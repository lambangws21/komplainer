const COLUMNS = [
  ['tanggal', 'Tanggal'], ['dokter', 'Dokter'], ['rumahSakit', 'Rumah Sakit'], ['team', 'Team Pelapor'],
  ['tindakan', 'Tindakan'], ['komplain', 'Masalah'], ['jalanKeluar', 'Solusi Awal'], ['penangananSelanjutnya', 'Penanganan Selanjutnya'],
  ['status', 'Tingkat Keparahan'], ['statusPenanganan', 'Status Penanganan'], ['picNama', 'PIC'], ['tenggat', 'Tenggat'], ['pelaporNama', 'Pelapor'],
];
function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function reportsToCsv(rows) {
  const header = COLUMNS.map(([, label]) => escapeCsv(label)).join(',');
  const lines = rows.map((row) => COLUMNS.map(([key]) => escapeCsv(row[key])).join(','));
  return ['﻿' + header, ...lines].join('\r\n');
}
export function downloadCsv(filename, csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
