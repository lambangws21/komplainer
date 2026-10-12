import { json, errorResponse, ApiError } from '@/lib/server/apps-script';
import { usesFirebase } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { currentFirebaseUser } from '@/lib/server/firebase-accounts';
import { loadConfig, subscribeUrl } from '@/lib/server/google-calendar.mjs';

export const maxDuration = 15;
export async function GET() {
  try {
    if (!usesFirestore() || !usesFirebase()) return json({ status: 'success', available: false, connected: false });
    const user = await currentFirebaseUser();
    // Jadwal & Agenda is admin-only while in development — open to petugas/pelapor once stable.
    if (user.role !== 'admin') throw new ApiError('Fitur jadwal masih tahap pengembangan, baru tersedia untuk admin.', 403);
    const config = await loadConfig();
    if (!config?.calendarId) return json({ status: 'success', available: true, connected: false });
    return json({ status: 'success', available: true, connected: true, email: config.email, subscribeUrl: subscribeUrl(config.calendarId), groupEmail: config.groupEmail || '' });
  } catch (error) { return errorResponse(error); }
}
