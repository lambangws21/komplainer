import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { callScript, json, errorResponse, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { backupStatus, drainBackupQueue } from '@/lib/server/firebase-backup.mjs';
export const maxDuration = 60;
async function requireAdmin() {
  const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
  if (user.role !== 'admin' || user.mustChangePassword) throw new ApiError('Hanya admin dapat melihat backup.', 403);
}
export async function GET() {
  try { await requireAdmin(); return json({ status: 'success', data: await backupStatus() }); } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try { assertSameOrigin(request); await requireAdmin(); return json({ status: 'success', data: await drainBackupQueue({ force: true }) }); } catch (error) { return errorResponse(error); }
}
