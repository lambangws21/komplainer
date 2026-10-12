import { randomUUID } from 'node:crypto';
import { initializeFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { firebaseApp } from './firebase-app.mjs';
import { ApiError } from './api-error.mjs';
import { REPORTS, BACKUPS, MENTIONS, mentionId, validId, backupId, mutateReport, canReadReport, publicReport, restrictedReport, validatePhotos } from './firestore-domain.mjs';
export const usesFirestore = () => process.env.DATA_PROVIDER === 'firestore';
export const firestoreDb = () => initializeFirestore(firebaseApp(), { preferRest: true });
export function photoBucket() {
  if (!process.env.FIREBASE_STORAGE_BUCKET) throw new ApiError('FIREBASE_STORAGE_BUCKET belum dikonfigurasi.', 503);
  return getStorage(firebaseApp()).bucket(process.env.FIREBASE_STORAGE_BUCKET);
}
export function publicHistory(entry, reportId) {
  let detail = {};
  try { detail = JSON.parse(entry.detail || '{}'); } catch { /* Legacy audit detail may be malformed. */ }
  return { ...entry, fotoUrls: [...(detail.fotoIds || []).map((id) => `/api/photo?report=${encodeURIComponent(reportId)}&id=${encodeURIComponent(id)}`), ...(detail.photoRefs || []).map((photo) => `/api/photo?report=${encodeURIComponent(reportId)}&path=${encodeURIComponent(photo.path)}`)] };
}
export async function executeFirestore(action, body, { user, accounts, db = firestoreDb(), upload = uploadPhotos, cleanup = cleanupPhotos }) {
  if (!user?.active || user.mustChangePassword || user.approval && user.approval !== 'approved') throw new ApiError('Akun tidak diizinkan mengakses laporan.', 403);
  const reports = db.collection(REPORTS);
  if (action === 'list') {
    const snapshot = await reports.get();
    return { status: 'success', data: snapshot.docs.map((doc) => doc.data()).filter((item) => !item.deletedAt && !item.migrationPending).map((item) => canReadReport(item, user) ? publicReport(item, accounts) : restrictedReport(item)), assignees: user.role === 'admin' ? accounts.filter((account) => account.active && (!account.approval || account.approval === 'approved') && ['petugas', 'pelapor'].includes(account.role)) : [] };
  }
  if (action === 'mentionables') {
    return { status: 'success', data: accounts.filter((account) => account.active && (!account.approval || account.approval === 'approved') && account.id !== user.id).map((account) => ({ id: account.id, nama: account.nama, role: account.role })) };
  }
  if (action === 'accountGuard') {
    if (user.role !== 'admin') throw new ApiError('Hanya admin dapat mengelola akun.', 403);
    if (body.active === false || body.role !== 'petugas') {
      const assigned = await reports.where('picId', '==', body.id).get();
      if (assigned.docs.some((doc) => !doc.data().deletedAt && doc.data().statusPenanganan !== 'Selesai')) throw new ApiError('Alihkan komplain aktif milik pengguna ini sebelum mengubah aksesnya.', 409);
    }
    return { status: 'success' };
  }
  const id = validId(action === 'create' ? `ID-${body.requestId || ''}` : body.id);
  const ref = reports.doc(id);
  const existing = await ref.get();
  const old = existing.exists ? existing.data() : null;
  if (action === 'detail') {
    if (!old || old.deletedAt || old.migrationPending || !canReadReport(old, user)) throw new ApiError('Laporan tidak ditemukan atau tidak dapat diakses.', 404);
    const history = await ref.collection('history').orderBy('tanggal', 'desc').get();
    return { status: 'success', data: publicReport(old, accounts), history: history.docs.map((doc) => publicHistory(doc.data(), id)) };
  }
  const incoming = validatePhotos(body.photos);
  const now = new Date().toISOString();
  const preflight = mutateReport(action, body, old, user, accounts, incoming.map(() => ({})), now);
  if (preflight.duplicate) return { status: 'success', data: publicReport(old, accounts), id };
  let uploaded = [];
  let committed = false;
  try {
    uploaded = await upload(incoming, id);
    const result = await db.runTransaction(async (transaction) => {
      const latest = await transaction.get(ref);
      const current = latest.exists ? latest.data() : null;
      const outcome = mutateReport(action, body, current, user, accounts, uploaded, now);
      if (outcome.duplicate) return outcome;
      if (action === 'create') {
        const limitRef = db.collection('komplainer_limits').doc(validId(user.id));
        const saved = await transaction.get(limitRef);
        const limit = saved.exists ? saved.data() : { startedAt: 0, count: 0 };
        const fresh = Date.now() - limit.startedAt > 300000;
        const count = fresh ? 1 : limit.count + 1;
        if (count > 30) throw new ApiError('Terlalu banyak laporan. Coba lagi beberapa menit lagi.', 429);
        transaction.set(limitRef, { startedAt: fresh ? Date.now() : limit.startedAt, count });
      }
      const jobId = backupId(id, outcome.item.version);
      transaction.set(ref, outcome.item);
      transaction.set(ref.collection('history').doc(outcome.history.id), outcome.history);
      transaction.set(db.collection(BACKUPS).doc(jobId), { id: jobId, reportId: id, version: outcome.item.version, report: outcome.item, history: outcome.history, newPhotos: uploaded, state: 'pending', attempts: 0, createdAt: now, nextAttemptAt: Date.now(), error: '' });
      for (const mentionedId of outcome.mentions || []) transaction.set(db.collection(MENTIONS).doc(mentionId(id, mentionedId)), { id: mentionId(id, mentionedId), reportId: id, mentionedUserId: mentionedId, byUserId: user.id, byNama: user.nama, snippet: (outcome.mentionSnippet || '').slice(0, 300), createdAt: now, read: false });
      return { ...outcome, jobId };
    });
    committed = !result.duplicate;
    if (!committed) await cleanup(uploaded);
    return { status: 'success', data: publicReport(result.item, accounts), id, action, mentions: result.mentions || [], ...(result.jobId ? { backupJobId: result.jobId } : {}) };
  } catch (error) {
    if (!committed) await cleanup(uploaded);
    throw error;
  }
}
export async function uploadPhotos(photos, id, prefix = 'komplainer/reports') {
  const uploaded = [];
  const bucket = photos.length ? photoBucket() : null;
  try {
    for (const photo of photos) {
      const path = `${prefix}/${id}/${randomUUID()}.${photo.mimeType === 'image/png' ? 'png' : photo.mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
      const file = bucket.file(path);
      await file.save(photo.bytes, { resumable: false, metadata: { contentType: photo.mimeType, cacheControl: 'private, no-store' } });
      uploaded.push({ path, mimeType: photo.mimeType, filename: photo.filename, bytes: photo.bytes.length });
    }
    return uploaded;
  } catch (error) { await cleanupPhotos(uploaded); throw error; }
}
export async function cleanupPhotos(photos) {
  if (photos.length) await Promise.allSettled(photos.map((photo) => photoBucket().file(photo.path).delete({ ignoreNotFound: true })));
}
export async function allowedPhoto(reportId, user, path, driveId, db = firestoreDb()) {
  const ref = db.collection(REPORTS).doc(validId(reportId));
  const doc = await ref.get();
  const item = doc.exists ? doc.data() : null;
  if (!item || item.deletedAt || !canReadReport(item, user)) throw new ApiError('Foto tidak dapat diakses.', 404);
  const history = await ref.collection('history').get();
  const refs = [...(item.photoRefs || [])];
  const ids = [...(item.fotoIds || [])];
  for (const entry of history.docs) {
    let detail = {}; try { detail = JSON.parse(entry.data().detail || '{}'); } catch { /* Keep old malformed logs readable. */ }
    refs.push(...(detail.photoRefs || [])); ids.push(...(detail.fotoIds || []));
  }
  if (path && refs.some((photo) => photo.path === path)) return refs.find((photo) => photo.path === path);
  if (driveId && ids.includes(driveId)) return { driveId };
  throw new ApiError('Foto tidak ditemukan pada laporan ini.', 404);
}
export async function listMentions(user, db = firestoreDb()) {
  const snapshot = await db.collection(MENTIONS).where('mentionedUserId', '==', validId(user.id)).where('read', '==', false).get();
  return snapshot.docs.map((doc) => doc.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export async function markMentionRead(user, id, db = firestoreDb()) {
  const ref = db.collection(MENTIONS).doc(validId(id));
  const doc = await ref.get();
  if (!doc.exists || doc.data().mentionedUserId !== user.id) throw new ApiError('Notifikasi tidak ditemukan.', 404);
  await ref.update({ read: true });
  return { status: 'success' };
}
