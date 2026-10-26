'use client';
import { useRef, useState } from 'react';
import { ImageDown, Send, LoaderCircle, Copy, Check } from 'lucide-react';
import ReportImageCard from './report-image-card';
import { shareText, shareUrl, whatsappShareUrl, telegramShareUrl } from './share-report.mjs';

// Renders the off-screen ReportImageCard, captures it as a PNG (html-to-image, loaded lazily so
// it never weighs down the initial bundle), then hands it to the OS share sheet via the Web
// Share API's file support — WhatsApp/Telegram/etc all accept an image there, and `text` (which
// already carries the report's deep link via shareText) rides along as the caption. Most desktop
// browsers don't support sharing files at all, so there the image just downloads — with no
// caption field to carry the link, a panel with a copyable link and WA/Telegram buttons opens
// underneath so the link still reaches whoever receives the image.
//
// navigator.share() only works inside a direct user gesture — generating the PNG is async and
// takes real time, which consumes that gesture before share() runs, throwing NotAllowedError.
// So on devices that support file sharing, the first tap only prepares the file; a second tap
// (a fresh gesture) calls share() with nothing awaited first.
export default function ShareImageButton({ item, formatDate, label, className, iconClassName = 'h-4 w-4 shrink-0' }) {
  const nodeRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [readyFile, setReadyFile] = useState(null);
  const link = item ? shareUrl(item) : '';
  const text = item ? shareText(item, formatDate) : '';

  async function prepareFile() {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(nodeRef.current, { pixelRatio: 2, backgroundColor: '#020617' });
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], `komplain-${item?.id || 'laporan'}.png`, { type: 'image/png' });
  }

  async function handleClick() {
    if (busy) return;
    if (readyFile) {
      // This click is itself the fresh user gesture — nothing async happens before share().
      try { await navigator.share({ files: [readyFile], title: 'Laporan Komplain', text }); setReadyFile(null); }
      catch (err) { if (err?.name !== 'AbortError') { console.error(err); setError('Gagal membagikan gambar. Coba lagi.'); } }
      return;
    }
    setBusy(true); setError(''); setDownloaded(false); setCopied(false);
    try {
      const file = await prepareFile();
      if (navigator.canShare?.({ files: [file] })) setReadyFile(file);
      else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = file.name;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        URL.revokeObjectURL(url);
        setDownloaded(true);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') { console.error(err); setError('Gagal membuat gambar. Coba lagi.'); }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable — link stays selectable in the input */ }
  }

  const readyLabel = label ? 'Kirim gambar' : undefined;
  const idleLabel = label || 'Bagikan sebagai gambar';

  return <div className="relative inline-block">
    <div aria-hidden="true" style={{ position: 'fixed', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}><ReportImageCard ref={nodeRef} item={item} formatDate={formatDate} /></div>
    <button type="button" disabled={busy} onClick={handleClick} aria-label={readyFile ? 'Kirim gambar' : idleLabel} title={readyFile ? 'Gambar siap — ketuk sekali lagi untuk kirim' : idleLabel} className={className}>
      {busy ? <LoaderCircle aria-hidden="true" className={`${iconClassName} animate-spin motion-reduce:animate-none`} /> : readyFile ? <Send aria-hidden="true" className={iconClassName} /> : <ImageDown aria-hidden="true" className={iconClassName} />}
      {readyFile ? readyLabel : label}
    </button>
    {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
    {downloaded && <div role="status" className="komplain-theme absolute left-0 top-full z-20 mt-2 w-64 max-w-[80vw] rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs text-slate-200 shadow-xl">
      <div className="flex items-start justify-between gap-2"><p className="font-medium leading-5">Gambar terunduh. Sertakan link ini saat membagikan, agar penerima bisa membuka laporannya:</p><button type="button" onClick={() => setDownloaded(false)} aria-label="Tutup" className="shrink-0 text-slate-400 hover:text-slate-200">×</button></div>
      <div className="mt-2 flex items-center gap-1.5">
        <input readOnly value={link} onFocus={(event) => event.target.select()} className="min-w-0 flex-1 truncate rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300" />
        <button type="button" onClick={copyLink} aria-label="Salin link" title="Salin link" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600">{copied ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}</button>
      </div>
      <div className="mt-2 flex gap-2">
        <a href={whatsappShareUrl(text)} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-emerald-700 px-2 py-1.5 text-center font-medium hover:bg-emerald-600">WhatsApp</a>
        <a href={telegramShareUrl(link, text)} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-blue-700 px-2 py-1.5 text-center font-medium hover:bg-blue-600">Telegram</a>
      </div>
    </div>}
  </div>;
}
