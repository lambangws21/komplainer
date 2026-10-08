'use client';
import LoadingState from './loading-state';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, historyNote, picResponseBubble } from './ui-styles.mjs';
import FormattedText, { InlineText } from './formatted-text';
import PhotoGallery from './photo-gallery';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Search, PlusCircle, Pencil, Archive, UserRound, MessageCircle, RotateCcw, Eye, X, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Table2, BarChart3, ArrowDownUp, Download, Lock, AlertCircle, Wrench, ListChecks, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
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
import { WORKFLOW_STATUSES, STATUS_CASE, canEditReport, canFollowUp, canReopen, handlingStatus, isOverdue, workflowCardStyle, daysSince, historyChanges, formatHistoryValue, historyFieldLabel, editedFieldLabels } from './workflow.mjs';
import { apiRequest } from './api-client.mjs';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const iconControl = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const input = 'min-w-0 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const PAGE_SIZE_OPTIONS = [1, 5, 10, 20, 50];
function initials(name) {
  const cleaned = String(name || '').replace(/^dr\.?\s*/i, '').trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}
function Avatar({ name }) {
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">{initials(name)}</span>;
}
function Classification({ item, Badge }) {
  return <div className="space-y-3">
    <div><p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Kondisi kasus</p><StatusCaseBadge statusCase={item.statusCase} /></div>
    <div><p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Keparahan</p>{item.status ? <Badge status={item.status} /> : <span className="text-xs text-slate-400">Belum dinilai PIC</span>}</div>
  </div>;
}
function ReportProgress({ item, today, onAlert }) {
  return <div className="space-y-2"><WorkflowBadge status={handlingStatus(item)} /><div className="flex flex-wrap items-center gap-1.5"><StaleBadge item={item} /><AlertBadge item={item} compact onClick={onAlert} /></div>{item.tenggat && <p className={`text-xs leading-5 ${isOverdue(item, today) ? 'font-medium text-red-300' : 'text-slate-400'}`}>{isOverdue(item, today) ? 'Melewati tenggat' : handlingStatus(item) === 'Selesai' ? 'Penanganan selesai' : 'Dalam masa penanganan'}</p>}</div>;
}
function historyDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Waktu tidak tersedia' : date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Flags a case that's been open a week or more without being marked Selesai, so an old report
// doesn't quietly fall off the radar between the one-time "new report" popup and the next scan.
function StaleBadge({ item }) {
  if (handlingStatus(item) === 'Selesai') return null;
  const days = daysSince(item.createdAt);
  if (days === null || days < 7) return null;
  return <span title={`Dilaporkan ${days} hari lalu, belum selesai`} className="rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{days} hari</span>;
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
  const [mobile, setMobile] = useState(false);
  const [mobilePageSize, setMobilePageSize] = useState(1);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => { setMobile(query.matches); setPage(1); };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const effectivePageSize = mobile ? mobilePageSize : pageSize;
  const [detail, setDetail] = useState(null);
  const dialogStyle = useDialogViewport(detail !== null);
  const [history, setHistory] = useState([]);
  const [detailTab, setDetailTab] = useState('report');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailVersion = useRef(0);
  const detailReturnFocus = useRef(null);
  const tableViewButton = useRef(null);
  const detailScroll = useRef(null);
  useEffect(() => { detailScroll.current?.scrollTo({ top: 0 }); }, [detailTab]);
  const openDetail = async (item, resetTab = true) => {
    onMarkRead?.(item.id);
    if (resetTab) detailReturnFocus.current = document.activeElement;
    const version = ++detailVersion.current;
    setDetail(item); if (resetTab) setDetailTab('report'); setHistory([]); setDetailError(''); setDetailLoading(true);
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);
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
    {canFollowUp(item, user) ? <button disabled={busy} aria-label={`Detail laporan ${item.dokter || ''}`} onClick={() => openDetail(item)} className={mobile ? `${control} px-3 text-emerald-300 hover:bg-emerald-500/10` : `${iconControl} text-emerald-300 hover:bg-emerald-500/10`}><Eye aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Detail & Riwayat</span>}</button> : <button aria-label={`Detail laporan ${item.dokter || ''}`} onClick={() => openDetail(item)} className={mobile ? `${control} px-3 text-blue-300 hover:bg-blue-500/10` : `${iconControl} text-blue-300 hover:bg-blue-500/10`}><Eye aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Detail</span>}</button>}
    {canEditReport(item, user) && <button disabled={busy || item.id == null} aria-label={`Edit laporan ${item.dokter || ''}`} onClick={() => onEdit(item)} className={mobile ? `${control} px-3 text-slate-300 hover:bg-slate-800` : `${iconControl} text-slate-300 hover:bg-slate-800`}><Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Edit</span>}</button>}
    {user.role === 'admin' && handlingStatus(item) !== 'Selesai' && <button disabled={busy} aria-label={`Tentukan PIC ${item.dokter || ''}`} onClick={() => onAssign(item)} className={mobile ? `${control} px-3 text-violet-300 hover:bg-violet-500/10` : `${iconControl} text-violet-300 hover:bg-violet-500/10`}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Tentukan PIC</span>}</button>}
    {user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' && <button disabled={busy} aria-label={`Ambil laporan ${item.dokter || ''} sebagai PIC`} onClick={() => onSelfAssign(item)} className={mobile ? `${control} px-3 text-violet-300 hover:bg-violet-500/10` : `${iconControl} text-violet-300 hover:bg-violet-500/10`}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Ambil sebagai PIC</span>}</button>}
    {canReopen(item, user) && <button disabled={busy} aria-label={`Buka kembali ${item.dokter || ''}`} onClick={() => onReopen(item)} className={mobile ? `${control} px-3 text-amber-300 hover:bg-amber-500/10` : `${iconControl} text-amber-300 hover:bg-amber-500/10`}><RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Buka kembali</span>}</button>}
    {canEditReport(item, user) && <button disabled={busy || item.id == null} aria-label={`Arsipkan laporan ${item.dokter || ''}`} onClick={() => onDelete(item)} className={mobile ? `${control} px-3 text-slate-300 hover:bg-red-500/10 hover:text-red-300` : `${iconControl} text-slate-300 hover:bg-red-500/10 hover:text-red-300`}><Archive aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Arsipkan</span>}</button>}
  </div>;
  const mobileActions = (item) => {
    const options = [
      canEditReport(item, user) && ['Edit laporan', Pencil, () => onEdit(item)],
      user.role === 'admin' && handlingStatus(item) !== 'Selesai' && ['Tentukan PIC', UserRound, () => onAssign(item)],
      user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' && ['Ambil sebagai PIC', UserRound, () => onSelfAssign(item)],
      canReopen(item, user) && ['Buka kembali', RotateCcw, () => onReopen(item)],
      canEditReport(item, user) && ['Arsipkan laporan', Archive, () => onDelete(item)],
    ].filter(Boolean);
    return <div className="flex items-center gap-2"><button disabled={busy} onClick={() => openDetail(item)} className={`${control} min-w-0 flex-1 bg-blue-600 px-3 text-white hover:bg-blue-500`}><Eye aria-hidden="true" className="h-4 w-4 shrink-0" />Detail & riwayat</button>{options.length > 0 && <DropdownMenu.Root><DropdownMenu.Trigger disabled={busy} aria-label={`Aksi lainnya untuk ${item.dokter || 'laporan'}`} className={`${control} shrink-0 border border-slate-700 bg-slate-800 px-3`}><MoreHorizontal aria-hidden="true" className="h-5 w-5" /></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content data-role={user.role} align="end" sideOffset={6} className="komplain-theme z-[70] min-w-48 rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-slate-100 shadow-xl">{options.map(([label, Icon, onSelect]) => <DropdownMenu.Item key={label} disabled={busy} onSelect={onSelect} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-slate-700 data-[disabled]:opacity-40"><Icon aria-hidden="true" className="h-4 w-4" />{label}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}</div>;
  };
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
    {(roleLegend.admin || roleLegend.pelapor || roleLegend.petugas || roleLegend.delegated) && <div aria-label="Legenda warna peran" className="hidden flex-wrap items-center gap-2 text-xs text-slate-400 md:flex"><span>Peran:</span>{roleLegend.admin && <RoleBadge role="admin" />}{roleLegend.pelapor && <RoleBadge role="pelapor" />}{roleLegend.petugas && <RoleBadge role="petugas" />}{roleLegend.delegated && <RoleBadge role="pelapor" pic />}</div>}
    <div className="flex items-center justify-between gap-2 sm:gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Pusat laporan</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Data & Rekap Komplain</h2><p className="mt-1 hidden text-sm text-slate-400 sm:block">{user.role === 'admin' ? 'Kelola seluruh laporan dan pantau penyelesaian setiap minggu.' : 'Laporan dan rekap ini hanya mencakup data yang dapat Anda akses.'}</p></div><button onClick={onCreate} className={`${control} shrink-0 bg-blue-600 hover:bg-blue-500`}><PlusCircle aria-hidden="true" className="h-4 w-4" />Buat laporan</button></div>
    <div aria-label="Tampilan data" className="flex w-full gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 sm:w-fit">
      {[['table', 'Data tabel', Table2], ['weekly', 'Rekap', BarChart3]].map(([value, label, Icon]) => <button key={value} ref={value === 'table' ? tableViewButton : undefined} aria-pressed={view === value} onClick={() => setView(value)} className={`${control} flex-1 whitespace-nowrap sm:flex-none ${view === value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}><Icon aria-hidden="true" className="h-4 w-4" />{label}</button>)}
    </div>

    {view === 'weekly' ? <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:flex-row lg:items-center">
        <div><h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-300" />{formatDate(summary.start)} – {formatDate(summary.end)}</h3><p className="mt-2 text-sm text-slate-400">{periodMode === 'week' ? 'Periode Senin–Minggu, berdasarkan tanggal kejadian.' : 'Periode satu bulan penuh, berdasarkan tanggal kejadian.'}</p></div>
        <div className="flex flex-wrap items-center gap-2"><div aria-label="Pilih jenis rekap" className="flex gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1">{[['week', 'Mingguan'], ['month', 'Bulanan']].map(([value, label]) => <button key={value} aria-pressed={periodMode === value} onClick={() => { setPeriodMode(value); setPage(1); }} className={`${control} px-3 ${periodMode === value ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{label}</button>)}</div>{periodPicker}</div>
      </div>
      {summary.invalidDates > 0 && <p role="status" className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">{summary.invalidDates} laporan dengan tanggal tidak valid tidak disertakan dalam rekap.</p>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
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
      <div className="space-y-3 p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative"><span className="sr-only">Cari laporan</span><Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari dokter, rumah sakit, team, masalah, atau solusi…" className={`${input} pl-10`} /></label>
          <label className="hidden items-center gap-2 md:flex"><ArrowDownUp aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><span className="sr-only">Urutkan laporan</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className={input}><option value="newest">Baru masuk dahulu</option><option value="oldest">Lama dahulu</option></select></label>
        </div>

        <button onClick={() => setMobileFilters((value) => !value)} aria-expanded={mobileFilters} aria-controls="report-filters" className={`${control} w-full justify-between bg-slate-800 md:hidden`}><span className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />Filtrasi & urutan{hiddenFilterCount + [workflowFilter !== 'Semua', statusCaseFilter !== 'Semua', onlyMine].filter(Boolean).length > 0 && ' · aktif'}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 ${mobileFilters ? 'rotate-180' : ''}`} /></button>
        <div id="report-filters" className={`rounded-xl border border-slate-800 bg-slate-950/40 p-3 ${mobileFilters ? '' : 'hidden md:block'}`}>
          <label className="mb-3 flex items-center gap-2 md:hidden"><span className="text-xs text-slate-400">Urutan</span><select aria-label="Urutkan laporan mobile" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className={input}><option value="newest">Terbaru dahulu</option><option value="oldest">Terlama dahulu</option></select></label>
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-sm"><p role="status" className="text-slate-400">{ready ? `${filtered.length} laporan ditemukan` : 'Menunggu data laporan…'}</p><details open={!mobile} className="group md:contents"><summary className="cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold text-blue-300 md:hidden">Export & opsi</summary><div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">{(search || level !== 'Semua' || statusCaseFilter !== 'Semua' || workflowFilter !== 'Semua' || onlyMine || implantFilter !== 'Semua' || period !== 'all' || (rangeStart && rangeEnd)) && <button onClick={reset} className={`${control} text-blue-300 hover:bg-blue-500/10`}>Reset filter</button>}<button disabled={!filtered.length} onClick={exportFiltered} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Export Excel (CSV)</button>{user.role === 'admin' && <button disabled={!filtered.length} onClick={exportByTeam} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Rekap per Technical Support</button>}{user.role === 'admin' && <button disabled={!filtered.length} onClick={exportByTindakan} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Rekap per Tindakan</button>}</div></details></div>
      </div>
      {rows.length > 0 && <>
        <div tabIndex={0} role="region" aria-label="Tabel laporan komplain, geser untuk melihat semua kolom" className="hidden overflow-x-auto rounded-xl border border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 md:block"><table className="w-full min-w-[1440px] table-fixed text-left text-sm"><caption className="sr-only">Laporan komplain diurutkan berdasarkan tanggal. Gunakan tombol detail untuk membaca masalah dan solusi lengkap.</caption><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400"><tr>{[['Dokter', 'w-44'], ['Rumah Sakit', 'w-36'], ['Masalah', ''], ['PIC', 'w-40'], ['Tanggal / Tenggat', 'w-36'], ['Klasifikasi', 'w-44'], ['Status penanganan', 'w-40'], ['Aksi', 'w-36']].map(([label, width]) => <th key={label} scope="col" className={`px-4 py-3 font-medium ${width}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((item, index) => item.restricted ? <tr key={item.id ?? index} className="bg-slate-950/40"><td colSpan={4} className="px-4 py-3.5 align-top"><p className="flex items-center gap-1.5 text-sm text-slate-500"><Lock aria-hidden="true" className="h-4 w-4 shrink-0" />Dilaporkan pengguna lain, isi laporan tidak dapat diakses</p><p className="mt-1 break-words text-xs text-slate-500">RS: {item.rumahSakit || 'Belum diisi'} · Team: {item.team || 'Belum diisi'}</p></td><td className="px-4 py-3.5 align-top text-slate-400">{formatDate(item.tanggal)}</td><td className="px-4 py-3.5 align-top"><Classification item={item} Badge={Badge} /></td><td className="px-4 py-3.5 align-top"><WorkflowBadge status={handlingStatus(item)} /></td><td className="px-4 py-3.5 align-top">{actions(item)}</td></tr> : <tr key={item.id ?? index} className={`transition hover:bg-slate-800/40 ${index % 2 === 1 ? 'bg-slate-900/40' : ''}`}>
          <td className="px-4 py-3.5 align-middle"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={item.dokter} /><div className="min-w-0"><p className="truncate font-semibold text-white">{item.dokter || '—'}</p><p className="truncate text-xs text-slate-400">{item.team || 'Team belum diisi'}</p></div></div></td>
          <td className="px-4 py-3.5 align-middle break-words text-slate-300">{item.rumahSakit || '—'}</td>
          <td className="px-4 py-3.5 align-middle"><p className="truncate text-xs font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</p><div className="mt-1"><ImplantBadge item={item} compact /></div><p className="mt-1 line-clamp-2 break-words leading-snug text-slate-300">{item.komplain ? <InlineText text={item.komplain} /> : '—'}</p>{item.jalanKeluar && <p className={`mt-1 line-clamp-2 break-words text-xs leading-snug ${picResponseBubble}`}><span className="font-semibold">{handlingStatus(item) === 'Baru' ? 'Solusi awal:' : 'Respons PIC:'}</span> <InlineText text={item.jalanKeluar} /></p>}<button onClick={() => openDetail(item)} className="mt-1 inline-flex items-center text-xs font-semibold text-blue-300 hover:underline">Lihat detail</button></td>
          <td className="px-4 py-3.5 align-middle">{item.picId ? <div className="flex min-w-0 flex-col items-start gap-1.5"><RoleBadge role={item.picRole} pic /><span className="break-words text-xs text-slate-300">{item.picNama}</span></div> : <span className="text-xs text-slate-500">Belum ditugaskan</span>}</td>
          <td className="px-4 py-3.5 align-middle"><p className="text-xs text-slate-300">{formatDate(item.tanggal)}</p>{item.tenggat && <p className={`mt-0.5 text-xs ${isOverdue(item, today()) ? 'font-semibold text-red-300' : 'text-slate-500'}`}>{isOverdue(item, today()) ? 'Terlambat' : formatDate(item.tenggat)}</p>}</td>
          <td className="px-4 py-3.5 align-middle"><Classification item={item} Badge={Badge} /></td>
          <td className="px-4 py-3.5 align-middle"><ReportProgress item={item} today={today()} onAlert={alertAction(item)} /></td>
          <td className="px-3 py-3.5 align-middle">{actions(item)}</td>
        </tr>)}</tbody></table></div>
        <div className="space-y-3 px-3 pb-4 sm:px-4 md:hidden">{rows.map((item, index) => item.restricted ? <article key={item.id ?? index} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-2"><p className="text-xs text-slate-400">{formatDate(item.tanggal)}</p><WorkflowBadge status={handlingStatus(item)} /></div><p className="mt-2 break-words text-sm text-slate-400">RS: {item.rumahSakit || 'Belum diisi'} · Team: {item.team || 'Belum diisi'}</p><p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><Lock aria-hidden="true" className="h-4 w-4 shrink-0" />Dilaporkan pengguna lain, isi laporan tidak dapat diakses</p></article> : <article key={item.id ?? index} className={`min-w-0 rounded-2xl border p-4 shadow-sm ${workflowCardStyle(item, today())}`}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold leading-5">{item.dokter || 'Dokter tidak tersedia'}</h3><p className="mt-0.5 text-[11px] text-slate-400">{formatDate(item.tanggal)}</p></div><WorkflowBadge status={handlingStatus(item)} /></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">{[['Rumah Sakit', item.rumahSakit || 'Belum diisi'], ['Team Pelapor', item.team || 'Belum diisi'], ['PIC', item.picNama || 'Belum ditugaskan'], ['Tenggat', item.tenggat ? formatDate(item.tenggat) : 'Belum ditentukan']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] text-slate-400">{label}</dt><dd className={`break-words leading-4 ${label === 'Tenggat' && isOverdue(item, today()) ? 'font-semibold text-red-300' : 'text-slate-200'}`}>{value}{label === 'Tenggat' && isOverdue(item, today()) && ' · Terlambat'}</dd></div>)}</dl>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2"><div className="min-w-0"><p className="mb-1 text-[10px] text-slate-400">Kondisi kasus</p><StatusCaseBadge statusCase={item.statusCase} /></div><div className="min-w-0"><p className="mb-1 text-[10px] text-slate-400">Keparahan</p>{item.status ? <Badge status={item.status} /> : <span className="text-xs text-slate-400">Belum dinilai PIC</span>}</div></div>
          <div className="mt-2 space-y-1 text-xs leading-5"><p className="break-words font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</p><p className={`break-words text-slate-300 ${expandedCard === item.id ? '' : 'line-clamp-2'}`}><span className="font-semibold text-slate-400">Masalah: </span>{item.komplain ? <InlineText text={item.komplain} /> : 'Belum diisi'}</p>{item.jalanKeluar && <p className={`break-words text-emerald-200 ${expandedCard === item.id ? '' : 'line-clamp-1'}`}><span className="font-semibold">Penyelesaian: </span><InlineText text={item.jalanKeluar} /></p>}</div>
          {expandedCard === item.id && <div id={`card-content-${item.id}`} className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs"><p className="break-words text-slate-300"><span className="font-semibold">Pelapor: </span>{item.pelaporNama || 'Data lama'} {item.pelaporRole && <RoleBadge role={item.pelaporRole} />}</p>{item.picId && <RoleBadge role={item.picRole} pic />}<p className="break-words leading-5 text-slate-300"><span className="font-semibold">RTL: </span>{item.penangananSelanjutnya ? <InlineText text={item.penangananSelanjutnya} /> : 'Belum diisi'}</p><ImplantBadge item={item} /><StaleBadge item={item} /><AlertBadge item={item} compact onClick={alertAction(item)} />{item.fotoUrls?.length > 0 && <PhotoGallery urls={item.fotoUrls} label="Foto laporan" thumbClassName="h-14 w-14" />}</div>}
          <button aria-expanded={expandedCard === item.id} onClick={() => setExpandedCard((value) => value === item.id ? null : item.id)} className="flex min-h-9 items-center gap-1 text-xs font-semibold text-blue-300">{expandedCard === item.id ? 'Ringkas kembali' : 'Baca seluruh ringkasan'}<ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 ${expandedCard === item.id ? 'rotate-180' : ''}`} /></button>
          <div className="border-t border-slate-800 pt-2">{mobileActions(item)}</div>
        </article>)}</div>
      </>}
      {!loading && !loadError && ready && rows.length === 0 && <div className="border-t border-slate-800 p-10 text-center"><Search aria-hidden="true" className="mx-auto h-8 w-8 text-slate-600" /><h3 className="mt-3 font-semibold">{list.length ? 'Tidak ada laporan yang cocok' : 'Belum ada laporan'}</h3><p className="mt-2 text-sm text-slate-400">{list.length ? 'Ubah kata kunci, tingkat keparahan, atau periode.' : 'Mulai dengan membuat laporan komplain pertama.'}</p><button onClick={list.length ? reset : onCreate} className={`${control} mt-4 bg-slate-800`}>{list.length ? 'Reset semua filter' : 'Buat laporan'}</button></div>}
      {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3 py-3 sm:px-5 sm:py-4"><p className="hidden text-xs text-slate-400 sm:block">Menampilkan {(currentPage - 1) * effectivePageSize + 1}–{Math.min(currentPage * effectivePageSize, filtered.length)} dari {filtered.length} laporan</p><div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:gap-3"><label className="flex items-center gap-2 text-xs text-slate-400"><span className="hidden sm:inline">Tampilkan</span><select aria-label="Jumlah laporan per halaman" value={effectivePageSize} onChange={(event) => { (mobile ? setMobilePageSize : setPageSize)(Number(event.target.value)); setPage(1); }} className="min-h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-400">{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / halaman</option>)}</select></label><div className="flex items-center gap-2"><button disabled={currentPage === 1} aria-label="Halaman sebelumnya" onClick={() => setPage(currentPage - 1)} className={`${control} bg-slate-800 px-3`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button><span className="text-sm tabular-nums">{currentPage} / {totalPages}</span><button disabled={currentPage === totalPages} aria-label="Halaman berikutnya" onClick={() => setPage(currentPage + 1)} className={`${control} bg-slate-800 px-3`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div></div></div>}
    </div>}
    <Dialog.Root open={detail !== null} onOpenChange={(open) => { if (!open) { detailVersion.current += 1; setDetail(null); } }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user.role} style={dialogStyle} onCloseAutoFocus={(event) => { event.preventDefault(); if (detailReturnFocus.current?.isConnected) detailReturnFocus.current.focus(); }} className={`${mobileDialog} max-w-2xl ${levels.find((item) => item.code === detail?.status)?.accent ? `border-l-4 ${levels.find((item) => item.code === detail?.status)?.accent}` : ''}`}>
      <div className="relative shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <Dialog.Title className="pr-10 text-base font-bold sm:text-xl">Detail laporan</Dialog.Title>
        <Dialog.Description className="mt-1 pr-10 text-xs text-slate-400">Ringkasan, isi laporan, dan jejak perubahan.</Dialog.Description>
        <Dialog.Close aria-label="Tutup detail laporan" className={`${control} absolute right-2 top-2 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
      </div>
      {detail && <>
      <div aria-label="Bagian detail laporan" className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-900 px-3 py-2 sm:px-5">{[['report', 'Ringkasan'], ['content', 'Isi laporan'], ['history', `Riwayat${detailLoading ? '' : ` (${history.length})`}`]].map(([value, label]) => <button key={value} aria-pressed={detailTab === value} onClick={() => setDetailTab(value)} className={`${control} min-w-0 flex-1 px-2 text-xs sm:text-sm ${detailTab === value ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</button>)}</div>
      <div ref={detailScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 touch-pan-y [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-4" data-dialog-scroll>
      {detailLoading && <p role="status" className="mb-3 text-xs text-blue-300">Memperbarui informasi laporan…</p>}
      {detailError && <div role="alert" className="mb-3 rounded-xl border border-red-900 bg-red-950/20 p-3 text-xs text-red-300"><p>{detailError}</p><p className="mt-1 text-slate-400">Informasi yang tampil belum dapat dipastikan sebagai versi terbaru.</p><button onClick={() => openDetail(detail, false)} className={`${control} mt-2 bg-slate-800 text-xs`}>Coba lagi</button></div>}
      <div hidden={detailTab !== 'report'} className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 break-words text-base font-semibold">{detail.dokter || 'Dokter belum diisi'}</h3><WorkflowBadge status={handlingStatus(detail)} /></div>
        <p className="mt-1 break-words text-xs text-slate-400">{detail.rumahSakit || 'Rumah Sakit belum diisi'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3"><div className="min-w-0"><p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Kondisi kasus</p><StatusCaseBadge statusCase={detail.statusCase} /></div><div className="min-w-0"><p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Keparahan</p>{detail.status ? <Badge status={detail.status} /> : <span className="text-xs text-slate-400">Belum dinilai PIC</span>}</div></div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><SimpleStatusBadge item={detail} /><AlertBadge item={detail} compact /></div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-800 bg-slate-950/20 p-3">{[['Tanggal', formatDate(detail.tanggal), null], ['Pelapor', detail.pelaporNama || 'Data lama (admin)', detail.pelaporRole], ['Team Pelapor', detail.team, null], ['PIC', detail.picNama, detail.picId ? detail.picRole : null], ['Tindakan', detail.tindakan, null], ['Tenggat', detail.tenggat ? formatDate(detail.tenggat) : 'Belum ditentukan', null]].map(([label, value, role]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 flex flex-wrap items-center gap-1.5 break-words text-xs font-medium leading-5 sm:text-sm">{value ? <>{value}{role && <RoleBadge role={role} pic={label === 'PIC'} />}</> : label === 'PIC' ? <span className="flex items-center gap-1.5 text-slate-400"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Belum ditugaskan</span> : '—'}</dd></div>)}</dl>
      {detectImplants(detail).length > 0 && <div className="rounded-xl border border-slate-800 p-3"><p className="mb-2 text-xs font-medium text-slate-400">Implant</p><ImplantBadge item={detail} /></div>}
      {detail.selesaiPada && <p className="text-xs text-slate-400">Selesai pada {new Date(detail.selesaiPada).toLocaleString('id-ID')}</p>}
      <button onClick={() => setDetailTab('content')} className={`${control} w-full bg-slate-800 text-blue-300`}>Baca masalah & penyelesaian<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
      </div>
      <div hidden={detailTab !== 'content'} className="space-y-3">
      {(() => {
        const pelaporAuthor = detail.pelaporRole ? { role: detail.pelaporRole, pic: false } : null;
        const picAuthor = detail.picRole ? { role: detail.picRole, pic: true } : null;
        const followUpAuthor = handlingStatus(detail) === 'Baru' ? pelaporAuthor : picAuthor;
        return [['Masalah', detail.komplain, 'border-red-900/50 bg-red-950/20 text-red-200', AlertCircle, pelaporAuthor], [handlingStatus(detail) === 'Baru' ? 'Solusi awal' : 'Penyelesaian tindak lanjut', detail.jalanKeluar, 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200', Wrench, followUpAuthor], ['Rencana tindak lanjut (RTL)', detail.penangananSelanjutnya, 'border-violet-900/50 bg-violet-950/20 text-violet-200', ListChecks, followUpAuthor]].map(([label, value, color, Icon, author]) => <div key={label} className={`min-w-0 rounded-xl border p-3 sm:p-4 ${color}`}><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}{author && value && <RoleBadge role={author.role} pic={author.pic} />}</h3>{value ? <FormattedText text={value} className="mt-2 text-sm leading-6 text-slate-200" /> : <p className="mt-2 text-xs leading-5 text-slate-400">Belum diisi</p>}</div>);
      })()}
      {detail.fotoUrls?.length > 0 && <div><p className="mb-2 text-sm font-semibold">Foto laporan ({detail.fotoUrls.length})</p><PhotoGallery urls={detail.fotoUrls} label="Foto laporan" /></div>}
      </div>
      <section hidden={detailTab !== 'history'} aria-label="Riwayat perubahan laporan">
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Riwayat edit & tindak lanjut</h3><span className="text-xs text-slate-400">{history.length} aktivitas</span></div>
        <p className="mt-1 text-xs text-slate-400">Perubahan terbaru ditampilkan paling atas.</p>
        {detailLoading && <div className="mt-3"><LoadingState compact title="Memuat riwayat…" description="Mengambil perkembangan terbaru laporan ini." /></div>}

        {!detailLoading && !detailError && !history.length && <p className="mt-3 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Belum ada riwayat perubahan. Aktivitas berikutnya akan tercatat di sini.</p>}
        <ol className="mt-4 space-y-4">{history.map((entry) => {
          const changes = historyChanges(entry.detail);
          const fields = editedFieldLabels(entry.detail);
          return <li key={entry.id} className="relative ml-1 border-l-2 border-blue-800 pl-4"><span aria-hidden="true" className="absolute -left-[5px] top-5 h-2 w-2 rounded-full bg-blue-400" /><article className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-semibold text-slate-100">{entry.aksi}</h4><time dateTime={Number.isNaN(new Date(entry.tanggal).getTime()) ? undefined : new Date(entry.tanggal).toISOString()} className="text-xs text-slate-400">{historyDate(entry.tanggal)}</time></div>
            <p className="mt-2 flex items-center gap-1.5 break-words text-xs text-slate-300"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{entry.nama || 'Pengguna'}</p>
            {fields.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Kolom yang diedit">{fields.map((field) => <span key={field} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{field}</span>)}</div>}
            {changes.length > 0 && <details className="mt-3" open={!mobile}><summary className="cursor-pointer text-xs font-semibold text-blue-300">Detail perubahan ({changes.length})</summary><dl className="mt-2 space-y-3">{changes.map((change) => <div key={change.key}><dt className="mb-1.5 text-xs font-medium text-slate-300">{historyFieldLabel(change.key)}</dt><dd className="grid min-w-0 gap-2 sm:grid-cols-2"><div className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 p-2"><span className="text-[10px] uppercase tracking-wide text-slate-400">Sebelum</span><FormattedText text={String(formatHistoryValue(change.key, change.before, levels, formatDate))} className="mt-1 break-words text-xs leading-5 text-slate-400" /></div><div className="min-w-0 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-2"><span className="text-[10px] uppercase tracking-wide text-emerald-300">Sesudah</span><FormattedText text={String(formatHistoryValue(change.key, change.after, levels, formatDate))} className="mt-1 break-words text-xs leading-5 text-slate-200" /></div></dd></div>)}</dl></details>}
            {entry.catatan && <FormattedText text={entry.catatan} className={`mt-3 ${historyNote}`} />}
            {entry.fotoUrls?.length > 0 && <div className="mt-3"><PhotoGallery urls={entry.fotoUrls} label="Foto tindak lanjut" thumbClassName="h-16 w-16" /></div>}
          </article></li>;
        })}</ol>
      </section>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"><Dialog.Close className={`${control} min-w-0 flex-1 bg-slate-800 px-2 hover:bg-slate-700`}><X aria-hidden="true" className="h-4 w-4 shrink-0" />Tutup</Dialog.Close>{canFollowUp(detail, user) && <button disabled={busy || detailLoading || !!detailError} onClick={() => { detailVersion.current += 1; setDetail(null); if (!detail.picId && user.role === 'admin') onAssign(detail); else onOpenPicAction(detail, true); }} className={`${control} min-w-0 flex-1 bg-blue-600 px-2 text-white hover:bg-blue-500`}>{detail.picId ? <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0" /> : <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />}{detail.picId ? 'Tindak lanjuti' : 'Tentukan PIC'}</button>}</div>
      </>}</Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
