import { callScript, json, errorResponse } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
export const maxDuration = 30;
export async function GET() {
  try { if (usesFirebase()) return json({ status: 'success', user: await currentFirebaseUser(true) }); const result = await callScript('session'); return json({ status: 'success', user: result.user }); }
  catch (error) { return errorResponse(error); }
}
