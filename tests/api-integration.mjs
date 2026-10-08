// Run after `npm run build`; uses only a local, disposable Apps Script fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createFixture, fakeKey } from './helpers/apps-script-fixture.mjs';
import { hashPassword } from '../src/lib/server/password.mjs';
const fixture = createFixture();
const password = 'Local-test-only-2026!';
const hash = await hashPassword(password);
fixture.ss.getSheetByName('Pengguna').data[1][5] = hash;
const reporter = fixture.addUser('reporter-api@example.test', 'pelapor', hash);
const pic = fixture.addUser('pic-api@example.test', 'petugas', hash);
const mock = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  try { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(fixture.request(JSON.parse(raw)))); }
  catch { res.statusCode = 400; res.end('{}'); }
});
await new Promise((resolve) => mock.listen(4100, '127.0.0.1', resolve));
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100'], { env: { ...process.env, AUTH_PROVIDER: 'sheets', GOOGLE_SCRIPT_URL: 'http://127.0.0.1:4100', GOOGLE_SCRIPT_API_KEY: fakeKey }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; app.stdout.on('data', (chunk) => { output += chunk; }); app.stderr.on('data', (chunk) => { output += chunk; });
const origin = 'http://localhost:3100';
let cookie = '';
async function request(path, body, source = origin) {
  return fetch(origin + path, { headers: { Origin: source, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await fetch(origin); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, output);
  assert.equal((await request('/api/komplain')).status, 401);
  assert.equal((await request('/api/photo?id=invalid')).status, 401);
  cookie = `komplain_session=${'a'.repeat(64)}`;
  assert.equal((await request('/api/photo?id=invalid')).status, 401);
  cookie = '';
  assert.equal((await request('/api/auth/login', { email: 'admin@example.test', password: 'wrong' })).status, 401);
  assert.equal((await request('/api/auth/login', { email: 'admin@example.test', password }, 'https://foreign.example')).status, 403);
  const localIpLogin = await fetch('http://127.0.0.1:3100/api/auth/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3100', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password }) });
  assert.equal(localIpLogin.status, 200);
  const login = await request('/api/auth/login', { email: 'admin@example.test', password });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=lax/i); assert.match(header, /Secure/i);
  cookie = header.split(';')[0];
  assert.equal((await request('/api/auth/session')).status, 200);
  assert.equal((await request('/api/photo?id=invalid')).status, 400);
  const create = await request('/api/komplain', { action: 'create', requestId: randomUUID(), tanggal: '2026-10-03', dokter: 'Dokter Uji', team: 'Unit Uji', tindakan: 'Pemeriksaan', komplain: 'Masalah uji integrasi', statusCase: 'Ada Kendala', status: 'C3 - Moderate', jalanKeluar: '' });
  assert.equal(create.status, 200, JSON.stringify(await create.clone().json()));
  const list = await request('/api/komplain');
  assert.match(list.headers.get('cache-control'), /no-store/);
  assert.equal((await list.json()).data.length, 1);
  const loginAs = async (email) => {
    const response = await request('/api/auth/login', { email, password });
    assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie').split(';')[0];
  };
  let item = (await create.json()).data;
  assert.equal((await request('/api/komplain', { action: 'unknown' })).status, 400);
  assert.equal((await request('/api/komplain', { action: 'update', ...item, version: item.version - 1 })).status, 409);
  let response = await request('/api/komplain', { action: 'update', ...item, dokter: 'Dokter API Diedit', rumahSakit: 'RS Uji API' });
  assert.equal(response.status, 200); item = (await response.json()).data;
  let detail = await (await request(`/api/komplain?id=${encodeURIComponent(item.id)}`)).json();
  const edit = JSON.parse(detail.history.find((entry) => entry.aksi === 'Laporan diedit').detail);
  assert.equal(edit.before.dokter, 'Dokter Uji'); assert.equal(edit.after.dokter, 'Dokter API Diedit');
  response = await request('/api/komplain', { action: 'assign', id: item.id, version: item.version, picId: pic.user.id, tenggat: '2026-10-12', catatan: 'Penugasan API' });
  assert.equal(response.status, 200); item = (await response.json()).data;
  await loginAs(reporter.user.email);
  assert.equal((await request('/api/users')).status, 403);
  assert.equal((await request(`/api/komplain?id=${encodeURIComponent(item.id)}`)).status, 404);
  assert.equal((await request('/api/komplain', { action: 'assign', id: item.id, version: item.version, picId: reporter.user.id })).status, 404);
  await loginAs(pic.user.email);
  response = await request('/api/komplain', { action: 'followUp', id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: '' });
  assert.equal(response.status, 400);
  response = await request('/api/komplain', { action: 'followUp', id: item.id, version: item.version, statusPenanganan: 'Diproses', jalanKeluar: 'Sedang diperiksa', status: 'C3 - Moderate', penangananSelanjutnya: 'Koordinasi PIC' });
  assert.equal(response.status, 200); item = (await response.json()).data;
  response = await request('/api/komplain', { action: 'followUp', id: item.id, version: item.version, statusPenanganan: 'Selesai', jalanKeluar: 'Selesai melalui API', catatan: 'Hasil pemeriksaan selesai' });
  assert.equal(response.status, 200); item = (await response.json()).data; assert.equal(item.statusPenanganan, 'Selesai');
  await loginAs('admin@example.test');
  assert.equal((await request('/api/users')).status, 200);
  response = await request('/api/users', { action: 'createUser', nama: 'Akun API Uji', email: 'new-api@example.test', unit: 'Team API', role: 'pelapor', password });
  assert.equal(response.status, 200);
  const account = (await response.json()).user;
  response = await request('/api/users', { action: 'updateUser', id: account.id, nama: 'Akun API Diedit', email: account.email, unit: 'Team Baru', role: 'pelapor', active: true });
  assert.equal(response.status, 200);
  response = await request('/api/users', { action: 'resetPassword', id: account.id, password: '654321' });
  assert.equal(response.status, 200);
  response = await request('/api/auth/login', { email: account.email, password: '654321' });
  assert.equal(response.status, 200); assert.equal((await response.json()).user.mustChangePassword, true);
  cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/komplain')).status, 403);
  assert.equal((await request('/api/photo?id=invalid')).status, 403);
  response = await request('/api/auth/password', { currentPassword: '654321', password: '123456' });
  assert.equal(response.status, 200);
  assert.equal((await request('/api/auth/session')).status, 401);
  await loginAs('admin@example.test');

  response = await request('/api/komplain', { action: 'reopen', id: item.id, version: item.version, catatan: 'Perlu pemeriksaan lanjutan' });
  assert.equal(response.status, 200); item = (await response.json()).data; assert.equal(item.statusPenanganan, 'Baru');
  response = await request('/api/komplain', { action: 'delete', id: item.id, version: item.version });
  assert.equal(response.status, 200);
  assert.equal((await (await request('/api/komplain')).json()).data.length, 0);
  assert.equal((await request(`/api/komplain?id=${encodeURIComponent(item.id)}`)).status, 404);
  assert.ok(fixture.ss.getSheetByName('Riwayat').data.some((row) => row[1] === item.id && row[5] === 'Laporan diarsipkan'));

  assert.equal((await request('/api/auth/logout', {})).status, 200);
  assert.equal((await request('/api/komplain')).status, 401);
  if (process.env.TEST_INITIAL_ADMIN_PASSWORD) {
    fixture.ss.getSheetByName('Pengguna').data.splice(1);
    fixture.context.setupKomplainer();
    const initialPassword = process.env.TEST_INITIAL_ADMIN_PASSWORD;
    const initialLogin = await request('/api/auth/login', { email: 'lambangws', password: initialPassword });
    assert.equal(initialLogin.status, 200);
    assert.equal((await initialLogin.json()).user.mustChangePassword, true);
    cookie = initialLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/komplain')).status, 403);
    assert.equal((await request('/api/auth/password', { currentPassword: initialPassword, password })).status, 200);
    assert.equal((await request('/api/auth/session')).status, 401);
    assert.equal((await request('/api/auth/login', { email: 'lambangws', password: initialPassword })).status, 401);
    assert.equal((await request('/api/auth/login', { email: 'lambangws', password })).status, 200);
    console.log('Initial admin username and mandatory password change passed.');
  }
  console.log('API integration passed: login, origin protection, secure session, create/update/detail/history, version conflict, assign, PIC follow-up/completion, reopen/archive, account create/update/reset, six-character password change, photo authorization, role restrictions, logout revocation. No live Sheets used.');
} finally {
  app.kill('SIGTERM');
  await new Promise((resolve) => mock.close(resolve));
}
