import 'server-only';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { ApiError } from './api-error.mjs';
import { complaintUserId, firebaseEmail, firebaseUid } from './firebase-identity.mjs';
import { SESSION_SECONDS } from './password.mjs';

export const FIREBASE_COOKIE = 'komplain_firebase_session';
export const usesFirebase = () => process.env.AUTH_PROVIDER === 'firebase';
export function firebaseAuth() {
  const existing = getApps().find((app) => app.name === 'komplainer');
  if (existing) return getAuth(existing);
  try {
    const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    return getAuth(initializeApp({ credential: cert(account), projectId: account.project_id }, 'komplainer'));
  } catch { throw new ApiError('Konfigurasi Firebase Admin belum valid. Periksa kredensial server.', 503); }
}
export async function firebasePasswordLogin(email, password) { return firebasePasswordRequest('signInWithPassword', email, password); }
export async function firebasePasswordRegister(email, password, displayName) { return firebasePasswordRequest('signUp', email, password, displayName); }
async function firebasePasswordRequest(method, email, password, displayName) {
  if (!process.env.FIREBASE_WEB_API_KEY) throw new ApiError('FIREBASE_WEB_API_KEY belum dikonfigurasi.', 503);
  let response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(process.env.FIREBASE_WEB_API_KEY)}`, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: firebaseEmail(email), password, ...(displayName ? { displayName } : {}), returnSecureToken: true }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError('Layanan login Firebase belum dapat dihubungi.', 502); }
  const result = await response.json();
  if (!response.ok) {
    const code = result.error?.message;
    if (code === 'OPERATION_NOT_ALLOWED') throw new ApiError('Aktifkan Email/Password di Firebase Authentication.', 503);
    if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw new ApiError('Terlalu banyak percobaan login. Coba kembali nanti.', 429);
    if (code?.includes('API_KEY')) throw new ApiError('Firebase Web API Key belum valid.', 503);
    if (method === 'signUp') {
      if (code === 'EMAIL_EXISTS') throw new ApiError('Email sudah terdaftar. Silakan masuk atau hubungi admin.', 409);
      throw new ApiError('Pendaftaran belum berhasil. Periksa email dan password, lalu coba lagi.', 400);
    }
    throw new ApiError('Email atau password salah.', 401);
  }
  return result;
}
export async function firebaseAccount(id, uid = firebaseUid(id)) {
  try { return await firebaseAuth().getUser(uid); }
  catch (error) { if (error.code === 'auth/user-not-found') return null; throw error; }
}
export async function requireFirebaseSession() {
  const token = (await cookies()).get(FIREBASE_COOKIE)?.value;
  if (!token) throw new ApiError('Silakan masuk untuk melanjutkan.', 401);
  const auth = firebaseAuth();
  try {
    const decoded = await auth.verifySessionCookie(token, true);
    let id;
    try { id = complaintUserId(decoded.uid); } catch { /* Existing Firebase UID is linked by the backend. */ }
    return { id, uid: decoded.uid, email: decoded.email };
  } catch { throw new ApiError('Sesi berakhir. Silakan masuk kembali.', 401); }
}
export async function setFirebaseSession(idToken, id, uid = firebaseUid(id)) {
  const auth = firebaseAuth();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (decoded.uid !== uid) throw new ApiError('Akun Firebase tidak sesuai profil Komplainer.', 403);
  const session = await auth.createSessionCookie(idToken, { expiresIn: SESSION_SECONDS * 1000 });
  (await cookies()).set(FIREBASE_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
export async function clearFirebaseSession() {
  (await cookies()).set(FIREBASE_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
