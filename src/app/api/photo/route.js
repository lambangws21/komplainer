import 'server-only';
import { NextResponse } from 'next/server';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { callScript } from '@/lib/server/apps-script';
import { usesFirestore, allowedPhoto, photoBucket } from '@/lib/server/firestore-store.mjs';
import { allowedSchedulePhoto } from '@/lib/server/firestore-schedule.mjs';
import { ApiError } from '@/lib/server/api-error.mjs';

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,100}$/;

async function requireSession() {
  const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
  if (user.mustChangePassword) throw new ApiError('Ganti password sementara sebelum melanjutkan.', 403);
  return user;
}

// Google Drive now serves uc?export=view responses with Cross-Origin-Resource-Policy: same-site,
// which browsers block when loaded as <img src> from any other origin. Proxying through our own
// origin avoids that restriction; the bytes themselves are already shared ANYONE_WITH_LINK/VIEW.
export async function GET(request) {
  try {
    const user = await requireSession();
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    if (usesFirestore()) {
      const scheduleId = params.get('schedule');
      const photo = scheduleId ? await allowedSchedulePhoto(scheduleId, user, params.get('path')) : await allowedPhoto(params.get('report'), params.get('path'), id);
      if (photo.path) {
        const [bytes] = await photoBucket().file(photo.path).download();
        return new NextResponse(bytes, { headers: { 'Content-Type': photo.mimeType || 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
      }
    }
    if (!id || !DRIVE_ID.test(id)) throw new ApiError('ID foto tidak valid.', 400);
    const upstream = await fetch(`https://drive.google.com/uc?export=view&id=${id}`, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !upstream.body || !contentType.startsWith('image/')) throw new ApiError('Foto tidak dapat dimuat.', 502);
    return new NextResponse(upstream.body, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 502;
    return NextResponse.json({ status: 'error', message: error instanceof ApiError ? error.message : 'Foto tidak dapat dimuat.' }, { status: code, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
