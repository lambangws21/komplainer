import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import vm from 'node:vm';

class Sheet {
  constructor(name, data = []) { this.name = name; this.data = data.map((row) => [...row]); this.maxColumns = 26; }
  getMaxColumns() { return this.maxColumns; }
  insertColumnsAfter(position, count) { this.maxColumns += count; return this; }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return Math.max(0, ...this.data.map((row) => row.length)); }
  getRange(row, column, height = 1, width = 1) {
    const range = {
      getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => this.data[row - 1 + r]?.[column - 1 + c] ?? '')),
      setValues: (values) => { for (let r = 0; r < height; r++) { while (this.data.length < row + r) this.data.push([]); for (let c = 0; c < width; c++) this.data[row - 1 + r][column - 1 + c] = values[r][c]; } return range; },
      setValue: (value) => range.setValues([[value]]),
      setFontWeight: () => range, setBackground: () => range,
    };
    return range;
  }
  appendRow(row) { this.data.push([...row]); }
  deleteRow(row) { this.data.splice(row - 1, 1); }
  setFrozenRows() {}
}
export const fakeHash = `scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`;
export const fakeKey = 'test-only-key-'.padEnd(48, 'x');
export function createFixture({ legacyRows = [] } = {}) {
  const headers = ['ID', 'Tanggal', 'Dokter', 'Team', 'Tindakan', 'Komplain', 'Jalan Keluar', 'Status'];
  const data = new Sheet('Data Komplain', [headers, ...legacyRows]);
  const sheets = [data];
  const properties = new Map([['APP_API_KEY', fakeKey]]);
  const cache = new Map();
  const ss = {
    getSheets: () => sheets,
    getSheetByName: (name) => sheets.find((sheet) => sheet.name === name),
    insertSheet: (name) => { const sheet = new Sheet(name); sheets.push(sheet); return sheet; },
    getSpreadsheetTimeZone: () => 'Asia/Makassar',
  };
  let held = false;
  const context = vm.createContext({
    console, Date,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key) || null, setProperty: (key, value) => properties.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { held = true; }, tryLock: () => { held = true; return true; }, hasLock: () => held, releaseLock: () => { held = false; } }) },
    CacheService: { getScriptCache: () => ({ get: (key) => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    Utilities: {
      getUuid: randomUUID, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, value) => createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: (value) => Buffer.from(value).toString('base64url'),
      formatDate: (date, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; } }) },
  });
  vm.runInContext(readFileSync(new URL('../../docs/appscript.gs', import.meta.url), 'utf8'), context);
  context.DATA_ONLY = false;
  context.ensureSchema();
  const request = (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ apiKey: fakeKey, ...body }) } }).text);
  function login(email, hash = fakeHash) {
    const sessionHash = createHash('sha256').update(randomUUID()).digest('hex');
    const result = request({ action: 'login', email, expectedHash: hash, sessionHash, expiresAt: new Date(Date.now() + 3600000).toISOString() });
    if (result.status !== 'success') throw new Error(result.message);
    return { user: result.user, sessionHash };
  }
  const admin = request({ action: 'bootstrap', nama: 'Admin Uji', email: 'admin@example.test', unit: 'Pusat', passwordHash: fakeHash }).user;
  const adminSession = login(admin.email);
  function addUser(email, role = 'pelapor', hash = fakeHash) {
    const result = request({ action: 'createUser', ...adminSession, nama: email.split('@')[0], email, role, unit: 'Unit A', passwordHash: hash });
    if (result.status !== 'success') throw new Error(result.message);
    // Tests that are not about first login may complete the initial password change directly.
    const sheet = ss.getSheetByName('Pengguna');
    const row = sheet.data.find((row) => row[0] === result.user.id);
    row[8] = false;
    return login(email, hash);
  }
  const createReport = (session, overrides = {}) => request({ action: 'create', ...session, requestId: randomUUID(), tanggal: '2026-10-03', dokter: 'Dokter Uji', team: 'Unit A', tindakan: 'Pemeriksaan', komplain: 'Masalah uji', jalanKeluar: '', status: 'C3 - Moderate', ...overrides });
  return { context, request, data, ss, properties, login, admin, adminSession, addUser, createReport };
}
