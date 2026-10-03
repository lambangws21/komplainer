/**
 * Konfigurasi Header Sheet
 * Struktur baru: ID | Tanggal | Dokter | Team | Tindakan | Komplain | Jalan Keluar | Status
 */
var HEADERS = ["ID", "Tanggal", "Dokter", "Team", "Tindakan", "Komplain", "Jalan Keluar", "Status"];

/**
 * Memastikan Header Otomatis Terbuat jika Sheet Masih Kosong
 */
function ensureHeaders(sheet) {
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  }
  
  if (!sheet) {
    throw new Error("Sheet tidak ditemukan.");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight("bold")
         .setBackground("#F1F5F9");
  }
}

/**
 * Menangani HTTP POST Request (Create, Update, Delete)
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders(sheet);
    
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;

    if (action === "create") {
      var newId = contents.id || "ID-" + new Date().getTime();
      var tanggal = contents.tanggal || new Date().toISOString().split('T')[0];
      var dokter = contents.dokter || "";
      var team = contents.team || "";
      var tindakan = contents.tindakan || "";
      var komplain = contents.komplain || "";
      var jalanKeluar = contents.jalanKeluar || "";
      var status = contents.status || "C3 - Moderate"; // Default ke C3 - Moderate

      sheet.appendRow([newId, tanggal, dokter, team, tindakan, komplain, jalanKeluar, status]);
      return jsonResponse({ status: "success", message: "Data berhasil ditambahkan", id: newId });

    } else if (action === "update") {
      var idToUpdate = contents.id;
      if (!idToUpdate) return jsonResponse({ status: "error", message: "ID wajib diisi" });

      var data = sheet.getDataRange().getValues();
      var rowIndex = -1;

      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() === idToUpdate.toString()) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) return jsonResponse({ status: "error", message: "Data tidak ditemukan" });

      if (contents.tanggal !== undefined) sheet.getRange(rowIndex, 2).setValue(contents.tanggal);
      if (contents.dokter !== undefined) sheet.getRange(rowIndex, 3).setValue(contents.dokter);
      if (contents.team !== undefined) sheet.getRange(rowIndex, 4).setValue(contents.team);
      if (contents.tindakan !== undefined) sheet.getRange(rowIndex, 5).setValue(contents.tindakan);
      if (contents.komplain !== undefined) sheet.getRange(rowIndex, 6).setValue(contents.komplain);
      if (contents.jalanKeluar !== undefined) sheet.getRange(rowIndex, 7).setValue(contents.jalanKeluar);
      if (contents.status !== undefined) sheet.getRange(rowIndex, 8).setValue(contents.status);

      return jsonResponse({ status: "success", message: "Data berhasil diperbarui" });

    } else if (action === "delete") {
      var idToDelete = contents.id;
      if (!idToDelete) return jsonResponse({ status: "error", message: "ID wajib diisi" });

      var data = sheet.getDataRange().getValues();
      var rowIndex = -1;

      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() === idToDelete.toString()) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) return jsonResponse({ status: "error", message: "Data tidak ditemukan" });

      sheet.deleteRow(rowIndex);
      return jsonResponse({ status: "success", message: "Data berhasil dihapus" });
    }

    return jsonResponse({ status: "error", message: "Aksi tidak valid" });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * Menangani HTTP GET Request (Fetch Data)
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders(sheet);

    var data = sheet.getDataRange().getValues();
    var rows = [];

    for (var i = 1; i < data.length; i++) {
      rows.push({
        id: data[i][0],
        tanggal: data[i][1],
        dokter: data[i][2],
        team: data[i][3],
        tindakan: data[i][4],
        komplain: data[i][5],
        jalanKeluar: data[i][6],
        status: data[i][7] || "C3 - Moderate"
      });
    }

    return jsonResponse({ status: "success", data: rows });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * REKAPAN MINGGUAN OTOMATIS (Sesuai Status C1 - C4)
 */
function generateWeeklySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  ensureHeaders(sheet);
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  var now = new Date();
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  var totalMingguIni = 0;
  var statusCount = { 
    "C1 - Critical": 0, 
    "C2 - Major": 0, 
    "C3 - Moderate": 0, 
    "C4 - Minor": 0 
  };

  for (var i = 1; i < data.length; i++) {
    var tgl = new Date(data[i][1]);
    if (!isNaN(tgl) && tgl >= sevenDaysAgo) {
      totalMingguIni++;
      var st = data[i][7] || "C3 - Moderate";
      
      // Normalisasi nama status jika ada variasi string
      if (st.indexOf("C1") !== -1) statusCount["C1 - Critical"]++;
      else if (st.indexOf("C2") !== -1) statusCount["C2 - Major"]++;
      else if (st.indexOf("C4") !== -1) statusCount["C4 - Minor"]++;
      else statusCount["C3 - Moderate"]++;
    }
  }

  var summarySheet = ss.getSheetByName("Rekapan Mingguan");
  if (!summarySheet) {
    summarySheet = ss.insertSheet("Rekapan Mingguan");
    summarySheet.appendRow(["Tanggal Rekapan", "Total Kasus Minggu Ini", "C1 - Critical", "C2 - Major", "C3 - Moderate", "C4 - Minor"]);
    summarySheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#E2E8F0");
  }

  summarySheet.appendRow([
    now.toLocaleDateString("id-ID"),
    totalMingguIni,
    statusCount["C1 - Critical"],
    statusCount["C2 - Major"],
    statusCount["C3 - Moderate"],
    statusCount["C4 - Minor"]
  ]);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}