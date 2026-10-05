import { ApiError } from './api-error.mjs';
import { firebaseUid } from './firebase-identity.mjs';

export async function authenticateFirebase(lookup, services) {
  if (!lookup.user) throw new ApiError('Email atau password salah.', 401);
  const uid = firebaseUid(lookup.user.id);
  if (!await services.getAccount(lookup.user.id)) {
    if (!lookup.passwordHash || !await services.verifyLegacy(lookup.passwordHash)) throw new ApiError('Email atau password salah.', 401);
    await services.createAccount(uid);
  }
  // Existing Firebase accounts never fall back to the old Sheet password.
  const signedIn = await services.signIn();
  if (signedIn.localId !== uid) throw new ApiError('Akun Firebase tidak sesuai profil Komplainer.', 403);
  const profile = await services.migrate({ id: lookup.user.id, expectedHash: lookup.passwordHash, firebaseUid: uid });
  return { idToken: signedIn.idToken, user: profile.user };
}
