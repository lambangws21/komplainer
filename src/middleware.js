import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'komplain_session';
const FIREBASE_COOKIE = 'komplain_firebase_session';
// firebase-admin needs the Node runtime, so the cookie itself can't be verified here — this only
// rejects the common "no cookie at all" case at the edge, before a Node function is invoked.
// The Google OAuth callback is reached via a top-level GET redirect from accounts.google.com;
// our cookies are sameSite:'lax', which IS sent on top-level GET navigations, so this check
// still applies there even though the navigation originates off-site.
const PROTECTED_PREFIXES = ['/api/komplain', '/api/users', '/api/photo', '/api/mentions', '/api/mentionables', '/api/announcements', '/api/backup', '/api/auth/session', '/api/auth/profile', '/api/auth/password', '/api/auth/logout', '/api/schedules', '/api/calendar/geocode', '/api/calendar/google', '/api/push'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const hasSession = request.cookies.has(SESSION_COOKIE) || request.cookies.has(FIREBASE_COOKIE);
    if (!hasSession) return NextResponse.json({ status: 'error', message: 'Silakan masuk untuk melanjutkan.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const response = NextResponse.next();
  if (pathname === '/komplain') response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/komplain'],
};
