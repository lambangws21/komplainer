import 'server-only';
import { firebaseAuth, requireFirebaseSession } from './firebase-auth';
import { profileFromAccount, appClaims } from './firebase-profile.mjs';
import { ApiError } from './api-error.mjs';

export async function ensureFirebaseProfile(account) {
  const existing = profileFromAccount(account);
  if (existing) {
    if (!existing.active) throw new ApiError('Akun dinonaktifkan. Hubungi admin.', 403);
    return existing;
  }
  if (account.disabled) throw new ApiError('Akun dinonaktifkan.', 403);
  const admin = account.uid === process.env.FIREBASE_ADMIN_UID;
  const claims = appClaims(account, { role: admin ? 'admin' : 'pelapor', unit: admin ? 'Pusat' : 'Belum diisi', active: true, mustChangePassword: false });
  await firebaseAuth().setCustomUserClaims(account.uid, claims);
  return profileFromAccount({ ...account, customClaims: claims });
}
export async function firebaseProfile(uid) {
  const user = profileFromAccount(await firebaseAuth().getUser(uid));
  if (!user?.active) throw new ApiError('Akun belum terhubung atau dinonaktifkan. Silakan masuk kembali.', 401);
  return user;
}
export async function currentFirebaseUser() {
  const identity = await requireFirebaseSession();
  return firebaseProfile(identity.uid);
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
  await firebaseAuth().setCustomUserClaims(uid, appClaims(account, metadata));
}
