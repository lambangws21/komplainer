import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { firebaseAuth, firebasePasswordRegister, setFirebaseSession, usesFirebase } from '@/lib/server/firebase-auth';
import { firebaseDirectory } from '@/lib/server/firebase-accounts';
import { appClaims, profileFromAccount, registrationMetadata, usernameField, assertUsernameAvailable, REGISTRATION_UNITS } from '@/lib/server/firebase-profile.mjs';
import { validatePassword } from '@/lib/server/password.mjs';

export const maxDuration = 30;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirebase()) throw new ApiError('Pendaftaran Firebase belum diaktifkan.', 503);
    const body = await readBody(request);
    const nama = requiredText(body.nama, 'Nama');
    const unit = String(body.unit || '').trim();
    if (!REGISTRATION_UNITS.includes(unit)) throw new ApiError(`Team Pelapor harus salah satu dari: ${REGISTRATION_UNITS.join(', ')}.`);
    const username = usernameField(body.username);
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError('Email tidak valid.');
    try { validatePassword(body.password); } catch (error) { throw new ApiError(error.message); }
    assertUsernameAvailable(await firebaseDirectory(), username, null);
    // Client-provided role/approval/active fields are deliberately ignored.
    const metadata = registrationMetadata(unit, username);
    appClaims({}, metadata);
    const signedUp = await firebasePasswordRegister(email, body.password, nama);
    const auth = firebaseAuth();
    const verified = await auth.verifyIdToken(signedUp.idToken, true);
    if (verified.uid !== signedUp.localId || verified.email?.toLowerCase() !== email) throw new ApiError('Identitas pendaftaran Firebase tidak sesuai.', 403);
    const account = await auth.getUser(verified.uid);
    const claims = appClaims(account, metadata);
    await auth.setCustomUserClaims(account.uid, claims);
    const user = profileFromAccount({ ...account, customClaims: claims });
    await setFirebaseSession(signedUp.idToken, user.id, account.uid);
    return json({ status: 'success', user }, 201);
  } catch (error) { return errorResponse(error); }
}
function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new ApiError(`${label} wajib diisi, maksimal 200 karakter.`);
  return value.trim();
}
