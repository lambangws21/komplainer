import { json, errorResponse, readBody, assertSameOrigin, callScript, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { saveSubscription } from '@/lib/server/push.mjs';

export const maxDuration = 15;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirestore()) throw new ApiError('Notifikasi HP membutuhkan mode Firestore.', 503);
    const user = usesFirebase() ? await currentFirebaseUser() : (await callScript('session')).user;
    const body = await readBody(request);
    await saveSubscription(user.id, body.subscription);
    return json({ status: 'success' });
  } catch (error) { return errorResponse(error); }
}
