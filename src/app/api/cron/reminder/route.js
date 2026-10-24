import { json, errorResponse, ApiError } from '@/lib/server/apps-script';
import { cronAuthorized } from '@/lib/server/firebase-backup.mjs';
import { sendBroadcast } from '@/lib/server/push.mjs';

export const maxDuration = 30;

// Four daily reminder pushes (07:00/10:00/13:00/20:00 WIB) — triggered by a GitHub Actions
// schedule rather than Vercel Cron, since the Hobby plan caps native crons at 2/day and this
// project already uses both slots for backup + the existing check-in. See
// .github/workflows/reminder-notifications.yml for the schedule → slot mapping.
const REMINDERS = {
  pagi: { title: 'Selamat Pagi', body: 'Semoga hari ini dipenuhi semangat dan kelancaran dalam bertugas.' },
  perjalanan: { title: 'Tetap Berhati-hati', body: 'Jaga keselamatan di perjalanan — keluarga tercinta menanti Anda pulang dengan selamat.' },
  siang: { title: 'Utamakan Keselamatan', body: 'Bekerja dengan sungguh-sungguh itu penting, namun kehati-hatian jauh lebih utama.' },
  malam: { title: 'Pelayanan Terbaik', body: 'Membantu sesama tak selalu soal materi — pelayanan terbaik bagi pelanggan adalah wujud kepedulian yang sesungguhnya.' },
};

export async function GET(request) {
  try {
    if (!cronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) throw new ApiError('Akses tidak diizinkan.', 401);
    const slot = new URL(request.url).searchParams.get('slot');
    const reminder = REMINDERS[slot];
    if (!reminder) throw new ApiError('Slot pengingat tidak dikenali.', 400);
    const data = await sendBroadcast({ ...reminder, url: '/komplain' });
    return json({ status: 'success', data });
  } catch (error) { return errorResponse(error); }
}
