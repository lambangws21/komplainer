import { callScript, json, errorResponse, readBody, assertSameOrigin, clearSession, ApiError } from '@/lib/server/apps-script';
import { hashPassword, verifyPassword } from '@/lib/server/password.mjs';
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    const credentials = await callScript('ownCredentials');
    if (!await verifyPassword(body.currentPassword, credentials.passwordHash)) throw new ApiError('Password saat ini salah.', 401);
    if (body.password === body.currentPassword) throw new ApiError('Gunakan password baru yang berbeda.');
    let passwordHash;
    try { passwordHash = await hashPassword(body.password); } catch (error) { throw new ApiError(error.message); }
    await callScript('changePassword', { passwordHash, expectedHash: credentials.passwordHash });
    await clearSession();
    return json({ status: 'success', message: 'Password diperbarui. Silakan masuk kembali.' });
  } catch (error) { return errorResponse(error); }
}
