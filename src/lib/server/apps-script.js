import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { tokenHash, SESSION_SECONDS } from './password.mjs';
import { ApiError } from './api-error.mjs';
import { usesFirebase, requireFirebaseSession } from './firebase-auth';
export { ApiError } from './api-error.mjs';

export const SESSION_COOKIE = 'komplain_session';
export async function callScript(action, payload = {}, authenticated = true, verifiedIdentity = null) {
  const url = process.env.GOOGLE_SCRIPT_URL?.trim() || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL?.trim();
  const apiKey = process.env.GOOGLE_SCRIPT_API_KEY?.trim();
  if (!url || !apiKey) throw new ApiError('Konfigurasi server belum lengkap. Isi GOOGLE_SCRIPT_URL dan GOOGLE_SCRIPT_API_KEY di environment Vercel/lokal, lalu deploy ulang. Lihat panduan setup akun.', 503);
  let sessionHash;
  let firebaseUserId;
  if (authenticated && usesFirebase()) {
    firebaseUserId = (verifiedIdentity || await requireFirebaseSession()).id;
  } else if (authenticated) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError('Silakan masuk untuk melanjutkan.', 401);
    sessionHash = tokenHash(token);
  }
  let result;
  try {
    const response = await fetch(url, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action, apiKey, ...(authenticated ? (firebaseUserId ? { firebaseUserId } : { sessionHash }) : {}) }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch {
    throw new ApiError('Layanan data belum dapat dihubungi. Periksa deployment Google Apps Script atau coba lagi.', 502);
  }
  if (result?.status !== 'success') throw new ApiError(result?.message || 'Apps Script belum sesuai versi aplikasi. Perbarui deployment skrip.', Number(result?.code) || 502);
  return result;
}
export function json(data, code = 200) {
  return NextResponse.json(data, { status: code, headers: { 'Cache-Control': 'private, no-store' } });
}
export function errorResponse(error) {
  return json({ status: 'error', message: error instanceof ApiError ? error.message : 'Permintaan tidak dapat diproses.' }, error instanceof ApiError ? error.code : 500);
}
export async function readBody(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError('Gunakan format JSON.', 415);
  const text = await request.text();
  if (text.length > 32000) throw new ApiError('Permintaan terlalu besar.', 413);
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ApiError('Data permintaan tidak valid.'); }
}
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError('Permintaan harus berasal dari aplikasi ini.', 403);
}
export async function setSession(token) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
export async function clearSession() {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
