'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { displaySrc } from './photo-url.mjs';

export default function PhotoGallery({ urls = [], label = 'Foto', thumbClassName = 'h-20 w-20' }) {
  const [index, setIndex] = useState(null);
  if (!urls.length) return null;
  const open = index !== null;
  const go = (delta) => setIndex((current) => (current + delta + urls.length) % urls.length);
  return <>
    <div className="flex flex-wrap gap-2">{urls.map((url, i) => <button key={url} type="button" onClick={() => setIndex(i)} aria-label={`Lihat ${label.toLowerCase()} ${i + 1}`} className={`block ${thumbClassName} shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 transition hover:ring-2 hover:ring-blue-400`}><img src={displaySrc(url)} alt={`${label} ${i + 1}`} loading="lazy" className="h-full w-full object-cover" /></button>)}</div>
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) setIndex(null); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[90] bg-black/90" /><Dialog.Content onOpenAutoFocus={(event) => event.preventDefault()} className="fixed left-1/2 top-1/2 z-[91] flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 outline-none">
        <Dialog.Title className="sr-only">{label}</Dialog.Title>
        <Dialog.Description className="sr-only">Pratinjau {label.toLowerCase()} {open ? index + 1 : ''} dari {urls.length}</Dialog.Description>
        {open && <img src={displaySrc(urls[index])} alt={`${label} ${index + 1}`} className="max-h-[75dvh] w-auto max-w-full rounded-xl object-contain" />}
        <div className="flex items-center gap-3">
          {urls.length > 1 && <button type="button" onClick={() => go(-1)} aria-label="Foto sebelumnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></button>}
          {urls.length > 1 && <span className="text-sm tabular-nums text-slate-200">{index + 1} / {urls.length}</span>}
          {urls.length > 1 && <button type="button" onClick={() => go(1)} aria-label="Foto berikutnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"><ChevronRight aria-hidden="true" className="h-5 w-5" /></button>}
          {open && <a href={urls[index]} target="_blank" rel="noreferrer" aria-label="Buka foto asli di tab baru" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"><ExternalLink aria-hidden="true" className="h-5 w-5" /></a>}
        </div>
        <Dialog.Close aria-label="Tutup" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-800/80 text-white transition hover:bg-slate-700"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
