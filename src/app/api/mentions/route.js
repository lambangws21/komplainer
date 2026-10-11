import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { listMentions, markMentionRead } from '@/lib/server/firestore-store.mjs';
import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
export async function GET() {
  try { const user = await currentFirebaseUser(); return json({ status: 'success', data: await listMentions(user) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const user = await currentFirebaseUser();
    const body = await readBody(request);
    if (body.action !== 'read' || typeof body.id !== 'string') throw new ApiError('Aksi tidak valid.');
    return json(await markMentionRead(user, body.id));
  } catch (error) { return errorResponse(error); }
}
