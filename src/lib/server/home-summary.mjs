import 'server-only';
import { callReports } from './report-service';
import { handlingStatus } from '@/app/komplain/workflow.mjs';

// Reports untouched this long (no update, still open) surface as an SLA/aging widget on the
// admin Beranda — a quick worklist of what's stalled, not just what's newly waiting on someone.
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

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
  const now = Date.now();
  const stale = user.role !== 'admin' ? [] : active
    .filter((item) => now - new Date(item.updatedAt || item.createdAt || 0).getTime() > STALE_MS)
    .sort((a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')))
    .slice(0, 5);
  // Every complaint this user owns end-to-end — as PIC (petugas) or as the original reporter
  // (pelapor) — active or already Selesai. "Perlu tindakan Anda" above only covers the
  // still-open subset, so this is the fuller "what's mine" picture, not just what's pending.
  const myComplaints = user.role === 'petugas' ? data.filter((item) => !item.restricted && item.picId === user.id)
    : user.role === 'pelapor' ? data.filter((item) => !item.restricted && item.pelaporId === user.id)
    : [];
  myComplaints.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  return {
    status: 'success',
    counts: { own: own.length, active: active.length, attention: attention.length, waiting: waiting.length, completed: completed.length, myComplaints: myComplaints.length },
    attention: priority,
    stale,
    myComplaints: myComplaints.slice(0, 8),
    latest: { items: page, nextCursor: cursor + limit < rest.length ? cursor + limit : null, total: rest.length },
  };
}
