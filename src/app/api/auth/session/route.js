import { callScript, json, errorResponse } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
export async function GET() {
  try { if (usesFirebase()) return json({ status: 'success', user: await currentFirebaseUser() }); const result = await callScript('session'); return json({ status: 'success', user: result.user }); }
  catch (error) { return errorResponse(error); }
}
