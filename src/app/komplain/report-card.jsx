import { Stethoscope, Tag, AlertCircle } from 'lucide-react';
import { Avatar } from './kanban-board';

// Pieces shared by the two "report as a card" renderings — FeedCard (interactive, on-screen)
// and ReportImageCard (static, exported as a PNG for sharing). Deliberately not merged into one
// component: one needs buttons and line-clamped text, the other needs plain text free to run to
// any height — but the byline, meta row, and status-case styling were identical copy-paste
// between the two, which is the part worth sharing.

// Shorter than workflow.mjs's ROLE_LABELS ("Petugas / PIC") — this sits right under a name in a
// tight card byline, where the longer form used in account pickers wouldn't fit as cleanly.
const BYLINE_ROLE_LABELS = { admin: 'Admin', petugas: 'PIC', pelapor: 'Pelapor' };

// Renders as a button (onOpen) on FeedCard, a plain div on the non-interactive ReportImageCard.
export function ReporterByline({ item, onClick }) {
  const content = <>
    <Avatar name={item.pelaporNama} />
    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{item.pelaporNama || 'Pengguna'}</span>{item.pelaporRole && <span className="block text-xs text-slate-500">{BYLINE_ROLE_LABELS[item.pelaporRole] || item.pelaporRole}</span>}</span>
  </>;
  return onClick
    ? <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-2.5 text-left focus-visible:outline-none">{content}</button>
    : <div className="flex items-center gap-3">{content}</div>;
}

// `truncate` keeps FeedCard's header on one line; ReportImageCard leaves it off since a static
// image can just be as wide/tall as the content needs.
export function ReportMeta({ item, truncate = false }) {
  const textClass = truncate ? 'min-w-0 truncate' : '';
  return <>
    <span className={`inline-flex items-center gap-1 ${truncate ? 'min-w-0' : ''}`}><Stethoscope aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className={textClass}>{item.dokter || 'Dokter belum diisi'} · {item.rumahSakit || 'RS belum diisi'}</span></span>
    {item.team && <span className={`inline-flex items-center gap-1 ${truncate ? 'min-w-0' : ''}`}><Tag aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className={textClass}>{item.team}</span></span>}
  </>;
}

// Deliberately more vivid than the shared StatusCaseBadge (which stays muted for the
// table/Kanban/detail chrome) — cards are the one place "Ada Kendala" should jump out at a glance.
export const STATUS_CASE_VIVID = { Sukses: 'border-emerald-500 bg-emerald-600 text-white', 'Ada Kendala': 'border-red-500 bg-red-600 text-white' };

export function StatusCasePill({ item, label, className = '' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CASE_VIVID[item.statusCase] || 'border-slate-600 bg-slate-700 text-slate-200'} ${className}`}>{item.statusCase === 'Ada Kendala' && <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}{label}</span>;
}
