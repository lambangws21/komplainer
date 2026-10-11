import { callBackup, syncBackupJob } from '../src/lib/server/firebase-backup.mjs';
import { firestoreDb } from '../src/lib/server/firestore-store.mjs';
import { BACKUPS } from '../src/lib/server/firestore-domain.mjs';
try {
  const health = await callBackup('backupHealth');
  if (health.protocol !== 'komplainer-backup-v1') throw Error('Apps Script belum mendukung backup.');
  const jobs = await firestoreDb().collection(BACKUPS).where('nextAttemptAt', '<=', Date.now() + (process.argv.includes('--force') ? 86400000 : 0)).orderBy('nextAttemptAt').get();
  let success = 0, failed = 0;
  for (const job of jobs.docs) {
    const result = await syncBackupJob(job.id, { force: process.argv.includes('--force') });
    if (result.success) success++; else if (!result.skipped) failed++;
  }
  console.log(JSON.stringify({ succeeded: success, failed }));
  if (failed) process.exitCode = 1;
} catch (error) { console.error(error.message || 'Backup gagal.'); process.exitCode = 1; }
