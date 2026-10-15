import { json, errorResponse, ApiError } from '@/lib/server/apps-script';
import { cronAuthorized } from '@/lib/server/firebase-backup.mjs';
import { sendBroadcast } from '@/lib/server/push.mjs';

export const maxDuration = 30;
export async function GET(request) {
  try {
    if (!cronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) throw new ApiError('Akses tidak diizinkan.', 401);
    const data = await sendBroadcast({ title: 'Bagaimana hari ini?', body: 'Apakah sesuai dengan yang diharapkan? Catat laporan atau kendala di Komplainer.', url: '/komplain' });
    return json({ status: 'success', data });
  } catch (error) { return errorResponse(error); }
}
