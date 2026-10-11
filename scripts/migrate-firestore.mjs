import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { firestoreDb, photoBucket } from '../src/lib/server/firestore-store.mjs';
import { callBackup } from '../src/lib/server/firebase-backup.mjs';
import { REPORTS, BACKUPS, validId } from '../src/lib/server/firestore-domain.mjs';

const apply = process.argv.includes('--apply');
const source = process.argv.includes('--source-backup') ? 'backup' : 'original';
let locked = false;
let wasLocked = false;
let complete = false;
try {
  const health = await callBackup('backupHealth');
  wasLocked = !!health.writeLocked;
  if (health.protocol !== 'komplainer-backup-v1') throw Error('Deploy docs/appscript.gs terbaru sebelum migrasi.');
  if (apply && source === 'original') { await callBackup('backupMaintenance', { enabled: true }); locked = true; }
  const data = []; let offset = 0;
  do {
    const result = await callBackup('backupExport', { offset, source });
    data.push(...result.data); offset = result.nextOffset;
  } while (offset != null);
  const photoIds = new Set();
  for (const entry of data) {
    validId(entry.report.id);
    (entry.report.fotoIds || []).forEach((id) => photoIds.add(id));
    for (const event of entry.history) {
      try { (JSON.parse(event.detail || '{}').fotoIds || []).forEach((id) => photoIds.add(id)); } catch { /* Preserve malformed legacy detail. */ }
    }
  }
  const summary = { mode: apply ? 'apply' : 'dry-run', reports: data.length, archived: data.filter((entry) => entry.report.deletedAt).length, history: data.reduce((sum, entry) => sum + entry.history.length, 0), photos: photoIds.size };
  console.log(JSON.stringify(summary));
  if (!apply) { console.log('Tidak ada data yang ditulis. Gunakan --apply setelah source write dihentikan sementara.'); process.exit(0); }
  // Local immutable source copy is private and gitignored. Never print report contents.
  await mkdir('.local-backups', { recursive: true, mode: 0o700 });
  await writeFile(`.local-backups/migration-${Date.now()}.json`, JSON.stringify(data), { mode: 0o600 });
  const db = firestoreDb();
  const bucket = photoBucket();
  let imported = 0, skipped = 0;
  for (const entry of data) {
    const original = entry.report;
    const ref = db.collection(REPORTS).doc(original.id);
    const existing = await ref.get();
    const sourceDigest = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
    if (existing.exists && !existing.data().migrationPending) {
      if (existing.data().migrationSourceHash !== sourceDigest || existing.data().version !== original.version || existing.data().updatedAt !== original.updatedAt) throw Error('Target berbeda dari sumber. Migrasi berhenti tanpa menimpa laporan yang sudah ada.');
      const importedEvents = await ref.collection('history').get();
      if (entry.history.some((event) => !importedEvents.docs.some((doc) => doc.id === event.id))) throw Error('Riwayat target belum lengkap; periksa migrasi sebelum melanjutkan.');
      skipped++; continue;
    }
    const copied = new Map();
    const photoRef = async (id) => {
      if (copied.has(id)) return copied.get(id);
      if (!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) throw Error('ID foto lama tidak valid.');
      const response = await fetch(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      const mimeType = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw Error('Foto Drive lama tidak dapat dibaca. Tidak mengalihkan database.');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5000000) throw Error('Foto lama melampaui batas 5MB.');
      const path = `komplainer/reports/${original.id}/legacy-${id}`;
      await bucket.file(path).save(bytes, { resumable: false, metadata: { contentType: mimeType, cacheControl: 'private, no-store' } });
      const photo = { path, mimeType, filename: `legacy-${id}.jpg`, bytes: bytes.length, legacyDriveId: id };
      copied.set(id, photo); return photo;
    };
    const report = { ...original, photoRefs: await Promise.all((original.fotoIds || []).map(photoRef)), fotoIds: [] };
    const history = [];
    for (const event of entry.history) {
      validId(event.id);
      let detail = {}; try { detail = JSON.parse(event.detail || '{}'); } catch { detail = { legacyDetail: event.detail }; }
      if (detail.fotoIds?.length) { detail.photoRefs = await Promise.all(detail.fotoIds.map(photoRef)); delete detail.fotoIds; }
      history.push({ ...event, detail: JSON.stringify(detail) });
    }
    report.photoCount = report.photoRefs.length + history.reduce((count, event) => count + (JSON.parse(event.detail).photoRefs || []).length, 0);
    const migrationReport = { ...report, migrationSourceHash: sourceDigest, migrationPending: true };
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (current.exists && (!current.data().migrationPending || current.data().migrationSourceHash !== sourceDigest)) throw Error('Target berbeda/berubah. Migrasi tidak menimpa data aktif.');
      transaction.set(ref, migrationReport);
    });
    const events = history.length ? history : [null];
    for (let start = 0; start < events.length; start += 50) {
      const batch = db.batch();
      for (const event of events.slice(start, start + 50)) {
        if (event) batch.set(ref.collection('history').doc(event.id), event);
        const id = createHash('sha256').update(`migration:${report.id}:${report.version}:${event?.id || 'snapshot'}`).digest('hex');
        const jobRef = db.collection(BACKUPS).doc(id);
        if (!(await jobRef.get()).exists) batch.create(jobRef, { id, reportId: report.id, version: report.version, report, history: event, newPhotos: [], state: 'pending', attempts: 0, createdAt: new Date().toISOString(), nextAttemptAt: Date.now(), error: '' });
      }
      await batch.commit();
    }
    const copiedHistory = await ref.collection('history').get();
    if (history.some((event) => !copiedHistory.docs.some((doc) => doc.id === event.id && doc.data().detail === event.detail))) throw Error('Verifikasi riwayat gagal.');
    await ref.update({ migrationPending: false });
    const verified = await ref.get();
    if (!verified.exists || verified.data().version !== report.version) throw Error('Verifikasi target gagal.');
    imported++;
  }
  // A second export detects writes during migration; no provider/env is switched automatically.
  const verification = []; offset = 0;
  do { const result = await callBackup('backupExport', { offset, source }); verification.push(...result.data); offset = result.nextOffset; } while (offset != null);
  const sourceHash = (rows) => createHash('sha256').update(JSON.stringify(rows.map((row) => ({ report: row.report, history: row.history })).sort((a,b) => a.report.id.localeCompare(b.report.id)))).digest('hex');
  if (sourceHash(data) !== sourceHash(verification)) throw Error('Sumber berubah selama migrasi. Jangan aktifkan Firestore sebelum rekonsiliasi.');
  complete = true;
  console.log(JSON.stringify({ imported, skipped, verified: true, activation: 'manual', pending: 'Pastikan backup selesai sebelum DATA_PROVIDER=firestore dan redeploy.' }));
} catch (error) {
  console.error(error.message || 'Migrasi gagal. Database utama belum dialihkan.');
  process.exitCode = 1;
}

finally {
  if (locked && !wasLocked && (!complete || !process.argv.includes('--keep-write-lock'))) { await callBackup('backupMaintenance', { enabled: false }).catch(() => { console.error('Lepaskan FIRESTORE_WRITE_LOCK di Script Properties sebelum memakai mode lama.'); }); }
  if (locked && complete && process.argv.includes('--keep-write-lock')) console.log('Sumber tetap read-only untuk cutover. Setelah aplikasi Firestore aktif, pertahankan lock agar penulisan lama tidak berjalan lagi.');
}
