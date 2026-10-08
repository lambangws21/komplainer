import 'server-only';
import { NextResponse } from 'next/server';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { callScript } from '@/lib/server/apps-script';
import { ApiError } from '@/lib/server/api-error.mjs';

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,100}$/;

async function requireSession() {
  const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
  if (user.mustChangePassword) throw new ApiError('Ganti password sementara sebelum melanjutkan.', 403);
}

// Google Drive now serves uc?export=view responses with Cross-Origin-Resource-Policy: same-site,
// which browsers block when loaded as <img src> from any other origin. Proxying through our own
// origin avoids that restriction; the bytes themselves are already shared ANYONE_WITH_LINK/VIEW.
export async function GET(request) {
  try {
    await requireSession();
    const id = new URL(request.url).searchParams.get('id');
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
