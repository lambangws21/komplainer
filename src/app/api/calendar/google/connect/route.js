import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { errorResponse, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { consentUrl, OAUTH_STATE_COOKIE } from '@/lib/server/google-calendar.mjs';

export const maxDuration = 15;

export async function GET(request) {
  try {
    if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur ini membutuhkan mode Firestore.', 503);
    const user = await currentFirebaseUser();
    if (user.role !== 'admin') throw new ApiError('Hanya admin dapat menghubungkan Google Calendar.', 403);
    const state = randomBytes(24).toString('hex');
    (await cookies()).set(OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
    return Response.redirect(consentUrl(new URL(request.url).origin, state), 303);
  } catch (error) { return errorResponse(error); }
}
