import { callReports } from '@/lib/server/report-service';
import { json, errorResponse } from '@/lib/server/apps-script';
export async function GET() {
  try { return json(await callReports('mentionables', {})); } catch (error) { return errorResponse(error); }
}
