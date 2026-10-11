import { ApiError } from './server/api-error.mjs';

export const ANNOUNCEMENT_AUDIENCES = { all: 'Semua pengguna', admin: 'Admin', petugas: 'PIC', pelapor: 'Pelapor', users: 'Pengguna tertentu' };
export function announcementAudience(item) {
  return ANNOUNCEMENT_AUDIENCES[item.audience || 'all'] || 'Penerima tidak valid';
}
export function canReceiveAnnouncement(item, user) {
  if (!user?.id) return false;
  const audience = item.audience ?? 'all';
  return audience === 'all' || (audience === 'users' ? Array.isArray(item.recipientIds) && item.recipientIds.includes(user.id) : ['admin', 'petugas', 'pelapor'].includes(audience) && audience === user.role);
}
export function visibleAnnouncements(items, { onlyActive = true, forUser = null, now = Date.now() } = {}) {
  return items.filter((item) => (!onlyActive || (item.active && (!item.expiresAt || new Date(item.expiresAt).getTime() > now))) && (!forUser || (canReceiveAnnouncement(item, forUser) && !(item.dismissedBy || []).includes(forUser.id))))
    .map((item) => {
      const copy = { ...item };
      delete copy.dismissedBy;
      if (forUser) delete copy.recipientIds;
      return copy;
    })
    .sort((a, b) => Number(b.priority === 'important') - Number(a.priority === 'important') || String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function announcementSettings(body) {
  const audience = body.audience ?? 'all';
  const priority = body.priority ?? 'info';
  if (!Object.hasOwn(ANNOUNCEMENT_AUDIENCES, audience)) throw new ApiError('Penerima pengumuman tidak valid.');
  if (!['info', 'important'].includes(priority)) throw new ApiError('Jenis pengumuman tidak valid.');
  let recipientIds = [];
  if (audience === 'users') {
    if (!Array.isArray(body.recipientIds) || !body.recipientIds.length || body.recipientIds.length > 100 || body.recipientIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 150)) throw new ApiError('Pilih 1–100 pengguna penerima.');
    recipientIds = [...new Set(body.recipientIds)];
  }
  return { audience, priority, recipientIds };
}
