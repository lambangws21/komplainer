// Disposable local UI harness. All report mutations stay in an in-memory Sheet fixture.
import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { createFixture, fakeKey } from './helpers/apps-script-fixture.mjs';
import { hashPassword } from '../src/lib/server/password.mjs';
const fixture = createFixture();
const password = 'Local-test-only-2026!';
const hash = await hashPassword(password);
fixture.ss.getSheetByName('Pengguna').data[1][5] = hash;
const reporter = fixture.addUser('reporter@example.test', 'pelapor', hash);
const pic = fixture.addUser('pic@example.test', 'petugas', hash);
fixture.createReport(reporter, { tanggal: '2026-10-08', dokter: 'Dr. Nama Dokter Panjang untuk Pemeriksaan Mobile', rumahSakit: 'Rumah Sakit Uji dengan Nama Panjang', team: 'Team Pelapor Uji Mobile', tindakan: 'TKR Zimmer', komplain: 'Masalah uji mobile. '.repeat(20), jalanKeluar: 'Respons awal untuk menguji teks panjang tanpa kehilangan isi. '.repeat(8), penangananSelanjutnya: 'Koordinasikan instrumen dan lakukan pemeriksaan lanjutan.' });
let other = fixture.createReport(reporter, { tanggal: '2026-10-07', dokter: 'Dokter Penugasan Uji', rumahSakit: 'RS Uji', tindakan: 'THR Zimmer' }).data;
fixture.request({ action: 'assign', ...fixture.adminSession, id: other.id, version: other.version, picId: pic.user.id, tenggat: '2026-10-09', catatan: 'Penugasan uji lokal' });
let failNext = false;
const mock = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/audit/fail-next') { failNext = true; res.end('{"ok":true}'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw);
    if (failNext && !['authLookup', 'login', 'session'].includes(body.action)) { failNext = false; res.end(JSON.stringify({ status: 'error', code: 502, message: 'Gangguan jaringan uji lokal. Coba lagi.' })); return; }
    res.end(JSON.stringify(fixture.request(body)));
  } catch { res.statusCode = 400; res.end('{}'); }
});
await new Promise((resolve) => mock.listen(4105, '127.0.0.1', resolve));
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3106'], { env: { ...process.env, AUTH_PROVIDER: 'sheets', DATA_PROVIDER: 'apps-script', FIREBASE_BACKUP_ENABLED: 'false', GOOGLE_SCRIPT_URL: 'http://127.0.0.1:4105', GOOGLE_SCRIPT_API_KEY: fakeKey }, stdio: ['ignore', 'pipe', 'pipe'] });
app.stdout.pipe(process.stdout); app.stderr.pipe(process.stderr);
// These optional Firebase-only notices are empty in the Sheets UI fixture. Keep
// tests isolated from real Firebase and avoid ending a valid fixture session.
const frontend = createServer((req, res) => {
  if (req.method === 'GET' && ['/api/announcements', '/api/mentions'].includes(req.url?.split('?')[0])) {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ status: 'success', data: [] })); return;
  }
  const upstream = httpRequest({ hostname: '127.0.0.1', port: 3106, path: req.url, method: req.method, headers: req.headers }, (response) => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('UI fixture is starting.'); });
  req.pipe(upstream);
});
await new Promise((resolve) => frontend.listen(3105, '127.0.0.1', resolve));
console.log('Local audit fixture: http://localhost:3105/komplain; admin@example.test / reporter@example.test / pic@example.test. Only disposable local data.');
let closing = false;
async function close() { if (closing) return; closing = true; app.kill('SIGTERM'); frontend.close(); mock.close(); }
process.on('SIGTERM', close); process.on('SIGINT', close); app.on('exit', () => { frontend.close(); mock.close(); });
