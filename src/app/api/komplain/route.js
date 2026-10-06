import { callScript, json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';

export const maxDuration = 30;
export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    return json(await callScript(id ? 'detail' : 'list', id ? { id } : {}));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (!['create', 'update', 'delete', 'assign', 'followUp', 'reopen'].includes(body.action)) throw new ApiError('Aksi laporan tidak valid.');
    const keys = ['id', 'version', 'tanggal', 'dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'penangananSelanjutnya', 'status', 'statusPenanganan', 'picId', 'tenggat', 'catatan', 'requestId'];
    const payload = Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
    return json(await callScript(body.action, payload));
  } catch (error) { return errorResponse(error); }
}
