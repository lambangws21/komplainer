const SCRIPT_VERSION = "cases-v5-2026-02-20";
const SPREADSHEET_ID = "1fxYbg7wSmjdrnNpJi7d589lHmNBKDnZYkJ5doAh4-z8";
const SHEET_NAME = "Sheet1";
const FOLDER_ID = "1lxkK1VkOD5qevYDbU-aGCc23rjg4pNRz";
const CASE_HEADERS = ["No", "Title", "Note", "GoogleDriveID", "Tags", "CreatedAt", "UpdatedAt"];

/* =======================
   Helpers
======================= */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(SHEET_NAME + " tidak ditemukan");
  return sheet;
}

function toIso_(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function toStr_(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeIds_(value) {
  if (Array.isArray(value)) {
    return value.map(String).map(function (s) { return s.trim(); }).filter(Boolean).join(",");
  }
  return String(value || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean)
    .join(",");
}

function normalizeTagsCsv_(value) {
  var list = Array.isArray(value) ? value : String(value || "").split(",");
  var seen = {};
  var out = [];

  for (var i = 0; i < list.length; i++) {
    var tag = String(list[i] || "").trim().toLowerCase();
    if (!tag) continue;
    if (seen[tag]) continue;
    seen[tag] = true;
    out.push(tag);
  }

  return out.join(",");
}

function splitTags_(value) {
  var csv = normalizeTagsCsv_(value);
  if (!csv) return [];
  return csv.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

function firstDriveId_(joinedIds) {
  const ids = String(joinedIds || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  return ids.length ? ids[0] : "";
}

function ensureFileNameExt_(fileName, ext) {
  const name = String(fileName || "image_" + Date.now());
  if (/\.[a-zA-Z0-9]+$/.test(name)) return name;
  return name + ext;
}

function findRowByNo_(sheet, no) {
  const target = String(no || "").trim();
  if (!target) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() === target) return i + 2;
  }
  return -1;
}

function getNextNo_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let maxNo = 0;
  for (let i = 0; i < values.length; i++) {
    const n = Number(values[i][0]);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  }
  return maxNo + 1;
}

function appendCaseRow_(sheet, no, title, note, joinedIds, tagsCsv) {
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 7).setValues([[
    Number(no),
    String(title || ""),
    String(note || ""),
    String(joinedIds || ""),
    normalizeTagsCsv_(tagsCsv),
    new Date(),
    new Date()
  ]]);
}

function normalizeHeaderKey_(header) {
  return String(header || "").toLowerCase().replace(/[\s_]/g, "").trim();
}

function pickByHeader_(rawRow, map, keys, fallbackIndex) {
  for (var i = 0; i < keys.length; i++) {
    var idx = map[keys[i]];
    if (idx !== undefined) return rawRow[idx];
  }
  if (fallbackIndex !== undefined && fallbackIndex < rawRow.length) return rawRow[fallbackIndex];
  return "";
}

function migrateFromUnknownSchema_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, CASE_HEADERS.length).setValues([CASE_HEADERS]);
    return;
  }

  var width = Math.max(sheet.getLastColumn(), CASE_HEADERS.length);
  var all = sheet.getRange(1, 1, lastRow, width).getValues();
  var headerRow = all[0];

  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var key = normalizeHeaderKey_(headerRow[c]);
    if (key && map[key] === undefined) map[key] = c;
  }

  var rows = [];
  var maxNo = 0;

  for (var r = 1; r < all.length; r++) {
    var raw = all[r];

    var noRaw = pickByHeader_(raw, map, ["no", "id"], 0);
    var noNum = Number(noRaw);
    var no = (!isNaN(noNum) && noNum > 0) ? Math.floor(noNum) : "";
    if (no && no > maxNo) maxNo = no;

    var title = toStr_(pickByHeader_(raw, map, ["title", "tindakan", "namakasus"], 1));
    var note = toStr_(pickByHeader_(raw, map, ["note", "keterangan"], 2));
    var ids = normalizeIds_(pickByHeader_(raw, map, ["googledriveid", "googledriveids"], 3));
    var tags = normalizeTagsCsv_(pickByHeader_(raw, map, ["tags", "tag"], 4));

    var createdAt = pickByHeader_(raw, map, ["createdat", "createdatupdatedat", "date", "tanggal"], 5);
    var updatedAt = pickByHeader_(raw, map, ["updatedat"], 6);

    rows.push([no, title, note, ids, tags, createdAt, updatedAt]);
  }

  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) {
      maxNo += 1;
      rows[i][0] = maxNo;
    }
    rows[i][3] = normalizeIds_(rows[i][3]);
    rows[i][4] = normalizeTagsCsv_(rows[i][4]);

    if (!rows[i][5]) rows[i][5] = new Date();
    if (!rows[i][6]) rows[i][6] = rows[i][5] || new Date();
  }

  if (sheet.getMaxColumns() < CASE_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), CASE_HEADERS.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, CASE_HEADERS.length).setValues([CASE_HEADERS]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, CASE_HEADERS.length).setValues(rows);
  }
}

function fastBackfillCanonicalRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const rng = sheet.getRange(2, 1, lastRow - 1, 7);
  const rows = rng.getValues();

  let maxNo = 0;
  rows.forEach(function (r) {
    const n = Number(r[0]);
    if (Number.isFinite(n) && n > maxNo) maxNo = n;
  });

  for (let i = 0; i < rows.length; i++) {
    const no = Number(rows[i][0]);
    if (!Number.isFinite(no) || no <= 0) {
      maxNo += 1;
      rows[i][0] = maxNo;
    }

    rows[i][1] = String(rows[i][1] || "");
    rows[i][2] = String(rows[i][2] || "");
    rows[i][3] = normalizeIds_(rows[i][3]);
    rows[i][4] = normalizeTagsCsv_(rows[i][4]);

    if (!rows[i][5]) rows[i][5] = new Date();
    if (!rows[i][6]) rows[i][6] = rows[i][5] || new Date();
  }

  rng.setValues(rows);
}

function ensureCaseSheetSchema_(sheet) {
  if (sheet.getMaxColumns() < CASE_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), CASE_HEADERS.length - sheet.getMaxColumns());
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CASE_HEADERS.length).setValues([CASE_HEADERS]);
    return;
  }

  const headerNow = sheet.getRange(1, 1, 1, CASE_HEADERS.length).getValues()[0]
    .map(function (v) { return String(v || "").trim(); });

  const isCanonical = CASE_HEADERS.every(function (h, i) { return headerNow[i] === h; });

  if (!isCanonical) {
    migrateFromUnknownSchema_(sheet);
  } else {
    fastBackfillCanonicalRows_(sheet);
  }

  sheet.getRange(1, 1, 1, CASE_HEADERS.length).setValues([CASE_HEADERS]);
}

/* Jalankan manual 1x setelah paste script */
function migrateCaseSheetSchema() {
  const sheet = getSheet_();
  ensureCaseSheetSchema_(sheet);
}

/* Opsional: perbaiki row yang sempat geser */
function repairShiftedCaseRows() {
  const sh = getSheet_();
  ensureCaseSheetSchema_(sh);

  const last = sh.getLastRow();
  if (last < 2) return;

  const rng = sh.getRange(2, 1, last - 1, 7);
  const rows = rng.getValues();

  let maxNo = 0;
  rows.forEach(function (r) {
    const n = Number(r[0]);
    if (Number.isFinite(n) && n > maxNo) maxNo = n;
  });

  const idRegex = /^[a-zA-Z0-9_-]{10,}(,[a-zA-Z0-9_-]{10,})*$/;

  for (let i = 0; i < rows.length; i++) {
    const no = String(rows[i][0] || "").trim();
    const title = String(rows[i][1] || "").trim();
    const note = String(rows[i][2] || "").trim();
    const drive = String(rows[i][3] || "").trim();

    const noInvalid = !/^\d+$/.test(no);
    const looksShifted = noInvalid && title && note && !drive && idRegex.test(note);

    if (looksShifted) {
      maxNo += 1;
      rows[i][3] = note;      // Note -> GoogleDriveID
      rows[i][2] = title;     // Title -> Note
      rows[i][1] = no;        // No text lama -> Title
      rows[i][0] = maxNo;     // No angka
      rows[i][4] = rows[i][4] || ""; // tags kosong
      if (!rows[i][5]) rows[i][5] = new Date();
      rows[i][6] = new Date();
    }

    rows[i][3] = normalizeIds_(rows[i][3]);
    rows[i][4] = normalizeTagsCsv_(rows[i][4]);
    if (!rows[i][5]) rows[i][5] = new Date();
    if (!rows[i][6]) rows[i][6] = rows[i][5] || new Date();
  }

  rng.setValues(rows);
}

/* =======================
   GET
======================= */
function doGet(e) {
  try {
    if (e && e.parameter && (e.parameter.mode === "doctorImages" || e.parameter.getDoctorImages === "true")) {
      return getDoctorImages();
    }

    const sheet = getSheet_();
    ensureCaseSheetSchema_(sheet);

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return json_({ status: "success", scriptVersion: SCRIPT_VERSION, data: [], count: 0 });
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    const records = rows.map(function (r) {
      const no = r[0];
      const title = r[1] || "";
      const note = r[2] || "";
      const googleDriveId = normalizeIds_(r[3]);
      const tagsCsv = normalizeTagsCsv_(r[4]);
      const tags = splitTags_(tagsCsv);
      const firstId = firstDriveId_(googleDriveId);

      return {
        no: no,
        id: no,
        title: title,
        tindakan: title,
        note: note,
        googleDriveId: googleDriveId,
        tags: tags,
        tagsCsv: tagsCsv,
        imageUrl: firstId ? "https://drive.google.com/uc?export=view&id=" + firstId : null,
        createdAt: toIso_(r[5]),
        updatedAt: toIso_(r[6])
      };
    });

    return json_({
      status: "success",
      scriptVersion: SCRIPT_VERSION,
      data: records,
      count: records.length
    });
  } catch (err) {
    return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: err.message || String(err) });
  }
}

/* =======================
   Optional: list images
======================= */
function getDoctorImages() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFiles();
    const doctors = [];

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();
      if (mimeType && mimeType.indexOf("image/") === 0) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const fileId = file.getId();
        doctors.push({
          name: file.getName().replace(/\.[^/.]+$/, ""),
          photoUrl: "https://drive.google.com/uc?export=view&id=" + fileId,
          fileId: fileId,
          dateCreated: toIso_(file.getDateCreated())
        });
      }
    }

    doctors.sort(function (a, b) {
      return new Date(b.dateCreated) - new Date(a.dateCreated);
    });

    return json_({
      status: "success",
      scriptVersion: SCRIPT_VERSION,
      data: doctors,
      message: doctors.length ? null : "No images found"
    });
  } catch (err) {
    return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: err.message || String(err), data: [] });
  }
}

/* =======================
   POST / PUT / DELETE
======================= */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: "Invalid request" });
    }

    const data = JSON.parse(e.postData.contents || "{}");

    const method = String(data.methodOverride || data._method || data.method || "").toUpperCase();
    if (method === "PUT") return doPut_(data);
    if (method === "DELETE") return doDelete_(data);

    const sheet = getSheet_();
    ensureCaseSheetSchema_(sheet);
    const folder = DriveApp.getFolderById(FOLDER_ID);

    // CASE A: upload single image (legacy)
    if (data.singleBase64Image && data.fileName) {
      const mimeType = data.mimeType || "image/jpeg";
      const ext = mimeType === "image/png" ? ".png" : ".jpg";
      const fileName = ensureFileNameExt_(data.fileName, ext);

      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.singleBase64Image),
        mimeType,
        fileName
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return json_({
        status: "success",
        scriptVersion: SCRIPT_VERSION,
        data: { fileId: file.getId() }
      });
    }

    // CASE B1: create kasus (payload baru)
    if (Array.isArray(data.base64Images) && Array.isArray(data.fileNames) && data.title && data.note) {
      const mimeTypeDefault = data.mimeType || "image/jpeg";
      const ext = mimeTypeDefault === "image/png" ? ".png" : ".jpg";
      const uploadedIds = [];

      for (let i = 0; i < data.base64Images.length; i++) {
        const b64 = data.base64Images[i];
        if (!b64) continue;

        const rawName = data.fileNames[i] || ("image_" + Date.now() + "_" + (i + 1));
        const fileName = ensureFileNameExt_(rawName, ext);

        const blob = Utilities.newBlob(
          Utilities.base64Decode(b64),
          mimeTypeDefault,
          fileName
        );
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        uploadedIds.push(file.getId());
      }

      const joinedIds = uploadedIds.join(",");
      const tagsCsv = normalizeTagsCsv_(data.tags !== undefined ? data.tags : (data.tagsCsv !== undefined ? data.tagsCsv : data.tag));
      const no = getNextNo_(sheet);

      appendCaseRow_(sheet, no, data.title, data.note, joinedIds, tagsCsv);

      return json_({
        status: "success",
        scriptVersion: SCRIPT_VERSION,
        data: { no: no, id: no, googleDriveIds: joinedIds, tagsCsv: tagsCsv, tags: splitTags_(tagsCsv) }
      });
    }

    // CASE B2: create kasus (legacy payload)
    if (data.title && data.note && (data.googleDriveIds || data.googleDriveId)) {
      const joinedIds = normalizeIds_(data.googleDriveIds || data.googleDriveId);
      const tagsCsv = normalizeTagsCsv_(data.tags !== undefined ? data.tags : (data.tagsCsv !== undefined ? data.tagsCsv : data.tag));
      const no = getNextNo_(sheet);

      appendCaseRow_(sheet, no, data.title, data.note, joinedIds, tagsCsv);

      return json_({
        status: "success",
        scriptVersion: SCRIPT_VERSION,
        data: { no: no, id: no, googleDriveIds: joinedIds, tagsCsv: tagsCsv, tags: splitTags_(tagsCsv) }
      });
    }

    return json_({
      status: "error",
      scriptVersion: SCRIPT_VERSION,
      message: "Missing required fields: title, note, base64Images, fileNames"
    });
  } catch (err) {
    return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: err.message || String(err) });
  }
}

function doPut_(data) {
  try {
    const sheet = getSheet_();
    ensureCaseSheetSchema_(sheet);

    const no = data.no || data.id || data.No;
    const row = findRowByNo_(sheet, no);
    if (row < 2) return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: "No/id tidak ditemukan" });

    const current = sheet.getRange(row, 1, 1, 7).getValues()[0];
    const currentNo = current[0];
    const currentTitle = current[1] || "";
    const currentNote = current[2] || "";
    const currentIds = current[3] || "";
    const currentTags = current[4] || "";
    const currentCreatedAt = current[5] || new Date();

    const nextTitle =
      (data.title !== undefined || data.tindakan !== undefined)
        ? String(data.title || data.tindakan || "")
        : String(currentTitle);

    const nextNote =
      (data.note !== undefined)
        ? String(data.note || "")
        : String(currentNote);

    let nextIds = String(currentIds || "");
    if (data.googleDriveIds !== undefined || data.googleDriveId !== undefined) {
      nextIds = normalizeIds_(data.googleDriveIds || data.googleDriveId);
    }

    const hasTags = (data.tags !== undefined || data.tagsCsv !== undefined || data.tag !== undefined);
    const nextTags = hasTags
      ? normalizeTagsCsv_(data.tags !== undefined ? data.tags : (data.tagsCsv !== undefined ? data.tagsCsv : data.tag))
      : normalizeTagsCsv_(currentTags);

    sheet.getRange(row, 1, 1, 7).setValues([[
      currentNo,
      nextTitle,
      nextNote,
      nextIds,
      nextTags,
      currentCreatedAt,
      new Date()
    ]]);

    return json_({
      status: "success",
      scriptVersion: SCRIPT_VERSION,
      message: "Data berhasil diperbarui",
      data: { no: currentNo, id: currentNo, tagsCsv: nextTags, tags: splitTags_(nextTags) }
    });
  } catch (err) {
    return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: err.message || String(err) });
  }
}

function doDelete_(data) {
  try {
    const sheet = getSheet_();
    ensureCaseSheetSchema_(sheet);

    const no = data.no || data.id || data.No;
    const row = findRowByNo_(sheet, no);
    if (row < 2) return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: "No/id tidak ditemukan" });

    const ids = normalizeIds_(sheet.getRange(row, 4).getValue())
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    ids.forEach(function (id) {
      try {
        DriveApp.getFileById(id).setTrashed(true);
      } catch (e) {}
    });

    sheet.deleteRow(row);

    return json_({
      status: "success",
      scriptVersion: SCRIPT_VERSION,
      message: "Data berhasil dihapus"
    });
  } catch (err) {
    return json_({ status: "error", scriptVersion: SCRIPT_VERSION, message: err.message || String(err) });
  }
}
