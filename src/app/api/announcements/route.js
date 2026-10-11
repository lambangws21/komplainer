import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, dismissAnnouncement } from '@/lib/server/announcements.mjs';
import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
export async function GET(request) {
  try {
    const user = await currentFirebaseUser();
    const all = new URL(request.url).searchParams.get('all') === '1';
    const admin = all && user.role === 'admin';
    return json({ status: 'success', data: await listAnnouncements({ onlyActive: !admin, forUser: admin ? null : user }) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const user = await currentFirebaseUser();
    const body = await readBody(request);
    if (body.action === 'create') return json(await createAnnouncement(user, body));
    if (body.action === 'update') return json(await updateAnnouncement(user, body));
    if (body.action === 'delete') return json(await deleteAnnouncement(user, body.id));
    if (body.action === 'dismiss') return json(await dismissAnnouncement(user, body.id));
    throw new ApiError('Aksi tidak valid.');
  } catch (error) { return errorResponse(error); }
}
