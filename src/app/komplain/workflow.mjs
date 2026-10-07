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
// Lets a card's color say at a glance whether a case has been picked up yet.
export function workflowCardStyle(item, today) {
  const status = handlingStatus(item);
  if (today && isOverdue(item, today)) return 'border-red-800/60 bg-red-950/10';
  if (status === 'Selesai') return 'border-emerald-800/60 bg-emerald-950/10';
  if (status === 'Baru') return 'border-slate-700/70 bg-slate-950/50';
  return 'border-blue-800/60 bg-blue-950/10';
}
