import { json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { callSchedules } from '@/lib/server/schedule-service.mjs';

export const maxDuration = 60;
export async function GET() {
  try { return json(await callSchedules('list')); } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (!['create', 'update', 'delete'].includes(body.action)) throw new ApiError('Aksi jadwal tidak valid.');
    const keys = ['id', 'reportId', 'title', 'location', 'locationLat', 'locationLng', 'notes', 'date', 'startTime', 'endTime', 'picId', 'photos'];
    const payload = Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
    return json(await callSchedules(body.action, payload));
  } catch (error) { return errorResponse(error); }
}
