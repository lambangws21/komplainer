import { callScript, json, errorResponse, readBody, assertSameOrigin, setSession, ApiError } from '@/lib/server/apps-script';
import { usesFirebase, firebaseAuth, firebasePasswordLogin, setFirebaseSession } from '@/lib/server/firebase-auth';
import { authenticateFirebase } from '@/lib/server/firebase-login.mjs';
import { ensureFirebaseProfile, firebaseDirectory } from '@/lib/server/firebase-accounts';
import { firebaseEmail } from '@/lib/server/firebase-identity.mjs';
import { clearSession } from '@/lib/server/apps-script';
import { createToken, tokenHash, verifyPassword, SESSION_SECONDS } from '@/lib/server/password.mjs';

export const maxDuration = 30;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    const identifier = String(body.email || '').trim().toLowerCase();
    if (!identifier || identifier.length > 254 || typeof body.password !== 'string' || body.password.length > 128) throw new ApiError('Email/username atau password tidak valid.');
    if (usesFirebase()) {
      let email = identifier;
      if (identifier !== 'lambangws' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(identifier)) throw new ApiError('Email/username atau password tidak valid.');
        const match = (await firebaseDirectory()).find((account) => account.username === identifier);
        if (!match) throw new ApiError('Email atau password salah.', 401);
        email = match.email;
      }
      const auth = firebaseAuth();
      const { user, idToken } = await authenticateFirebase(firebaseEmail(email), {
        signIn: () => firebasePasswordLogin(email, body.password),
        verifyToken: (token) => auth.verifyIdToken(token, true),
        getAccount: (uid) => auth.getUser(uid),
        ensureProfile: ensureFirebaseProfile,
      });
      await setFirebaseSession(idToken, user.id, user.firebaseUid);
      await clearSession();
      return json({ status: 'success', user });
    }
    if (identifier !== 'lambangws' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) throw new ApiError('Email/username atau password tidak valid.');
    const credentials = await callScript('authLookup', { email: identifier }, false);
    // A dummy derivation avoids an immediate return for unknown accounts.
    const hash = credentials.passwordHash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPassword(body.password, hash);
    if (!valid || !credentials.passwordHash) throw new ApiError('Email atau password salah.', 401);
    const token = createToken();
    const result = await callScript('login', { email: identifier, expectedHash: credentials.passwordHash, sessionHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString() }, false);
    await setSession(token);
    return json({ status: 'success', user: result.user });
  } catch (error) { return errorResponse(error); }
}
