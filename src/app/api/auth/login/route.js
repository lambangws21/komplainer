import { callScript, json, errorResponse, readBody, assertSameOrigin, setSession, ApiError } from '@/lib/server/apps-script';
import { usesFirebase, firebaseAuth, firebaseAccount, firebasePasswordLogin, setFirebaseSession } from '@/lib/server/firebase-auth';
import { authenticateFirebase } from '@/lib/server/firebase-login.mjs';
import { firebaseEmail } from '@/lib/server/firebase-identity.mjs';
import { clearSession } from '@/lib/server/apps-script';
import { createToken, tokenHash, verifyPassword, SESSION_SECONDS } from '@/lib/server/password.mjs';

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    if ((email !== 'lambangws' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) throw new ApiError('Email/username atau password tidak valid.');
    if (usesFirebase()) {
      const auth = firebaseAuth();
      let existing;
      try { existing = await auth.getUserByEmail(firebaseEmail(email)); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      if (existing) {
        const signedIn = await firebasePasswordLogin(email, body.password);
        const verified = await auth.verifyIdToken(signedIn.idToken, true);
        if (verified.uid !== existing.uid || verified.email?.toLowerCase() !== firebaseEmail(email)) throw new ApiError('Identitas Firebase tidak sesuai.', 403);
        const profile = await callScript('firebaseLink', {
          firebaseUid: verified.uid, email, nama: existing.displayName || email.split('@')[0],
          emailVerified: verified.email_verified === true,
          grantAdmin: process.env.FIREBASE_ADMIN_UID === verified.uid,
        }, false);
        await setFirebaseSession(signedIn.idToken, profile.user.id, verified.uid);
        await clearSession();
        return json({ status: 'success', user: profile.user });
      }
      const lookup = await callScript('firebaseLookup', { email }, false);
      const profile = await authenticateFirebase(lookup, {
        getAccount: firebaseAccount,
        verifyLegacy: (hash) => verifyPassword(body.password, hash),
        async createAccount(uid) {
          try { await auth.createUser({ uid, email: firebaseEmail(email), password: body.password, displayName: lookup.user.nama }); }
          catch (error) { if (error.code !== 'auth/uid-already-exists') throw new ApiError('Akun belum dapat dimigrasi ke Firebase. Periksa email yang bentrok atau konfigurasi Authentication.', 409); }
        },
        signIn: () => firebasePasswordLogin(email, body.password),
        migrate: (payload) => callScript('firebaseMigrate', payload, false),
      });
      await setFirebaseSession(profile.idToken, lookup.user.id);
      await clearSession();
      return json({ status: 'success', user: profile.user });
    }
    const credentials = await callScript('authLookup', { email }, false);
    // A dummy derivation avoids an immediate return for unknown accounts.
    const hash = credentials.passwordHash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPassword(body.password, hash);
    if (!valid || !credentials.passwordHash) throw new ApiError('Email atau password salah.', 401);
    const token = createToken();
    const result = await callScript('login', { email, expectedHash: credentials.passwordHash, sessionHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString() }, false);
    await setSession(token);
    return json({ status: 'success', user: result.user });
  } catch (error) { return errorResponse(error); }
}
