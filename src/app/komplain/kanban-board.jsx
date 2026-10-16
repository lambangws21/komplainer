'use client';
import { useMemo, useState } from 'react';
import { UserRound, MessageCircle, Heart } from 'lucide-react';
import FieldInfo from './field-info';
import StatusCaseBadge from './status-case-badge';
import { InlineText } from './formatted-text';
import { WORKFLOW_STATUSES, canFollowUp, canReopen, handlingStatus, workflowCardStyle } from './workflow.mjs';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';

export function initials(name) {
  const cleaned = String(name || '').replace(/^dr\.?\s*/i, '').trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}
export function Avatar({ name }) {
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">{initials(name)}</span>;
}

const KANBAN_COLUMN_ACCENT = { Baru: 'text-blue-300', Diproses: 'text-violet-300', Menunggu: 'text-amber-300', Selesai: 'text-emerald-300' };
const KANBAN_DOT_COLOR = { Baru: 'bg-blue-400', Diproses: 'bg-violet-400', Menunggu: 'bg-amber-400', Selesai: 'bg-emerald-400' };
// The PIC chooses between these two with a single checkbox when saving RTL ("Sedang menunggu
// konfirmasi / pihak terkait") — easy to mix up since both mean "not done yet", so the column
// headers spell out the difference instead of leaving it to be inferred from the label alone.
const WORKFLOW_STATUS_HINT = {
  Baru: 'Laporan baru masuk, belum ada PIC yang menangani.',
  Diproses: 'PIC sudah ditugaskan dan sedang aktif menangani laporan ini.',
  Menunggu: 'PIC sudah menangani, tapi sedang menunggu konfirmasi dari pihak lain (RS, tim lain, dll) sebelum bisa melanjutkan.',
  Selesai: 'Penanganan sudah tuntas. Bisa dibuka kembali jika ternyata masalah muncul lagi.',
};

// What dropping a Kanban card on a different column (or, for any other caller, a card's own
// primary button) actually does — take an unassigned case, follow up on your own, or reopen a
// closed one. Returns null when the viewer has no action available, so a drop is a no-op and a
// card with no primary action just isn't draggable.
// `targetStatus` is the column the card was dropped on — passed through to onOpenPicAction so
// the follow-up dialog can pre-apply it instead of asking the PIC to re-pick what they just
// dragged to (desktop-only, since only drag produces a targetStatus in the first place).
export function kanbanDropAction(item, user, { onAssign, onSelfAssign, onOpenPicAction, onReopen }, targetStatus) {
  if (user.role === 'admin' && !item.picId && handlingStatus(item) !== 'Selesai') return () => onAssign(item);
  if (user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai') return () => onSelfAssign(item);
  if (canFollowUp(item, user)) return () => onOpenPicAction(item, true, targetStatus);
  if (canReopen(item, user)) return () => onReopen(item);
  return null;
}

// A single card, shared by the desktop columns and the mobile per-status tab list. The whole
// card opens the same detail dialog as "Lihat detail" in the table, and — desktop only — can
// also be dragged to another column; a drop never mutates data directly (it triggers the exact
// same assign/self-assign/follow-up/reopen action the card's own primary button would, via
// onDropAction), so dragging is a faster on-ramp into the existing validated flow, not a
// shortcut around it. Required fields (severity, catatan, solusi) still have to be filled in
// whichever dialog that opens.
function KanbanCard({ item, onOpen, Badge, formatDate, draggable = false, dragging = false, onDragStart, onDragEnd }) {
  const reactionTotal = (item.reactions?.like || 0) + (item.reactions?.love || 0);
  return <div role="button" tabIndex={0} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={() => onOpen(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item); } }} className={`min-w-0 cursor-pointer rounded-xl border p-3 text-left shadow-sm transition hover:border-blue-500/60 hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${dragging ? 'opacity-40' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${workflowCardStyle(item)}`}>
    <div className="flex items-start justify-between gap-2"><p className="break-words text-sm font-semibold leading-5 text-slate-100">{item.dokter || 'Dokter tidak tersedia'}</p><StatusCaseBadge statusCase={item.statusCase} /></div>
    <p className="mt-0.5 break-words text-xs text-slate-400">{item.rumahSakit || 'Rumah sakit belum diisi'}</p>
    <p className="mt-2 truncate text-xs font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</p>
    <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-300">{item.komplain ? <InlineText text={item.komplain} /> : 'Belum diisi'}</p>
    <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-400"><UserRound aria-hidden="true" className="h-3 w-3 shrink-0" /><span className="truncate">{item.team || 'Team belum diisi'}</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">Pelapor: {item.pelaporNama || '—'}</span></div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">{item.picId ? <><Avatar name={item.picNama} /><span className="truncate text-xs text-slate-300">{item.picNama}</span></> : <span className="text-xs font-semibold text-amber-300">Belum ada PIC</span>}</div>
      {item.status && <Badge status={item.status} />}
    </div>
    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>{formatDate(item.tanggal)}</span><div className="flex items-center gap-2"><span className="flex items-center gap-1" title="Jumlah riwayat perubahan"><MessageCircle aria-hidden="true" className="h-3 w-3" />{item.version || 1}</span>{reactionTotal > 0 && <span className="flex items-center gap-1 text-pink-300"><Heart aria-hidden="true" className="h-3 w-3 fill-current" />{reactionTotal}</span>}</div></div>
  </div>;
}
export default function KanbanBoard({ items, mobile, onOpen, Badge, formatDate, onDropAction }) {
  const [mobileTab, setMobileTab] = useState(WORKFLOW_STATUSES[0]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const groups = useMemo(() => {
    const map = new Map(WORKFLOW_STATUSES.map((status) => [status, []]));
    for (const item of items) (map.get(handlingStatus(item)) || map.get('Baru')).push(item);
    return map;
  }, [items]);
  if (mobile) {
    const activeItems = groups.get(mobileTab) || [];
    return <div className="space-y-3 p-3">
      <div role="tablist" aria-label="Status laporan" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1">{WORKFLOW_STATUSES.map((status) => <button key={status} role="tab" title={WORKFLOW_STATUS_HINT[status]} aria-selected={mobileTab === status} onClick={() => setMobileTab(status)} className={`${control} shrink-0 px-3 text-xs ${mobileTab === status ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>{status} ({(groups.get(status) || []).length})</button>)}</div>
      <p className="px-1 text-xs leading-5 text-slate-400">{WORKFLOW_STATUS_HINT[mobileTab]}</p>
      {activeItems.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Tidak ada laporan berstatus {mobileTab}.</p> : <div className="space-y-2">{activeItems.map((item) => <KanbanCard key={item.id} item={item} onOpen={onOpen} Badge={Badge} formatDate={formatDate} />)}</div>}
    </div>;
  }
  // Dragging only ever reads the source item off `items` by id (not off drag payload data) —
  // the dataTransfer channel just carries the id across the browser's native DnD boundary.
  const handleDrop = (status) => (event) => {
    event.preventDefault();
    setDragOverStatus(null);
    setDraggingId(null);
    const id = event.dataTransfer.getData('text/plain');
    const item = items.find((entry) => String(entry.id) === id);
    if (!item || handlingStatus(item) === status) return;
    onDropAction?.(item, status)?.();
  };
  return <div role="region" aria-label="Papan kanban laporan" className="flex gap-3 overflow-x-auto p-3 sm:p-5">{WORKFLOW_STATUSES.map((status) => { const columnItems = groups.get(status) || []; return <div key={status} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dragOverStatus !== status) setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus((current) => current === status ? null : current)} onDrop={handleDrop(status)} className={`flex min-w-[240px] flex-1 flex-col gap-2 rounded-xl border p-2 transition-colors ${dragOverStatus === status ? 'border-blue-500 bg-blue-950/30' : 'border-slate-800 bg-slate-950/40'}`}>
    <div className="flex items-center gap-1.5 px-1 py-1"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${KANBAN_DOT_COLOR[status]}`} /><h3 className={`text-sm font-semibold ${KANBAN_COLUMN_ACCENT[status]}`}>{status}</h3><FieldInfo text={WORKFLOW_STATUS_HINT[status]} /><span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{columnItems.length}</span></div>
    <div className="flex flex-col gap-2 overflow-y-auto overscroll-contain" style={{ maxHeight: '65vh' }}>{columnItems.length === 0 ? <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">Tidak ada laporan.</p> : columnItems.map((item) => <KanbanCard key={item.id} item={item} onOpen={onOpen} Badge={Badge} formatDate={formatDate} draggable={!!onDropAction} dragging={draggingId === item.id} onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(item.id)); event.dataTransfer.effectAllowed = 'move'; setDraggingId(item.id); }} onDragEnd={() => setDraggingId(null)} />)}</div>
  </div>; })}</div>;
}
