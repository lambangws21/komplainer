import 'server-only';
import { firebaseAuth, requireFirebaseSession } from './firebase-auth';
import { profileFromAccount, appClaims, requireApprovedProfile } from './firebase-profile.mjs';
import { ApiError } from './api-error.mjs';

export async function ensureFirebaseProfile(account) {
  const existing = profileFromAccount(account);
  if (existing) {
    if (account.disabled || account.customClaims.komplainer.active === false) throw new ApiError('Akun dinonaktifkan. Hubungi admin.', 403);
    return existing;
  }
  if (account.disabled) throw new ApiError('Akun dinonaktifkan.', 403);
  const admin = account.uid === process.env.FIREBASE_ADMIN_UID;
  const claims = appClaims(account, { role: admin ? 'admin' : 'pelapor', unit: admin ? 'Pusat' : 'Belum diisi', active: true, approval: admin ? 'approved' : 'pending', mustChangePassword: false });
  await firebaseAuth().setCustomUserClaims(account.uid, claims);
  return profileFromAccount({ ...account, customClaims: claims });
}
export async function firebaseProfile(uid, allowPending = false) {
  const account = await firebaseAuth().getUser(uid);
  const user = profileFromAccount(account);
  if (!user || account.disabled || account.customClaims.komplainer.active === false) throw new ApiError('Akun belum terhubung atau dinonaktifkan. Silakan masuk kembali.', 401);
  return allowPending ? user : requireApprovedProfile(user);
}
export async function currentFirebaseUser(allowPending = false) {
  const identity = await requireFirebaseSession();
  return firebaseProfile(identity.uid, allowPending);
}
export async function firebaseDirectory() {
  const users = [];
  let pageToken;
  do {
    const page = await firebaseAuth().listUsers(1000, pageToken);
    users.push(...page.users.map(profileFromAccount).filter(Boolean));
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}
export async function writeFirebaseMetadata(uid, metadata) {
  const account = await firebaseAuth().getUser(uid);
  await firebaseAuth().setCustomUserClaims(uid, appClaims(account, { ...account.customClaims?.komplainer, ...metadata }));
}
