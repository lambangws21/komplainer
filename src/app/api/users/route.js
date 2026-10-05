import { callScript, json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { randomUUID } from 'node:crypto';
import { hashPassword, validatePassword } from '@/lib/server/password.mjs';
import { usesFirebase, firebaseAuth, firebaseAccount, requireFirebaseSession } from '@/lib/server/firebase-auth';
import { firebaseUid, firebaseEmail } from '@/lib/server/firebase-identity.mjs';
export async function GET() {
  try { return json(await callScript('users')); } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (!['createUser', 'updateUser', 'resetPassword'].includes(body.action)) throw new ApiError('Aksi akun tidak valid.');
    // Check authorization before doing password work.
    const session = await callScript('session');
    if (session.user.role !== 'admin' || session.user.mustChangePassword) throw new ApiError('Hanya admin dapat mengelola akun.', 403);
    const payload = { id: body.id, nama: body.nama, email: body.email, role: body.role, unit: body.unit, active: body.active };
    if (usesFirebase()) {
      const identity = await requireFirebaseSession();
      const auth = firebaseAuth();
      if (body.action === 'createUser') {
        try { validatePassword(body.password); } catch (error) { throw new ApiError(error.message); }
        if (!['admin', 'pelapor', 'petugas'].includes(body.role) || !String(body.nama || '').trim() || !String(body.unit || '').trim()) throw new ApiError('Lengkapi nama, team pelapor, dan peran yang valid.');
        const id = `USR-${randomUUID()}`;
        try {
          await auth.createUser({ uid: firebaseUid(id), email: firebaseEmail(body.email), password: body.password, displayName: String(body.nama).trim() });
        } catch { throw new ApiError('Akun Firebase belum dapat dibuat. Periksa email yang sudah terdaftar atau konfigurasi Firebase.', 409); }
        try {
          return json(await callScript('createUser', { ...payload, firebaseAccountId: id, passwordHash: `firebase:${firebaseUid(id)}` }));
        } catch (error) {
          // A timeout may follow a successful Sheet write: don't delete the identity
          // unless the backend definitively rejected the new account.
          if (error instanceof ApiError && error.code < 500) await auth.deleteUser(firebaseUid(id));
          throw error;
        }
      }
      const users = await callScript('users');
      const target = users.data.find((user) => user.id === body.id);
      if (!target) throw new ApiError('Akun tidak ditemukan.', 404);
      if (body.action === 'resetPassword') {
        try { validatePassword(body.password); } catch (error) { throw new ApiError(error.message); }
        const existing = await firebaseAccount(target.id);
        if (existing) await auth.updateUser(firebaseUid(target.id), { password: body.password });
        else await auth.createUser({ uid: firebaseUid(target.id), email: firebaseEmail(target.email), password: body.password, displayName: target.nama, disabled: !target.active });
        await auth.revokeRefreshTokens(firebaseUid(target.id));
        return json(await callScript('resetPassword', { id: target.id, passwordHash: `firebase:${firebaseUid(target.id)}` }, true, identity));
      }
      // Sheets enforces last-admin and active-PIC constraints before syncing Firebase.
      const result = await callScript('updateUser', payload);
      if (await firebaseAccount(target.id)) {
        try {
          await auth.updateUser(firebaseUid(target.id), { email: firebaseEmail(body.email), displayName: body.nama, disabled: !body.active });
          await auth.revokeRefreshTokens(firebaseUid(target.id));
        } catch { throw new ApiError('Profil tersimpan, tetapi sinkronisasi Firebase gagal. Periksa bentrok email, lalu simpan ulang akun.', 502); }
      }
      return json(result);
    }
    if (body.action === 'createUser' || body.action === 'resetPassword') {
      try { payload.passwordHash = await hashPassword(body.password); } catch (error) { throw new ApiError(error.message); }
    }
    return json(await callScript(body.action, payload));
  } catch (error) { return errorResponse(error); }
}
