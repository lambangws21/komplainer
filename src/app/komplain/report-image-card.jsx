import { forwardRef } from 'react';
import Image from 'next/image';
import { UserRound, CalendarDays } from 'lucide-react';
import { ReporterByline, ReportMeta, StatusCasePill } from './report-card';
import { handlingStatus, statusCaseLabel } from './workflow.mjs';
import { displaySrc } from './photo-url.mjs';

const HANDLING_VIVID = { Baru: 'border-blue-500 bg-blue-600 text-white', Diproses: 'border-violet-500 bg-violet-600 text-white', Menunggu: 'border-amber-500 bg-amber-600 text-white', Selesai: 'border-emerald-500 bg-emerald-600 text-white' };
// 400 chars keeps the exported image a reasonable height for a single WhatsApp-friendly card —
// the full text is still one tap away via the deep link printed in the footer.
function previewText(text, max = 400) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value || 'Deskripsi belum diisi.';
}

// A read-only, purely presentational mirror of FeedCard's layout, sized and styled for export
// as a static PNG (see share-image-button.jsx) rather than on-screen interaction — no buttons,
// no onClick, no line-clamping (a static image can just be as tall as it needs to be). Rendered
// off-screen and captured with html-to-image. Shares its byline/meta/status-case pill with
// FeedCard via report-card.jsx — see that file for why the two aren't merged outright.
const ReportImageCard = forwardRef(function ReportImageCard({ item, formatDate }, ref) {
  const handling = handlingStatus(item);
  return <div ref={ref} style={{ width: 560, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }} className="bg-slate-950 text-slate-100">
    <div className="p-7">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <p className="text-sm font-bold tracking-wide text-blue-300">KOMPLAINER</p>
        <span className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{formatDate(item.tanggal)}</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <StatusCasePill item={item} label={statusCaseLabel(item)} />
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${HANDLING_VIVID[handling] || 'border-slate-600 bg-slate-700 text-slate-200'}`}>{handling}</span>
      </div>
      <h2 className="mt-4 break-words text-2xl font-bold leading-snug text-white">{item.tindakan || 'Tindakan belum diisi'}</h2>
      <div className="mt-4"><ReporterByline item={item} /></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
        <ReportMeta item={item} />
      </div>
      {item.fotoUrls?.length > 0 && (item.fotoUrls.length === 1
        ? <div className="relative mt-4 h-36 w-full overflow-hidden rounded-xl border border-slate-800"><Image src={displaySrc(item.fotoUrls[0])} alt="Foto laporan" fill unoptimized priority className="object-cover" /></div>
        : <div className="mt-4 grid grid-cols-2 gap-1.5">{item.fotoUrls.slice(0, 4).map((url, index) => <div key={url} className="relative h-16 w-full overflow-hidden rounded-xl border border-slate-800">
            <Image src={displaySrc(url)} alt={`Foto laporan ${index + 1}`} fill unoptimized priority className="object-cover" />
            {index === 3 && item.fotoUrls.length > 4 && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm font-semibold text-white">+{item.fotoUrls.length - 4}</div>}
          </div>)}</div>)}
      <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm leading-6 text-slate-300">{previewText(item.komplain)}</p>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-300"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{item.picNama ? `PIC: ${item.picNama}` : 'PIC: belum ditugaskan'}</div>
      <div className="mt-5 border-t border-slate-800 pt-3 text-center text-[11px] text-slate-500">Dibuat otomatis melalui Komplainer — sistem pelaporan komplain rumah sakit</div>
    </div>
  </div>;
});
export default ReportImageCard;
