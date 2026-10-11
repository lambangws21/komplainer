import 'server-only';
import { callReports } from './report-service';
import { handlingStatus } from '@/app/komplain/workflow.mjs';

// Mirrors the Beranda's own/active/attention/waiting/completed split (previously recomputed
// client-side from the full report list on every render) so the Beranda can fetch a small,
// purpose-built payload instead of the entire list used by the Table/Recap tabs.
export async function reportSummary(user, { cursor = 0, limit = 3 } = {}) {
  const { data } = await callReports('list');
  const own = data.filter((item) => !item.restricted && (user.role === 'admin' || item.picId === user.id || item.pelaporId === user.id));
  const active = own.filter((item) => handlingStatus(item) !== 'Selesai');
  const attention = active.filter((item) => user.role === 'admin' ? !item.picId || handlingStatus(item) === 'Menunggu' : item.picId === user.id);
  const waiting = active.filter((item) => handlingStatus(item) === 'Menunggu');
  const completed = own.filter((item) => handlingStatus(item) === 'Selesai');
  const priority = [...attention].sort((a, b) => String(a.createdAt || a.tanggal || '').localeCompare(String(b.createdAt || b.tanggal || ''))).slice(0, 3);
  const displayed = new Set(priority.map((item) => item.id));
  const rest = own.filter((item) => !displayed.has(item.id)).sort((a, b) => String(b.createdAt || b.tanggal || '').localeCompare(String(a.createdAt || a.tanggal || '')));
  const page = rest.slice(cursor, cursor + limit);
  return {
    status: 'success',
    counts: { own: own.length, active: active.length, attention: attention.length, waiting: waiting.length, completed: completed.length },
    attention: priority,
    latest: { items: page, nextCursor: cursor + limit < rest.length ? cursor + limit : null, total: rest.length },
  };
}
