import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { listReactionNotices, markReactionNoticeRead } from '@/lib/server/firestore-store.mjs';
import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
export async function GET() {
  try { const user = await currentFirebaseUser(); return json({ status: 'success', data: await listReactionNotices(user) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const user = await currentFirebaseUser();
    const body = await readBody(request);
    if (body.action !== 'read' || typeof body.id !== 'string') throw new ApiError('Aksi tidak valid.');
    return json(await markReactionNoticeRead(user, body.id));
  } catch (error) { return errorResponse(error); }
}
