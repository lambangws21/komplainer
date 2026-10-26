'use client';
import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Share2 } from 'lucide-react';
import { shareUrl, shareText, whatsappShareUrl, telegramShareUrl } from './share-report.mjs';

// navigator.share opens the OS share sheet (WhatsApp/Telegram/etc already listed there) on
// mobile browsers that support it; desktop browsers mostly don't, so they fall back to two
// direct links instead of silently doing nothing. The support check runs after mount (not
// during render) so server and first client render stay identical — no hydration mismatch.
// Pass `item` to share a specific report, or `text`/`url` directly to share something else
// (e.g. the app itself) — an explicit override always wins over the report-derived value.
export default function ShareButton({ item, formatDate, text: textOverride, url: urlOverride, shareTitle = 'Laporan Komplain', label, className, iconClassName = 'h-4 w-4 shrink-0' }) {
  const [nativeShare, setNativeShare] = useState(false);
  useEffect(() => { setNativeShare(typeof navigator !== 'undefined' && !!navigator.share); }, []);

  const text = textOverride ?? (item ? shareText(item, formatDate) : '');
  const url = urlOverride ?? (item ? shareUrl(item) : '');

  async function share() {
    try { await navigator.share({ title: shareTitle, text, url }); } catch { /* user cancelled the share sheet */ }
  }
  if (nativeShare) {
    return <button type="button" onClick={share} aria-label={label || 'Bagikan'} title={label || 'Bagikan'} className={className}><Share2 aria-hidden="true" className={iconClassName} />{label}</button>;
  }
  return <Popover.Root>
    <Popover.Trigger asChild><button type="button" aria-label={label || 'Bagikan'} title={label || 'Bagikan'} className={className}><Share2 aria-hidden="true" className={iconClassName} />{label}</button></Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} collisionPadding={12} className="komplain-theme z-[70] w-56 rounded-xl border border-slate-700 bg-slate-800 p-1.5 shadow-xl">
      <a href={whatsappShareUrl(text)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-200 hover:bg-slate-700">WhatsApp</a>
      <a href={telegramShareUrl(url, text)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-200 hover:bg-slate-700">Telegram</a>
      <Popover.Arrow className="fill-slate-700" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
