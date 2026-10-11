import { json, errorResponse, callScript, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { reportSummary } from '@/lib/server/home-summary.mjs';

export const maxDuration = 30;
export async function GET(request) {
  try {
    const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
    if (user.mustChangePassword) throw new ApiError('Ganti password sementara sebelum melanjutkan.', 403);
    const params = new URL(request.url).searchParams;
    const cursor = Math.max(0, parseInt(params.get('cursor') || '0', 10) || 0);
    const limit = Math.min(10, Math.max(1, parseInt(params.get('limit') || '3', 10) || 3));
    return json(await reportSummary(user, { cursor, limit }));
  } catch (error) { return errorResponse(error); }
}
