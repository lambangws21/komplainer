import { json, errorResponse, ApiError } from '@/lib/server/apps-script';
import { cronAuthorized, drainBackupQueue } from '@/lib/server/firebase-backup.mjs';
export const maxDuration = 60;
export async function GET(request) {
  try {
    if (!cronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) throw new ApiError('Akses tidak diizinkan.', 401);
    return json({ status: 'success', data: await drainBackupQueue() });
  } catch (error) { return errorResponse(error); }
}
