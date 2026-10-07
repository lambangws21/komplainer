import { detectImplants } from './implant.mjs';

const COLUMNS = [
  ['tanggal', 'Tanggal'], ['dokter', 'Dokter'], ['rumahSakit', 'Rumah Sakit'], ['team', 'Team Pelapor'],
  ['tindakan', 'Tindakan'], [(row) => detectImplants(row).map((implant) => implant.label).join(' + '), 'Implant'],
  ['komplain', 'Masalah'], ['jalanKeluar', 'Solusi Awal'], ['penangananSelanjutnya', 'RTL'],
  ['statusCase', 'Status Case'], ['status', 'Tingkat Keparahan'], ['statusPenanganan', 'Status Penanganan'], ['picNama', 'PIC'], ['tenggat', 'Tenggat'], ['pelaporNama', 'Pelapor'],
];
function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function cell(row, key) {
  return typeof key === 'function' ? key(row) : row[key];
}
export function reportsToCsv(rows) {
  const header = COLUMNS.map(([, label]) => escapeCsv(label)).join(',');
  const lines = rows.map((row) => COLUMNS.map(([key]) => escapeCsv(cell(row, key))).join(','));
  return ['﻿' + header, ...lines].join('\r\n');
}
// Groups rows by a field (e.g. team or tindakan) and counts Sukses/Ada Kendala, mirroring the
// "REKAP" sheet pattern: one row per group with Total Case / Sukses / Ada Kendala.
export function recapToCsv(rows, groupKey, groupLabel) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row[groupKey] || '').trim() || 'Belum diisi';
    const group = groups.get(key) || { total: 0, sukses: 0, kendala: 0 };
    group.total += 1;
    if (row.statusCase === 'Sukses') group.sukses += 1;
    else if (row.statusCase === 'Ada Kendala') group.kendala += 1;
    groups.set(key, group);
  });
  const header = [groupLabel, 'Total Case', 'Sukses', 'Ada Kendala'].map(escapeCsv).join(',');
  const lines = Array.from(groups.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, group]) => [key, group.total, group.sukses, group.kendala].map(escapeCsv).join(','));
  return ['﻿' + header, ...lines].join('\r\n');
}
export function downloadCsv(filename, csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
