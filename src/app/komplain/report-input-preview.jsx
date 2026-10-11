'use client';
import FormattedText from './formatted-text';
import PhotoGallery from './photo-gallery';
import StatusCaseBadge from './status-case-badge';
import WorkflowBadge from './workflow-badge';
import { handlingStatus } from './workflow.mjs';

export default function ReportInputPreview({ form, user, editItem, photos, formatDate }) {
  const urls = [...(editItem?.fotoUrls || []), ...photos.map((photo) => photo.previewUrl)];
  return <aside aria-labelledby="report-live-preview-title" className="hidden min-w-0 lg:sticky lg:top-0 lg:block lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-slate-800 lg:p-5">
    <h3 id="report-live-preview-title" className="text-xl font-semibold">Preview Laporan</h3>
    <p className="mt-2 text-xs leading-5 text-slate-400">Preview mengikuti isian Anda. Laporan belum disimpan.</p>
    <article className="mt-5 space-y-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-5">
      <div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{editItem ? 'Preview perubahan' : 'Laporan baru'}</p><span className="text-xs text-slate-400">{form.tanggal ? formatDate(form.tanggal) : 'Tanggal belum diisi'}</span></div><div className="mt-2"><WorkflowBadge status={editItem ? handlingStatus(editItem) : 'Baru'} /></div></div>
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-700">{[
        ['Dokter', form.dokter], ['Rumah Sakit', form.rumahSakit], ['Team Pelapor', form.team], ['Tindakan', form.tindakan],
      ].map(([label, value]) => <div key={label} className="min-w-0 border-b border-r border-slate-700 p-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm leading-5">{value || <span className="text-slate-500">Belum diisi</span>}</dd></div>)}</dl>
      <section><h4 className="text-xs text-slate-400">Deskripsi</h4><div className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-slate-950/40 p-3">{form.komplain ? <FormattedText text={form.komplain} className="break-words text-sm leading-6" /> : <p className="text-sm text-slate-500">Deskripsi komplain akan tampil di sini.</p>}</div></section>
      <div className="border-t border-slate-700 pt-4"><StatusCaseBadge statusCase={form.statusCase} /></div>
      {(form.jalanKeluar || form.penangananSelanjutnya) && <div className="space-y-3 border-t border-slate-700 pt-4">{[
        ['Solusi awal', form.jalanKeluar, 'border-emerald-500/60 border-l-emerald-400 bg-emerald-950/70', 'text-emerald-200'],
        ['Rencana tindak lanjut (RTL)', form.penangananSelanjutnya, 'border-violet-500/60 border-l-violet-400 bg-violet-950/70', 'text-violet-200'],
      ].filter(([, value]) => value).map(([label, value, panelClass, titleClass]) => <section key={label} className={`rounded-xl border border-l-4 p-3 ${panelClass}`}><h4 className={`text-sm font-semibold ${titleClass}`}>{label}</h4><FormattedText text={value} className="mt-2 max-h-32 overflow-y-auto break-words text-sm leading-6 text-slate-100" /></section>)}</div>}
      <section className="rounded-xl border border-slate-700 p-3"><h4 className="text-sm font-medium">Foto laporan ({urls.length})</h4>{urls.length ? <div className="mt-3"><PhotoGallery urls={urls} label="Foto preview laporan" thumbClassName="h-16 w-16" /></div> : <p className="mt-2 text-xs text-slate-400">Belum ada foto yang dipilih.</p>}</section>
      <p className="break-words text-xs text-slate-400">Pelapor: {editItem?.pelaporNama || user.nama}</p>
      <button type="submit" className="min-h-11 w-full rounded-xl text-sm font-semibold text-blue-300 hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Tinjau selengkapnya</button>
    </article>
  </aside>;
}
