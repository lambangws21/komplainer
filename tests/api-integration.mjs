// Run after `npm run build`; uses only a local, disposable Apps Script fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createFixture, fakeKey } from './helpers/apps-script-fixture.mjs';
import { hashPassword } from '../src/lib/server/password.mjs';
const fixture = createFixture();
const password = 'Local-test-only-2026!';
fixture.ss.getSheetByName('Pengguna').data[1][5] = await hashPassword(password);
const mock = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  try { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(fixture.request(JSON.parse(raw)))); }
  catch { res.statusCode = 400; res.end('{}'); }
});
await new Promise((resolve) => mock.listen(4100, '127.0.0.1', resolve));
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100'], { env: { ...process.env, GOOGLE_SCRIPT_URL: 'http://127.0.0.1:4100', GOOGLE_SCRIPT_API_KEY: fakeKey }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  assert.equal((await request('/api/auth/login', { email: 'admin@example.test', password: 'wrong' })).status, 401);
  assert.equal((await request('/api/auth/login', { email: 'admin@example.test', password }, 'https://foreign.example')).status, 403);
  const login = await request('/api/auth/login', { email: 'admin@example.test', password });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=lax/i); assert.match(header, /Secure/i);
  cookie = header.split(';')[0];
  assert.equal((await request('/api/auth/session')).status, 200);
  const create = await request('/api/komplain', { action: 'create', requestId: randomUUID(), tanggal: '2026-10-03', dokter: 'Dokter Uji', team: 'Unit Uji', tindakan: 'Pemeriksaan', komplain: 'Masalah uji integrasi', status: 'C3 - Moderate', jalanKeluar: '' });
  assert.equal(create.status, 200, JSON.stringify(await create.clone().json()));
  const list = await request('/api/komplain');
  assert.match(list.headers.get('cache-control'), /no-store/);
  assert.equal((await list.json()).data.length, 1);
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
  console.log('API integration passed: login, origin protection, secure session, create/list, logout revocation. No live Sheets used.');
} finally {
  app.kill('SIGTERM');
  await new Promise((resolve) => mock.close(resolve));
}
