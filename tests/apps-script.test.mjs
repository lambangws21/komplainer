import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, fakeHash } from './helpers/apps-script-fixture.mjs';

test('migration preserves old rows and headers and never selects the summary sheet', () => {
  const row = ['OLD-1', '2026-09-30', 'Dokter lama', 'Unit lama', 'Tindakan lama', 'Masalah lama', '', 'C1 - Critical'];
  const f = createFixture({ legacyRows: [row] });
  assert.deepEqual(f.data.data[1], row);
  assert.equal(f.data.data[0].length, 23);
  f.context.setupKomplainer();
  assert.equal(f.data.data[0].length, 23);
  const result = f.request({ action: 'list', ...f.adminSession });
  assert.equal(result.data[0].statusPenanganan, 'Baru');
  assert.equal(result.data[0].version, 1);
  assert.equal(f.properties.get('COMPLAINT_SHEET_NAME'), 'Data Komplain');
  f.context.generateWeeklySummary();
  assert.ok(f.ss.getSheetByName('Rekapan Mingguan'));
  assert.equal(f.request({ action: 'list', ...f.adminSession }).data[0].id, 'OLD-1');
  const pelapor = f.addUser('reporter@example.test');
  assert.equal(f.request({ action: 'list', ...pelapor }).data.length, 1);
  assert.equal(f.request({ action: 'list', ...pelapor }).data[0].restricted, true);
});
test('unauthenticated and forged-role requests cannot access reports', () => {
  const f = createFixture();
  assert.equal(JSON.parse(f.context.doGet().text).code, 401);
  assert.equal(f.request({ action: 'list', apiKey: 'wrong' }).code, 403);
  assert.equal(f.request({ action: 'list', role: 'admin' }).code, 401);
  const a = f.addUser('a@example.test');
  const b = f.addUser('b@example.test');
  const item = f.createReport(a).data;
  assert.equal(f.request({ action: 'list', ...b, role: 'admin' }).data.length, 1);
  assert.equal(f.request({ action: 'detail', ...b, id: item.id }).code, 404);
  assert.equal(f.request({ action: 'delete', ...b, id: item.id, version: 1, role: 'admin' }).code, 404);
});
test('assignment, follow-up, completion and reopen enforce permissions and versions', () => {
  const f = createFixture();
  const reporter = f.addUser('reporter@example.test');
  const pic = f.addUser('pic@example.test', 'petugas');
  const other = f.addUser('other@example.test', 'petugas');
  let item = f.createReport(reporter).data;
  assert.equal(item.jalanKeluar, '');
  assert.equal(item.pelaporId, reporter.user.id);
  assert.equal(f.request({ action: 'assign', ...reporter, id: item.id, version: item.version, picId: pic.user.id }).code, 403);
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id, tenggat: '2026-10-05' }).data;
  assert.equal(f.request({ action: 'list', ...pic }).data.length, 1);
  assert.equal(f.request({ action: 'list', ...other }).data.length, 1);
  assert.equal(f.request({ action: 'followUp', ...pic, id: item.id, version: 1, statusPenanganan: 'Selesai', jalanKeluar: 'Solusi', catatan: 'Selesai' }).code, 409);
  assert.equal(f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: '', catatan: 'Selesai' }).code, 400);
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', jalanKeluar: '', catatan: 'Mulai diperiksa' }).data;
  assert.equal(f.request({ action: 'update', ...reporter, ...item, tindakan: 'Perubahan' }).code, 403);
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: 'Masalah diperbaiki', catatan: 'Sudah diperiksa' }).data;
  assert.ok(item.selesaiPada);
  assert.equal(f.request({ action: 'reopen', ...pic, id: item.id, version: item.version, catatan: 'Masih bermasalah' }).code, 403);
  item = f.request({ action: 'reopen', ...reporter, id: item.id, version: item.version, catatan: 'Masalah muncul kembali' }).data;
  assert.equal(item.statusPenanganan, 'Baru');
  assert.equal(item.selesaiPada, '');
  const detail = f.request({ action: 'detail', ...reporter, id: item.id });
  assert.equal(detail.history.length, 5);
  assert.equal(detail.history[0].catatan, 'Masalah muncul kembali');
});
test('temporary password, revocation, last admin and active assignments are protected', () => {
  const f = createFixture();
  const result = f.request({ action: 'createUser', ...f.adminSession, nama: 'User', email: 'user@example.test', unit: 'Unit A', role: 'petugas', passwordHash: fakeHash });
  const temp = f.login(result.user.email);
  assert.equal(temp.user.mustChangePassword, true);
  assert.equal(f.request({ action: 'list', ...temp }).code, 403);
  assert.equal(f.request({ action: 'changePassword', ...temp, expectedHash: fakeHash, passwordHash: fakeHash }).status, 'success');
  assert.equal(f.request({ action: 'session', ...temp }).code, 401);
  const pic = f.login(result.user.email);
  const item = f.createReport(f.adminSession).data;
  f.request({ action: 'assign', ...f.adminSession, id: item.id, version: 1, picId: pic.user.id, tenggat: '' });
  assert.equal(f.request({ action: 'updateUser', ...f.adminSession, ...pic.user, role: 'pelapor', active: true }).code, 409);
  assert.equal(f.request({ action: 'updateUser', ...f.adminSession, ...f.admin, active: false }).code, 409);
  assert.equal(f.request({ action: 'bootstrap', nama: 'Another' }).code, 409);
  const users = f.request({ action: 'users', ...f.adminSession });
  assert.equal(JSON.stringify(users).includes('passwordHash'), false);
});
test('promoting a legacy pelapor-PIC to petugas does not require transferring their active case first', () => {
  const f = createFixture();
  const legacyDelegate = f.addUser('legacy-delegate@example.test');
  const owner = f.addUser('legacy-owner@example.test');
  f.createReport(owner);
  // Simulate pre-existing data from before delegation was restricted to petugas accounts.
  f.data.data[1][8] = 'Diproses';
  f.data.data[1][9] = legacyDelegate.user.id;
  assert.equal(f.request({ action: 'updateUser', ...f.adminSession, ...legacyDelegate.user, role: 'admin', active: true }).code, 409);
  assert.equal(f.request({ action: 'updateUser', ...f.adminSession, ...legacyDelegate.user, role: 'pelapor', active: false }).code, 409);
  assert.equal(f.request({ action: 'updateUser', ...f.adminSession, ...legacyDelegate.user, role: 'petugas', active: true }).status, 'success');
});
test('create retry is idempotent and spreadsheet formulas are escaped; archive preserves data', () => {
  const f = createFixture();
  const reporter = f.addUser('reporter@example.test');
  const requestId = randomUUID();
  const body = { requestId, komplain: '=IMPORTXML("https://example.test", "//x")', team: 'Unit B', statusPenanganan: 'Selesai', pelaporId: f.admin.id };
  const first = f.createReport(reporter, body).data;
  const second = f.createReport(reporter, body).data;
  assert.equal(first.id, second.id);
  assert.equal(f.request({ action: 'list', ...reporter }).data.length, 1);
  assert.equal(first.team, 'Unit B');
  assert.equal(first.statusPenanganan, 'Baru');
  assert.equal(first.pelaporId, reporter.user.id);
  assert.ok(f.data.data[1][5].startsWith("'="));
  assert.ok(first.komplain.startsWith('='));
  assert.equal(f.request({ action: 'delete', ...f.adminSession, id: first.id, version: 1 }).status, 'success');
  assert.equal(f.createReport(reporter, body).code, 409);
  assert.equal(f.request({ action: 'list', ...f.adminSession }).data.length, 0);
  assert.equal(f.data.getLastRow(), 2);
  assert.ok(f.data.data[1][17]);
});
test('authentication lookup is throttled and invalid dates are rejected', () => {
  const f = createFixture();
  for (let i = 0; i < 10; i++) assert.equal(f.request({ action: 'authLookup', email: 'admin@example.test' }).status, 'success');
  assert.equal(f.request({ action: 'authLookup', email: 'admin@example.test' }).code, 429);
  assert.equal(f.createReport(f.adminSession, { tanggal: '2026-02-30' }).code, 400);
});

test('setup creates every sheet and seeds initial admin once without resetting accounts', async () => {
  const { verifyPassword } = await import('../src/lib/server/password.mjs');
  const f = createFixture();
  const users = f.ss.getSheetByName('Pengguna');
  users.data.splice(1);
  f.context.setupKomplainer();
  for (const name of ['Pengguna', 'Sesi', 'Riwayat', 'Rekapan Mingguan']) assert.ok(f.ss.getSheetByName(name).data[0].length);
  assert.equal(users.data[1][1], 'lambangws');
  assert.equal(users.data[1][2], 'lambangws');
  assert.equal(users.data[1][3], 'admin');
  assert.equal(users.data[1][8], true);
  assert.match(users.data[1][5], /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  if (process.env.TEST_INITIAL_ADMIN_PASSWORD) {
    assert.ok(await verifyPassword(process.env.TEST_INITIAL_ADMIN_PASSWORD, users.data[1][5]));
    assert.ok(!users.data[1].includes(process.env.TEST_INITIAL_ADMIN_PASSWORD));
  }
  const lookup = f.request({ action: 'authLookup', email: 'LAMBANGWS' });
  assert.equal(lookup.passwordHash, users.data[1][5]);
  const session = f.login('lambangws', lookup.passwordHash);
  assert.equal(f.request({ action: 'list', ...session }).code, 403);
  users.data[1][5] = fakeHash;
  users.data[1][8] = false;
  f.context.setupKomplainer();
  assert.equal(users.data.length, 2);
  assert.equal(users.data[1][5], fakeHash);
  assert.equal(users.data[1][8], false);
  users.data.splice(1);
  f.context.setupKomplainer();
  assert.equal(users.data.length, 1);
});

test('authenticated requests create missing sheets and extend legacy summary headers without erasing rows', () => {
  const f = createFixture();
  const summary = f.ss.getSheetByName('Rekapan Mingguan');
  summary.data[0] = summary.data[0].slice(0, 6);
  const old = ['2026-09-28', 1, 0, 0, 1, 0];
  summary.appendRow(old);
  f.ss.getSheets().splice(f.ss.getSheets().findIndex((sheet) => sheet.name === 'Riwayat'), 1);
  assert.equal(f.request({ action: 'session', ...f.adminSession }).status, 'success');
  assert.ok(f.ss.getSheetByName('Riwayat'));
  assert.equal(summary.data[0].length, 14);
  assert.deepEqual(summary.data[1], old);
  f.properties.set('COMPLAINT_SHEET_NAME', 'Komplain Baru');
  f.context.ensureSchema();
  assert.equal(f.ss.getSheetByName('Komplain Baru').data[0].length, 23);
  f.data.maxColumns = 8;
  f.context.ensureHeaders(f.data);
  assert.equal(f.data.maxColumns, 23);
  const users = f.ss.getSheetByName('Pengguna');
  users.data[0] = users.data[0].slice(0, 8);
  users.data[1] = users.data[1].slice(0, 8);
  f.context.ensureSchema();
  assert.equal(users.data[0].length, 9);
});

test('setup generates missing or short API key and preserves a valid key on rerun', () => {
  const f = createFixture();
  f.properties.delete('APP_API_KEY');
  f.context.setupKomplainer();
  const generated = f.properties.get('APP_API_KEY');
  assert.match(generated, /^[a-f0-9]{64}$/);
  f.context.setupKomplainer();
  assert.equal(f.properties.get('APP_API_KEY'), generated);
  f.properties.set('APP_API_KEY', 'short');
  f.context.setupKomplainer();
  assert.match(f.properties.get('APP_API_KEY'), /^[a-f0-9]{64}$/);
  assert.notEqual(f.properties.get('APP_API_KEY'), generated);
});

test('admin assigns a petugas as PIC without changing their account role', async () => {
  const { canFollowUp } = await import('../src/app/komplain/workflow.mjs');
  const f = createFixture();
  const owner = f.addUser('owner@example.test');
  const pic = f.addUser('pic@example.test', 'petugas');
  const other = f.addUser('other@example.test', 'petugas');
  let item = f.createReport(owner).data;
  assert.ok(f.request({ action: 'list', ...f.adminSession }).assignees.some((user) => user.id === pic.user.id));
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: 1, picId: pic.user.id }).data;
  assert.equal(item.picRole, 'petugas');
  assert.equal(item.pelaporRole, 'pelapor');
  const assignedRow = f.request({ action: 'list', ...pic }).data[0];
  assert.equal(assignedRow.picRole, 'petugas');
  assert.equal('passwordHash' in assignedRow, false);
  assert.equal(f.request({ action: 'session', ...pic }).user.role, 'petugas');
  assert.equal(f.request({ action: 'followUp', ...owner, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'Bukan PIC' }).code, 403);
  assert.equal(canFollowUp(item, pic.user), true);
  assert.equal(canFollowUp(item, other.user), false);
  assert.equal(f.request({ action: 'followUp', ...other, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'Tidak berwenang' }).code, 403);
  assert.equal(f.request({ action: 'updateUser', ...f.adminSession, ...pic.user, active: false }).code, 409);
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'Diperiksa' }).data;
  assert.equal(item.statusPenanganan, 'Diproses');
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: other.user.id }).data;
  assert.equal(item.picId, other.user.id);
  assert.equal(f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: 'Solusi', catatan: 'Selesai' }).code, 403);
  item = f.request({ action: 'followUp', ...other, id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: 'Sudah diperbaiki', catatan: 'Selesai' }).data;
  assert.equal(item.statusPenanganan, 'Selesai');
});

test('pelapor accounts are excluded from the PIC pool and cannot be assigned as PIC', async () => {
  const f = createFixture();
  const owner = f.addUser('owner-only@example.test');
  const reporter = f.addUser('reporter-only@example.test');
  const item = f.createReport(owner).data;
  assert.equal(f.request({ action: 'list', ...f.adminSession }).assignees.some((user) => user.id === reporter.user.id), false);
  assert.equal(f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: reporter.user.id }).code, 400);
});


test('reporter can set and edit a report team without changing account unit or access', () => {
  const f = createFixture();
  const reporter = f.addUser('reporter@example.test');
  const other = f.addUser('other@example.test');
  assert.equal(f.createReport(reporter, { team: '   ' }).code, 400);
  assert.equal(f.createReport(reporter, { team: 'x'.repeat(201) }).code, 400);
  let item = f.createReport(reporter, { team: '  Unit Baru  ' }).data;
  assert.equal(item.team, 'Unit Baru');
  item = f.request({ action: 'update', ...reporter, ...item, team: 'Unit Revisi' }).data;
  assert.equal(item.team, 'Unit Revisi');
  assert.equal(f.request({ action: 'session', ...reporter }).user.unit, 'Unit A');
  assert.equal(f.request({ action: 'list', ...other }).data.length, 1);
  assert.equal(f.request({ action: 'update', ...other, ...item, team: 'Unit Lain' }).code, 404);
});

test('hospital persists through create, edit and follow-up and old clients preserve it', () => {
  const f = createFixture();
  let item = f.createReport(f.adminSession, { rumahSakit: 'RS Harapan' }).data;
  assert.equal(item.rumahSakit, 'RS Harapan');
  assert.equal(f.data.data[0][19], 'Rumah Sakit');
  assert.equal(f.data.data[1][19], 'RS Harapan');
  item = f.request({ ...item, ...f.adminSession, action: 'update', rumahSakit: 'RS Sehat' }).data;
  assert.equal(item.rumahSakit, 'RS Sehat');
  const oldBody = { ...item };
  delete oldBody.rumahSakit;
  item = f.request({ ...oldBody, ...f.adminSession, action: 'update' }).data;
  assert.equal(item.rumahSakit, 'RS Sehat');
  const pic = f.addUser('hospital-pic@example.test', 'petugas');
  item = f.request({ ...f.adminSession, action: 'assign', id: item.id, version: item.version, picId: pic.user.id }).data;
  item = f.request({ ...pic, action: 'followUp', id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: 'Alat diganti dan diuji', catatan: 'Verifikasi selesai' }).data;
  assert.equal(item.rumahSakit, 'RS Sehat');
  assert.equal(item.jalanKeluar, 'Alat diganti dan diuji');
  assert.equal(f.request({ ...f.adminSession, action: 'detail', id: item.id }).data.rumahSakit, 'RS Sehat');
});

test('non-owners see status-only summaries, never report content, in list results', () => {
  const f = createFixture();
  const owner = f.addUser('owner@example.test');
  const stranger = f.addUser('stranger@example.test');
  const item = f.createReport(owner, { dokter: 'dr. Rahasia', komplain: 'Isi rahasia' }).data;
  const summary = f.request({ action: 'list', ...stranger }).data[0];
  assert.equal(summary.id, item.id);
  assert.equal(summary.restricted, true);
  assert.equal(summary.status, item.status);
  assert.equal(summary.statusCase, item.statusCase);
  assert.equal(summary.statusPenanganan, item.statusPenanganan);
  assert.equal('dokter' in summary, false);
  assert.equal('komplain' in summary, false);
  assert.equal('jalanKeluar' in summary, false);
  assert.equal('pelaporNama' in summary, false);
  const full = f.request({ action: 'list', ...owner }).data[0];
  assert.equal(full.restricted, undefined);
  assert.equal(full.dokter, 'dr. Rahasia');
});
test('report owner can delete their own untouched report, but not once handling has started', () => {
  const f = createFixture();
  const owner = f.addUser('owner@example.test');
  const stranger = f.addUser('stranger@example.test');
  const item = f.createReport(owner).data;
  assert.equal(f.request({ action: 'delete', ...stranger, id: item.id, version: item.version }).code, 404);
  assert.equal(f.request({ action: 'delete', ...owner, id: item.id, version: item.version }).status, 'success');
  const second = f.createReport(owner).data;
  const pic = f.addUser('pic@example.test', 'petugas');
  const assigned = f.request({ action: 'assign', ...f.adminSession, id: second.id, version: second.version, picId: pic.user.id }).data;
  const inProgress = f.request({ action: 'followUp', ...pic, id: assigned.id, version: assigned.version, statusPenanganan: 'Diproses', catatan: 'Mulai' }).data;
  assert.equal(f.request({ action: 'delete', ...owner, id: inProgress.id, version: inProgress.version }).code, 403);
  assert.equal(f.request({ action: 'delete', ...f.adminSession, id: inProgress.id, version: inProgress.version }).status, 'success');
});
test('every petugas can read full report content, not just assigned cases', () => {
  const f = createFixture();
  const owner = f.addUser('owner@example.test');
  const unassignedPetugas = f.addUser('triage@example.test', 'petugas');
  const item = f.createReport(owner, { dokter: 'dr. Rahasia', komplain: 'Isi rahasia' }).data;
  const seen = f.request({ action: 'list', ...unassignedPetugas }).data[0];
  assert.equal(seen.restricted, undefined);
  assert.equal(seen.dokter, 'dr. Rahasia');
  assert.equal(seen.komplain, 'Isi rahasia');
  assert.equal(f.request({ action: 'detail', ...unassignedPetugas, id: item.id }).status, 'success');
});
test('a petugas can self-assign an unassigned case but not take over an already-assigned one', () => {
  const f = createFixture();
  const owner = f.addUser('owner@example.test');
  const firstResponder = f.addUser('first@example.test', 'petugas');
  const latecomer = f.addUser('late@example.test', 'petugas');
  const item = f.createReport(owner).data;
  assert.equal(f.request({ action: 'assign', ...latecomer, id: item.id, version: item.version, picId: owner.user.id }).code, 403);
  let assigned = f.request({ action: 'assign', ...firstResponder, id: item.id, version: item.version, picId: firstResponder.user.id }).data;
  assert.equal(assigned.picId, firstResponder.user.id);
  assert.equal(f.request({ action: 'assign', ...latecomer, id: assigned.id, version: assigned.version, picId: latecomer.user.id }).code, 403);
  assigned = f.request({ action: 'followUp', ...firstResponder, id: assigned.id, version: assigned.version, statusPenanganan: 'Diproses', catatan: 'Ditangani' }).data;
  assert.equal(assigned.statusPenanganan, 'Diproses');
});
test('PIC can set the next-handling plan while following up on a case', () => {
  const f = createFixture();
  const owner = f.addUser('owner@example.test');
  const pic = f.addUser('pic@example.test', 'petugas');
  let item = f.createReport(owner).data;
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id }).data;
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'Mulai', penangananSelanjutnya: 'Audit SLA bulanan' }).data;
  assert.equal(item.penangananSelanjutnya, 'Audit SLA bulanan');
});
test('existing nineteen-column sheet gains hospital header without shifting report data', () => {
  const f = createFixture();
  const created = f.createReport(f.adminSession).data;
  f.data.data[0].pop();
  f.data.data[1].pop();
  const original = [...f.data.data[1]];
  const result = f.request({ ...f.adminSession, action: 'detail', id: created.id });
  assert.equal(result.status, 'success');
  assert.deepEqual(f.data.data[1], original);
  assert.equal(f.data.data[0][19], 'Rumah Sakit');
  assert.equal(result.data.rumahSakit, '');
  assert.equal(result.data.version, created.version);
});
test('photos are uploaded to Drive on create, appended on update, and attached to follow-up history entries', () => {
  const f = createFixture();
  const owner = f.addUser('owner-photo@example.test');
  const pic = f.addUser('pic-photo@example.test', 'petugas');
  const photo = (name) => ({ base64: Buffer.from(`fake-bytes-${name}`).toString('base64'), mimeType: 'image/jpeg', filename: `${name}.jpg` });
  let item = f.createReport(owner, { photos: [photo('a')] }).data;
  assert.equal(item.fotoUrls.length, 1);
  assert.match(item.fotoUrls[0], /^https:\/\/drive\.google\.com\/uc\?export=view&id=/);
  assert.equal(f.driveFiles[0].sharing.access, 'ANYONE_WITH_LINK');
  item = f.request({ action: 'update', ...owner, ...item, photos: [photo('b')] }).data;
  assert.equal(item.fotoUrls.length, 2);
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id }).data;
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'Diperiksa', photos: [photo('c')] }).data;
  assert.equal(item.fotoUrls.length, 2);
  const detail = f.request({ action: 'detail', ...pic, id: item.id });
  assert.equal(detail.history[0].fotoUrls.length, 1);
  assert.match(detail.history[0].fotoUrls[0], /^https:\/\/drive\.google\.com\/uc\?export=view&id=/);
});
test('photo uploads reject unsupported types, oversized files, and too many files per submit', () => {
  const f = createFixture();
  const owner = f.addUser('owner-photo-limits@example.test');
  const big = Buffer.alloc(6 * 1024 * 1024, 1).toString('base64');
  assert.equal(f.createReport(owner, { photos: [{ base64: Buffer.from('x').toString('base64'), mimeType: 'application/pdf', filename: 'f.pdf' }] }).code, 400);
  assert.equal(f.createReport(owner, { photos: [{ base64: big, mimeType: 'image/jpeg', filename: 'big.jpg' }] }).code, 400);
  const sixPhotos = Array.from({ length: 6 }, (_, index) => ({ base64: Buffer.from(`p${index}`).toString('base64'), mimeType: 'image/jpeg', filename: `p${index}.jpg` }));
  assert.equal(f.createReport(owner, { photos: sixPhotos }).code, 400);
});
test('reporter classifies outcome as Sukses/Ada Kendala; severity starts blank and is PIC-only', () => {
  const f = createFixture();
  const reporter = f.addUser('status-case@example.test');
  const pic = f.addUser('status-case-pic@example.test', 'petugas');
  assert.equal(f.createReport(reporter, { statusCase: 'Tidak Valid' }).code, 400);
  // A client-supplied severity at creation is ignored — only the PIC can set it.
  let item = f.createReport(reporter, { statusCase: 'Sukses', status: 'C1 - Critical' }).data;
  assert.equal(item.statusCase, 'Sukses');
  assert.equal(item.status, '');
  // The reporter's own edit (still Baru) cannot set severity even if they send one.
  item = f.request({ action: 'update', ...reporter, ...item, status: 'C4 - Minor' }).data;
  assert.equal(item.status, '');
  assert.equal(f.request({ action: 'update', ...reporter, ...item, statusCase: 'Bukan Opsi' }).code, 400);
  // The PIC sets/revises severity while taking on and resolving the case.
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id, status: 'C2 - Major' }).data;
  assert.equal(item.status, 'C2 - Major');
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'Ditinjau', status: 'C1 - Critical' }).data;
  assert.equal(item.status, 'C1 - Critical');
});
test("a report's total photos across create and every follow-up are capped at MAX_PHOTOS_TOTAL", () => {
  const f = createFixture();
  const reporter = f.addUser('photo-cap@example.test');
  const pic = f.addUser('photo-cap-pic@example.test', 'petugas');
  const photos = (n, prefix) => Array.from({ length: n }, (_, index) => ({ base64: Buffer.from(`${prefix}${index}`).toString('base64'), mimeType: 'image/jpeg', filename: `${prefix}${index}.jpg` }));
  let item = f.createReport(reporter, { photos: photos(5, 'a') }).data;
  assert.equal(item.fotoUrls.length, 5);
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id }).data;
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'batch 1', photos: photos(5, 'b') }).data;
  item = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'batch 2', photos: photos(5, 'c') }).data;
  const detail = f.request({ action: 'detail', ...pic, id: item.id });
  const historyTotal = detail.history.reduce((sum, entry) => sum + (entry.fotoUrls?.length || 0), 0);
  assert.equal(item.fotoUrls.length + historyTotal, 15);
  const overCap = f.request({ action: 'followUp', ...pic, id: item.id, version: item.version, statusPenanganan: 'Diproses', catatan: 'batch 3', photos: photos(1, 'd') });
  assert.equal(overCap.code, 400);
  assert.match(overCap.message, /batas maksimal/);
});
test('audit history records severity and status case before/after values', () => {
  const f = createFixture();
  const reporter = f.addUser('audit-trail@example.test');
  const pic = f.addUser('audit-trail-pic@example.test', 'petugas');
  let item = f.createReport(reporter, { statusCase: 'Ada Kendala' }).data;
  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id, status: 'C2 - Major' }).data;
  const detail = f.request({ action: 'detail', ...pic, id: item.id });
  const assignEntry = detail.history.find((entry) => entry.aksi === 'PIC / tenggat diperbarui');
  const parsed = JSON.parse(assignEntry.detail);
  assert.equal(parsed.before.status, '');
  assert.equal(parsed.after.status, 'C2 - Major');
  assert.equal(parsed.before.statusCase, 'Ada Kendala');
  assert.equal(parsed.after.statusCase, 'Ada Kendala');
});
test('weekly summary tracks Status Case counts alongside severity and workflow counts', () => {
  const f = createFixture();
  f.context.generateWeeklySummary();
  const summary = f.ss.getSheetByName('Rekapan Mingguan');
  assert.deepEqual(summary.data[0].slice(-2), ['Sukses', 'Ada Kendala']);
  assert.equal(summary.data[1].length, summary.data[0].length);
});
test('throttle supports a custom limit/window/bucket independent of the default login bucket', () => {
  const f = createFixture();
  for (let i = 0; i < 3; i++) f.context.throttle('user-x', 3, 60, 'report');
  assert.throws(() => f.context.throttle('user-x', 3, 60, 'report'), /Terlalu banyak percobaan/);
  // Same name, default 'login' bucket — unaffected by the 'report' bucket above.
  f.context.throttle('user-x', 10, 900);
});
test('audit history records which fields changed on edit, and PIC name alongside PIC id on assign', () => {
  const f = createFixture();
  const reporter = f.addUser('audit-fields@example.test');
  const pic = f.addUser('audit-fields-pic@example.test', 'petugas');
  let item = f.createReport(reporter, { dokter: 'Dokter Awal', tindakan: 'Tindakan Awal' }).data;
  item = f.request({ action: 'update', ...reporter, ...item, dokter: 'Dokter Baru', tindakan: 'Tindakan Awal' }).data;
  let detail = f.request({ action: 'detail', ...reporter, id: item.id });
  let editEntry = detail.history.find((entry) => entry.aksi === 'Laporan diedit');
  assert.deepEqual(JSON.parse(editEntry.detail).fields, ['dokter']);
  assert.equal(JSON.parse(editEntry.detail).before.dokter, 'Dokter Awal');
  assert.equal(JSON.parse(editEntry.detail).after.dokter, 'Dokter Baru');
  assert.equal(JSON.parse(editEntry.detail).after.tindakan, 'Tindakan Awal');

  item = f.request({ action: 'assign', ...f.adminSession, id: item.id, version: item.version, picId: pic.user.id }).data;
  detail = f.request({ action: 'detail', ...pic, id: item.id });
  const assignEntry = detail.history.find((entry) => entry.aksi === 'PIC / tenggat diperbarui');
  const parsed = JSON.parse(assignEntry.detail);
  assert.equal(parsed.before.picNama, '');
  assert.equal(parsed.after.picNama, pic.user.nama);
});
test('report creation is rate-limited per user', () => {
  const f = createFixture();
  const reporter = f.addUser('rate-limited@example.test');
  for (let i = 0; i < 30; i++) assert.equal(f.createReport(reporter).status, 'success');
  assert.equal(f.createReport(reporter).code, 429);
});
