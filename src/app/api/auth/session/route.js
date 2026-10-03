import { callScript, json, errorResponse } from '@/lib/server/apps-script';
export async function GET() {
  try { const result = await callScript('session'); return json({ status: 'success', user: result.user }); }
  catch (error) { return errorResponse(error); }
}
