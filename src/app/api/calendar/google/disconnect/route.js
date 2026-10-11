import { json, errorResponse, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { clearConfig } from '@/lib/server/google-calendar.mjs';

export const maxDuration = 15;
export async function POST(request) {
  try {
    assertSameOrigin(request);
    if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur jadwal belum tersedia.', 503);
    const user = await currentFirebaseUser();
    if (user.role !== 'admin') throw new ApiError('Hanya admin dapat memutuskan koneksi.', 403);
    await clearConfig();
    return json({ status: 'success' });
  } catch (error) { return errorResponse(error); }
}
