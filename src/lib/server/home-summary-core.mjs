import { handlingStatus } from '../../app/komplain/workflow.mjs';

// Reports untouched this long (no update, still open) surface as an SLA/aging widget on the
// admin Beranda — a quick worklist of what's stalled, not just what's newly waiting on someone.
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

// Pure own/active/attention/waiting/completed split, deliberately kept free of the `server-only`
// import and the Firestore/Sheets call that live in home-summary.mjs — those make this logic
// unreachable from a plain unit test, which is exactly how the attention/latest overlap
// regression slipped through uncaught before. See home-summary.test.mjs for coverage.
export function computeReportSummary(data, user, { cursor = 0, limit = 3 } = {}) {
  const own = data.filter((item) => user.role === 'admin' || item.picId === user.id || item.pelaporId === user.id);
  const active = own.filter((item) => handlingStatus(item) !== 'Selesai');
  const attention = active.filter((item) => user.role === 'admin' ? !item.picId || handlingStatus(item) === 'Menunggu' : item.picId === user.id);
  const waiting = active.filter((item) => handlingStatus(item) === 'Menunggu');
  const completed = own.filter((item) => handlingStatus(item) === 'Selesai');
  const priority = [...attention].sort((a, b) => String(a.createdAt || a.tanggal || '').localeCompare(String(b.createdAt || b.tanggal || ''))).slice(0, 3);
  // The Beranda feed itself is team-wide for every role (same visibility `list` already grants —
  // a pelapor still only sees full content on their own/assigned reports, restricted summaries
  // on the rest), not just "mine" — "Laporan saya" below covers the personal view separately.
  // Still excludes whatever "Perlu tindakan Anda" is actually showing (`priority`, not the full
  // `attention` set) so admin/petugas on mobile don't see the same card twice, side by side.
  const displayed = new Set(priority.map((item) => item.id));
  const rest = data.filter((item) => !displayed.has(item.id)).sort((a, b) => String(b.createdAt || b.tanggal || '').localeCompare(String(a.createdAt || a.tanggal || '')));
  const page = rest.slice(cursor, cursor + limit);
  const now = Date.now();
  const stale = user.role !== 'admin' ? [] : active
    .filter((item) => now - new Date(item.updatedAt || item.createdAt || 0).getTime() > STALE_MS)
    .sort((a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')))
    .slice(0, 5);
  // Every complaint this user owns end-to-end — as PIC (petugas) or as the original reporter
  // (pelapor) — active or already Selesai. "Perlu tindakan Anda" above only covers the
  // still-open subset, so this is the fuller "what's mine" picture, not just what's pending.
  const myComplaints = user.role === 'petugas' ? data.filter((item) => item.picId === user.id)
    : data.filter((item) => item.pelaporId === user.id);
  myComplaints.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  // "own" only covers reports already tied to this petugas (as PIC), so a brand-new unassigned
  // report never shows up anywhere on their Beranda otherwise — this surfaces it separately,
  // across the whole list, so petugas can see and take new incoming reports right away.
  const incomingAll = user.role === 'petugas' ? data.filter((item) => !item.picId && handlingStatus(item) !== 'Selesai')
    .sort((a, b) => String(b.createdAt || b.tanggal || '').localeCompare(String(a.createdAt || a.tanggal || '')))
    : [];
  return {
    status: 'success',
    counts: { own: own.length, active: active.length, attention: attention.length, waiting: waiting.length, completed: completed.length, myComplaints: myComplaints.length, incoming: incomingAll.length },
    attention: priority,
    stale,
    myComplaints: myComplaints.slice(0, 8),
    incoming: incomingAll.slice(0, 5),
    latest: { items: page, nextCursor: cursor + limit < rest.length ? cursor + limit : null, total: rest.length },
  };
}
