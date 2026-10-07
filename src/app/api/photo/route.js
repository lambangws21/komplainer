import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { usesFirebase, requireFirebaseSession } from '@/lib/server/firebase-auth';
import { SESSION_COOKIE } from '@/lib/server/apps-script';
import { ApiError } from '@/lib/server/api-error.mjs';

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,100}$/;

async function requireSession() {
  if (usesFirebase()) { await requireFirebaseSession(); return; }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError('Silakan masuk untuk melanjutkan.', 401);
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
    return new NextResponse(upstream.body, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=86400' } });
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 502;
    return NextResponse.json({ status: 'error', message: error instanceof ApiError ? error.message : 'Foto tidak dapat dimuat.' }, { status: code });
  }
}
