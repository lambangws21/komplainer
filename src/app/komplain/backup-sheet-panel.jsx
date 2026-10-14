'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from './api-client.mjs';
import WorkflowBadge from './workflow-badge';
import StatusCaseBadge from './status-case-badge';
import FormattedText from './formatted-text';

const control = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const input = 'min-w-0 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400';
const PAGE_SIZE = 10;
const SEARCH_FIELDS = ['dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'pelaporNama', 'picNama'];

function formatDate(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Reads straight from the "Firebase Backup" sheet (via the same Apps Script backupExport action
// the migration tool uses) — this is literally what's sitting in Google Sheets right now, not a
// reflection of Firestore's own bookkeeping. Read-only: nothing here can edit or delete that data.
export default function BackupSheetPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true); setError('');
    try { setData((await apiRequest('/api/backup/sheet')).data); }
    catch (err) { setError(err.message || 'Gagal memuat data dari Google Sheet.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLocaleLowerCase('id-ID');
    return [...data.reports]
      .filter(({ report }) => !query || SEARCH_FIELDS.some((key) => String(report[key] || '').toLocaleLowerCase('id-ID').includes(query)))
      .sort((a, b) => String(b.report.updatedAt || b.report.createdAt || '').localeCompare(String(a.report.updatedAt || a.report.createdAt || '')));
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return <section aria-label="Data di Google Sheet" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold">Data di Google Sheet</h2><p className="mt-1 text-sm text-slate-400">Isi sheet &quot;Firebase Backup&quot; — salinan laporan yang sudah berhasil dicadangkan ke Google Sheets/Drive.</p></div>
      <button disabled={loading} onClick={load} className={`${control} shrink-0 border border-slate-700 bg-slate-800`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />Muat ulang</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>}
    {!data && loading && <p role="status" className="text-sm text-slate-400">Memuat data dari Google Sheet…</p>}
    {data && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">{data.total} laporan tersimpan di sheet{data.truncated ? ' (ditampilkan sebagian — terlalu banyak untuk dimuat sekaligus)' : ''}</p>
        <label className="relative w-full sm:w-64"><span className="sr-only">Cari data backup</span><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari dokter, RS, tindakan…" className={`${input} pl-9`} /></label>
      </div>
      {rows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">{data.total ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data di sheet backup.'}</p> : <>
        <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400"><tr><th scope="col" className="px-3 py-2 font-medium">Dokter / Rumah Sakit</th><th scope="col" className="px-3 py-2 font-medium">Tanggal</th><th scope="col" className="px-3 py-2 font-medium">Kondisi</th><th scope="col" className="px-3 py-2 font-medium">Status</th><th scope="col" className="px-3 py-2 font-medium">Versi</th><th scope="col" className="px-3 py-2 font-medium">Diperbarui</th><th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Detail</span></th></tr></thead><tbody className="divide-y divide-slate-800">
          {rows.map(({ report, history }) => <Fragment key={report.id}>
            <tr className="hover:bg-slate-800/40">
              <td className="px-3 py-2.5 align-top"><p className="break-words font-semibold text-slate-100">{report.dokter || '—'}</p><p className="mt-0.5 break-words text-xs text-slate-400">{report.rumahSakit || 'Rumah sakit belum diisi'}</p></td>
              <td className="px-3 py-2.5 align-top text-xs text-slate-300">{formatDate(report.tanggal)}</td>
              <td className="px-3 py-2.5 align-top"><StatusCaseBadge statusCase={report.statusCase} /></td>
              <td className="px-3 py-2.5 align-top"><WorkflowBadge status={report.statusPenanganan || 'Baru'} /></td>
              <td className="px-3 py-2.5 align-top text-xs tabular-nums text-slate-300">v{report.version}</td>
              <td className="px-3 py-2.5 align-top text-xs text-slate-400">{formatDateTime(report.updatedAt)}</td>
              <td className="px-3 py-2.5 align-top"><button type="button" aria-expanded={expanded === report.id} onClick={() => setExpanded((value) => value === report.id ? null : report.id)} className={`${control} px-2 text-blue-300 hover:bg-blue-500/10`}><ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${expanded === report.id ? 'rotate-180' : ''}`} /></button></td>
            </tr>
            {expanded === report.id && <tr><td colSpan={7} className="space-y-3 border-t border-slate-800 bg-slate-950/40 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-400">Masalah</p><FormattedText text={report.komplain || 'Belum diisi'} className="mt-1 text-sm leading-6 text-slate-200" /></div><div><p className="text-xs font-semibold text-slate-400">Solusi / hasil penanganan</p><FormattedText text={report.jalanKeluar || report.solusiAwal || 'Belum diisi'} className="mt-1 text-sm leading-6 text-slate-200" /></div></div>
              <p className="text-xs text-slate-400">Team: {report.team || '—'} · PIC: {report.picNama || 'Belum ada PIC'} · Pelapor: {report.pelaporNama || '—'}</p>
              <p className="text-xs font-semibold text-slate-400">Riwayat ({history.length})</p>
              {history.length ? <ol className="space-y-1.5">{history.map((entry) => <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs"><span className="font-semibold text-slate-200">{entry.aksi}</span><span className="ml-2 text-slate-400">{entry.nama} · {formatDateTime(entry.tanggal)}</span></li>)}</ol> : <p className="text-xs text-slate-500">Belum ada riwayat tercatat di sheet.</p>}
            </td></tr>}
          </Fragment>)}
        </tbody></table></div>
        {totalPages > 1 && <div className="flex items-center justify-between gap-2 text-sm"><span className="text-xs text-slate-400">Halaman {currentPage} / {totalPages}</span><div className="flex items-center gap-2"><button disabled={currentPage === 1} aria-label="Halaman sebelumnya" onClick={() => setPage(currentPage - 1)} className={`${control} bg-slate-800 px-2.5`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button><button disabled={currentPage === totalPages} aria-label="Halaman berikutnya" onClick={() => setPage(currentPage + 1)} className={`${control} bg-slate-800 px-2.5`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div></div>}
      </>}
    </>}
  </section>;
}
