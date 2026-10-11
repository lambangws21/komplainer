import 'server-only';
import { randomUUID } from 'node:crypto';
import { ApiError } from './api-error.mjs';
import { REPORTS, validId, text, date, canReadReport, validatePhotos } from './firestore-domain.mjs';
import { firestoreDb, uploadPhotos, cleanupPhotos } from './firestore-store.mjs';

export const SCHEDULES = 'komplainer_schedules';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PHOTOS = 5;

export function scheduleVisible(item, user) {
  return user.role === 'admin' || item.createdBy === user.id || item.picId === user.id;
}

function time(value, label) {
  if (typeof value !== 'string' || !TIME.test(value)) throw new ApiError(`${label} tidak valid.`);
  return value;
}

// Set only when the location came from a picked geocode suggestion (see location-search.jsx) —
// free-typed text has no coordinates, and that's fine, it just falls back to a text Maps search.
function coord(value, label, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) throw new ApiError(`${label} tidak valid.`);
  return num;
}

// Mirrors publicReport()'s shape: raw storage paths stay server-side, the client only ever
// sees proxied /api/photo URLs.
function publicSchedule(item) {
  const { photoRefs = [], ...result } = item;
  result.fotoUrls = photoRefs.map((photo) => `/api/photo?schedule=${encodeURIComponent(item.id)}&path=${encodeURIComponent(photo.path)}`);
  return result;
}

async function scheduleFields(body, user, accounts, db) {
  const title = text(body.title, 'Judul', true, 200);
  const location = text(body.location, 'Lokasi', false, 300);
  const locationLat = coord(body.locationLat, 'Koordinat lokasi', -90, 90);
  const locationLng = coord(body.locationLng, 'Koordinat lokasi', -180, 180);
  const notes = text(body.notes, 'Catatan', false, 1000);
  const eventDate = date(body.date);
  const startTime = time(body.startTime, 'Waktu mulai');
  const endTime = time(body.endTime, 'Waktu selesai');
  if (endTime <= startTime) throw new ApiError('Waktu selesai harus setelah waktu mulai.');
  const pic = body.picId ? accounts.find((account) => account.id === body.picId && account.active && (!account.approval || account.approval === 'approved')) : null;
  if (body.picId && !pic) throw new ApiError('Pilih pengguna aktif sebagai PIC jadwal.');
  let reportId = '';
  if (body.reportId) {
    reportId = validId(body.reportId);
    const reportDoc = await db.collection(REPORTS).doc(reportId).get();
    const report = reportDoc.exists ? reportDoc.data() : null;
    if (!report || report.deletedAt || !canReadReport(report, user)) throw new ApiError('Laporan terkait tidak ditemukan atau tidak dapat diakses.', 404);
  }
  return { title, location, locationLat, locationLng, notes, date: eventDate, startTime, endTime, picId: pic?.id || '', picNama: pic?.nama || '', reportId };
}

export async function allowedSchedulePhoto(scheduleId, user, path, db = firestoreDb()) {
  const doc = await db.collection(SCHEDULES).doc(validId(scheduleId)).get();
  const item = doc.exists ? doc.data() : null;
  if (!item || !scheduleVisible(item, user)) throw new ApiError('Foto tidak dapat diakses.', 404);
  const match = (item.photoRefs || []).find((photo) => photo.path === path);
  if (!match) throw new ApiError('Foto tidak ditemukan pada jadwal ini.', 404);
  return match;
}

export async function executeSchedule(action, body, { user, accounts, db = firestoreDb() }) {
  if (!user?.active || user.approval && user.approval !== 'approved' || user.mustChangePassword) throw new ApiError('Akun tidak diizinkan mengakses jadwal.', 403);
  const schedules = db.collection(SCHEDULES);
  if (action === 'list') {
    const snapshot = await schedules.get();
    return { status: 'success', data: snapshot.docs.map((doc) => doc.data()).filter((item) => scheduleVisible(item, user)).map(publicSchedule) };
  }
  const now = new Date().toISOString();
  if (action === 'create') {
    const fields = await scheduleFields(body, user, accounts, db);
    const incoming = validatePhotos(body.photos);
    if (incoming.length > MAX_PHOTOS) throw new ApiError(`Maksimal ${MAX_PHOTOS} foto per jadwal.`);
    const id = `SCH-${randomUUID()}`;
    const photoRefs = await uploadPhotos(incoming, id, 'komplainer/schedules');
    const item = { ...fields, id, photoRefs, createdBy: user.id, createdByNama: user.nama, createdAt: now, updatedAt: now };
    try { await schedules.doc(id).set(item); } catch (error) { await cleanupPhotos(photoRefs); throw error; }
    return { status: 'success', data: publicSchedule(item) };
  }
  const id = validId(body.id);
  const ref = schedules.doc(id);
  const existing = await ref.get();
  const old = existing.exists ? existing.data() : null;
  if (!old) throw new ApiError('Jadwal tidak ditemukan.', 404);
  if (user.role !== 'admin' && old.createdBy !== user.id) throw new ApiError('Hanya pembuat jadwal atau admin yang dapat mengubahnya.', 403);
  if (action === 'update') {
    const fields = await scheduleFields(body, user, accounts, db);
    const incoming = validatePhotos(body.photos);
    if ((old.photoRefs || []).length + incoming.length > MAX_PHOTOS) throw new ApiError(`Maksimal ${MAX_PHOTOS} foto per jadwal.`);
    const uploaded = await uploadPhotos(incoming, id, 'komplainer/schedules');
    const item = { ...old, ...fields, photoRefs: [...(old.photoRefs || []), ...uploaded], updatedAt: now };
    try { await ref.set(item); } catch (error) { await cleanupPhotos(uploaded); throw error; }
    return { status: 'success', data: publicSchedule(item) };
  }
  if (action === 'delete') {
    await ref.delete();
    await cleanupPhotos(old.photoRefs || []);
    return { status: 'success', data: publicSchedule({ ...old, deletedAt: now }) };
  }
  throw new ApiError('Aksi jadwal tidak valid.');
}
