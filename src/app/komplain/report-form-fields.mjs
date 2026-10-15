// Shared between page.jsx (openForm/review validation, the field-conflicts banner) and
// ReportForm (the actual input/review JSX) — kept as plain data so both can import it without
// either one owning the other.
export const TINDAKAN_PRESETS = ['TKR ZIMMER', 'TKR NORMMED', 'THR ZIMMER', 'UKA OXFORD ZIMMER', 'THR NORMMED', 'BIPOLAR ZIMMER'];
export const fields = [
  ['tanggal', 'Tanggal kejadian', 'date'], ['dokter', 'Dokter', 'text'],
  ['rumahSakit', 'Rumah Sakit', 'text'], ['team', 'Team Pelapor', 'text'], ['tindakan', 'Tindakan Operasi', 'text'],
  ['komplain', 'Deskripsi Komplain', 'textarea'], ['jalanKeluar', 'Solusi awal (opsional)', 'textarea'], ['penangananSelanjutnya', 'Rencana tindak lanjut (opsional)', 'textarea'],
];
export const OPTIONAL_FIELDS = ['jalanKeluar', 'penangananSelanjutnya'];
// Team Pelapor is pre-filled with the reporter's broad unit (see REGISTRATION_UNITS in
// firebase-profile.mjs) as a starting point — these are the exact values that means it was never
// actually edited to the specific team/crew that reported the case.
export const GENERIC_TEAM_VALUES = ['TS', 'Logistik'];
export const fieldExamples = {
  tanggal: '2026-03-12', dokter: 'dr. Andi Saputra', rumahSakit: 'RS Harapan Bunda', team: 'Team yang operasi',
  tindakan: 'BIPOLAR ZIMMER', komplain: 'Dokter komplain mengenai ketidak lengkapan instrument dan implant',
  jalanKeluar: 'Menghubungi tim untuk mengantarkan kekurangan implant dan instrumen yang tidak lengkap',
  penangananSelanjutnya: 'Meminta tim untuk melakukan pengadaan instrument dan implant.',
};
export const FIELD_HINTS = {
  team: 'Isi nama team yang melaporkan kasus ini.',
  komplain: 'Jelaskan masalah secara singkat dan jelas.',
  jalanKeluar: 'Boleh dikosongkan jika belum ada penanganan.',
  penangananSelanjutnya: 'Boleh dikosongkan jika belum ada rencana lanjutan.',
};
