import 'server-only';
import { callReports } from './report-service';
import { computeReportSummary } from './home-summary-core.mjs';

export async function reportSummary(user, { cursor = 0, limit = 3 } = {}) {
  const { data } = await callReports('list');
  return computeReportSummary(data, user, { cursor, limit });
}
