'use client';
import { useState } from 'react';
import { ChevronRight, ThumbsUp, Heart, MessageCircle, Lock, CalendarPlus, CalendarDays, UserRound, Archive } from 'lucide-react';
import { InlineText } from './formatted-text';
import WorkflowBadge from './workflow-badge';
import ShareButton from './share-button';
import ShareImageButton from './share-image-button';
import { ReporterByline, ReportMeta, StatusCasePill } from './report-card';
import { handlingStatus, canFollowUp, canDeleteReport, statusCaseLabel } from './workflow.mjs';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';

function relativeTime(value) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A Facebook-style post: date/status header, a big bold title (the tindakan — what actually
// broke, the thing worth noticing first), then author + context chips, a content preview, and
// the usual Like/Love · comment-count · Share row along the bottom. The Beranda feed's primary
// unit — both the team-wide "Laporan Team" and the personal "Laporan Saya" section render a
// list of these.
export default function FeedCard({ item, user, busy, formatDate, Badge, onOpen, onReact, onAssign, onFollowUp, onTakeReport, onSchedule, onDelete }) {
  // Guards against a rapid double-tap firing two overlapping react() calls with the same stale
  // `item.version` — data-view.jsx's own reaction row already does this; this mirrors it. Declared
  // before the restricted-item early return so hook order stays stable across renders.
  const [reacting, setReacting] = useState(false);
  if (item.restricted) return <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-500"><Lock aria-hidden="true" className="h-4 w-4" /></span><p className="min-w-0 flex-1 text-sm text-slate-500">Dilaporkan pengguna lain · isi laporan tidak dapat diakses</p></div></article>;

  async function toggleReaction(type) {
    if (!onReact || reacting) return;
    setReacting(true);
    try { await onReact(item.id, item.version, type); }
    catch (error) { if (error?.code !== 401) console.error(error); }
    finally { setReacting(false); }
  }
  const primary = user.role === 'admin' && !item.picId && handlingStatus(item) !== 'Selesai' ? ['Tentukan PIC', () => onAssign(item)]
    : user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' ? ['Ambil sebagai PIC', () => onTakeReport(item)]
    : canFollowUp(item, user) ? ['Tangani', () => onFollowUp(item)]
    : [handlingStatus(item) === 'Selesai' ? 'Lihat penyelesaian' : 'Lihat detail', () => onOpen(item)];

  return <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm shadow-black/20">
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 items-center gap-1.5 text-left text-xs text-slate-400 hover:text-slate-300 focus-visible:outline-none"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{formatDate(item.tanggal)} · {relativeTime(item.createdAt)}</span></button>
        <StatusCasePill item={item} label={statusCaseLabel(item)} className="shrink-0" />
      </div>
      <button type="button" onClick={() => onOpen(item)} className="mt-2 block w-full text-left">
        <h3 className="break-words text-lg font-bold leading-snug text-slate-50 sm:text-xl">{item.tindakan || 'Tindakan belum diisi'}</h3>
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <ReporterByline item={item} onClick={() => onOpen(item)} />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <ReportMeta item={item} truncate />
          {item.status && Badge && <Badge status={item.status} />}
        </div>
      </div>
      <button type="button" onClick={() => onOpen(item)} className="mt-3 block w-full text-left">
        <p className="line-clamp-3 break-words text-sm leading-6 text-slate-300"><InlineText text={item.komplain || 'Deskripsi belum diisi'} /></p>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[11px] font-medium text-slate-300"><UserRound aria-hidden="true" className="h-3 w-3 shrink-0" />{item.picNama ? `PIC: ${item.picNama}` : 'PIC: -'}</span>
        <WorkflowBadge status={handlingStatus(item)} />
      </div>
    </div>
    <div className="flex items-center justify-between gap-0.5 border-t border-slate-800 px-1 py-1 sm:gap-1 sm:px-3">
      <div className="flex min-w-0 items-center gap-0 sm:gap-1">
        {onReact ? <>
          <button type="button" disabled={reacting || busy} aria-pressed={item.reactions?.mine === 'like'} aria-label="Suka" title="Suka" onClick={() => toggleReaction('like')} className={`inline-flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold sm:min-h-11 sm:gap-1.5 sm:px-3 sm:text-sm ${item.reactions?.mine === 'like' ? 'text-blue-400' : 'text-slate-400 hover:bg-slate-800'}`}><ThumbsUp aria-hidden="true" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Suka</span>{item.reactions?.like > 0 && <span>{item.reactions.like}</span>}</button>
          <button type="button" disabled={reacting || busy} aria-pressed={item.reactions?.mine === 'love'} aria-label="Cinta" title="Cinta" onClick={() => toggleReaction('love')} className={`inline-flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold sm:min-h-11 sm:gap-1.5 sm:px-3 sm:text-sm ${item.reactions?.mine === 'love' ? 'text-pink-400' : 'text-slate-400 hover:bg-slate-800'}`}><Heart aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${item.reactions?.mine === 'love' ? 'fill-current' : ''}`} /><span className="hidden sm:inline">Cinta</span>{item.reactions?.love > 0 && <span>{item.reactions.love}</span>}</button>
        </> : <span className="inline-flex items-center gap-3 px-2 text-xs text-slate-500">{(item.reactions?.like || item.reactions?.love) > 0 && <span className="flex items-center gap-1"><Heart aria-hidden="true" className="h-3.5 w-3.5 fill-pink-400 text-pink-400" />{(item.reactions?.like || 0) + (item.reactions?.love || 0)}</span>}</span>}
        <button type="button" onClick={() => onOpen(item)} aria-label="Riwayat" title="Riwayat" className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 sm:min-h-11 sm:gap-1.5 sm:px-3 sm:text-sm"><MessageCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Riwayat</span>{item.version > 1 && <span>{item.version - 1}</span>}</button>
        <ShareButton item={item} formatDate={formatDate} iconClassName="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 sm:min-h-11 sm:gap-1.5 sm:px-3 sm:text-sm" />
        <ShareImageButton item={item} formatDate={formatDate} iconClassName="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 sm:min-h-11 sm:gap-1.5 sm:px-3 sm:text-sm" />
        {onDelete && canDeleteReport(item, user) && <button type="button" disabled={busy} aria-label="Arsipkan laporan" title="Arsipkan laporan — menyembunyikan dari daftar, bukan menghapus permanen" onClick={() => onDelete(item)} className="inline-flex min-h-9 items-center rounded-lg px-1.5 text-xs font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300 sm:min-h-11 sm:px-3 sm:text-sm"><Archive aria-hidden="true" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /></button>}
      </div>
      <div className="flex shrink-0 items-center gap-1 py-1 sm:gap-1.5">
        {onSchedule && <button disabled={busy} onClick={() => onSchedule(item)} aria-label="Jadwalkan" title="Jadwalkan" className={`${button} min-h-9 px-1.5 bg-slate-800/70 text-slate-300 sm:px-2.5`}><CalendarPlus aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>}
        <button disabled={busy} onClick={primary[1]} className={`${button} min-h-9 px-2.5 bg-emerald-600 text-white hover:bg-emerald-500`}>{primary[0]}<ChevronRight aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
      </div>
    </div>
  </article>;
}
