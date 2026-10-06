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
  const approval = meta.approval || 'approved'; // Preserve previously approved accounts.
  return { id: profileId(account.uid), firebaseUid: account.uid, nama: account.displayName || account.email?.split('@')[0] || 'Pengguna', email: account.email, username: meta.username || null, role: meta.role, unit: meta.unit || 'Belum diisi', approval, active: !account.disabled && meta.active !== false && approval === 'approved', mustChangePassword: meta.mustChangePassword === true };
}
export function requireApprovedProfile(user) {
  if (!user || user.approval && user.approval !== 'approved') throw new ApiError(user?.approval === 'rejected' ? 'Pendaftaran ditolak. Hubungi admin.' : 'Akun menunggu persetujuan admin.', 403);
  if (!user.active) throw new ApiError('Akun dinonaktifkan. Hubungi admin.', 403);
  return user;
}
export const REGISTRATION_UNITS = ['TS', 'Logistik'];
export function registrationMetadata(unit, username) {
  return { role: 'pelapor', unit, active: true, approval: 'pending', mustChangePassword: false, username: username || null };
}
export function usernameField(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)) throw new ApiError('Username harus 3-32 karakter: huruf kecil, angka, titik (.), garis bawah (_), atau strip (-), dan diawali huruf atau angka.');
  return username;
}
export function assertUsernameAvailable(accounts, username, exceptFirebaseUid) {
  if (username && accounts.some((item) => item.username === username && item.firebaseUid !== exceptFirebaseUid)) throw new ApiError('Username sudah digunakan akun lain.', 409);
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
