import { randomUUID } from 'node:crypto';
import { initializeFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseApp } from './firebase-app.mjs';
import { announcementSettings, canReceiveAnnouncement, visibleAnnouncements } from '../announcement-policy.mjs';
import { firebaseDirectory } from './firebase-accounts';
import { ApiError } from './api-error.mjs';
const ANNOUNCEMENTS = 'komplainer_announcements';
const db = () => initializeFirestore(firebaseApp(), { preferRest: true });
function announcementRef(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) throw new ApiError('Pengumuman tidak ditemukan.', 404);
  return db().collection(ANNOUNCEMENTS).doc(id);
}
function requireAdmin(user) { if (user.role !== 'admin') throw new ApiError('Hanya admin dapat mengelola pengumuman.', 403); }
function text(value, label, required, max) {
  if (typeof value !== 'string') throw new ApiError(`${label} tidak valid.`);
  const result = value.trim();
  if (required && !result) throw new ApiError(`${label} wajib diisi.`);
  if (result.length > max) throw new ApiError(`${label} terlalu panjang.`);
  return result;
}
export async function listAnnouncements({ onlyActive = true, forUser = null } = {}) {
  const snapshot = await db().collection(ANNOUNCEMENTS).get();
  return visibleAnnouncements(snapshot.docs.map((doc) => doc.data()), { onlyActive, forUser });
}
export async function dismissAnnouncement(user, id) {
  const ref = announcementRef(id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Pengumuman tidak ditemukan.', 404);
  if (!canReceiveAnnouncement(doc.data(), user)) throw new ApiError('Pengumuman tidak ditemukan.', 404);
  await ref.update({ dismissedBy: FieldValue.arrayUnion(user.id) });
  return { status: 'success' };
}
async function settings(body) {
  const result = announcementSettings(body);
  if (result.audience === 'users') {
    const accounts = await firebaseDirectory();
    if (result.recipientIds.some((id) => !accounts.some((account) => account.id === id && account.active))) throw new ApiError('Penerima harus merupakan pengguna aktif yang disetujui.');
  }
  return result;
}
const DURATIONS = [1, 3, 7, 14, 30];
function expiryFromDuration(durationDays, now) {
  if (durationDays == null) return '';
  if (!DURATIONS.includes(durationDays)) throw new ApiError('Durasi tampil tidak valid.');
  return new Date(now.getTime() + durationDays * 86400000).toISOString();
}
export async function createAnnouncement(user, body) {
  requireAdmin(user);
  const now = new Date();
  const item = { ...await settings(body), id: randomUUID(), title: text(body.title, 'Judul', true, 150), body: text(body.body, 'Isi pengumuman', true, 2000), active: true, expiresAt: expiryFromDuration(body.durationDays ?? null, now), createdBy: user.id, createdByNama: user.nama, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  await db().collection(ANNOUNCEMENTS).doc(item.id).set(item);
  return { status: 'success', data: item };
}
export async function updateAnnouncement(user, body) {
  requireAdmin(user);
  const ref = announcementRef(body.id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Pengumuman tidak ditemukan.', 404);
  const update = { updatedAt: new Date().toISOString() };
  if (['audience', 'priority', 'recipientIds'].some((key) => body[key] !== undefined)) Object.assign(update, await settings({ ...doc.data(), ...body }));
  if (body.title !== undefined) update.title = text(body.title, 'Judul', true, 150);
  if (body.body !== undefined) update.body = text(body.body, 'Isi pengumuman', true, 2000);
  if (body.active !== undefined) { if (typeof body.active !== 'boolean') throw new ApiError('Status tidak valid.'); update.active = body.active; }
  if (body.durationDays !== undefined) update.expiresAt = expiryFromDuration(body.durationDays, new Date());
  await ref.update(update);
  return { status: 'success', data: { ...doc.data(), ...update } };
}
export async function deleteAnnouncement(user, id) {
  requireAdmin(user);
  await announcementRef(id).delete();
  return { status: 'success' };
}
