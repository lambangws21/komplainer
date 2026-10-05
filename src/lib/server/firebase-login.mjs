import { ApiError } from './api-error.mjs';

// Account authentication has no dependency on Apps Script or Google Sheets.
export async function authenticateFirebase(expectedEmail, services) {
  const signedIn = await services.signIn();
  const verified = await services.verifyToken(signedIn.idToken);
  if (verified.uid !== signedIn.localId || verified.email?.toLowerCase() !== expectedEmail) throw new ApiError('Identitas Firebase tidak sesuai.', 403);
  const account = await services.getAccount(verified.uid);
  const user = await services.ensureProfile(account);
  return { user, idToken: signedIn.idToken };
}
