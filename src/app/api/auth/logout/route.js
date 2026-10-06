import { callScript, json, errorResponse, assertSameOrigin, clearSession } from '@/lib/server/apps-script';
import { usesFirebase, clearFirebaseSession } from '@/lib/server/firebase-auth';
export const maxDuration = 30;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (usesFirebase()) { await clearFirebaseSession(); await clearSession(); }
    else { try { await callScript('logout'); } finally { await clearSession(); } }
    return json({ status: 'success' });
  } catch (error) { return errorResponse(error); }
}
