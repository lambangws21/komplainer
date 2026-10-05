import { callScript, json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { randomUUID } from 'node:crypto';
import { hashPassword, validatePassword } from '@/lib/server/password.mjs';
import { usesFirebase, firebaseAuth } from '@/lib/server/firebase-auth';
import { currentFirebaseUser, firebaseDirectory, writeFirebaseMetadata } from '@/lib/server/firebase-accounts';
import { appClaims, profileFromAccount, assertAccountChange } from '@/lib/server/firebase-profile.mjs';
import { firebaseUid, firebaseEmail } from '@/lib/server/firebase-identity.mjs';
export async function GET() {
  try { if (usesFirebase()) { const user = await currentFirebaseUser(); if (user.role !== 'admin' || user.mustChangePassword) throw new ApiError('Hanya admin dapat mengelola akun.', 403); return json({ status: 'success', data: await firebaseDirectory() }); } return json(await callScript('users')); } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (!['createUser', 'updateUser', 'resetPassword', 'approveUser', 'rejectUser'].includes(body.action)) throw new ApiError('Aksi akun tidak valid.');
    const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
    if (user.role !== 'admin' || user.mustChangePassword) throw new ApiError('Hanya admin dapat mengelola akun.', 403);
    const payload = { id: body.id, nama: body.nama, email: body.email, role: body.role, unit: body.unit, active: body.active };
    if (usesFirebase()) {
      const auth = firebaseAuth();
      if (body.action === 'createUser') {
        try { validatePassword(body.password); } catch (error) { throw new ApiError(error.message); }
        const nama = accountText(body.nama, 'Nama');
        const unit = accountText(body.unit, 'Team Pelapor');
        if (!['admin', 'pelapor', 'petugas'].includes(body.role)) throw new ApiError('Peran tidak valid.');
        const id = `USR-${randomUUID()}`;
        const metadata = { role: body.role, unit, active: true, approval: 'approved', mustChangePassword: true };
        const claims = appClaims({}, metadata);
        let account;
        try { account = await auth.createUser({ uid: firebaseUid(id), email: firebaseEmail(body.email), password: body.password, displayName: nama, disabled: true }); }
        catch { throw new ApiError('Email sudah dipakai atau akun Firebase belum dapat dibuat. Akun yang sudah ada dapat langsung login.', 409); }
        await auth.setCustomUserClaims(account.uid, claims);
        await auth.updateUser(account.uid, { disabled: false });
        return json({ status: 'success', user: profileFromAccount({ ...account, disabled: false, customClaims: claims }) });
      }
      const accounts = await firebaseDirectory();
      const target = accounts.find((item) => item.id === body.id);
      if (!target) throw new ApiError('Akun tidak ditemukan.', 404);
      if (['approveUser', 'rejectUser'].includes(body.action)) {
        if (!['pending', 'rejected'].includes(target.approval)) throw new ApiError('Pendaftaran sudah diproses. Muat ulang daftar.', 409);
        await writeFirebaseMetadata(target.firebaseUid, { approval: body.action === 'approveUser' ? 'approved' : 'rejected', role: 'pelapor', active: true, approvedBy: user.firebaseUid });
        return json({ status: 'success' });
      }
      if (target.approval !== 'approved') throw new ApiError('Setujui pendaftaran terlebih dahulu sebelum mengubah akun.', 409);
      if (body.action === 'resetPassword') {
        try { validatePassword(body.password); } catch (error) { throw new ApiError(error.message); }
        // Gate the temporary password before changing Firebase credentials.
        await writeFirebaseMetadata(target.firebaseUid, { role: target.role, unit: target.unit, active: target.active, mustChangePassword: true });
        await auth.updateUser(target.firebaseUid, { password: body.password });
        await auth.revokeRefreshTokens(target.firebaseUid);
        return json({ status: 'success' });
      }
      assertAccountChange(target, body, accounts, process.env.FIREBASE_ADMIN_UID);
      const nama = accountText(body.nama, 'Nama');
      const unit = accountText(body.unit, 'Team Pelapor');
      const email = firebaseEmail(body.email);
      const metadata = { role: body.role, unit, active: body.active, mustChangePassword: target.mustChangePassword };
      appClaims(await auth.getUser(target.firebaseUid), metadata);
      if (!body.active || body.role !== target.role) await callScript('accountGuard', { id: target.id });
      await auth.updateUser(target.firebaseUid, { email, displayName: nama, disabled: !body.active });
      await writeFirebaseMetadata(target.firebaseUid, metadata);
      await auth.revokeRefreshTokens(target.firebaseUid);
      return json({ status: 'success' });
    }
    if (body.action === 'createUser' || body.action === 'resetPassword') {
      try { payload.passwordHash = await hashPassword(body.password); } catch (error) { throw new ApiError(error.message); }
    }
    return json(await callScript(body.action, payload));
  } catch (error) { return errorResponse(error); }
}

function accountText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new ApiError(`${label} wajib diisi, maksimal 200 karakter.`);
  return value.trim();
}
