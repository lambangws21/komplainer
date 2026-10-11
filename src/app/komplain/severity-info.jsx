'use client';
import * as Popover from '@radix-ui/react-popover';
import { Info, X } from 'lucide-react';

// Tap-to-reveal reference for what each severity level means, next to the
// Tingkat Keparahan legend — keeps the form itself free of explanatory paragraphs.
export default function SeverityInfo({ levels }) {
  return <Popover.Root>
    <Popover.Trigger asChild><button type="button" aria-label="Info tingkat keparahan" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><Info aria-hidden="true" className="h-3.5 w-3.5" /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} collisionPadding={12} className="komplain-theme z-[70] max-h-[min(60dvh,420px)] w-[min(320px,calc(100vw-2rem))] overflow-y-auto space-y-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs leading-5 text-slate-200 shadow-xl">
      <div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-100">Panduan tingkat keparahan</h4><Popover.Close aria-label="Tutup panduan keparahan" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><X aria-hidden="true" className="h-4 w-4" /></Popover.Close></div>
      {levels.map((level) => <p key={level.code}><span className={`mr-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${level.color}`}>{level.label}</span>{level.description}</p>)}
      <details className="border-t border-slate-600 pt-3"><summary className="cursor-pointer py-2 font-semibold text-slate-100">Arti status penanganan</summary><dl className="mt-2 space-y-2">{[
        ['Baru', 'Laporan masuk dan belum ada tindak lanjut yang tersimpan.'],
        ['Diproses', 'PIC sedang menangani komplain.'],
        ['Menunggu', 'Penanganan menunggu konfirmasi atau tindakan pihak terkait.'],
        ['Selesai', 'Hasil penyelesaian sudah dicatat dan komplain ditutup.'],
      ].map(([label, description]) => <div key={label}><dt className="font-semibold text-slate-100">{label}</dt><dd className="text-slate-300">{description}</dd></div>)}</dl></details>
      <Popover.Arrow className="fill-slate-700" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
