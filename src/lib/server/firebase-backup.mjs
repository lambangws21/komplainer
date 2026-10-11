import { randomUUID, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { firestoreDb, photoBucket, usesFirestore } from './firestore-store.mjs';
import { BACKUPS } from './firestore-domain.mjs';
import { ApiError } from './api-error.mjs';
export const backupEnabled = () => usesFirestore() && process.env.FIREBASE_BACKUP_ENABLED === 'true';
export function cronAuthorized(header, secret) {
  if (!secret || secret.length < 32 || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${secret}`); const supplied = Buffer.from(header);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export function retryDelay(attempts) { return Math.min(86400000, 60000 * 2 ** Math.min(attempts, 10)); }
export async function callBackup(action, payload = {}, fetcher = fetch) {
  const url = process.env.GOOGLE_SCRIPT_URL;
  const apiKey = process.env.GOOGLE_SCRIPT_API_KEY;
  if (!url || !apiKey) throw new ApiError('Endpoint backup Apps Script belum dikonfigurasi.', 503);
  const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action, apiKey }), signal: AbortSignal.timeout(25000), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') throw new ApiError('Backup Apps Script belum berhasil. Periksa deployment dan API key.', 502);
  return result;
}
export async function syncBackupJob(id, { db = firestoreDb(), send = callBackup, loadPhoto = async (photo) => { const [bytes] = await photoBucket().file(photo.path).download(); return bytes; }, force = false } = {}) {
  const ref = db.collection(BACKUPS).doc(id);
  const token = randomUUID();
  const job = await db.runTransaction(async (transaction) => {
    const saved = await transaction.get(ref);
    if (!saved.exists) return null;
    const item = saved.data();
    if (item.state === 'done' || item.state === 'processing' && item.leaseUntil > Date.now() || !force && item.nextAttemptAt > Date.now()) return null;
    transaction.update(ref, { state: 'processing', leaseToken: token, leaseUntil: Date.now() + 120000, nextAttemptAt: Date.now() + 120000 });
    return item;
  });
  if (!job) return { skipped: true };
  let result, failed = false;
  try {
    const photos = [];
    for (const photo of job.newPhotos || []) {
      if (photo.legacyDriveId) continue;
      const bytes = await loadPhoto(photo);
      if (bytes.length > 5000000) throw new Error('Invalid stored photo size');
      photos.push({ path: photo.path, filename: photo.filename, mimeType: photo.mimeType, base64: bytes.toString('base64') });
    }
    result = await send('backupSync', { eventId: job.id, report: job.report, history: job.history, photos });
  } catch { failed = true; }
  await db.runTransaction(async (transaction) => {
    const saved = await transaction.get(ref);
    if (!saved.exists || saved.data().leaseToken !== token) return;
    const attempts = (job.attempts || 0) + 1;
    transaction.update(ref, failed ? { state: 'failed', attempts, error: 'Backup tertunda. Periksa Apps Script atau koneksi; sistem akan mencoba ulang.', nextAttemptAt: Date.now() + retryDelay(attempts), leaseToken: '', leaseUntil: 0 } : { state: 'done', attempts, completedAt: new Date().toISOString(), drivePhotoCount: result.photoCount || 0, error: '', nextAttemptAt: FieldValue.delete(), leaseToken: '', leaseUntil: 0 });
  });
  return { success: !failed };
}
export async function drainBackupQueue({ limit = 5, force = false, db = firestoreDb() } = {}) {
  if (!backupEnabled()) return { processed: 0, disabled: true };
  const jobs = await db.collection(BACKUPS).where('nextAttemptAt', '<=', force ? Date.now() + 86400000 : Date.now()).orderBy('nextAttemptAt').limit(limit).get();
  const started = Date.now(); const results = [];
  for (const job of jobs.docs) {
    if (Date.now() - started > 20000) break;
    results.push(await syncBackupJob(job.id, { db, force }));
  }
  return { processed: results.filter((result) => !result.skipped).length, succeeded: results.filter((result) => result.success).length };
}
export async function backupStatus() {
  if (!usesFirestore()) return { provider: 'apps-script', enabled: false };
  const jobs = firestoreDb().collection(BACKUPS);
  const counts = await Promise.all(['pending', 'processing', 'failed', 'done'].map(async (state) => [state, (await jobs.where('state', '==', state).count().get()).data().count]));
  const recent = await jobs.orderBy('createdAt', 'desc').limit(10).get();
  return { provider: 'firestore', enabled: backupEnabled(), counts: Object.fromEntries(counts), jobs: recent.docs.map((doc) => { const item = doc.data(); return { id: doc.id, reportId: item.reportId, version: item.version, state: item.state, attempts: item.attempts, error: item.error, completedAt: item.completedAt || null }; }) };
}
