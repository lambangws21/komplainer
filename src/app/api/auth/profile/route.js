import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { usesFirebase, firebaseAuth, requireFirebaseSession, clearFirebaseSession } from '@/lib/server/firebase-auth';
import { currentFirebaseUser, firebaseDirectory, writeFirebaseMetadata } from '@/lib/server/firebase-accounts';
import { firebaseEmail } from '@/lib/server/firebase-identity.mjs';
import { usernameField, assertUsernameAvailable } from '@/lib/server/firebase-profile.mjs';

export const maxDuration = 30;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirebase()) throw new ApiError('Profil hanya dapat diedit pada mode Firebase.', 503);
    const identity = await requireFirebaseSession();
    const user = await currentFirebaseUser(true);
    const body = await readBody(request);
    const nama = String(body.nama || '').trim();
    if (!nama || nama.length > 200) throw new ApiError('Nama wajib diisi, maksimal 200 karakter.');
    const email = firebaseEmail(body.email);
    const username = body.username ? usernameField(body.username) : null;
    const accounts = await firebaseDirectory();
    if (accounts.some((account) => account.email === email && account.firebaseUid !== identity.uid)) throw new ApiError('Email sudah digunakan akun lain.', 409);
    assertUsernameAvailable(accounts, username, identity.uid);
    const auth = firebaseAuth();
    await auth.updateUser(identity.uid, { email, displayName: nama });
    await writeFirebaseMetadata(identity.uid, { role: user.role, unit: user.unit, active: user.approval === 'approved' ? user.active : true, approval: user.approval, mustChangePassword: user.mustChangePassword, username });
    await auth.revokeRefreshTokens(identity.uid);
    await clearFirebaseSession();
    return json({ status: 'success', message: 'Profil diperbarui. Silakan masuk kembali.' });
  } catch (error) { return errorResponse(error); }
}
