import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSolution, handlingSolution, handlingDraft, mergeEditable } from '../src/app/komplain/report-process.mjs';
import { mutateReport } from '../src/lib/server/firestore-domain.mjs';
const reporter = { id: 'reporter', role: 'pelapor', active: true };
const pic = { id: 'pic', role: 'petugas', active: true };
const admin = { id: 'admin', role: 'admin', active: true };
const accounts = [reporter, pic, admin];
const now = '2026-10-09T00:00:00Z';
const create = () => mutateReport('create', { requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', tanggal: '2026-10-09', dokter: 'Dokter', rumahSakit: 'RS', team: 'TS', tindakan: 'TKR', komplain: 'Masalah', statusCase: 'Ada Kendala', jalanKeluar: 'Saran awal pelapor' }, null, reporter, accounts, [], now).item;

test('PIC starts with an empty resolution while reporter solution remains readable', () => {
  const item = create();
  assert.equal(initialSolution(item), 'Saran awal pelapor');
  assert.equal(handlingSolution(item), '');
  assert.equal(handlingDraft(item).jalanKeluar, '');
  assert.equal(initialSolution(null), '');
});
test('follow-up preserves initial solution, enforces severity and records waiting/completion', () => {
  let item = create();
  item = mutateReport('assign', { version: item.version, picId: pic.id }, item, admin, accounts, [], now).item;
  assert.throws(() => mutateReport('followUp', { version: item.version, statusPenanganan: 'Diproses', jalanKeluar: '' }, item, pic, accounts, [], now), /keparahan/);
  assert.throws(() => mutateReport('followUp', { version: item.version, status: 'C3 - Moderate', statusPenanganan: 'Selesai', jalanKeluar: '' }, item, pic, accounts, [], now), /Solusi/);
  item = mutateReport('followUp', { version: item.version, status: 'C3 - Moderate', statusPenanganan: 'Menunggu', jalanKeluar: '', penangananSelanjutnya: 'Menunggu konfirmasi' }, item, pic, accounts, [], now).item;
  assert.equal(item.statusPenanganan, 'Menunggu');
  assert.equal(initialSolution(item), 'Saran awal pelapor');
  assert.equal(handlingSolution(item), '');
  item = mutateReport('followUp', { version: item.version, statusPenanganan: 'Selesai', jalanKeluar: 'Instrumen diganti dan diuji' }, item, pic, accounts, [], now).item;
  assert.equal(initialSolution(item), 'Saran awal pelapor');
  assert.equal(handlingSolution(item), 'Instrumen diganti dan diuji');
  const updated = mutateReport('update', { ...item, jalanKeluar: 'Koreksi solusi awal' }, item, admin, accounts, [], now).item;
  assert.equal(initialSolution(updated), 'Koreksi solusi awal');
  assert.equal(handlingSolution(updated), 'Instrumen diganti dan diuji');
});
test('legacy handling text is never auto-promoted from initial solution', () => {
  assert.equal(initialSolution({ statusPenanganan: 'Baru', jalanKeluar: 'Awal' }), 'Awal');
  assert.equal(handlingSolution({ statusPenanganan: 'Baru', jalanKeluar: 'Awal' }), '');
  assert.equal(handlingSolution({ statusPenanganan: 'Selesai', jalanKeluar: 'Hasil lama' }), 'Hasil lama');
});
test('conflict recovery adopts untouched remote fields but preserves overlapping edits', () => {
  const result = mergeEditable({ dokter: 'A', komplain: 'Awal', jalanKeluar: '' }, { dokter: 'A', komplain: 'Edit saya', jalanKeluar: 'Solusi saya' }, { dokter: 'B', komplain: 'Edit orang lain', jalanKeluar: '' });
  assert.deepEqual(result.merged, { dokter: 'B', komplain: 'Edit saya', jalanKeluar: 'Solusi saya' });
  assert.deepEqual(result.conflicts, [{ key: 'komplain', local: 'Edit saya', latest: 'Edit orang lain' }]);
});
