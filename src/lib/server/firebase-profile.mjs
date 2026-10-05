import { createHash } from 'node:crypto';
import { complaintUserId } from './firebase-identity.mjs';
import { ApiError } from './api-error.mjs';

export function profileId(uid) {
  try { return complaintUserId(uid); } catch {
    const hex = createHash('sha256').update(uid).digest('hex').slice(0, 32);
    return `USR-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
export function profileFromAccount(account) {
  const meta = account.customClaims?.komplainer;
  if (!meta || !['admin', 'pelapor', 'petugas'].includes(meta.role)) return null;
  return { id: profileId(account.uid), firebaseUid: account.uid, nama: account.displayName || account.email?.split('@')[0] || 'Pengguna', email: account.email, role: meta.role, unit: meta.unit || 'Belum diisi', active: !account.disabled && meta.active !== false, mustChangePassword: meta.mustChangePassword === true };
}
export function appClaims(account, metadata) {
  const claims = { ...account.customClaims, komplainer: metadata };
  if (Buffer.byteLength(JSON.stringify(claims)) > 1000) throw new ApiError('Team Pelapor terlalu panjang untuk profil Firebase. Gunakan nama yang lebih singkat.');
  return claims;
}
export function assertAccountChange(target, change, accounts, configuredAdminUid) {
  if (!['admin', 'pelapor', 'petugas'].includes(change.role) || typeof change.active !== 'boolean') throw new ApiError('Peran atau status akun tidak valid.');
  if (target.firebaseUid === configuredAdminUid && (change.role !== 'admin' || !change.active)) throw new ApiError('Admin utama tidak dapat dinonaktifkan atau diturunkan perannya.', 409);
  if (target.role === 'admin' && target.active && (change.role !== 'admin' || !change.active) && accounts.filter((user) => user.role === 'admin' && user.active).length <= 1) throw new ApiError('Admin aktif terakhir harus tetap aktif.', 409);
}
