import { callScript, json, errorResponse, readBody, assertSameOrigin, clearSession, ApiError } from '@/lib/server/apps-script';
import { usesFirebase, firebaseAuth, requireFirebaseSession, firebasePasswordLogin, clearFirebaseSession } from '@/lib/server/firebase-auth';
import { currentFirebaseUser, writeFirebaseMetadata } from '@/lib/server/firebase-accounts';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/server/password.mjs';
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (usesFirebase()) {
      const identity = await requireFirebaseSession();
      const user = await currentFirebaseUser();
      try { validatePassword(body.password); } catch (error) { throw new ApiError(error.message); }
      if (body.password === body.currentPassword) throw new ApiError('Gunakan password baru yang berbeda.');
      let signedIn;
      try { signedIn = await firebasePasswordLogin(user.email, body.currentPassword); }
      catch (error) { if (error.code === 401) throw new ApiError('Password saat ini salah.', 400); throw error; }
      if (signedIn.localId !== identity.uid) throw new ApiError('Akun Firebase tidak sesuai.', 403);
      await firebaseAuth().updateUser(identity.uid, { password: body.password });
      await firebaseAuth().revokeRefreshTokens(identity.uid);
      await writeFirebaseMetadata(identity.uid, { role: user.role, unit: user.unit, active: user.active, mustChangePassword: false });
      await clearFirebaseSession();
      return json({ status: 'success', message: 'Password diperbarui. Silakan masuk kembali.' });
    }
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
