import { callReports } from '@/lib/server/report-service';
import { after } from 'next/server';
import { backupEnabled, syncBackupJob } from '@/lib/server/firebase-backup.mjs';
import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { firebaseDirectory } from '@/lib/server/firebase-accounts';
import { pushTargetsForMutation, sendPush } from '@/lib/server/push.mjs';

export const maxDuration = 60;
export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    return json(await callReports(id ? 'detail' : 'list', id ? { id } : {}));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (!['create', 'update', 'delete', 'assign', 'followUp', 'reopen', 'purge', 'bulkPurge', 'react'].includes(body.action)) throw new ApiError('Aksi laporan tidak valid.');
    const keys = ['id', 'version', 'tanggal', 'dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'penangananSelanjutnya', 'status', 'statusCase', 'statusPenanganan', 'picId', 'tenggat', 'catatan', 'requestId', 'photos', 'items', 'type'];
    const payload = Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
    const result = await callReports(body.action, payload);
    if (result.backupJobId && backupEnabled()) after(async () => { try { await syncBackupJob(result.backupJobId); } catch { /* Durable queue remains available to cron. */ } });
    if (result.action && usesFirestore()) after(async () => {
      try {
        const accounts = await firebaseDirectory();
        const targets = pushTargetsForMutation(result.action, result.data, result.mentions, accounts);
        for (const target of targets) await sendPush([target.userId], { title: target.title, body: target.body, url: target.url });
      } catch { /* Best-effort — in-app notifications still cover this. */ }
    });
    const response = { ...result }; delete response.backupJobId; delete response.action; delete response.mentions;
    return json(response);
  } catch (error) { return errorResponse(error); }
}
