import { cookies } from 'next/headers';
import { errorResponse, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { completeConnection, OAUTH_STATE_COOKIE } from '@/lib/server/google-calendar.mjs';

export const maxDuration = 30;

export async function GET(request) {
  try {
    if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur ini membutuhkan mode Firestore.', 503);
    const user = await currentFirebaseUser();
    if (user.role !== 'admin') throw new ApiError('Hanya admin dapat menghubungkan Google Calendar.', 403);
    const params = new URL(request.url).searchParams;
    const jar = await cookies();
    const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
    jar.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    if (!expectedState || params.get('state') !== expectedState) throw new ApiError('Sesi penghubungan tidak valid atau kedaluwarsa. Coba hubungkan lagi.', 400);
    const code = params.get('code');
    if (!code) throw new ApiError(params.get('error') === 'access_denied' ? 'Izin akses Google Calendar dibatalkan.' : 'Kode otorisasi tidak diterima dari Google.', 400);
    const origin = new URL(request.url).origin;
    await completeConnection(code, origin, user);
    return Response.redirect(`${origin}/komplain`, 303);
  } catch (error) { return errorResponse(error); }
}
