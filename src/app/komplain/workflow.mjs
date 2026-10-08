export const WORKFLOW_STATUSES = ['Baru', 'Diproses', 'Menunggu', 'Selesai'];
export const ROLE_LABELS = { admin: 'Admin', petugas: 'Petugas / PIC', pelapor: 'Pelapor' };
// Set by the reporter at creation. Severity (C1-C4) is a separate, PIC-only judgment made later.
export const STATUS_CASE = [
  { code: 'Sukses', label: 'Sukses', color: 'text-emerald-300 border-emerald-800 bg-emerald-950/40' },
  { code: 'Ada Kendala', label: 'Ada Kendala', color: 'text-red-300 border-red-800 bg-red-950/40' },
];
export const handlingStatus = (item) => item.statusPenanganan || 'Baru';
export const canEditReport = (item, user) => !!user && (user.role === 'admin' || (item.pelaporId === user.id && handlingStatus(item) === 'Baru'));
export const canFollowUp = (item, user) => handlingStatus(item) !== 'Selesai' && (user?.role === 'admin' || (!!user && item.picId === user.id));
export const canReopen = (item, user) => !!user && handlingStatus(item) === 'Selesai' && (user.role === 'admin' || item.pelaporId === user.id);
export const isOverdue = (item, today) => !!item.tenggat && item.tenggat < today && handlingStatus(item) !== 'Selesai';
export function daysSince(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate).getTime();
  return Number.isNaN(parsed) ? null : Math.floor((Date.now() - parsed) / 86400000);
}
// Which editable fields an "update" audit entry actually changed, as readable labels.
const CONTENT_FIELD_LABELS = { tanggal: 'Tanggal', dokter: 'Dokter', rumahSakit: 'Rumah Sakit', team: 'Team', tindakan: 'Tindakan', komplain: 'Masalah', jalanKeluar: 'Solusi', penangananSelanjutnya: 'RTL' };
export function editedFieldLabels(detailJson) {
  try {
    const detail = JSON.parse(detailJson || '{}');
    return Array.isArray(detail.fields) ? detail.fields.map((key) => CONTENT_FIELD_LABELS[key] || key) : [];
  } catch { return []; }
}
// Pulls whichever tracked before/after values changed out of a history entry's raw detail
// JSON (PIC, tenggat, severity, status case, workflow status) — whatever the action touched.
const TRACKED_KEYS = ['statusPenanganan', 'picNama', 'tenggat', 'status', 'statusCase'];
export function historyChanges(detailJson) {
  try {
    const detail = JSON.parse(detailJson || '{}');
    if (!detail.before || !detail.after) return [];
    return TRACKED_KEYS.filter((key) => detail.before[key] !== undefined && detail.after[key] !== undefined && detail.before[key] !== detail.after[key]).map((key) => ({ key, before: detail.before[key], after: detail.after[key] }));
  } catch { return []; }
}
const CHANGE_LABELS = { statusPenanganan: 'Status', picNama: 'PIC', tenggat: 'Tenggat', status: 'Tingkat keparahan', statusCase: 'Status Case' };
// Formats one historyChanges() entry into readable text; needs the caller's LEVELS list and
// formatDate so this file stays free of UI concerns.
export function formatHistoryChange(change, levelsList, formatDateFn) {
  const format = (value) => {
    if (change.key === 'status') return levelsList.find((level) => level.code === value)?.label || 'Belum ditentukan';
    if (change.key === 'picNama') return value || 'Belum ditugaskan';
    if (change.key === 'tenggat') return value ? formatDateFn(value) : 'Belum ditentukan';
    if (change.key === 'statusCase') return value || '-';
    return value;
  };
  return `${CHANGE_LABELS[change.key]}: ${format(change.before)} → ${format(change.after)}`;
}
// Lets a card's color say at a glance whether a case has been picked up yet.
export function workflowCardStyle(item, today) {
  const status = handlingStatus(item);
  if (today && isOverdue(item, today)) return 'border-red-800/60 bg-red-950/10';
  if (status === 'Selesai') return 'border-emerald-800/60 bg-emerald-950/10';
  if (status === 'Baru') return 'border-slate-700/70 bg-slate-950/50';
  return 'border-blue-800/60 bg-blue-950/10';
}
