/**
 * Komplainer v2 — bound to the existing Google Spreadsheet.
 * Setup: Script Properties APP_API_KEY (same as GOOGLE_SCRIPT_API_KEY in Vercel),
 * optionally COMPLAINT_SHEET_NAME. Run setupKomplainer(), then deploy a NEW web-app version.
 * The first eight columns remain compatible with v1. Never use getActiveSheet for data requests.
 * Production DATA_ONLY mode: Firebase owns accounts; trusted Next.js server sends verified context.
 */
// Firebase handles every account; set false only for legacy migration tests.
var DATA_ONLY = true;
var FIREBASE_DIRECTORY = null;
var LEGACY_HEADERS = ['ID', 'Tanggal', 'Dokter', 'Team', 'Tindakan', 'Komplain', 'Jalan Keluar', 'Status'];
var HEADERS = LEGACY_HEADERS.concat(['Status Penanganan', 'PIC ID', 'PIC Nama', 'Tenggat', 'Pelapor ID', 'Pelapor Nama', 'Dibuat Pada', 'Diperbarui Pada', 'Selesai Pada', 'Dihapus Pada', 'Versi', 'Rumah Sakit', 'Penanganan Selanjutnya']);
var USER_HEADERS = ['ID', 'Nama', 'Email', 'Role', 'Unit', 'Password Hash', 'Aktif', 'Dibuat Pada', 'Wajib Ganti Password'];
var SESSION_HEADERS = ['Token Hash', 'User ID', 'Expires At'];
var HISTORY_HEADERS = ['ID', 'Komplain ID', 'Tanggal', 'User ID', 'Nama', 'Aksi', 'Catatan', 'Detail'];
var LEVELS = ['C1 - Critical', 'C2 - Major', 'C3 - Moderate', 'C4 - Minor'];
var WORKFLOW = ['Baru', 'Diproses', 'Menunggu', 'Selesai'];
var ROLES = ['pelapor', 'petugas', 'admin'];
var SUMMARY_HEADERS = ['Tanggal Rekapan', 'Total Kasus Minggu Ini'].concat(LEVELS, ['Awal Minggu', 'Akhir Minggu', 'Baru', 'Diproses', 'Menunggu', 'Selesai']);
// One-time initial password hash; never reset an existing account during setup.
var INITIAL_ADMIN_HASH = 'scrypt:79ba41d40b7579ebcb1b33e905843ef8:aa25c5c093dfb3f1cd5cfe81cd1873f0030b2fabb3b2f88d5e2560125d465b5f85036be6327c2b3cfd7227f09bc45fba12f23d875a704da6986f44d272fab6d0';

function fail(message, code) { var error = new Error(message || 'Fungsi fail hanya helper. Pilih setupKomplainer pada dropdown fungsi, lalu Run.'); error.code = code || 400; throw error; }
function props() { return PropertiesService.getScriptProperties(); }
function spreadsheet() {
  var id = props().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) fail('Hubungkan Apps Script ke spreadsheet atau isi SPREADSHEET_ID.', 503);
  return ss;
}
function startsWithHeaders(sheet, expected) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() < expected.length) return false;
  var actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  return expected.every(function (name, index) { return String(actual[index]).trim() === name; });
}
function dataSheet() {
  var ss = spreadsheet();
  var name = props().getProperty('COMPLAINT_SHEET_NAME');
  if (name) {
    var configured = ss.getSheetByName(name);
    if (!configured) configured = ss.insertSheet(name);
    return configured;
  }
  var matches = ss.getSheets().filter(function (sheet) { return startsWithHeaders(sheet, LEGACY_HEADERS); });
  if (matches.length > 1) fail('Ada lebih dari satu sheet komplain. Isi COMPLAINT_SHEET_NAME.', 503);
  var sheet = matches[0] || ss.getSheetByName('Komplain') || ss.insertSheet('Komplain');
  props().setProperty('COMPLAINT_SHEET_NAME', sheet.getName());
  return sheet;
}
function ensureHeaders(sheet) {
  if (!sheet) sheet = dataSheet();
  ensureColumnCapacity(sheet, HEADERS.length);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  else {
    if (!startsWithHeaders(sheet, LEGACY_HEADERS)) fail('Delapan kolom awal tidak sesuai. Setup dibatalkan tanpa mengubah data.', 503);
    var width = sheet.getLastColumn();
    if (width > HEADERS.length) fail('Ada kolom tambahan yang tidak dikenali. Sesuaikan kolom sebelum setup.', 503);
    if (width > LEGACY_HEADERS.length && !startsWithHeaders(sheet, HEADERS.slice(0, width))) fail('Kolom tambahan tidak sesuai skema Komplainer v2.', 503);
    if (width < HEADERS.length) sheet.getRange(1, width + 1, 1, HEADERS.length - width).setValues([HEADERS.slice(width)]);
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#E2E8F0');
  sheet.setFrozenRows(1);
  return sheet;
}
function ensureColumnCapacity(sheet, width) {
  var available = sheet.getMaxColumns();
  if (available < width) sheet.insertColumnsAfter(available, width - available);
}
function systemSheet(name, headers, legacyWidth) {
  var ss = spreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  ensureColumnCapacity(sheet, headers.length);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E2E8F0');
    sheet.setFrozenRows(1);
  } else {
    var width = sheet.getLastColumn();
    var minimum = legacyWidth || 1;
    if (width < minimum || width > headers.length || !startsWithHeaders(sheet, headers.slice(0, width))) fail('Header sheet ' + name + ' tidak sesuai. Data tidak diubah.', 503);
    if (width < headers.length) sheet.getRange(1, width + 1, 1, headers.length - width).setValues([headers.slice(width)]);
  }
  return sheet;
}
function ensureSchema() {
  ensureHeaders(dataSheet());
  if (!DATA_ONLY) { systemSheet('Pengguna', USER_HEADERS); systemSheet('Sesi', SESSION_HEADERS); }
  systemSheet('Riwayat', HISTORY_HEADERS);
  systemSheet('Rekapan Mingguan', SUMMARY_HEADERS, 6);
}
function seedInitialAdmin() {
  if (props().getProperty('INITIAL_ADMIN_CREATED') === 'true') return;
  if (allUsers().length > 0) { props().setProperty('INITIAL_ADMIN_CREATED', 'true'); return; }
  var user = { id: 'USR-' + Utilities.getUuid(), nama: 'lambangws', email: 'lambangws', role: 'admin', unit: 'Pusat', passwordHash: INITIAL_ADMIN_HASH, active: true, mustChangePassword: true };
  systemSheet('Pengguna', USER_HEADERS).appendRow([user.id, user.nama, user.email, user.role, user.unit, user.passwordHash, true, nowIso(), true]);
  props().setProperty('INITIAL_ADMIN_CREATED', 'true');
  audit('', user, 'Admin awal dibuat');
}
function setupKomplainer() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureSchema();
    if (!DATA_ONLY) seedInitialAdmin();
    var key = props().getProperty('APP_API_KEY');
    if (!key || key.trim().length < 32) {
      key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
      props().setProperty('APP_API_KEY', key);
    }
    console.log('Setup selesai. Salin APP_API_KEY dari Project Settings > Script Properties ke GOOGLE_SCRIPT_API_KEY di Next.js/Vercel. Key valid dan akun yang sudah ada tidak direset.');
  } finally { lock.releaseLock(); }
}
function rows(sheet, width) { return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues(); }
function clean(value) { var text = String(value == null ? '' : value); return /^'[=+\-@]/.test(text) ? text.slice(1) : text; }
// Prevent user-controlled strings from becoming spreadsheet formulas.
function cell(value) { return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value; }
function safeRow(values) { return values.map(cell); }
function nowIso() { return new Date().toISOString(); }
function dateText(value) {
  if (!value) return '';
  return value instanceof Date ? Utilities.formatDate(value, spreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(value).slice(0, 10);
}
function timestamp(value) { return value instanceof Date ? value.toISOString() : String(value || ''); }
function validDate(value, optional) {
  var text = String(value || '');
  if (!text && optional) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail('Tanggal tidak valid.');
  var parsed = new Date(text + 'T12:00:00Z');
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) fail('Tanggal kalender tidak valid.');
  return text;
}
function textField(value, label, required, max) {
  if (typeof value !== 'string') value = value == null ? '' : String(value);
  var result = value.trim();
  if (required && !result) fail(label + ' wajib diisi.');
  if (result.length > (max || 200)) fail(label + ' terlalu panjang.');
  return result;
}
function emailField(value) {
  var email = textField(value, 'Email', true, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Email tidak valid.');
  return email;
}
function loginField(value) {
  var identifier = textField(value, 'Email atau username', true, 254).toLowerCase();
  return identifier === 'lambangws' ? identifier : emailField(identifier);
}
function validHash(hash) { if (/^firebase:[^\s]{1,128}$/.test(String(hash))) return hash; if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(String(hash))) fail('Hash password tidak valid.'); return hash; }
function allUsers() {
  if (FIREBASE_DIRECTORY) return FIREBASE_DIRECTORY;
  return rows(systemSheet('Pengguna', USER_HEADERS), USER_HEADERS.length).map(function (row, index) {
    return { id: String(row[0]), nama: clean(row[1]), email: clean(row[2]), role: String(row[3]), unit: clean(row[4]), passwordHash: String(row[5]), active: row[6] === true || String(row[6]).toLowerCase() === 'true', createdAt: timestamp(row[7]), mustChangePassword: row[8] === true || String(row[8]).toLowerCase() === 'true', row: index + 2 };
  });
}
function publicUser(user) { return { id: user.id, nama: user.nama, email: user.email, role: user.role, unit: user.unit, active: user.active, mustChangePassword: user.mustChangePassword, firebaseUid: String(user.passwordHash || '').indexOf('firebase:') === 0 ? user.passwordHash.slice(9) : null }; }
function requireAdmin(user) { if (user.role !== 'admin') fail('Hanya admin dapat melakukan tindakan ini.', 403); }
function throttle(name) {
  var key = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, name));
  var cache = CacheService.getScriptCache();
  var attempts = Number(cache.get('login:' + key) || 0);
  if (attempts >= 10) fail('Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.', 429);
  cache.put('login:' + key, String(attempts + 1), 900);
}
function sessionUser(hash) {
  if (!/^[a-f0-9]{64}$/.test(String(hash))) fail('Silakan masuk untuk melanjutkan.', 401);
  var session = rows(systemSheet('Sesi', SESSION_HEADERS), 3).filter(function (row) { return String(row[0]) === hash && new Date(row[2]).getTime() > Date.now(); })[0];
  if (!session) fail('Sesi berakhir. Silakan masuk kembali.', 401);
  var user = allUsers().filter(function (item) { return item.id === String(session[1]) && item.active; })[0];
  if (!user) fail('Akun tidak aktif. Hubungi admin.', 401);
  return user;
}
function revokeSessions(userId, hash) {
  var sheet = systemSheet('Sesi', SESSION_HEADERS);
  var data = rows(sheet, 3);
  for (var i = data.length - 1; i >= 0; i--) if ((userId && String(data[i][1]) === userId) || (hash && String(data[i][0]) === hash) || new Date(data[i][2]).getTime() <= Date.now()) sheet.deleteRow(i + 2);
}
function audit(id, user, action, note, detail) {
  systemSheet('Riwayat', HISTORY_HEADERS).appendRow(safeRow([Utilities.getUuid(), id, nowIso(), user.id, user.nama, action, note || '', JSON.stringify(detail || {})]));
}
function report(row, index) {
  return { id: String(row[0]), tanggal: dateText(row[1]), dokter: clean(row[2]), team: clean(row[3]), tindakan: clean(row[4]), komplain: clean(row[5]), jalanKeluar: clean(row[6]), status: String(row[7] || LEVELS[2]), statusPenanganan: String(row[8] || 'Baru'), picId: String(row[9] || ''), picNama: clean(row[10]), tenggat: dateText(row[11]), pelaporId: String(row[12] || ''), pelaporNama: clean(row[13]), createdAt: timestamp(row[14]), updatedAt: timestamp(row[15]), selesaiPada: timestamp(row[16]), deletedAt: timestamp(row[17]), version: Number(row[18]) || 1, rumahSakit: clean(row[19]), penangananSelanjutnya: clean(row[20]), row: index + 2 };
}
function reports() { return rows(ensureHeaders(dataSheet()), HEADERS.length).map(report).filter(function (item) { return item.id && !item.deletedAt; }); }
function publicReport(item, accounts) {
  var result = Object.assign({}, item);
  var users = accounts || allUsers();
  var owner = users.filter(function (user) { return user.id === item.pelaporId; })[0];
  var pic = users.filter(function (user) { return user.id === item.picId; })[0];
  result.pelaporRole = owner ? owner.role : null;
  result.picRole = pic ? pic.role : null;
  delete result.row;
  return result;
}
// Petugas (PIC) are collectively responsible for triage and decisions on every incoming case.
function canRead(item, user) { return user.role === 'admin' || user.role === 'petugas' || item.pelaporId === user.id || item.picId === user.id; }
// Other users may see that a case exists and its status, never its content.
function summaryReport(item) { return { id: item.id, tanggal: item.tanggal, team: item.team, rumahSakit: item.rumahSakit, status: item.status, statusPenanganan: item.statusPenanganan, tenggat: item.tenggat, updatedAt: item.updatedAt, restricted: true }; }
function findReport(id, user) {
  var item = reports().filter(function (value) { return value.id === String(id); })[0];
  if (!item || !canRead(item, user)) fail('Laporan tidak ditemukan atau tidak dapat diakses.', 404);
  return item;
}
function checkVersion(item, body) { if (Number(body.version) !== item.version) fail('Laporan sudah diperbarui pengguna lain. Muat ulang data lalu ulangi perubahan.', 409); }
function writeReport(item) {
  var values = [item.id, item.tanggal, item.dokter, item.team, item.tindakan, item.komplain, item.jalanKeluar, item.status, item.statusPenanganan, item.picId, item.picNama, item.tenggat, item.pelaporId, item.pelaporNama, item.createdAt, item.updatedAt, item.selesaiPada, item.deletedAt, item.version, item.rumahSakit || '', item.penangananSelanjutnya || ''];
  dataSheet().getRange(item.row, 1, 1, HEADERS.length).setValues([safeRow(values)]);
}
function history(id) {
  return rows(systemSheet('Riwayat', HISTORY_HEADERS), HISTORY_HEADERS.length).filter(function (row) { return String(row[1]) === id; }).map(function (row) { return { id: String(row[0]), tanggal: timestamp(row[2]), nama: clean(row[4]), aksi: clean(row[5]), catatan: clean(row[6]), detail: clean(row[7]) }; }).reverse();
}
function createUser(body, actor, bootstrap) {
  var users = allUsers();
  var email = emailField(body.email);
  if (users.some(function (user) { return user.email === email; })) fail('Email sudah terdaftar.', 409);
  var role = bootstrap ? 'admin' : body.role;
  if (ROLES.indexOf(role) === -1) fail('Peran tidak valid.');
  var user = { id: body.firebaseAccountId && /^USR-[a-f0-9-]{36}$/i.test(body.firebaseAccountId) ? body.firebaseAccountId : 'USR-' + Utilities.getUuid(), nama: textField(body.nama, 'Nama', true), email: email, role: role, unit: textField(body.unit, 'Unit', true), passwordHash: validHash(body.passwordHash), active: true, mustChangePassword: !bootstrap };
  if (user.passwordHash.indexOf('firebase:') === 0 && user.passwordHash !== 'firebase:komplainer:' + user.id) fail('Identitas akun Firebase tidak sesuai.');
  systemSheet('Pengguna', USER_HEADERS).appendRow(safeRow([user.id, user.nama, email, role, user.unit, user.passwordHash, true, nowIso(), user.mustChangePassword]));
  audit('', actor || user, 'Akun dibuat', '', { userId: user.id, role: role });
  return { status: 'success', user: publicUser(user) };
}
function doGet() { return jsonResponse({ status: 'error', code: 401, message: 'Gunakan API aplikasi dengan sesi login.' }); }
function doPost(event) {
  var lock;
  try {
    var body = JSON.parse(event.postData.contents);
    var secret = props().getProperty('APP_API_KEY');
    if (!secret || secret.length < 32) fail('APP_API_KEY belum dikonfigurasi di Script Properties.', 503);
    if (typeof body.apiKey !== 'string' || body.apiKey !== secret) fail('Akses layanan tidak diizinkan.', 403);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) fail('Layanan sedang sibuk. Coba lagi.', 503);
    if (DATA_ONLY) {
      var permitted = ['list', 'detail', 'create', 'update', 'delete', 'assign', 'followUp', 'reopen', 'accountGuard'];
      if (permitted.indexOf(body.action) === -1) fail('Akun dan login ditangani Firebase, bukan Apps Script.', 403);
      if (!body.firebaseContext || !body.firebaseContext.user || !Array.isArray(body.firebaseContext.accounts)) fail('Konteks Firebase dari server aplikasi diperlukan. Update aplikasi dan login kembali.', 401);
      var verifiedProfile = body.firebaseContext.user;
      if (!verifiedProfile.id || ROLES.indexOf(verifiedProfile.role) === -1 || verifiedProfile.active !== true) fail('Profil Firebase tidak valid.', 403);
      FIREBASE_DIRECTORY = body.firebaseContext.accounts;
    }
    ensureSchema();
    return jsonResponse(handle(body));
  } catch (error) { return jsonResponse({ status: 'error', code: error.code || 500, message: error.code ? error.message : 'Layanan data gagal memproses permintaan. Periksa konfigurasi sheet.' }); }
  finally { FIREBASE_DIRECTORY = null; if (lock && lock.hasLock()) lock.releaseLock(); }
}
function handle(body) {
  var action = body.action;
  if (action === 'bootstrap') {
    if (allUsers().length > 0) fail('Admin sudah tersedia. Setup awal hanya dapat dilakukan sekali.', 409);
    ensureHeaders(dataSheet());
    return createUser(body, null, true);
  }
  if (action === 'firebaseLink') {
    var linkedUid = String(body.firebaseUid || '');
    if (!/^[^\s]{1,128}$/.test(linkedUid)) fail('UID Firebase tidak valid.');
    var linkedEmail = loginField(body.email);
    throttle(linkedEmail);
    var linkedUsers = allUsers();
    var linked = linkedUsers.filter(function (account) { return account.passwordHash === 'firebase:' + linkedUid; })[0];
    var matching = linkedUsers.filter(function (account) { return account.email === linkedEmail; })[0];
    if (!linked && matching) {
      if (matching.passwordHash.indexOf('firebase:') === 0) fail('Email terhubung ke akun Firebase lain.', 409);
      // Verified email or an explicitly selected admin can claim an old profile.
      if (body.emailVerified !== true && body.grantAdmin !== true && linkedUid !== 'komplainer:' + matching.id) fail('Verifikasi email Firebase untuk menghubungkan profil lama, atau hubungi admin.', 403);
      linked = matching;
    }
    var linkedSheet = systemSheet('Pengguna', USER_HEADERS);
    if (!linked) {
      linked = { id: 'USR-' + Utilities.getUuid(), nama: textField(body.nama, 'Nama', true), email: linkedEmail, role: body.grantAdmin === true ? 'admin' : 'pelapor', unit: 'Belum diisi', passwordHash: 'firebase:' + linkedUid, active: true, mustChangePassword: false, row: linkedSheet.getLastRow() + 1 };
      linkedSheet.appendRow(safeRow([linked.id, linked.nama, linked.email, linked.role, linked.unit, linked.passwordHash, true, nowIso(), false]));
      audit('', linked, 'Akun Firebase dihubungkan');
    } else {
      if (!linked.active) fail('Akun Komplainer dinonaktifkan. Hubungi admin.', 403);
      if (linked.email !== linkedEmail) fail('Email Firebase berbeda dari profil. Hubungi admin untuk menyelaraskan akun.', 409);
      if (linked.passwordHash !== 'firebase:' + linkedUid) {
        linkedSheet.getRange(linked.row, 6).setValue('firebase:' + linkedUid);
        linked.passwordHash = 'firebase:' + linkedUid;
        revokeSessions(linked.id);
        audit('', linked, 'Akun lama dihubungkan ke Firebase');
      }
      if (body.grantAdmin === true && linked.role !== 'admin') {
        linkedSheet.getRange(linked.row, 4).setValue('admin');
        linked.role = 'admin';
        audit('', linked, 'Admin Firebase ditetapkan oleh konfigurasi server');
      }
    }
    return { status: 'success', user: publicUser(linked) };
  }
  if (action === 'firebaseLookup') {
    var firebaseLogin = loginField(body.email);
    throttle(firebaseLogin);
    var firebaseProfile = allUsers().filter(function (account) { return account.email === firebaseLogin && account.active; })[0];
    return { status: 'success', user: firebaseProfile ? publicUser(firebaseProfile) : null, passwordHash: firebaseProfile && firebaseProfile.passwordHash.indexOf('scrypt:') === 0 ? firebaseProfile.passwordHash : null };
  }
  if (action === 'firebaseMigrate') {
    var migrating = allUsers().filter(function (account) { return account.id === body.id && account.active; })[0];
    if (!migrating || body.firebaseUid !== 'komplainer:' + migrating.id) fail('Identitas Firebase tidak sesuai.', 403);
    var marker = 'firebase:' + body.firebaseUid;
    if (migrating.passwordHash !== marker) {
      if (!body.expectedHash || body.expectedHash !== migrating.passwordHash) fail('Akun sudah diperbarui. Ulangi login.', 409);
      systemSheet('Pengguna', USER_HEADERS).getRange(migrating.row, 6).setValue(marker);
      revokeSessions(migrating.id);
      audit('', migrating, 'Login dipindahkan ke Firebase');
    }
    return { status: 'success', user: publicUser(migrating) };
  }
  if (action === 'authLookup') {
    var email = loginField(body.email);
    throttle(email);
    var account = allUsers().filter(function (user) { return user.email === email && user.active; })[0];
    return { status: 'success', passwordHash: account ? account.passwordHash : null };
  }
  if (action === 'login') {
    var loginUser = allUsers().filter(function (user) { return user.email === loginField(body.email) && user.active && user.passwordHash === body.expectedHash; })[0];
    if (!loginUser) fail('Email atau password salah.', 401);
    if (!/^[a-f0-9]{64}$/.test(String(body.sessionHash))) fail('Token sesi tidak valid.');
    var expiry = new Date(body.expiresAt).getTime();
    if (!isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 8 * 60 * 60 * 1000 + 60000) fail('Masa sesi tidak valid.');
    revokeSessions();
    var sessions = systemSheet('Sesi', SESSION_HEADERS);
    if (sessions.getLastRow() > 500) fail('Kapasitas sesi penuh. Hubungi admin.', 503);
    sessions.appendRow([body.sessionHash, loginUser.id, body.expiresAt]);
    return { status: 'success', user: publicUser(loginUser) };
  }
  var user;
  if (DATA_ONLY) {
    user = body.firebaseContext.user;
  } else if (body.firebaseSessionUid) {
    user = allUsers().filter(function (account) { return account.active && account.passwordHash === 'firebase:' + body.firebaseSessionUid; })[0];
    if (!user) fail('Akun Firebase tidak aktif atau belum terhubung.', 401);
  } else if (body.firebaseUserId) {
    user = allUsers().filter(function (account) { return account.id === body.firebaseUserId && account.active && account.passwordHash === 'firebase:komplainer:' + account.id; })[0];
    if (!user) fail('Akun Firebase tidak aktif atau belum terhubung.', 401);
  } else user = sessionUser(body.sessionHash);
  if (action === 'session') return { status: 'success', user: publicUser(user) };
  if (action === 'logout') { revokeSessions(null, body.sessionHash); return { status: 'success' }; }
  if (action === 'firebasePasswordChanged') {
    if (!body.firebaseUserId && !body.firebaseSessionUid) fail('Sesi Firebase diperlukan.', 403);
    systemSheet('Pengguna', USER_HEADERS).getRange(user.row, 9).setValue(false);
    audit('', user, 'Password Firebase diperbarui');
    return { status: 'success' };
  }
  if (action === 'ownCredentials') { throttle('password:' + user.id); return { status: 'success', passwordHash: user.passwordHash }; }
  if (action === 'changePassword') {
    if (body.expectedHash !== user.passwordHash) fail('Password sudah berubah. Masuk kembali.', 409);
    var newHash = validHash(body.passwordHash);
    var userSheet = systemSheet('Pengguna', USER_HEADERS);
    userSheet.getRange(user.row, 6).setValue(newHash);
    userSheet.getRange(user.row, 9).setValue(false);
    revokeSessions(user.id);
    audit('', user, 'Password diperbarui');
    return { status: 'success' };
  }
  if (user.mustChangePassword) fail('Ganti password sementara sebelum menggunakan aplikasi.', 403);
  if (action === 'users') {
    requireAdmin(user);
    return { status: 'success', data: allUsers().map(publicUser) };
  }
  if (action === 'createUser') { requireAdmin(user); return createUser(body, user, false); }
  if (action === 'updateUser' || action === 'resetPassword') {
    requireAdmin(user);
    var all = allUsers();
    var target = all.filter(function (item) { return item.id === body.id; })[0];
    if (!target) fail('Akun tidak ditemukan.', 404);
    var sheet = systemSheet('Pengguna', USER_HEADERS);
    if (action === 'resetPassword') {
      var resetHash = validHash(body.passwordHash);
      if (resetHash.indexOf('firebase:') === 0 && resetHash !== (target.passwordHash.indexOf('firebase:') === 0 ? target.passwordHash : 'firebase:komplainer:' + target.id)) fail('Identitas reset Firebase tidak sesuai.');
      sheet.getRange(target.row, 6).setValue(resetHash);
      sheet.getRange(target.row, 9).setValue(true);
    } else {
      var role = body.role;
      if (ROLES.indexOf(role) === -1 || typeof body.active !== 'boolean') fail('Peran atau status akun tidak valid.');
      if (target.role === 'admin' && target.active && (role !== 'admin' || !body.active) && all.filter(function (item) { return item.role === 'admin' && item.active; }).length === 1) fail('Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan perannya.', 409);
      // Active assigned cases must first be transferred away, unless the new role still keeps them a valid PIC.
      if ((!body.active || role !== 'petugas') && reports().some(function (item) { return item.picId === target.id && item.statusPenanganan !== 'Selesai'; })) fail('Alihkan komplain aktif milik pengguna ini sebelum mengubah aksesnya.', 409);
      var newEmail = target.email === 'lambangws' ? loginField(body.email) : emailField(body.email);
      if (all.some(function (item) { return item.email === newEmail && item.id !== target.id; })) fail('Email sudah terdaftar.', 409);
      sheet.getRange(target.row, 2, 1, 4).setValues([safeRow([textField(body.nama, 'Nama', true), newEmail, role, textField(body.unit, 'Unit', true)])]);
      sheet.getRange(target.row, 7).setValue(body.active);
    }
    revokeSessions(target.id);
    audit('', user, action === 'resetPassword' ? 'Password direset admin' : 'Akun diperbarui', '', { userId: target.id });
    return { status: 'success' };
  }
  if (action === 'accountGuard') {
    requireAdmin(user);
    // Promoting/keeping someone as petugas never orphans their active cases; only block changes that would.
    if ((body.active === false || body.role !== 'petugas') && reports().some(function (item) { return item.picId === body.id && item.statusPenanganan !== 'Selesai'; })) fail('Alihkan komplain aktif milik pengguna ini sebelum mengubah aksesnya.', 409);
    return { status: 'success' };
  }
  if (action === 'list') {
    var accounts = allUsers();
    return { status: 'success', data: reports().map(function (item) { return canRead(item, user) ? publicReport(item, accounts) : summaryReport(item); }), assignees: user.role === 'admin' ? accounts.filter(function (item) { return item.active && item.role === 'petugas'; }).map(publicUser) : [] };
  }
  if (action === 'detail') {
    var detail = findReport(body.id, user);
    return { status: 'success', data: publicReport(detail), history: history(detail.id) };
  }
  if (action === 'create') {
    if (!/^[a-f0-9-]{36}$/.test(String(body.requestId))) fail('ID permintaan tidak valid.');
    var id = 'ID-' + body.requestId;
    var existing = rows(ensureHeaders(dataSheet()), HEADERS.length).map(report).filter(function (item) { return item.id === id; })[0];
    if (existing) {
      if (existing.deletedAt) fail('Permintaan ini sudah diarsipkan. Buat laporan baru.', 409);
      if (existing.pelaporId !== user.id) fail('ID permintaan sudah digunakan.', 409);
      return { status: 'success', data: publicReport(existing), id: id };
    }
    var created = { id: id, tanggal: validDate(body.tanggal), dokter: textField(body.dokter, 'Dokter', true), rumahSakit: textField(body.rumahSakit, 'Rumah Sakit', false), team: textField(body.team, 'Team Pelapor', true), tindakan: textField(body.tindakan, 'Tindakan', true, 500), komplain: textField(body.komplain, 'Masalah', true, 5000), jalanKeluar: textField(body.jalanKeluar, 'Solusi', false, 5000), penangananSelanjutnya: textField(body.penangananSelanjutnya, 'Penanganan Selanjutnya', false, 5000), status: body.status, statusPenanganan: 'Baru', picId: '', picNama: '', tenggat: '', pelaporId: user.id, pelaporNama: user.nama, createdAt: nowIso(), updatedAt: nowIso(), selesaiPada: '', deletedAt: '', version: 1, row: dataSheet().getLastRow() + 1 };
    if (LEVELS.indexOf(created.status) === -1) fail('Tingkat keparahan tidak valid.');
    writeReport(created);
    audit(id, user, 'Laporan dibuat', '', { statusPenanganan: 'Baru' });
    return { status: 'success', data: publicReport(created), id: id };
  }
  if (['update', 'delete', 'assign', 'followUp', 'reopen'].indexOf(action) === -1) fail('Aksi tidak valid.');
  var item = findReport(body.id, user);
  checkVersion(item, body);
  var note = textField(body.catatan, 'Catatan', false, 2000);
  var before = { statusPenanganan: item.statusPenanganan, picId: item.picId, tenggat: item.tenggat };
  if (action === 'update') {
    if (user.role !== 'admin' && !(item.pelaporId === user.id && item.statusPenanganan === 'Baru')) fail('Hanya admin atau pelapor saat status Baru dapat mengedit laporan.', 403);
    item.tanggal = validDate(body.tanggal);
    item.dokter = textField(body.dokter, 'Dokter', true);
    if (body.rumahSakit !== undefined) item.rumahSakit = textField(body.rumahSakit, 'Rumah Sakit', false);
    item.team = textField(body.team, 'Team Pelapor', true);
    item.tindakan = textField(body.tindakan, 'Tindakan', true, 500);
    item.komplain = textField(body.komplain, 'Masalah', true, 5000);
    item.jalanKeluar = textField(body.jalanKeluar, 'Solusi', item.statusPenanganan === 'Selesai', 5000);
    if (body.penangananSelanjutnya !== undefined) item.penangananSelanjutnya = textField(body.penangananSelanjutnya, 'Penanganan Selanjutnya', false, 5000);
    if (LEVELS.indexOf(body.status) === -1) fail('Tingkat keparahan tidak valid.');
    item.status = body.status;
  } else if (action === 'delete') {
    if (user.role !== 'admin' && !(item.pelaporId === user.id && item.statusPenanganan === 'Baru')) fail('Hanya admin atau pelapor saat status Baru dapat menghapus laporan.', 403);
    item.deletedAt = nowIso();
  } else if (action === 'assign') {
    // A petugas may pick up a case with no PIC yet; reassigning an already-handled case stays admin-only.
    var selfAssign = user.role === 'petugas' && !item.picId && body.picId === user.id;
    if (!selfAssign) requireAdmin(user);
    if (item.statusPenanganan === 'Selesai') fail('Buka kembali laporan sebelum mengubah penugasan.', 409);
    var pic = allUsers().filter(function (target) { return target.id === body.picId && target.role === 'petugas' && target.active; })[0];
    if (body.picId && !pic) fail('PIC harus merupakan petugas (PIC) aktif.');
    item.picId = pic ? pic.id : '';
    item.picNama = pic ? pic.nama : '';
    item.tenggat = validDate(body.tenggat, true);
    if (item.statusPenanganan !== 'Baru' && !pic) fail('Laporan yang sedang ditangani harus memiliki PIC.');
  } else if (action === 'followUp') {
    if (user.role !== 'admin' && item.picId !== user.id) fail('Hanya admin atau PIC dapat memperbarui penanganan.', 403);
    if (item.statusPenanganan === 'Selesai') fail('Laporan sudah selesai. Gunakan Buka kembali untuk melanjutkan.', 409);
    if (['Diproses', 'Menunggu', 'Selesai'].indexOf(body.statusPenanganan) === -1) fail('Status penanganan tidak valid.');
    if (!item.picId) fail('Tentukan PIC sebelum memperbarui penanganan.');
    item.statusPenanganan = body.statusPenanganan;
    item.jalanKeluar = textField(body.jalanKeluar, 'Solusi', item.statusPenanganan === 'Selesai', 5000);
    if (body.penangananSelanjutnya !== undefined) item.penangananSelanjutnya = textField(body.penangananSelanjutnya, 'Penanganan Selanjutnya', false, 5000);
    item.selesaiPada = item.statusPenanganan === 'Selesai' ? nowIso() : '';
  } else if (action === 'reopen') {
    if (user.role !== 'admin' && item.pelaporId !== user.id) fail('Hanya admin atau pelapor dapat membuka kembali laporan.', 403);
    if (item.statusPenanganan !== 'Selesai' || !note) fail('Laporan harus berstatus Selesai dan alasan pembukaan wajib diisi.');
    item.statusPenanganan = 'Baru';
    item.selesaiPada = '';
  }
  item.updatedAt = nowIso();
  item.version += 1;
  writeReport(item);
  audit(item.id, user, { update: 'Laporan diedit', delete: 'Laporan diarsipkan', assign: 'PIC / tenggat diperbarui', followUp: 'Tindak lanjut', reopen: 'Laporan dibuka kembali' }[action], note, { before: before, after: { statusPenanganan: item.statusPenanganan, picId: item.picId, tenggat: item.tenggat } });
  return { status: 'success', data: publicReport(item) };
}

/** Previous complete Monday–Sunday week; named sheet is stable even when summary tab is active. */
function generateWeeklySummary() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var today = Utilities.formatDate(new Date(), spreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    var monday = new Date(today + 'T12:00:00Z');
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 7);
    var start = monday.toISOString().slice(0, 10);
    var sunday = new Date(monday.getTime() + 6 * 86400000);
    var end = sunday.toISOString().slice(0, 10);
    var selected = reports().filter(function (item) { return item.tanggal >= start && item.tanggal <= end; });
    var summaryHeaders = SUMMARY_HEADERS;
    var summary = systemSheet('Rekapan Mingguan', summaryHeaders, 6);
    var values = [today, selected.length].concat(LEVELS.map(function (level) { return selected.filter(function (item) { return item.status === level; }).length; }), [start, end], WORKFLOW.map(function (status) { return selected.filter(function (item) { return item.statusPenanganan === status; }).length; }));
    var existing = rows(summary, summaryHeaders.length).findIndex(function (row) { return dateText(row[6]) === start; });
    if (existing >= 0) summary.getRange(existing + 2, 1, 1, values.length).setValues([values]);
    else summary.appendRow(values);
  } finally { lock.releaseLock(); }
}
function jsonResponse(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
