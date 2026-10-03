export const WORKFLOW_STATUSES = ['Baru', 'Diproses', 'Menunggu', 'Selesai'];
export const ROLE_LABELS = { admin: 'Admin', petugas: 'Petugas / PIC', pelapor: 'Pelapor' };
export const handlingStatus = (item) => item.statusPenanganan || 'Baru';
export const canEditReport = (item, user) => !!user && (user.role === 'admin' || (item.pelaporId === user.id && handlingStatus(item) === 'Baru'));
export const canFollowUp = (item, user) => handlingStatus(item) !== 'Selesai' && (user?.role === 'admin' || (!!user && item.picId === user.id));
export const canReopen = (item, user) => !!user && handlingStatus(item) === 'Selesai' && (user.role === 'admin' || item.pelaporId === user.id);
export const isOverdue = (item, today) => !!item.tenggat && item.tenggat < today && handlingStatus(item) !== 'Selesai';
