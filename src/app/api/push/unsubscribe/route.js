import { json, errorResponse, readBody, assertSameOrigin, callScript, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { removeSubscription } from '@/lib/server/push.mjs';

export const maxDuration = 15;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirestore()) throw new ApiError('Notifikasi HP membutuhkan mode Firestore.', 503);
    if (usesFirebase()) await currentFirebaseUser(); else await callScript('session');
    const body = await readBody(request);
    await removeSubscription(body.endpoint);
    return json({ status: 'success' });
  } catch (error) { return errorResponse(error); }
}
