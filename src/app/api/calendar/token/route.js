import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { ensureCalendarToken, resetCalendarToken } from '@/lib/server/calendar-token.mjs';

export const maxDuration = 15;
function feedUrl(request, userId, token) {
  return `${new URL(request.url).origin}/api/calendar/feed/${userId}/${token}.ics`;
}
export async function GET(request) {
  try {
    if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur jadwal belum tersedia.', 503);
    const user = await currentFirebaseUser();
    const token = await ensureCalendarToken(user);
    return json({ status: 'success', url: feedUrl(request, user.id, token) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur jadwal belum tersedia.', 503);
    const body = await readBody(request);
    if (body.action !== 'reset') throw new ApiError('Aksi tidak valid.');
    const user = await currentFirebaseUser();
    const token = await resetCalendarToken(user);
    return json({ status: 'success', url: feedUrl(request, user.id, token) });
  } catch (error) { return errorResponse(error); }
}
