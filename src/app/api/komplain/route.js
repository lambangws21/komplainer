import { callReports } from '@/lib/server/report-service';
import { after } from 'next/server';
import { backupEnabled, syncBackupJob } from '@/lib/server/firebase-backup.mjs';
import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';

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
    if (!['create', 'update', 'delete', 'assign', 'followUp', 'reopen'].includes(body.action)) throw new ApiError('Aksi laporan tidak valid.');
    const keys = ['id', 'version', 'tanggal', 'dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'penangananSelanjutnya', 'status', 'statusCase', 'statusPenanganan', 'picId', 'tenggat', 'catatan', 'requestId', 'photos'];
    const payload = Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
    const result = await callReports(body.action, payload);
    if (result.backupJobId && backupEnabled()) after(async () => { try { await syncBackupJob(result.backupJobId); } catch { /* Durable queue remains available to cron. */ } });
    const response = { ...result }; delete response.backupJobId;
    return json(response);
  } catch (error) { return errorResponse(error); }
}
