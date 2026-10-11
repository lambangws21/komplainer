import 'server-only';
import { callScript, ApiError } from './apps-script';
import { usesFirebase } from './firebase-auth';
import { currentFirebaseUser, firebaseDirectory } from './firebase-accounts';
import { executeFirestore, usesFirestore } from './firestore-store.mjs';
export async function callReports(action, body = {}) {
  if (!usesFirestore()) return callScript(action, body);
  if (!usesFirebase()) throw new ApiError('Mode Firestore membutuhkan AUTH_PROVIDER=firebase.', 503);
  const user = await currentFirebaseUser();
  const accounts = await firebaseDirectory();
  return executeFirestore(action, body, { user, accounts });
}
