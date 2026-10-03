import { callScript, json, errorResponse, readBody, assertSameOrigin, setSession, ApiError } from '@/lib/server/apps-script';
import { createToken, tokenHash, verifyPassword, SESSION_SECONDS } from '@/lib/server/password.mjs';

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    if ((email !== 'lambangws' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) throw new ApiError('Email/username atau password tidak valid.');
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
