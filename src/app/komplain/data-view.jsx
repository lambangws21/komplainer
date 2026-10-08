'use client';
import LoadingState from './loading-state';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, dialogHeader, dialogBody, historyNote, picResponseBubble } from './ui-styles.mjs';
import FormattedText, { InlineText } from './formatted-text';
import PhotoGallery from './photo-gallery';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, PlusCircle, Pencil, Archive, UserRound, MessageCircle, RotateCcw, Eye, X, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Table2, BarChart3, ArrowDownUp, Download, Lock, AlertCircle, Wrench, ListChecks, SlidersHorizontal } from 'lucide-react';
import { dateKey, shiftDate, shiftMonth, summarizeWeek, summarizeMonth, weekStart } from './weekly-summary.mjs';
import { reportsToCsv, recapToCsv, groupRecap, downloadCsv } from './export.mjs';
import WorkflowBadge from './workflow-badge';
import SimpleStatusBadge from './simple-status-badge';
import StatusCaseBadge from './status-case-badge';
import AlertBadge from './alert-badge';
import DatePicker from './date-picker';
import DateRangePicker from './date-range-picker';
import RoleBadge from './role-badge';
import ImplantBadge from './implant-badge';
import { IMPLANTS, detectImplants } from './implant.mjs';
import { WORKFLOW_STATUSES, STATUS_CASE, canEditReport, canFollowUp, canReopen, handlingStatus, isOverdue, workflowCardStyle, daysSince, severityChange } from './workflow.mjs';
import { apiRequest } from './api-client.mjs';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const iconControl = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const input = 'min-w-0 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
function initials(name) {
  const cleaned = String(name || '').replace(/^dr\.?\s*/i, '').trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}
function Avatar({ name }) {
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">{initials(name)}</span>;
}
// Flags a case that's been open a week or more without being marked Selesai, so an old report
// doesn't quietly fall off the radar between the one-time "new report" popup and the next scan.
function StaleBadge({ item }) {
  if (handlingStatus(item) === 'Selesai') return null;
  const days = daysSince(item.createdAt);
  if (days === null || days < 7) return null;
  return <span title={`Dilaporkan ${days} hari lalu, belum selesai`} className="rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{days}h</span>;
}

export default function DataView({ list, loaded, loading, loadError, busy, user, levels, Badge, formatDate, today, onCreate, onEdit, onDelete, onAssign, onSelfAssign, onOpenPicAction, onReopen, onExpired, onMarkRead, pendingDetailId, onPendingDetailHandled }) {
  const [view, setView] = useState('table');
  const [periodMode, setPeriodMode] = useState('week');
  const [selectedDate, setSelectedDate] = useState(() => weekStart(today()));
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('Semua');
  const [statusCaseFilter, setStatusCaseFilter] = useState('Semua');
  const [workflowFilter, setWorkflowFilter] = useState('Semua');
  const [onlyMine, setOnlyMine] = useState(false);
  const [implantFilter, setImplantFilter] = useState('Semua');
  const [period, setPeriod] = useState('all');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [detail, setDetail] = useState(null);
  const dialogStyle = useDialogViewport(detail !== null);
  const [history, setHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailVersion = useRef(0);
  const detailReturnFocus = useRef(null);
  const tableViewButton = useRef(null);
  const openDetail = async (item) => {
    onMarkRead?.(item.id);
    detailReturnFocus.current = document.activeElement;
    const version = ++detailVersion.current;
    setDetail(item); setHistory([]); setDetailError(''); setDetailLoading(true);
    try {
      const result = await apiRequest(`/api/komplain?id=${encodeURIComponent(item.id)}`);
      if (version === detailVersion.current) { setDetail(result.data); setHistory(result.history || []); }
    } catch (error) { if (version === detailVersion.current) { setDetailError(error.message); if (error.code === 401) onExpired(); } }
    finally { if (version === detailVersion.current) setDetailLoading(false); }
  };
  useEffect(() => {
    if (!pendingDetailId) return;
    const item = list.find((entry) => entry.id === pendingDetailId);
    if (item) openDetail(item);
    onPendingDetailHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDetailId]);
  const summary = useMemo(() => (periodMode === 'week' ? summarizeWeek(list, selectedDate) : summarizeMonth(list, selectedDate)), [list, selectedDate, periodMode]);
  const filtered = useMemo(() => {
    const source = period === 'period' ? summary.current : list;
    const query = search.trim().toLocaleLowerCase('id-ID');
    const hasRange = !!(rangeStart && rangeEnd);
    return source.filter((item) => (!onlyMine || item.picId === user.id) && (workflowFilter === 'Semua' || handlingStatus(item) === workflowFilter) && (level === 'Semua' || (level === 'Belum' ? !item.status : String(item.status || '').split(' - ')[0] === level)) && (statusCaseFilter === 'Semua' || item.statusCase === statusCaseFilter) && (implantFilter === 'Semua' || detectImplants(item).some((implant) => implant.key === implantFilter)) && (!hasRange || (dateKey(item.tanggal) && dateKey(item.tanggal) >= rangeStart && dateKey(item.tanggal) <= rangeEnd)) && ['dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'picNama', 'pelaporNama'].some((key) => String(item[key] || '').toLocaleLowerCase('id-ID').includes(query)))
      .sort((a, b) => {
        const first = a.createdAt || (dateKey(a.tanggal) ? `${dateKey(a.tanggal)}T00:00:00` : '');
        const second = b.createdAt || (dateKey(b.tanggal) ? `${dateKey(b.tanggal)}T00:00:00` : '');
        if (!first) return second ? 1 : 0;
        if (!second) return -1;
        return sort === 'newest' ? second.localeCompare(first) : first.localeCompare(second);
      });
  }, [list, summary, search, level, statusCaseFilter, workflowFilter, onlyMine, implantFilter, user.id, period, rangeStart, rangeEnd, sort]);
  const myTaskCount = useMemo(() => list.filter((item) => item.picId === user.id).length, [list, user.id]);
  const roleLegend = useMemo(() => list.reduce((seen, item) => ({
    admin: seen.admin || item.pelaporRole === 'admin' || item.picRole === 'admin',
    pelapor: seen.pelapor || item.pelaporRole === 'pelapor',
    petugas: seen.petugas || (!!item.picId && item.picRole === 'petugas'),
    delegated: seen.delegated || (!!item.picId && item.picRole === 'pelapor'),
  }), { admin: false, pelapor: false, petugas: false, delegated: false }), [list]);
  const hiddenFilterCount = [level !== 'Semua', implantFilter !== 'Semua', period !== 'all', !!(rangeStart && rangeEnd)].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const highPriority = summary.current.filter((item) => /^C[12] - /.test(String(item.status))).length;
  const teams = new Set(summary.current.map((item) => String(item.team || '').trim()).filter(Boolean)).size;
  const delta = summary.current.length - summary.previous.length;
  const ready = loaded;
  const shown = (value) => ready ? value : '—';
  const periodLabel = periodMode === 'week' ? 'minggu' : 'bulan';
  const reset = () => { setSearch(''); setLevel('Semua'); setStatusCaseFilter('Semua'); setWorkflowFilter('Semua'); setOnlyMine(false); setImplantFilter('Semua'); setPeriod('all'); setRangeStart(''); setRangeEnd(''); setPage(1); };
  const selectPeriod = (date) => { const start = periodMode === 'week' ? weekStart(date) : date; if (start) { setSelectedDate(start); setPage(1); } };
  const viewPeriodReports = () => { setPeriod('period'); setSearch(''); setLevel('Semua'); setWorkflowFilter('Semua'); setPage(1); setView('table'); tableViewButton.current?.focus(); };
  function exportFiltered() {
    downloadCsv(`laporan-komplain-${today()}.csv`, reportsToCsv(filtered));
  }
  function exportByTeam() {
    downloadCsv(`rekap-technical-support-${today()}.csv`, recapToCsv(filtered, 'team', 'Technical Support'));
  }
  function exportByTindakan() {
    downloadCsv(`rekap-tindakan-${today()}.csv`, recapToCsv(filtered, 'tindakan', 'Tindakan'));
  }
  const alertAction = (item) => () => {
    if (canFollowUp(item, user)) onOpenPicAction(item);
    else if (canEditReport(item, user)) onEdit(item);
    else openDetail(item);
  };
  const actions = (item, mobile = false) => item.restricted ? <p className="flex items-center gap-1.5 text-xs text-slate-500"><Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Tidak dapat diakses</p> : <div className={mobile ? 'grid w-full grid-cols-2 gap-2' : 'flex flex-wrap items-center gap-1'}>
    {canFollowUp(item, user) ? <button disabled={busy} aria-label={`Detail dan tindak lanjut ${item.dokter || ''}`} onClick={() => onOpenPicAction(item)} className={mobile ? `${control} px-3 text-emerald-300 hover:bg-emerald-500/10` : `${iconControl} text-emerald-300 hover:bg-emerald-500/10`}><MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Detail & Tindak Lanjut</span>}</button> : <button aria-label={`Detail laporan ${item.dokter || ''}`} onClick={() => openDetail(item)} className={mobile ? `${control} px-3 text-blue-300 hover:bg-blue-500/10` : `${iconControl} text-blue-300 hover:bg-blue-500/10`}><Eye aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Detail</span>}</button>}
    {canEditReport(item, user) && <button disabled={busy || item.id == null} aria-label={`Edit laporan ${item.dokter || ''}`} onClick={() => onEdit(item)} className={mobile ? `${control} px-3 text-slate-300 hover:bg-slate-800` : `${iconControl} text-slate-300 hover:bg-slate-800`}><Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Edit</span>}</button>}
    {user.role === 'admin' && handlingStatus(item) !== 'Selesai' && <button disabled={busy} aria-label={`Tentukan PIC ${item.dokter || ''}`} onClick={() => onAssign(item)} className={mobile ? `${control} px-3 text-violet-300 hover:bg-violet-500/10` : `${iconControl} text-violet-300 hover:bg-violet-500/10`}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Tentukan PIC</span>}</button>}
    {user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' && <button disabled={busy} aria-label={`Ambil laporan ${item.dokter || ''} sebagai PIC`} onClick={() => onSelfAssign(item)} className={mobile ? `${control} px-3 text-violet-300 hover:bg-violet-500/10` : `${iconControl} text-violet-300 hover:bg-violet-500/10`}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Ambil sebagai PIC</span>}</button>}
    {canReopen(item, user) && <button disabled={busy} aria-label={`Buka kembali ${item.dokter || ''}`} onClick={() => onReopen(item)} className={mobile ? `${control} px-3 text-amber-300 hover:bg-amber-500/10` : `${iconControl} text-amber-300 hover:bg-amber-500/10`}><RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Buka kembali</span>}</button>}
    {canEditReport(item, user) && <button disabled={busy || item.id == null} aria-label={`Arsipkan laporan ${item.dokter || ''}`} onClick={() => onDelete(item)} className={mobile ? `${control} px-3 text-slate-300 hover:bg-red-500/10 hover:text-red-300` : `${iconControl} text-slate-300 hover:bg-red-500/10 hover:text-red-300`}><Archive aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Arsipkan</span>}</button>}
  </div>;
  const periodPicker = periodMode === 'week' ? <div className="flex flex-wrap items-center gap-2">
    <button aria-label="Minggu sebelumnya" onClick={() => selectPeriod(shiftDate(selectedDate, -7))} className={`${control} border border-slate-700 bg-slate-900 px-3`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
    <div className="min-w-0 flex-1 sm:flex-none sm:w-56"><DatePicker id="period-week" ariaLabel="Pilih tanggal dalam minggu rekap" value={selectedDate} onChange={selectPeriod} className={input} /></div>
    <button aria-label="Minggu berikutnya" onClick={() => selectPeriod(shiftDate(selectedDate, 7))} className={`${control} border border-slate-700 bg-slate-900 px-3`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
    <button onClick={() => selectPeriod(today())} className={`${control} bg-slate-800 text-slate-200`}>Minggu ini</button>
  </div> : <div className="flex flex-wrap items-center gap-2">
    <button aria-label="Bulan sebelumnya" onClick={() => selectPeriod(shiftMonth(selectedDate, -1))} className={`${control} border border-slate-700 bg-slate-900 px-3`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
    <div className="min-w-0 flex-1 sm:flex-none sm:w-56"><DatePicker id="period-month" ariaLabel="Pilih bulan rekap" value={selectedDate} onChange={selectPeriod} className={input} /></div>
    <button aria-label="Bulan berikutnya" onClick={() => selectPeriod(shiftMonth(selectedDate, 1))} className={`${control} border border-slate-700 bg-slate-900 px-3`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
    <button onClick={() => selectPeriod(today())} className={`${control} bg-slate-800 text-slate-200`}>Bulan ini</button>
  </div>;

  return <section aria-label="Data dan rekap komplain" className="space-y-5">
    {(roleLegend.admin || roleLegend.pelapor || roleLegend.petugas || roleLegend.delegated) && <div aria-label="Legenda warna peran" className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>Peran:</span>{roleLegend.admin && <RoleBadge role="admin" />}{roleLegend.pelapor && <RoleBadge role="pelapor" />}{roleLegend.petugas && <RoleBadge role="petugas" />}{roleLegend.delegated && <RoleBadge role="pelapor" pic />}</div>}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Pusat laporan</p><h2 className="mt-1 text-2xl font-bold">Data & Rekap Komplain</h2><p className="mt-1 text-sm text-slate-400">{user.role === 'admin' ? 'Kelola seluruh laporan dan pantau penyelesaian setiap minggu.' : 'Laporan dan rekap ini hanya mencakup data yang dapat Anda akses.'}</p></div><button onClick={onCreate} className={`${control} shrink-0 bg-blue-600 hover:bg-blue-500`}><PlusCircle aria-hidden="true" className="h-4 w-4" />Buat laporan</button></div>
    <div aria-label="Tampilan data" className="flex w-full gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 sm:w-fit">
      {[['table', 'Data tabel', Table2], ['weekly', 'Rekap', BarChart3]].map(([value, label, Icon]) => <button key={value} ref={value === 'table' ? tableViewButton : undefined} aria-pressed={view === value} onClick={() => setView(value)} className={`${control} flex-1 whitespace-nowrap sm:flex-none ${view === value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}><Icon aria-hidden="true" className="h-4 w-4" />{label}</button>)}
    </div>

    {view === 'weekly' ? <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:flex-row lg:items-center">
        <div><h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-300" />{formatDate(summary.start)} – {formatDate(summary.end)}</h3><p className="mt-2 text-sm text-slate-400">{periodMode === 'week' ? 'Periode Senin–Minggu, berdasarkan tanggal kejadian.' : 'Periode satu bulan penuh, berdasarkan tanggal kejadian.'}</p></div>
        <div className="flex flex-wrap items-center gap-2"><div aria-label="Pilih jenis rekap" className="flex gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1">{[['week', 'Mingguan'], ['month', 'Bulanan']].map(([value, label]) => <button key={value} aria-pressed={periodMode === value} onClick={() => { setPeriodMode(value); setPage(1); }} className={`${control} px-3 ${periodMode === value ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{label}</button>)}</div>{periodPicker}</div>
      </div>
      {summary.invalidDates > 0 && <p role="status" className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">{summary.invalidDates} laporan dengan tanggal tidak valid tidak disertakan dalam rekap.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Total laporan', shown(summary.current.length), 'Semua tingkat keparahan', 'text-blue-300'],
        ['Perubahan jumlah', shown(`${delta > 0 ? '+' : ''}${delta}`), `Dibanding periode sebelumnya`, 'text-violet-300'],
        ['Critical & Major', shown(highPriority), 'Laporan C1 dan C2', 'text-red-300'],
        ['Team Pelapor terkait', shown(teams), 'Team pelapor berbeda pada periode ini', 'text-emerald-300'],
      ].map(([label, value, hint, color]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-3xl font-bold tabular-nums ${color}`}>{value}</p><p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p></div>)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{WORKFLOW_STATUSES.map((status) => <div key={status} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><WorkflowBadge status={status} /><p className="mt-3 text-2xl font-bold">{shown(summary.current.filter((item) => handlingStatus(item) === status).length)}</p><p className="mt-1 text-xs text-slate-400">Status terkini untuk laporan periode ini</p></div>)}</div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Distribusi harian</h3><span className="text-xs text-slate-400">Jumlah laporan</span></div><p className="mt-1 text-sm text-slate-400">Hari dengan laporan terbanyak lebih mudah terlihat.</p><div className="mt-6 space-y-3">{summary.days.map((day, index) => <div key={day.date} className="flex items-center gap-3"><span className="w-12 shrink-0 text-sm text-slate-300">{periodMode === 'week' ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][index] : String(index + 1)}</span><div role="img" aria-label={`${formatDate(day.date)}: ${ready ? day.count : 'belum tersedia'} laporan`} className="h-7 flex-1 overflow-hidden rounded-md bg-slate-800"><div className="h-full rounded-md bg-blue-500" style={{ width: `${day.count / Math.max(1, ...summary.days.map((item) => item.count)) * 100}%` }} /></div><span className="w-7 text-right text-sm font-semibold tabular-nums">{shown(day.count)}</span></div>)}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2"><h3 className="font-semibold">Tingkat keparahan</h3><p className="mt-1 text-sm text-slate-400">Komposisi laporan dalam periode terpilih.</p><div className="mt-5 space-y-3">{levels.map((item) => { const count = summary.current.filter((report) => report.status === item.code).length; return <div key={item.code} className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/60 p-3"><Badge status={item.code} /><span className="text-sm font-semibold tabular-nums">{shown(count)} <span className="ml-2 text-xs font-normal text-slate-400">{ready ? `${summary.current.length ? Math.round(count / summary.current.length * 100) : 0}%` : '—'}</span></span></div>; })}{summary.current.some((report) => !levels.some((item) => item.code === report.status)) && <p className="text-sm text-slate-400">Belum diklasifikasikan: {summary.current.filter((report) => !levels.some((item) => item.code === report.status)).length} laporan</p>}</div></div>
      </div>
      {user.role === 'admin' && summary.current.length > 0 && <div className="grid gap-5 lg:grid-cols-2">
        {[['team', 'Rekap per Technical Support'], ['tindakan', 'Rekap per Tindakan']].map(([groupKey, title]) => <div key={groupKey} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-semibold">{title}</h3>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th scope="col" className="pb-2 pr-3 font-medium">{groupKey === 'team' ? 'Technical Support' : 'Tindakan'}</th><th scope="col" className="pb-2 pr-3 text-right font-medium">Total</th><th scope="col" className="pb-2 pr-3 text-right font-medium">Sukses</th><th scope="col" className="pb-2 text-right font-medium">Ada Kendala</th></tr></thead><tbody className="divide-y divide-slate-800">{groupRecap(summary.current, groupKey).slice(0, 8).map((group) => <tr key={group.key}><td className="truncate py-2 pr-3">{group.key}</td><td className="py-2 pr-3 text-right tabular-nums font-semibold">{group.total}</td><td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{group.sukses}</td><td className="py-2 text-right tabular-nums text-red-300">{group.kendala}</td></tr>)}</tbody></table></div>
        </div>)}
      </div>}
      {ready && !loading && !loadError && summary.current.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">Belum ada laporan pada {periodLabel} ini. Pilih {periodLabel} lain untuk melihat rekapan.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/60 bg-blue-950/20 p-5"><div><h3 className="font-semibold">Telusuri laporan {periodLabel} ini</h3><p className="mt-1 text-sm text-slate-400">Lihat rincian masalah dan solusi dari periode terpilih.</p></div><button onClick={viewPeriodReports} className={`${control} bg-blue-600 hover:bg-blue-500`}>Lihat {shown(summary.current.length)} laporan<ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div>
    </div> : <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative"><span className="sr-only">Cari laporan</span><Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari dokter, rumah sakit, team, masalah, atau solusi…" className={`${input} pl-10`} /></label>
          <label className="flex items-center gap-2"><ArrowDownUp aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><span className="sr-only">Urutkan laporan</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className={input}><option value="newest">Baru masuk dahulu</option><option value="oldest">Lama dahulu</option></select></label>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Status penanganan</span><select className={input} value={workflowFilter} onChange={(event) => { setWorkflowFilter(event.target.value); setPage(1); }}><option value="Semua">Semua status</option>{WORKFLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Status Case</span><select aria-label="Filter status case" value={statusCaseFilter} onChange={(event) => { setStatusCaseFilter(event.target.value); setPage(1); }} className={input}><option value="Semua">Semua status case</option>{STATUS_CASE.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
            <div className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Tugas Anda</span><button type="button" aria-pressed={onlyMine} onClick={() => { setOnlyMine((value) => !value); setPage(1); }} className={`${control} w-full justify-center ${onlyMine ? 'bg-violet-600' : 'bg-slate-800 text-slate-300'}`}><UserRound aria-hidden="true" className="h-4 w-4" />Tugas saya{myTaskCount > 0 && ` (${myTaskCount})`}</button></div>
          </div>
          <button type="button" aria-expanded={showAllFilters} onClick={() => setShowAllFilters((value) => !value)} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:underline"><SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />{showAllFilters ? 'Sembunyikan filter lainnya' : 'Tampilkan filter lainnya'}{!showAllFilters && hiddenFilterCount > 0 && <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-xs font-semibold text-blue-200">{hiddenFilterCount} aktif</span>}<ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${showAllFilters ? 'rotate-180' : ''}`} /></button>
          {showAllFilters && <div className="mt-3 grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Tingkat keparahan</span><select aria-label="Filter tingkat keparahan" value={level} onChange={(event) => { setLevel(event.target.value); setOnlyMine(false); setPage(1); }} className={input}><option value="Semua">Semua tingkat</option>{['C1', 'C2', 'C3', 'C4'].map((value) => <option key={value} value={value}>{value}</option>)}<option value="Belum">Belum ditentukan</option></select></label>
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Implant</span><select className={input} value={implantFilter} onChange={(event) => { setImplantFilter(event.target.value); setPage(1); }}><option value="Semua">Semua implant</option>{IMPLANTS.map((implant) => <option key={implant.key} value={implant.key}>{implant.label}</option>)}</select></label>
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Periode rekap</span><select className={input} value={period} onChange={(event) => { setPeriod(event.target.value); if (event.target.value === 'period') { setRangeStart(''); setRangeEnd(''); } setPage(1); }}><option value="all">Semua tanggal</option><option value="period">{periodMode === 'week' ? 'Minggu terpilih' : 'Bulan terpilih'}</option></select></label>
            <div className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Rentang tanggal</span><DateRangePicker start={rangeStart} end={rangeEnd} today={today()} onApply={(nextStart, nextEnd) => { setRangeStart(nextStart); setRangeEnd(nextEnd); setPeriod('all'); setPage(1); }} onClear={() => { setRangeStart(''); setRangeEnd(''); setPage(1); }} className={`${input} border-slate-700`} /></div>
          </div>}
        </div>
        {period === 'period' && <div className="space-y-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-3"><p className="text-sm text-blue-200">{formatDate(summary.start)} – {formatDate(summary.end)}</p>{periodPicker}</div>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-sm"><p role="status" className="text-slate-400">{ready ? `${filtered.length} laporan ditemukan` : 'Menunggu data laporan…'}</p><div className="flex flex-wrap items-center gap-2">{(search || level !== 'Semua' || statusCaseFilter !== 'Semua' || workflowFilter !== 'Semua' || onlyMine || implantFilter !== 'Semua' || period !== 'all' || (rangeStart && rangeEnd)) && <button onClick={reset} className={`${control} text-blue-300 hover:bg-blue-500/10`}>Reset filter</button>}<button disabled={!filtered.length} onClick={exportFiltered} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Export Excel (CSV)</button>{user.role === 'admin' && <button disabled={!filtered.length} onClick={exportByTeam} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Rekap per Technical Support</button>}{user.role === 'admin' && <button disabled={!filtered.length} onClick={exportByTindakan} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Rekap per Tindakan</button>}</div></div>
      </div>
      {rows.length > 0 && <>
        <div tabIndex={0} role="region" aria-label="Tabel laporan komplain, geser untuk melihat semua kolom" className="hidden overflow-x-auto border-y border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 md:block"><table className="w-full min-w-[1180px] table-fixed text-left text-sm"><caption className="sr-only">Laporan komplain diurutkan berdasarkan tanggal. Gunakan tombol detail untuk membaca masalah dan solusi lengkap.</caption><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400"><tr>{[['Dokter', 'w-44'], ['Rumah Sakit', 'w-32'], ['Masalah', ''], ['PIC', 'w-36'], ['Tanggal / Tenggat', 'w-28'], ['Tingkat', 'w-28'], ['Status', 'w-36'], ['Aksi', 'w-36']].map(([label, width]) => <th key={label} scope="col" className={`px-4 py-3 font-medium ${width}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((item, index) => item.restricted ? <tr key={item.id ?? index} className="bg-slate-950/40"><td colSpan={4} className="px-4 py-3.5 align-top"><p className="flex items-center gap-1.5 text-sm text-slate-500"><Lock aria-hidden="true" className="h-4 w-4 shrink-0" />Dilaporkan pengguna lain, isi laporan tidak dapat diakses</p><p className="mt-1 break-words text-xs text-slate-500">RS: {item.rumahSakit || 'Belum diisi'} · Team: {item.team || 'Belum diisi'}</p></td><td className="px-4 py-3.5 align-top text-slate-400">{formatDate(item.tanggal)}</td><td className="px-4 py-3.5 align-top"><div className="flex flex-wrap gap-1"><StatusCaseBadge statusCase={item.statusCase} /><Badge status={item.status} /></div></td><td className="px-4 py-3.5 align-top"><WorkflowBadge status={handlingStatus(item)} /></td><td className="px-4 py-3.5 align-top">{actions(item)}</td></tr> : <tr key={item.id ?? index} className={`transition hover:bg-slate-800/40 ${index % 2 === 1 ? 'bg-slate-900/40' : ''}`}>
          <td className="px-4 py-3.5 align-middle"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={item.dokter} /><div className="min-w-0"><p className="truncate font-semibold text-white">{item.dokter || '—'}</p><p className="truncate text-xs text-slate-400">{item.team || 'Team belum diisi'}</p></div></div></td>
          <td className="px-4 py-3.5 align-middle truncate text-slate-300">{item.rumahSakit || '—'}</td>
          <td className="px-4 py-3.5 align-middle"><p className="truncate text-xs font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</p><div className="mt-1"><ImplantBadge item={item} compact /></div><p className="mt-1 line-clamp-2 break-words leading-snug text-slate-300">{item.komplain ? <InlineText text={item.komplain} /> : '—'}</p>{item.jalanKeluar && <p className={`mt-1 line-clamp-2 break-words text-xs leading-snug ${picResponseBubble}`}><span className="font-semibold">{handlingStatus(item) === 'Baru' ? 'Solusi awal:' : 'Respons PIC:'}</span> <InlineText text={item.jalanKeluar} /></p>}<button onClick={() => openDetail(item)} className="mt-1 inline-flex items-center text-xs font-semibold text-blue-300 hover:underline">Lihat detail</button></td>
          <td className="px-4 py-3.5 align-middle">{item.picId ? <div className="flex min-w-0 items-center gap-1.5"><RoleBadge role={item.picRole} pic /><span className="truncate text-xs text-slate-300">{item.picNama}</span></div> : <span className="text-xs text-slate-500">Belum ditugaskan</span>}</td>
          <td className="px-4 py-3.5 align-middle"><p className="text-xs text-slate-300">{formatDate(item.tanggal)}</p>{item.tenggat && <p className={`mt-0.5 text-xs ${isOverdue(item, today()) ? 'font-semibold text-red-300' : 'text-slate-500'}`}>{isOverdue(item, today()) ? 'Terlambat' : formatDate(item.tenggat)}</p>}</td>
          <td className="px-4 py-3.5 align-middle"><div className="flex flex-wrap gap-1"><StatusCaseBadge statusCase={item.statusCase} /><Badge status={item.status} /></div></td>
          <td className="px-4 py-3.5 align-middle"><div className="flex flex-wrap items-center gap-1.5"><WorkflowBadge status={handlingStatus(item)} /><StaleBadge item={item} /><AlertBadge item={item} compact onClick={alertAction(item)} /></div></td>
          <td className="px-3 py-3.5 align-middle">{actions(item)}</td>
        </tr>)}</tbody></table></div>
        <div className="space-y-3 px-3 pb-4 sm:px-4 md:hidden">{rows.map((item, index) => item.restricted ? <article key={item.id ?? index} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-2"><p className="text-xs text-slate-400">{formatDate(item.tanggal)}</p><WorkflowBadge status={handlingStatus(item)} /></div><p className="mt-2 truncate text-sm text-slate-400">RS: {item.rumahSakit || 'Belum diisi'} · Team: {item.team || 'Belum diisi'}</p><p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><Lock aria-hidden="true" className="h-4 w-4 shrink-0" />Dilaporkan pengguna lain, isi laporan tidak dapat diakses</p></article> : <article key={item.id ?? index} className={`min-w-0 rounded-2xl border p-4 shadow-sm ${workflowCardStyle(item, today())}`}>
          <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Avatar name={item.dokter} /><h3 className="min-w-0 truncate font-semibold">{item.dokter || 'Dokter tidak tersedia'}</h3></div><div className="flex shrink-0 items-center gap-1.5"><WorkflowBadge status={handlingStatus(item)} /><StaleBadge item={item} /></div></div>
          <div className="mt-2 flex flex-wrap gap-1.5"><StatusCaseBadge statusCase={item.statusCase} /><Badge status={item.status} /><AlertBadge item={item} onClick={alertAction(item)} /></div>
          <p className="mt-2 truncate text-xs text-slate-400">RS: {item.rumahSakit || 'Belum diisi'} · PIC: {item.picNama || 'Belum ditugaskan'}</p>
          {item.tenggat && <p className={`mt-1 text-xs ${isOverdue(item, today()) ? 'font-semibold text-red-300' : 'text-slate-400'}`}>Tenggat: {formatDate(item.tenggat)}{isOverdue(item, today()) ? ' · Terlambat' : ''}</p>}
          <p className="mt-2 line-clamp-2 break-words text-sm text-slate-300"><span className="font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</span>{item.komplain ? <> — <InlineText text={item.komplain} /></> : ''}</p>
          {item.jalanKeluar && <p className={`mt-1 line-clamp-2 break-words text-xs ${picResponseBubble}`}><span className="font-semibold">{handlingStatus(item) === 'Baru' ? 'Solusi awal:' : 'Respons PIC:'}</span> <InlineText text={item.jalanKeluar} /></p>}
          <div className="mt-1.5"><ImplantBadge item={item} /></div>
          <div className="mt-3 border-t border-slate-800 pt-3">{actions(item, true)}</div>
        </article>)}</div>
      </>}
      {!loading && !loadError && ready && rows.length === 0 && <div className="border-t border-slate-800 p-10 text-center"><Search aria-hidden="true" className="mx-auto h-8 w-8 text-slate-600" /><h3 className="mt-3 font-semibold">{list.length ? 'Tidak ada laporan yang cocok' : 'Belum ada laporan'}</h3><p className="mt-2 text-sm text-slate-400">{list.length ? 'Ubah kata kunci, tingkat keparahan, atau periode.' : 'Mulai dengan membuat laporan komplain pertama.'}</p><button onClick={list.length ? reset : onCreate} className={`${control} mt-4 bg-slate-800`}>{list.length ? 'Reset semua filter' : 'Buat laporan'}</button></div>}
      {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4"><p className="text-xs text-slate-400">Menampilkan {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} laporan</p><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-slate-400"><span className="hidden sm:inline">Tampilkan</span><select aria-label="Jumlah laporan per halaman" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-400">{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / halaman</option>)}</select></label><div className="flex items-center gap-2"><button disabled={currentPage === 1} aria-label="Halaman sebelumnya" onClick={() => setPage(currentPage - 1)} className={`${control} bg-slate-800 px-3`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button><span className="text-sm tabular-nums">{currentPage} / {totalPages}</span><button disabled={currentPage === totalPages} aria-label="Halaman berikutnya" onClick={() => setPage(currentPage + 1)} className={`${control} bg-slate-800 px-3`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div></div></div>}
    </div>}
    <Dialog.Root open={detail !== null} onOpenChange={(open) => { if (!open) { detailVersion.current += 1; setDetail(null); } }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user.role} style={dialogStyle} onCloseAutoFocus={(event) => { event.preventDefault(); if (detailReturnFocus.current?.isConnected) detailReturnFocus.current.focus(); }} className={`${mobileDialog} max-w-2xl ${levels.find((item) => item.code === detail?.status)?.accent ? `border-l-4 ${levels.find((item) => item.code === detail?.status)?.accent}` : ''}`}><div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Detail laporan</Dialog.Title><Dialog.Description className="mt-2 text-sm text-slate-400">Informasi kejadian, masalah, dan solusi yang dicatat.</Dialog.Description><Dialog.Close aria-label="Tutup detail laporan" className={`${control} absolute right-3 top-3 px-3 text-slate-300`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>{detail && <div className={`${dialogBody} pt-5 space-y-5`} data-dialog-scroll>
      <div className="flex flex-wrap gap-6">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Prioritas</p><div className="flex flex-wrap gap-2"><StatusCaseBadge statusCase={detail.statusCase} /><Badge status={detail.status} /><AlertBadge item={detail} /></div></div>
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Progres</p><div className="flex flex-wrap gap-2"><WorkflowBadge status={handlingStatus(detail)} /><SimpleStatusBadge item={detail} /></div></div>
        {detectImplants(detail).length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Implant</p><ImplantBadge item={detail} /></div>}
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-800/30 p-4">{[['Tanggal', formatDate(detail.tanggal), null], ['Pelapor', detail.pelaporNama || 'Data lama (admin)', detail.pelaporRole], ['Dokter', detail.dokter, null], ['Team', detail.team, null], ['Rumah Sakit', detail.rumahSakit || 'Belum diisi', null], ['PIC', detail.picNama, detail.picId ? detail.picRole : null], ['Tindakan', detail.tindakan, null], ['Tenggat', detail.tenggat ? formatDate(detail.tenggat) : 'Belum ditentukan', null]].map(([label, value, role]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 flex flex-wrap items-center gap-1.5 break-words text-sm font-medium">{value ? <>{value}{role && <RoleBadge role={role} pic={label === 'PIC'} />}</> : label === 'PIC' ? <span className="flex items-center gap-1.5 text-slate-400"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Belum ditugaskan</span> : '—'}</dd></div>)}</dl>
      {detail.selesaiPada && <p className="text-xs text-slate-400">Selesai pada {new Date(detail.selesaiPada).toLocaleString('id-ID')}</p>}
      {(() => {
        const pelaporAuthor = detail.pelaporRole ? { role: detail.pelaporRole, pic: false } : null;
        const picAuthor = detail.picRole ? { role: detail.picRole, pic: true } : null;
        const followUpAuthor = handlingStatus(detail) === 'Baru' ? pelaporAuthor : picAuthor;
        return [['Masalah', detail.komplain, 'border-red-900/50 bg-red-950/20 text-red-200', AlertCircle, pelaporAuthor], [handlingStatus(detail) === 'Baru' ? 'Solusi awal' : 'Penyelesaian tindak lanjut', detail.jalanKeluar, 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200', Wrench, followUpAuthor], ['RTL', detail.penangananSelanjutnya, 'border-violet-900/50 bg-violet-950/20 text-violet-200', ListChecks, followUpAuthor]].map(([label, value, color, Icon, author]) => <div key={label} className={`rounded-xl border p-4 ${color}`}><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}{author && value && <RoleBadge role={author.role} pic={author.pic} />}</h3>{value ? <FormattedText text={value} className="mt-2 text-sm leading-6 text-slate-200" /> : <p className="mt-2 text-sm leading-6 text-slate-200">—</p>}</div>);
      })()}
      {detail.fotoUrls?.length > 0 && <div><p className="mb-2 text-sm font-semibold">Foto laporan ({detail.fotoUrls.length})</p><PhotoGallery urls={detail.fotoUrls} label="Foto laporan" /></div>}
      <section className="border-t border-slate-800 pt-5"><h3 className="font-semibold">Riwayat tindak lanjut</h3>{detailLoading && <div className="mt-3"><LoadingState compact title="Memuat riwayat…" description="Mengambil perkembangan terbaru laporan ini." /></div>}{detailError && <p role="alert" className="mt-3 text-sm text-red-300">{detailError}</p>}{!detailLoading && !detailError && !history.length && <p className="mt-3 text-sm text-slate-400">Belum ada riwayat. Data lama akan memiliki riwayat setelah diperbarui.</p>}<ol className="mt-4 space-y-4">{history.map((entry) => { const change = severityChange(entry.detail); return <li key={entry.id} className="border-l-2 border-blue-800 pl-4"><p className="text-sm font-semibold">{entry.aksi}</p><p className="mt-1 break-words text-xs text-slate-400">{entry.nama} · {new Date(entry.tanggal).toLocaleString('id-ID')}</p>{change && <p className="mt-1 text-xs text-amber-300">Tingkat keparahan: {levels.find((level) => level.code === change.before)?.label || 'Belum ditentukan'} → {levels.find((level) => level.code === change.after)?.label || 'Belum ditentukan'}</p>}{entry.catatan && <FormattedText text={entry.catatan} className={`mt-2 ${historyNote}`} />}{entry.fotoUrls?.length > 0 && <div className="mt-2"><PhotoGallery urls={entry.fotoUrls} label="Foto tindak lanjut" thumbClassName="h-16 w-16" /></div>}</li>; })}</ol></section>
      <Dialog.Close className={`${control} w-full bg-slate-800`}><X aria-hidden="true" className="h-4 w-4" />Tutup detail</Dialog.Close>
    </div>}</Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
