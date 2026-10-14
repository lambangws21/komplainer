import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { callScript, json, errorResponse, ApiError } from '@/lib/server/apps-script';
import { callBackup } from '@/lib/server/firebase-backup.mjs';

export const maxDuration = 60;
async function requireAdmin() {
  const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
  if (user.role !== 'admin' || user.mustChangePassword) throw new ApiError('Hanya admin dapat melihat data backup.', 403);
}
// Reads the "Firebase Backup" sheet directly — the actual mirror backupSync writes into on every
// successful job, not Firestore's own bookkeeping — so this shows exactly what's really sitting
// in Google Sheets. Paginated 25 rows/call on the Apps Script side; looped here (capped) so the
// admin gets one flat table instead of wiring pagination through another round trip.
export async function GET() {
  try {
    await requireAdmin();
    const reports = [];
    let offset = 0;
    let truncated = false;
    for (let i = 0; i < 40; i++) {
      const result = await callBackup('backupExport', { offset, source: 'backup' });
      reports.push(...result.data);
      if (result.nextOffset == null) break;
      offset = result.nextOffset;
      if (i === 39) truncated = true;
    }
    return json({ status: 'success', data: { total: reports.length, reports, truncated } });
  } catch (error) { return errorResponse(error); }
}
