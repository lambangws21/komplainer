import { callScript, json, errorResponse, assertSameOrigin, clearSession } from '@/lib/server/apps-script';
export async function POST(request) {
  try {
    assertSameOrigin(request);
    try { await callScript('logout'); } finally { await clearSession(); }
    return json({ status: 'success' });
  } catch (error) { return errorResponse(error); }
}
