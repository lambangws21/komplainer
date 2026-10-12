import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { shareWithGroup, unshareGroup } from '@/lib/server/google-calendar.mjs';

export const maxDuration = 20;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur jadwal belum tersedia.', 503);
    const user = await currentFirebaseUser();
    if (user.role !== 'admin') throw new ApiError('Hanya admin dapat mengatur akses Google Group.', 403);
    const body = await readBody(request);
    if (body.action === 'share') {
      const result = await shareWithGroup(body.groupEmail);
      return json({ status: 'success', ...result });
    }
    if (body.action === 'unshare') {
      await unshareGroup();
      return json({ status: 'success' });
    }
    throw new ApiError('Aksi tidak valid.');
  } catch (error) { return errorResponse(error); }
}
