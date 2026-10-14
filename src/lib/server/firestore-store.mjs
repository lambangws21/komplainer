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
// Permanent removal, distinct from the soft-delete ("Arsipkan") action — only allowed once this
// exact version has a confirmed-successful backup job, so the data survives in Drive/Sheets
// before it's erased from Firestore/Storage. Shared by the single-report and bulk purge actions
// below; throws ApiError on any ineligibility so the bulk path can catch per-item and keep going.
async function purgeReport(targetId, version, { user, db, cleanup }) {
  if (user.role !== 'admin') throw new ApiError('Hanya admin dapat menghapus permanen laporan.', 403);
  const id = validId(targetId);
  const ref = db.collection(REPORTS).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Laporan tidak ditemukan.', 404);
  const old = doc.data();
  if (Number(version) !== old.version) throw new ApiError('Laporan sudah diperbarui. Muat ulang data lalu ulangi.', 409);
  const allJobs = await db.collection(BACKUPS).where('reportId', '==', id).get();
  const directJob = await db.collection(BACKUPS).doc(backupId(id, old.version)).get();
  // Reports migrated from the old Apps Script/Sheets system got their backup jobs keyed by a
  // one-off id scheme (migration:<id>:<version>:<eventId>, one per history event — see
  // scripts/migrate-firestore.mjs) instead of backupId(id, version). Fall back to the reportId
  // query above so pre-migration data that's genuinely backed up isn't blocked from being purged.
  const done = (directJob.exists && directJob.data().state === 'done') || allJobs.docs.some((entry) => entry.data().version === old.version && entry.data().state === 'done');
  if (!done) throw new ApiError('Laporan ini belum berhasil dibackup. Tidak dapat dihapus permanen.', 409);
  const history = await ref.collection('history').get();
  // photoRefs lives on the report for most actions, but followUp photos only ever land in that
  // history entry's own detail — mirror allowedPhoto()'s aggregation so nothing is missed.
  const photoPaths = new Set((old.photoRefs || []).map((photo) => photo.path));
  for (const entry of history.docs) {
    let detail = {}; try { detail = JSON.parse(entry.data().detail || '{}'); } catch { /* Legacy malformed detail — nothing to recover from it. */ }
    for (const photo of detail.photoRefs || []) photoPaths.add(photo.path);
  }
  await cleanup([...photoPaths].map((path) => ({ path })));
  const allMentions = await db.collection(MENTIONS).where('reportId', '==', id).get();
  const batch = db.batch();
  for (const entry of history.docs) batch.delete(entry.ref);
  for (const entry of allJobs.docs) batch.delete(entry.ref);
  for (const entry of allMentions.docs) batch.delete(entry.ref);
  batch.delete(ref);
  await batch.commit();
  return { id, dokter: old.dokter, deletedAt: new Date().toISOString() };
}
export async function executeFirestore(action, body, { user, accounts, db = firestoreDb(), upload = uploadPhotos, cleanup = cleanupPhotos }) {
  if (!user?.active || user.mustChangePassword || user.approval && user.approval !== 'approved') throw new ApiError('Akun tidak diizinkan mengakses laporan.', 403);
  const reports = db.collection(REPORTS);
  if (action === 'list') {
    const snapshot = await reports.get();
    const items = snapshot.docs.map((doc) => doc.data()).filter((item) => !item.deletedAt && !item.migrationPending);
    const data = items.map((item) => canReadReport(item, user) ? publicReport(item, accounts) : restrictedReport(item));
    // Admin-only, and only to drive the "Hapus permanen" eligibility marker in the table — one
    // batched getAll() keyed by each report's current version, not a query per row.
    if (user.role === 'admin' && items.length) {
      const states = await db.getAll(...items.map((item) => db.collection(BACKUPS).doc(backupId(item.id, item.version))));
      const byId = new Map();
      const misses = [];
      items.forEach((item, index) => {
        if (states[index].exists) byId.set(item.id, states[index].data().state);
        else { byId.set(item.id, 'none'); misses.push(item); }
      });
      // Migrated reports' backup jobs use a different id scheme (see purgeReport) — batch a
      // fallback query (chunked to Firestore's 30-item "in" limit) for the direct-lookup misses
      // instead of leaving genuinely backed-up legacy data stuck showing "Belum backup".
      for (let start = 0; start < misses.length; start += 30) {
        const chunk = misses.slice(start, start + 30);
        const fallback = await db.collection(BACKUPS).where('reportId', 'in', chunk.map((item) => item.id)).get();
        const doneVersions = new Map();
        fallback.docs.forEach((entry) => {
          const job = entry.data();
          if (job.state !== 'done') return;
          const set = doneVersions.get(job.reportId) || new Set();
          set.add(job.version); doneVersions.set(job.reportId, set);
        });
        for (const item of chunk) if (doneVersions.get(item.id)?.has(item.version)) byId.set(item.id, 'done');
      }
      for (const item of data) item.backupState = byId.get(item.id) || 'none';
    }
    return { status: 'success', data, assignees: user.role === 'admin' ? accounts.filter((account) => account.active && (!account.approval || account.approval === 'approved') && ['petugas', 'pelapor'].includes(account.role)) : [] };
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
  if (action === 'purge') {
    // A minimal deletedAt-carrying stub, not the full report shape — applyMutationResult on the
    // client only needs `deletedAt` truthy to drop this id from the in-memory list, same as a
    // soft-delete does.
    const data = await purgeReport(body.id, body.version, { user, db, cleanup });
    return { status: 'success', id: data.id, action: 'purge', data };
  }
  if (action === 'bulkPurge') {
    if (user.role !== 'admin') throw new ApiError('Hanya admin dapat menghapus permanen laporan.', 403);
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    if (!items.length) throw new ApiError('Tidak ada laporan yang dipilih.');
    const results = [];
    for (const entry of items) {
      try { results.push({ id: entry.id, status: 'ok', data: await purgeReport(entry.id, entry.version, { user, db, cleanup }) }); }
      catch (error) { results.push({ id: entry.id, status: 'error', message: error.message || 'Gagal menghapus laporan.' }); }
    }
    return { status: 'success', action: 'bulkPurge', results };
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
