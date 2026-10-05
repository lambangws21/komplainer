// Namespace accounts to avoid modifying users belonging to other apps in the project.
export const firebaseUid = (id) => `komplainer:${id}`;
export function complaintUserId(uid) {
  if (!/^komplainer:USR-[a-f0-9-]{36}$/i.test(String(uid))) throw new Error('Akun bukan milik Komplainer.');
  return uid.slice('komplainer:'.length);
}
export function firebaseEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (value === 'lambangws') return 'lambangws@komplainer.invalid';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) throw new Error('Email/username tidak valid.');
  return value;
}
