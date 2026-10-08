'use client';
import { CheckCircle2, PlusCircle } from 'lucide-react';

export default function ReviewChecklist({ form, photoCount, onComplete }) {
  const items = [
    ['jalanKeluar', 'Sudah ada solusi awal yang bisa dicatat?', 'Solusi awal sudah dicatat', !!form.jalanKeluar?.trim()],
    ['penangananSelanjutnya', 'Ada rencana tindak lanjut (RTL) berikutnya?', 'Rencana tindak lanjut sudah dicatat', !!form.penangananSelanjutnya?.trim()],
    ['foto', 'Ada foto pendukung yang ingin dilampirkan?', `${photoCount} foto dilampirkan`, photoCount > 0],
  ];
  return <section aria-labelledby="review-checklist-title" className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3 sm:p-4"><h3 id="review-checklist-title" className="text-sm font-semibold">Sebelum dikirim, sudah ada informasi pendukung?</h3><p className="mt-1 text-xs leading-5 text-slate-400">Jika sudah ada, tambahkan agar penanggung jawab lebih mudah memahami kasus. Jika belum, laporan tetap boleh dikirim.</p><ul className="mt-3 divide-y divide-slate-800">{items.map(([key, question, complete, filled]) => <li key={key} className="flex items-start gap-2 py-3"><span className={`mt-1 shrink-0 ${filled ? 'text-emerald-300' : 'text-slate-400'}`}>{filled ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <PlusCircle aria-hidden="true" className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-xs leading-5 sm:text-sm">{question}</p><p className={`mt-0.5 text-xs ${filled ? 'text-emerald-300' : 'text-slate-400'}`}>{filled ? complete : 'Belum ditambahkan · opsional'}</p></div><button type="button" onClick={() => onComplete(key)} aria-label={`${filled ? 'Ubah' : 'Tambahkan'} ${key === 'jalanKeluar' ? 'solusi awal' : key === 'foto' ? 'foto pendukung' : 'rencana tindak lanjut'}`} className="min-h-11 shrink-0 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">{filled ? 'Ubah' : 'Tambah'}</button></li>)}</ul></section>;
}
