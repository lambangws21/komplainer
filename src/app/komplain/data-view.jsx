'use client';
import LoadingState from './loading-state';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, historyNote, picResponseBubble } from './ui-styles.mjs';
import FormattedText, { InlineText } from './formatted-text';
import PhotoGallery from './photo-gallery';
import FieldInfo from './field-info';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Search, PlusCircle, Pencil, Archive, UserRound, MessageCircle, RotateCcw, Eye, X, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Table2, BarChart3, ArrowDownUp, Download, AlertCircle, Wrench, ListChecks, SlidersHorizontal, MoreHorizontal, Trash2 } from 'lucide-react';
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
import { initialSolution, handlingSolution } from './report-process.mjs';
import { WORKFLOW_STATUSES, STATUS_CASE, canEditReport, canFollowUp, canReopen, handlingStatus, workflowCardStyle, daysSince, historyChanges, formatHistoryValue, historyFieldLabel, editedFieldLabels } from './workflow.mjs';
import { apiRequest } from './api-client.mjs';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const iconControl = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
const input = 'min-w-0 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400';
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
function ReportProgress({ item, onAlert }) {
  return <div className="space-y-2"><WorkflowBadge status={handlingStatus(item)} /><div className="flex flex-wrap items-center gap-1.5"><StaleBadge item={item} /><AlertBadge item={item} compact onClick={onAlert} /></div></div>;
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
  return <span title={`Dilaporkan ${days} hari lalu, belum selesai`} className="rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Belum selesai · {days} hari</span>;
}

// Admin-only marker for whether this report's current version has a confirmed backup — the
// precondition for "Hapus permanen" in the archive dialog. Lets admin scan the table for
// purge-eligible reports instead of opening each one to check.
const BACKUP_STATE_STYLE = {
  done: ['Backup', 'border-emerald-800 bg-emerald-950/40 text-emerald-300'],
  pending: ['Antre backup', 'border-amber-800 bg-amber-950/40 text-amber-300'],
  processing: ['Proses backup', 'border-amber-800 bg-amber-950/40 text-amber-300'],
  failed: ['Backup gagal', 'border-red-800 bg-red-950/40 text-red-300'],
  none: ['Belum backup', 'border-slate-700 bg-slate-800 text-slate-400'],
};
function BackupBadge({ item, user }) {
  if (user.role !== 'admin' || !item.backupState) return null;
  const [label, classes] = BACKUP_STATE_STYLE[item.backupState] || BACKUP_STATE_STYLE.none;
  return <span title={`Status backup: ${label}${item.backupState === 'done' ? ' — bisa dihapus permanen' : ''}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>{label}</span>;
}

export default function DataView({ initialView = 'table', list, loaded, loading, loadError, busy, user, levels, Badge, formatDate, today, onCreate, onEdit, onDelete, onAssign, onSelfAssign, onOpenPicAction, onReopen, onExpired, onMarkRead, pendingDetailId, onPendingDetailHandled, onBulkPurge }) {
  const [view, setView] = useState(initialView);
  const [periodMode, setPeriodMode] = useState('week');
  const [selectedDate, setSelectedDate] = useState(() => weekStart(today()));
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('Semua');
  const [statusCaseFilter, setStatusCaseFilter] = useState('Semua');
  const [workflowFilter, setWorkflowFilter] = useState('Semua');
  const [onlyMine, setOnlyMine] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
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
  // Selection persists across pagination/filter changes (not just the current page) so admin can
  // page through and build up a bulk-delete set — but gets pruned whenever the underlying list
  // changes (e.g. after a purge, or the 60s poll) so it never points at a row that's gone.
  const canBulkPurge = user.role === 'admin' && !!onBulkPurge;
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => {
    if (!canBulkPurge) return;
    setSelected((previous) => {
      if (!previous.size) return previous;
      const next = new Set([...previous].filter((id) => list.some((item) => item.id === id)));
      return next.size === previous.size ? previous : next;
    });
  }, [list, canBulkPurge]);
  const toggleSelect = (id) => setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkError, setBulkError] = useState('');
  const selectedItems = useMemo(() => canBulkPurge ? list.filter((item) => selected.has(item.id)) : [], [list, selected, canBulkPurge]);
  const selectedEligible = useMemo(() => selectedItems.filter((item) => item.backupState === 'done'), [selectedItems]);
  const selectedIneligible = useMemo(() => selectedItems.filter((item) => item.backupState !== 'done'), [selectedItems]);
  function openBulkPurge() { setBulkOpen(true); setBulkConfirm(false); setBulkResults(null); setBulkError(''); }
  async function confirmBulkPurge() {
    if (!bulkConfirm) { setBulkConfirm(true); return; }
    setBulkBusy(true); setBulkError('');
    try {
      const results = await onBulkPurge(selectedEligible.map((item) => ({ id: item.id, version: item.version })));
      setBulkResults(results);
      setSelected(new Set());
    } catch (error) { setBulkError(error.message || 'Gagal menghapus laporan terpilih.'); }
    finally { setBulkBusy(false); }
  }
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
    if (!item) return;
    openDetail(item);
    onPendingDetailHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDetailId, list]);
  const summary = useMemo(() => (periodMode === 'week' ? summarizeWeek(list, selectedDate) : summarizeMonth(list, selectedDate)), [list, selectedDate, periodMode]);
  const filtered = useMemo(() => {
    const source = period === 'period' ? summary.current : list;
    const query = search.trim().toLocaleLowerCase('id-ID');
    const hasRange = !!(rangeStart && rangeEnd);
    // Restricted rows (another reporter's report, visible only as a locked stub) only ever reach
    // a pelapor's list — admin/petugas can read everything. They carry no usable content, so
    // counting/filtering/exporting them would silently pad a pelapor's own stats with reports
    // that aren't theirs.
    return source.filter((item) => !item.restricted && (quickFilter === 'all' || (quickFilter === 'mine' ? item.picId === user.id && handlingStatus(item) !== 'Selesai' : handlingStatus(item) === 'Menunggu')) && (!onlyMine || item.picId === user.id) && (workflowFilter === 'Semua' || handlingStatus(item) === workflowFilter) && (level === 'Semua' || (level === 'Belum' ? !item.status : String(item.status || '').split(' - ')[0] === level)) && (statusCaseFilter === 'Semua' || item.statusCase === statusCaseFilter) && (implantFilter === 'Semua' || detectImplants(item).some((implant) => implant.key === implantFilter)) && (!hasRange || (dateKey(item.tanggal) && dateKey(item.tanggal) >= rangeStart && dateKey(item.tanggal) <= rangeEnd)) && ['dokter', 'rumahSakit', 'team', 'tindakan', 'komplain', 'jalanKeluar', 'picNama', 'pelaporNama'].some((key) => String(item[key] || '').toLocaleLowerCase('id-ID').includes(query)))
      .sort((a, b) => {
        const first = a.createdAt || (dateKey(a.tanggal) ? `${dateKey(a.tanggal)}T00:00:00` : '');
        const second = b.createdAt || (dateKey(b.tanggal) ? `${dateKey(b.tanggal)}T00:00:00` : '');
        if (!first) return second ? 1 : 0;
        if (!second) return -1;
        return sort === 'newest' ? second.localeCompare(first) : first.localeCompare(second);
      });
  }, [list, summary, search, level, statusCaseFilter, workflowFilter, onlyMine, quickFilter, implantFilter, user.id, period, rangeStart, rangeEnd, sort]);
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
  const reset = () => { setQuickFilter('all'); setSearch(''); setLevel('Semua'); setStatusCaseFilter('Semua'); setWorkflowFilter('Semua'); setOnlyMine(false); setImplantFilter('Semua'); setPeriod('all'); setRangeStart(''); setRangeEnd(''); setPage(1); };
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
  const actions = (item, mobile = false) => <div className={mobile ? 'grid w-full grid-cols-2 gap-2' : 'flex flex-wrap items-center gap-1'}>
    {canFollowUp(item, user) ? <button disabled={busy} aria-label={`Detail laporan ${item.dokter || ''}`} onClick={() => openDetail(item)} className={mobile ? `${control} px-3 text-emerald-300 hover:bg-emerald-500/10` : `${iconControl} text-emerald-300 hover:bg-emerald-500/10`}><Eye aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Detail & Riwayat</span>}</button> : <button aria-label={`Detail laporan ${item.dokter || ''}`} onClick={() => openDetail(item)} className={mobile ? `${control} px-3 text-blue-300 hover:bg-blue-500/10` : `${iconControl} text-blue-300 hover:bg-blue-500/10`}><Eye aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Detail</span>}</button>}
    {canEditReport(item, user) && <button disabled={busy || item.id == null} aria-label={`Edit laporan ${item.dokter || ''}`} onClick={() => onEdit(item)} className={mobile ? `${control} px-3 text-slate-300 hover:bg-slate-800` : `${iconControl} text-slate-300 hover:bg-slate-800`}><Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Edit</span>}</button>}
    {user.role === 'admin' && handlingStatus(item) !== 'Selesai' && <button disabled={busy} aria-label={`Tentukan PIC ${item.dokter || ''}`} onClick={() => onAssign(item)} className={mobile ? `${control} px-3 text-violet-300 hover:bg-violet-500/10` : `${iconControl} text-violet-300 hover:bg-violet-500/10`}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Tentukan PIC</span>}</button>}
    {user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' && <button disabled={busy} aria-label={`Ambil laporan ${item.dokter || ''} sebagai PIC`} onClick={() => onSelfAssign(item)} className={mobile ? `${control} px-3 text-violet-300 hover:bg-violet-500/10` : `${iconControl} text-violet-300 hover:bg-violet-500/10`}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Ambil sebagai PIC</span>}</button>}
    {canReopen(item, user) && <button disabled={busy} aria-label={`Buka kembali ${item.dokter || ''}`} onClick={() => onReopen(item)} className={mobile ? `${control} px-3 text-amber-300 hover:bg-amber-500/10` : `${iconControl} text-amber-300 hover:bg-amber-500/10`}><RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Buka kembali</span>}</button>}
    {canEditReport(item, user) && <button disabled={busy || item.id == null} aria-label={`Arsipkan laporan ${item.dokter || ''}`} onClick={() => onDelete(item)} className={mobile ? `${control} px-3 text-slate-300 hover:bg-red-500/10 hover:text-red-300` : `${iconControl} text-slate-300 hover:bg-red-500/10 hover:text-red-300`}><Archive aria-hidden="true" className="h-4 w-4 shrink-0" />{mobile && <span>Arsipkan</span>}</button>}
  </div>;
  const mobileActions = (item) => {
    // The problem description is already visible on the card itself, so a petugas facing an
    // unclaimed case can take it immediately — no need to open the detail dialog first.
    const primary = user.role === 'admin' && !item.picId && handlingStatus(item) !== 'Selesai' ? ['Tentukan PIC', UserRound, () => onAssign(item), 'bg-amber-600 hover:bg-amber-500']
      : user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' ? ['Ambil sebagai PIC', UserRound, () => onSelfAssign(item), 'bg-amber-600 hover:bg-amber-500']
      : canFollowUp(item, user) ? ['Tangani komplain', MessageCircle, () => onOpenPicAction(item, true), 'bg-blue-600 hover:bg-blue-500']
      : [handlingStatus(item) === 'Selesai' ? 'Lihat penyelesaian' : 'Lihat detail', Eye, () => openDetail(item), 'bg-blue-600 hover:bg-blue-500'];
    const options = [
      ['Detail & riwayat', Eye, () => openDetail(item)],
      canEditReport(item, user) && ['Edit laporan', Pencil, () => onEdit(item)],
      user.role === 'admin' && handlingStatus(item) !== 'Selesai' && ['Tentukan PIC', UserRound, () => onAssign(item)],
      user.role === 'petugas' && !item.picId && handlingStatus(item) !== 'Selesai' && ['Ambil sebagai PIC', UserRound, () => onSelfAssign(item)],
      canReopen(item, user) && ['Buka kembali', RotateCcw, () => onReopen(item)],
      canEditReport(item, user) && ['Arsipkan laporan', Archive, () => onDelete(item)],
    ].filter(Boolean);
    const [primaryLabel, PrimaryIcon, primaryAction, primaryColor] = primary;
    return <div className="flex items-center gap-2"><button disabled={busy} onClick={primaryAction} className={`${control} min-w-0 flex-1 px-3 text-white ${primaryColor}`}><PrimaryIcon aria-hidden="true" className="h-4 w-4 shrink-0" />{primaryLabel}</button>{options.length > 0 && <DropdownMenu.Root><DropdownMenu.Trigger disabled={busy} aria-label={`Aksi lainnya untuk ${item.dokter || 'laporan'}`} className={`${control} shrink-0 border border-slate-700 bg-slate-800 px-3`}><MoreHorizontal aria-hidden="true" className="h-5 w-5" /></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content data-role={user.role} align="end" sideOffset={6} className="komplain-theme z-[70] min-w-48 rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-slate-100 shadow-xl">{options.map(([label, Icon, onSelect]) => <DropdownMenu.Item key={label} disabled={busy} onSelect={onSelect} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-slate-700 data-[disabled]:opacity-40"><Icon aria-hidden="true" className="h-4 w-4" />{label}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}</div>;
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
      {[['table', 'Data tabel', Table2], ['weekly', 'Rekap', BarChart3]].map(([value, label, Icon]) => <button key={value} ref={value === 'table' ? tableViewButton : undefined} aria-pressed={view === value} onClick={() => setView(value)} className={`${control} flex-1 whitespace-nowrap sm:flex-none ${view === value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><Icon aria-hidden="true" className="h-4 w-4" />{label}</button>)}
    </div>

    {view === 'table' && <div aria-label="Ringkasan hasil filter laporan" className="hidden grid-cols-4 gap-4 lg:grid">{[
      ['Laporan ditemukan', filtered.length, 'Sesuai filter yang dipilih', 'text-blue-300'],
      ['Belum selesai', filtered.filter((item) => handlingStatus(item) !== 'Selesai').length, 'Masih dalam penanganan', 'text-violet-300'],
      ['Menunggu', filtered.filter((item) => handlingStatus(item) === 'Menunggu').length, 'Menunggu konfirmasi atau pihak terkait', 'text-amber-300'],
      ['Selesai', filtered.filter((item) => handlingStatus(item) === 'Selesai').length, 'Hasil penanganan tercatat', 'text-emerald-300'],
    ].map(([label, count, hint, color]) => <div key={label} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-3xl font-semibold tabular-nums ${color}`}>{shown(count)}</p><p className="mt-2 text-xs text-slate-400">{hint}</p></div>)}</div>}
    {view === 'weekly' ? <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:flex-row lg:items-center">
        <div><h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-300" />{formatDate(summary.start)} – {formatDate(summary.end)}</h3><p className="mt-2 text-sm text-slate-400">{periodMode === 'week' ? 'Periode Senin–Minggu, berdasarkan tanggal kejadian.' : 'Periode satu bulan penuh, berdasarkan tanggal kejadian.'}</p></div>
        <div className="flex flex-wrap items-center gap-2"><div aria-label="Pilih jenis rekap" className="flex gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1">{[['week', 'Mingguan'], ['month', 'Bulanan']].map(([value, label]) => <button key={value} aria-pressed={periodMode === value} onClick={() => { setPeriodMode(value); setPage(1); }} className={`${control} px-3 ${periodMode === value ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{label}</button>)}</div>{periodPicker}</div>
      </div>
      {summary.invalidDates > 0 && <p role="status" className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">{summary.invalidDates} laporan dengan tanggal tidak valid tidak disertakan dalam rekap.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Total laporan', shown(summary.current.length), 'Semua tingkat keparahan', 'text-blue-300'],
        ['Perubahan jumlah', shown(`${delta > 0 ? '+' : ''}${delta}`), `Dibanding periode sebelumnya`, 'text-violet-300'],
        ['Critical & Major', shown(highPriority), 'Laporan C1 dan C2', 'text-red-300'],
        ['Team Pelapor terkait', shown(teams), 'Team pelapor berbeda pada periode ini', 'text-emerald-300'],
      ].map(([label, value, hint, color]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-3xl font-bold tabular-nums ${color}`}>{value}</p><p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p></div>)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-800 lg:bg-slate-900 lg:divide-x lg:divide-slate-800">{WORKFLOW_STATUSES.map((status) => <div key={status} className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:rounded-none lg:border-0 lg:px-5"><WorkflowBadge status={status} /><p className="mt-3 text-2xl font-bold">{shown(summary.current.filter((item) => handlingStatus(item) === status).length)}</p></div>)}</div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Distribusi harian</h3><span className="text-xs text-slate-400">Jumlah laporan</span></div><p className="mt-1 text-sm text-slate-400">Hari dengan laporan terbanyak lebih mudah terlihat.</p><div className="mt-6 space-y-3 lg:hidden">{summary.days.map((day, index) => <div key={day.date} className="flex items-center gap-3"><span className="w-12 shrink-0 text-sm text-slate-300">{periodMode === 'week' ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][index] : String(index + 1)}</span><div role="img" aria-label={`${formatDate(day.date)}: ${ready ? day.count : 'belum tersedia'} laporan`} className="h-7 flex-1 overflow-hidden rounded-md bg-slate-800"><div className="h-full rounded-md bg-blue-500" style={{ width: `${day.count / Math.max(1, ...summary.days.map((item) => item.count)) * 100}%` }} /></div><span className="w-7 text-right text-sm font-semibold tabular-nums">{shown(day.count)}</span></div>)}</div>
          <div aria-label="Grafik distribusi laporan per hari" className="mt-6 hidden lg:block">
            <div className="flex h-60 items-end gap-2 border-b border-slate-700 bg-[linear-gradient(to_top,transparent_24%,rgba(148,163,184,0.08)_25%,transparent_26%,transparent_49%,rgba(148,163,184,0.08)_50%,transparent_51%,transparent_74%,rgba(148,163,184,0.08)_75%,transparent_76%)] pb-1">
              {summary.days.map((day) => <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${formatDate(day.date)}: ${shown(day.count)} laporan`}><span className="mb-2 text-xs font-medium tabular-nums text-slate-300">{ready && (periodMode === 'week' || day.count > 0) ? day.count : ''}</span><div role="img" aria-label={`${formatDate(day.date)}: ${shown(day.count)} laporan`} className="mx-auto w-full max-w-12 rounded-t-md bg-blue-500/80" style={{ height: ready ? `${day.count / Math.max(1, ...summary.days.map((item) => item.count)) * 78}%` : '0%', minHeight: ready && day.count > 0 ? 4 : 0 }} /></div>)}
            </div>
            <div className="mt-3 flex gap-2">{summary.days.map((day, index) => <span key={day.date} className="min-w-0 flex-1 text-center text-[11px] text-slate-400">{periodMode === 'week' ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][index] : index === 0 || (index + 1) % 5 === 0 || index === summary.days.length - 1 ? index + 1 : ''}</span>)}</div>
            <p className="mt-4 text-xs text-slate-400">{ready ? summary.current.length ? `${summary.current.length} laporan dalam periode ini.` : 'Tidak ada laporan dalam periode ini.' : 'Menunggu data laporan…'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2"><h3 className="font-semibold">Tingkat keparahan</h3><p className="mt-1 text-sm text-slate-400">Komposisi laporan dalam periode terpilih.</p><div className="mt-5 space-y-3">{levels.map((item) => { const count = summary.current.filter((report) => report.status === item.code).length; return <div key={item.code} className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/60 p-3"><Badge status={item.code} /><span className="text-sm font-semibold tabular-nums">{shown(count)} <span className="ml-2 text-xs font-normal text-slate-400">{ready ? `${summary.current.length ? Math.round(count / summary.current.length * 100) : 0}%` : '—'}</span></span></div>; })}{summary.current.some((report) => !levels.some((item) => item.code === report.status)) && <p className="text-sm text-slate-400">Belum diklasifikasikan: {summary.current.filter((report) => !levels.some((item) => item.code === report.status)).length} laporan</p>}</div></div>
      </div>
      {user.role === 'admin' && summary.current.length > 0 && <div className="grid gap-5 lg:grid-cols-2">
        {[['team', 'Rekap per Team Pelapor'], ['tindakan', 'Rekap per Tindakan']].map(([groupKey, title]) => <div key={groupKey} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-semibold">{title}</h3>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th scope="col" className="pb-2 pr-3 font-medium">{groupKey === 'team' ? 'Technical Support' : 'Tindakan'}</th><th scope="col" className="pb-2 pr-3 text-right font-medium">Total</th><th scope="col" className="pb-2 pr-3 text-right font-medium">Sukses</th><th scope="col" className="pb-2 text-right font-medium">Ada Kendala</th></tr></thead><tbody className="divide-y divide-slate-800">{groupRecap(summary.current, groupKey).slice(0, 8).map((group) => <tr key={group.key}><td className="truncate py-2 pr-3">{group.key}</td><td className="py-2 pr-3 text-right tabular-nums font-semibold">{group.total}</td><td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{group.sukses}</td><td className="py-2 text-right tabular-nums text-red-300">{group.kendala}</td></tr>)}</tbody></table></div>
        </div>)}
      </div>}
      {ready && !loading && !loadError && summary.current.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">Belum ada laporan pada {periodLabel} ini. Pilih {periodLabel} lain untuk melihat rekapan.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/60 bg-blue-950/20 p-5"><div><h3 className="font-semibold">Telusuri laporan {periodLabel} ini</h3><p className="mt-1 text-sm text-slate-400">Lihat rincian masalah dan solusi dari periode terpilih.</p></div><button onClick={viewPeriodReports} className={`${control} bg-blue-600 hover:bg-blue-500`}>Lihat {shown(summary.current.length)} laporan<ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div>
    </div> : <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="space-y-3 p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative"><span className="sr-only">Cari laporan berdasarkan dokter, rumah sakit, team, masalah, solusi, PIC, atau pelapor</span><Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari laporan…" className={`${input} pl-10`} /></label>
          <label className="hidden items-center gap-2 md:flex"><ArrowDownUp aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><span className="sr-only">Urutkan laporan</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className={input}><option value="newest">Baru masuk dahulu</option><option value="oldest">Lama dahulu</option></select></label>
        </div>

        <div role="group" aria-label="Filter cepat laporan" className="flex flex-wrap gap-2">{[['all', 'Semua'], ['mine', 'Tugas saya'], ['waiting', 'Menunggu']].map(([value, label]) => <button key={value} aria-pressed={quickFilter === value} onClick={() => { setQuickFilter(value); setPage(1); }} className={`${control} px-3 text-xs ${quickFilter === value ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400'}`}>{label}</button>)}</div>
        <button onClick={() => setMobileFilters((value) => !value)} aria-expanded={mobileFilters} aria-controls="report-filters" className={`${control} w-full justify-between bg-slate-800 md:hidden`}><span className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />Filter & urutan{hiddenFilterCount + [workflowFilter !== 'Semua', statusCaseFilter !== 'Semua', onlyMine].filter(Boolean).length > 0 && ' · aktif'}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 ${mobileFilters ? 'rotate-180' : ''}`} /></button>
        <div id="report-filters" className={`rounded-xl border border-slate-800 bg-slate-950/40 p-3 ${mobileFilters ? '' : 'hidden md:block'}`}>
          <label className="mb-3 flex items-center gap-2 md:hidden"><span className="text-xs text-slate-400">Urutan</span><select aria-label="Urutkan laporan mobile" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className={input}><option value="newest">Terbaru dahulu</option><option value="oldest">Terlama dahulu</option></select></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Status penanganan</span><select className={input} value={workflowFilter} onChange={(event) => { setWorkflowFilter(event.target.value); setPage(1); }}><option value="Semua">Semua status</option>{WORKFLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-slate-400">Kondisi kasus</span><select aria-label="Filter kondisi kasus" value={statusCaseFilter} onChange={(event) => { setStatusCaseFilter(event.target.value); setPage(1); }} className={input}><option value="Semua">Semua kondisi kasus</option>{STATUS_CASE.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-sm"><p role="status" className="text-slate-400">{ready ? `${filtered.length} laporan ditemukan` : 'Menunggu data laporan…'}</p><details open={!mobile} className="group md:contents"><summary className="cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold text-blue-300 md:hidden">Unduh & opsi</summary><div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">{(search || level !== 'Semua' || statusCaseFilter !== 'Semua' || workflowFilter !== 'Semua' || onlyMine || implantFilter !== 'Semua' || period !== 'all' || (rangeStart && rangeEnd)) && <button onClick={reset} className={`${control} text-blue-300 hover:bg-blue-500/10`}>Reset filter</button>}<button disabled={!filtered.length} onClick={exportFiltered} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Unduh CSV (buka di Excel)</button>{user.role === 'admin' && <button disabled={!filtered.length} onClick={exportByTeam} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Rekap per Team Pelapor</button>}{user.role === 'admin' && <button disabled={!filtered.length} onClick={exportByTindakan} className={`${control} bg-slate-800 text-slate-200`}><Download aria-hidden="true" className="h-4 w-4" />Rekap per Tindakan</button>}</div></details></div>
      </div>
      {canBulkPurge && selected.size > 0 && <div role="status" className="mx-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-900/50 bg-red-950/20 p-3 sm:mx-5"><p className="text-sm"><strong>{selected.size}</strong> laporan dipilih{selectedEligible.length !== selected.size && ` (${selectedEligible.length} bisa dihapus permanen)`}</p><div className="flex items-center gap-2"><button onClick={() => setSelected(new Set())} className={`${control} bg-slate-800 text-sm`}>Batal pilih</button><button onClick={openBulkPurge} className={`${control} bg-red-700 text-sm hover:bg-red-600`}><Trash2 aria-hidden="true" className="h-4 w-4" />Hapus permanen terpilih</button></div></div>}
      {rows.length > 0 && <>
        <div tabIndex={0} role="region" aria-label="Tabel laporan komplain, geser untuk melihat semua kolom" className="hidden overflow-auto rounded-xl border border-slate-800 lg:max-h-[680px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 md:block"><table className="w-full min-w-[1120px] lg:min-w-0 table-fixed text-left text-sm"><caption className="sr-only">Laporan komplain diurutkan berdasarkan tanggal. Gunakan tombol detail untuk membaca masalah dan solusi lengkap.</caption><thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase tracking-wider text-slate-400"><tr>{canBulkPurge && <th scope="col" className="w-10 px-3 py-3"><label className="sr-only" htmlFor="select-all-rows">Pilih semua laporan di halaman ini</label><input id="select-all-rows" type="checkbox" className="h-4 w-4 accent-red-500" checked={rows.length > 0 && rows.every((item) => selected.has(item.id))} onChange={() => { const pageIds = rows.map((item) => item.id); const allSelected = pageIds.every((id) => selected.has(id)); setSelected((previous) => { const next = new Set(previous); pageIds.forEach((id) => allSelected ? next.delete(id) : next.add(id)); return next; }); }} /></th>}{[['Dokter / Rumah Sakit', canBulkPurge ? 'w-[15%]' : 'w-[17%]'], ['Masalah / Tindakan', 'w-[23%]'], ['PIC', 'w-[11%]', 'PIC (Penanggung jawab) adalah petugas yang menangani laporan ini sampai selesai.'], ['Tanggal Kejadian', 'w-[11%]'], ['Klasifikasi', 'w-[13%]'], ['Status penanganan', 'w-[13%]'], ['Aksi', 'w-[12%]']].map(([label, width, hint]) => <th key={label} scope="col" className={`px-4 py-3 font-medium ${width}`}><span className="inline-flex items-center gap-1">{label}{hint && <FieldInfo text={hint} />}</span></th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((item, index) => <tr key={item.id ?? index} className={`transition hover:bg-slate-800/40 ${index % 2 === 1 ? 'bg-slate-900/40' : ''} ${selected.has(item.id) ? 'bg-red-950/10' : ''}`}>
          {canBulkPurge && <td className="px-3 py-3.5 align-middle"><label className="sr-only" htmlFor={`select-row-${item.id}`}>Pilih laporan {item.dokter || ''}</label><input id={`select-row-${item.id}`} type="checkbox" disabled={item.id == null} className="h-4 w-4 accent-red-500" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>}
          <td className="px-4 py-3.5 align-middle"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={item.dokter} /><div className="min-w-0"><p className="break-words font-semibold text-slate-100">{item.dokter || '—'}</p><p className="mt-1 break-words text-xs text-slate-300">{item.rumahSakit || 'Rumah sakit belum diisi'}</p><p className="mt-1 break-words text-xs text-slate-500">{item.team || 'Team belum diisi'}</p><div className="mt-1"><BackupBadge item={item} user={user} /></div></div></div></td>
          <td className="px-4 py-3.5 align-middle"><p className="truncate text-xs font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</p><div className="mt-1"><ImplantBadge item={item} compact /></div><p className="mt-1 line-clamp-2 break-words leading-snug text-slate-300">{item.komplain ? <InlineText text={item.komplain} /> : '—'}</p>{item.jalanKeluar && <p className={`mt-1 line-clamp-2 break-words text-xs leading-snug ${picResponseBubble}`}><span className="font-semibold">{handlingSolution(item) ? 'Hasil PIC:' : 'Solusi awal:'}</span> <InlineText text={handlingSolution(item) || initialSolution(item)} /></p>}<button onClick={() => openDetail(item)} className="mt-1 inline-flex items-center text-xs font-semibold text-blue-300 hover:underline">Lihat detail</button></td>
          <td className="px-4 py-3.5 align-middle">{item.picId ? <div className="flex min-w-0 flex-col items-start gap-1.5"><RoleBadge role={item.picRole} pic /><span className="break-words text-xs text-slate-300">{item.picNama}</span></div> : handlingStatus(item) === 'Selesai' ? <span className="text-xs text-slate-500">Belum ditugaskan</span> : <div className="flex flex-col items-start gap-1.5"><span className="flex items-center gap-1 text-xs font-semibold text-amber-300"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Belum ada PIC</span>{user.role === 'admin' && <button type="button" disabled={busy} onClick={() => onAssign(item)} className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-500">Tentukan PIC</button>}{user.role === 'petugas' && <button type="button" disabled={busy} onClick={() => onSelfAssign(item)} className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-500">Ambil sebagai PIC</button>}</div>}</td>
          <td className="px-4 py-3.5 align-middle"><p className="text-xs text-slate-300">{formatDate(item.tanggal)}</p></td>
          <td className="px-4 py-3.5 align-middle"><Classification item={item} Badge={Badge} /></td>
          <td className="px-4 py-3.5 align-middle"><ReportProgress item={item} today={today()} onAlert={alertAction(item)} /></td>
          <td className="px-3 py-3.5 align-middle">{actions(item)}</td>
        </tr>)}</tbody></table></div>
        <div className="space-y-3 px-3 pb-4 sm:px-4 md:hidden">{rows.map((item, index) => <article key={item.id ?? index} className={`min-w-0 rounded-2xl border p-4 shadow-sm ${workflowCardStyle(item)} ${selected.has(item.id) ? 'ring-2 ring-red-500' : ''}`}>
          <div className="flex items-start justify-between gap-2">{canBulkPurge && <label className="mt-0.5 shrink-0"><span className="sr-only">Pilih laporan {item.dokter || ''}</span><input type="checkbox" disabled={item.id == null} className="h-4 w-4 accent-red-500" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></label>}<div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold leading-5">{item.dokter || 'Dokter tidak tersedia'}</h3><p className="mt-0.5 text-[11px] text-slate-400">{formatDate(item.tanggal)}</p>{user.role === 'admin' && item.backupState && <div className="mt-1"><BackupBadge item={item} user={user} /></div>}</div><WorkflowBadge status={handlingStatus(item)} /></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">{[['Rumah Sakit', item.rumahSakit || 'Belum diisi'], ['Team Pelapor', item.team || 'Belum diisi'], ['Penanggung jawab (PIC)', item.picNama || 'Belum ditugaskan']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] text-slate-400">{label}</dt><dd className={`break-words leading-4 ${label === 'Penanggung jawab (PIC)' && !item.picId ? 'font-semibold text-amber-300' : 'text-slate-200'}`}>{value}</dd></div>)}</dl>

          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2"><div className="min-w-0"><p className="mb-1 text-[10px] text-slate-400">Kondisi kasus</p><StatusCaseBadge statusCase={item.statusCase} /></div><div className="min-w-0"><p className="mb-1 text-[10px] text-slate-400">Keparahan</p>{item.status ? <Badge status={item.status} /> : <span className="text-xs text-slate-400">Belum dinilai PIC</span>}</div></div>
          <div className="mt-2 space-y-1 text-xs leading-5"><p className="break-words font-medium text-violet-300">{item.tindakan || 'Tindakan belum diisi'}</p><p className={`break-words text-slate-300 ${expandedCard === item.id ? '' : 'line-clamp-2'}`}><span className="font-semibold text-slate-400">Masalah: </span>{item.komplain ? <InlineText text={item.komplain} /> : 'Belum diisi'}</p>{item.jalanKeluar && <p className={`break-words text-emerald-200 ${expandedCard === item.id ? '' : 'line-clamp-1'}`}><span className="font-semibold">{handlingSolution(item) ? 'Hasil PIC: ' : 'Solusi awal: '}</span><InlineText text={handlingSolution(item) || initialSolution(item)} /></p>}</div>
          {expandedCard === item.id && <div id={`card-content-${item.id}`} className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs"><p className="break-words text-slate-300"><span className="font-semibold">Pelapor: </span>{item.pelaporNama || 'Data lama'} {item.pelaporRole && <RoleBadge role={item.pelaporRole} />}</p>{item.picId && <RoleBadge role={item.picRole} pic />}<p className="break-words leading-5 text-slate-300"><span className="font-semibold">Rencana tindak lanjut: </span>{item.penangananSelanjutnya ? <InlineText text={item.penangananSelanjutnya} /> : 'Belum diisi'}</p><ImplantBadge item={item} /><StaleBadge item={item} /><AlertBadge item={item} compact onClick={alertAction(item)} />{item.fotoUrls?.length > 0 && <PhotoGallery urls={item.fotoUrls} label="Foto laporan" thumbClassName="h-14 w-14" />}</div>}
          <button aria-expanded={expandedCard === item.id} onClick={() => setExpandedCard((value) => value === item.id ? null : item.id)} className="flex min-h-9 items-center gap-1 text-xs font-semibold text-blue-300">{expandedCard === item.id ? 'Sembunyikan tambahan' : 'Informasi tambahan'}<ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 ${expandedCard === item.id ? 'rotate-180' : ''}`} /></button>
          <div className="border-t border-slate-800 pt-2">{mobileActions(item)}</div>
        </article>)}</div>
      </>}
      {!loading && !loadError && ready && rows.length === 0 && <div className="border-t border-slate-800 p-10 text-center"><Search aria-hidden="true" className="mx-auto h-8 w-8 text-slate-600" /><h3 className="mt-3 font-semibold">{list.length ? 'Tidak ada laporan yang cocok' : 'Belum ada laporan'}</h3><p className="mt-2 text-sm text-slate-400">{list.length ? 'Ubah kata kunci, tingkat keparahan, atau periode.' : 'Mulai dengan membuat laporan komplain pertama.'}</p><button onClick={list.length ? reset : onCreate} className={`${control} mt-4 bg-slate-800`}>{list.length ? 'Reset semua filter' : 'Buat laporan'}</button></div>}
      {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3 py-3 sm:px-5 sm:py-4"><p className="hidden text-xs text-slate-400 sm:block">Menampilkan {(currentPage - 1) * effectivePageSize + 1}–{Math.min(currentPage * effectivePageSize, filtered.length)} dari {filtered.length} laporan</p><div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:gap-3"><label className="flex items-center gap-2 text-xs text-slate-400"><span className="hidden sm:inline">Tampilkan</span><select aria-label="Jumlah laporan per halaman" value={effectivePageSize} onChange={(event) => { (mobile ? setMobilePageSize : setPageSize)(Number(event.target.value)); setPage(1); }} className="min-h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400">{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / halaman</option>)}</select></label><div className="flex items-center gap-2"><button disabled={currentPage === 1} aria-label="Halaman sebelumnya" onClick={() => setPage(currentPage - 1)} className={`${control} bg-slate-800 px-3`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button><span className="text-sm tabular-nums">{currentPage} / {totalPages}</span><button disabled={currentPage === totalPages} aria-label="Halaman berikutnya" onClick={() => setPage(currentPage + 1)} className={`${control} bg-slate-800 px-3`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div></div></div>}
    </div>}
    <Dialog.Root open={detail !== null} onOpenChange={(open) => { if (!open) { detailVersion.current += 1; setDetail(null); } }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user.role} style={dialogStyle} onCloseAutoFocus={(event) => { event.preventDefault(); if (detailReturnFocus.current?.isConnected) detailReturnFocus.current.focus(); }} className={`${mobileDialog} max-w-2xl lg:max-w-5xl ${levels.find((item) => item.code === detail?.status)?.accent ? `border-l-4 ${levels.find((item) => item.code === detail?.status)?.accent}` : ''}`}>
      <div className="relative shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <Dialog.Title className="pr-10 text-base font-bold sm:text-xl">Detail laporan</Dialog.Title>
        <Dialog.Description className="mt-1 pr-10 text-xs text-slate-400">Ringkasan, isi laporan, dan jejak perubahan.</Dialog.Description>
        <Dialog.Close aria-label="Tutup detail laporan" className={`${control} absolute right-2 top-2 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
      </div>
      {detail && <>
      <div aria-label="Bagian detail laporan" className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-900 px-3 py-2 sm:px-5 lg:hidden">{[['report', 'Ringkasan'], ['content', 'Isi laporan'], ['history', `Riwayat${detailLoading ? '' : ` (${history.length})`}`]].map(([value, label]) => <button key={value} aria-pressed={detailTab === value} onClick={() => setDetailTab(value)} className={`${control} min-w-0 flex-1 px-2 text-xs sm:text-sm lg:flex-none lg:min-w-40 ${detailTab === value ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</button>)}</div>
      <div ref={detailScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 touch-pan-y [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-4 lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:p-0" data-dialog-scroll>
      {detailLoading && <p role="status" className="mb-3 text-xs text-blue-300 lg:col-span-2 lg:mb-0 lg:px-5 lg:py-2">Memperbarui informasi laporan…</p>}
      {detailError && <div role="alert" className="mb-3 rounded-xl border border-red-900 bg-red-950/20 p-3 text-xs text-red-300 lg:col-span-2"><p>{detailError}</p><p className="mt-1 text-slate-400">Informasi yang tampil belum dapat dipastikan sebagai versi terbaru.</p><button onClick={() => openDetail(detail, false)} className={`${control} mt-2 bg-slate-800 text-xs`}>Coba lagi</button></div>}
      <div className="min-h-0 min-w-0 lg:overflow-y-auto lg:border-r lg:border-slate-800 lg:p-5">
      <section aria-label="Informasi utama laporan" className={`${detailTab !== 'report' ? 'hidden' : ''} space-y-4 lg:block lg:space-y-3`}>
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Informasi Utama</h3><WorkflowBadge status={handlingStatus(detail)} /></div>
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20 lg:grid-cols-3">
          <div className="min-w-0 border-b border-r border-slate-800 p-3"><dt className="sr-only">Dokter, Rumah Sakit, dan Team Pelapor</dt><dd><p className="break-words text-sm font-semibold">{detail.dokter || 'Dokter belum diisi'}</p><p className="mt-1 break-words text-xs text-slate-300">{detail.rumahSakit || 'Rumah sakit belum diisi'}</p><p className="mt-1 break-words text-xs text-slate-400">{detail.team || 'Team belum diisi'}</p></dd></div>
          <div className="min-w-0 border-b border-r border-slate-800 p-3"><dt className="text-xs text-slate-400">Tanggal kejadian</dt><dd className="mt-1 text-sm font-medium">{formatDate(detail.tanggal)}</dd></div>
          <div className="min-w-0 border-b border-slate-800 p-3"><dt className="text-xs text-slate-400">Pelapor</dt><dd className="mt-1 flex flex-wrap items-center gap-1.5 break-words text-xs">{detail.pelaporNama || 'Data lama (admin)'}{detail.pelaporRole && <RoleBadge role={detail.pelaporRole} />}</dd></div>
          <div className="min-w-0 border-r border-slate-800 p-3"><dt className="mb-1 text-xs text-slate-400">Kondisi kasus</dt><dd><StatusCaseBadge statusCase={detail.statusCase} /></dd></div>
          <div className="min-w-0 border-r border-slate-800 p-3"><dt className="mb-1 text-xs text-slate-400">Keparahan</dt><dd>{detail.status ? <Badge status={detail.status} /> : <span className="text-xs text-amber-300">Belum dinilai PIC</span>}</dd></div>
          <div className="min-w-0 p-3"><dt className="text-xs text-slate-400">Penanggung jawab (PIC)</dt><dd className="mt-1 space-y-1"><p className={`break-words text-xs ${detail.picId ? 'text-slate-200' : 'text-amber-300'}`}>{detail.picNama || 'Belum ada PIC'}</p>{detail.picId && <RoleBadge role={detail.picRole} pic />}{!detail.picId && handlingStatus(detail) !== 'Selesai' && ['admin', 'petugas'].includes(user.role) && <button type="button" disabled={busy || detailLoading || !!detailError} onClick={() => { const target = detail; detailVersion.current += 1; setDetail(null); if (user.role === 'admin') onAssign(target); else onSelfAssign(target); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-300 hover:bg-violet-500/25"><UserRound aria-hidden="true" className="h-3.5 w-3.5" />{user.role === 'admin' ? 'Tentukan PIC' : 'Ambil sebagai PIC'}</button>}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2"><SimpleStatusBadge item={detail} /><AlertBadge item={detail} compact /></div>
        {detail.selesaiPada && <p className="text-xs text-slate-400">Selesai pada {new Date(detail.selesaiPada).toLocaleString('id-ID')}</p>}
        <button onClick={() => setDetailTab('content')} className={`${control} w-full bg-slate-800 text-blue-300 lg:hidden`}>Baca masalah & penyelesaian<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
      </section>
      <div className={`${detailTab !== 'content' ? 'hidden' : ''} space-y-3 lg:mt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0`}>
      {(() => {
        const pelaporAuthor = detail.pelaporRole ? { role: detail.pelaporRole, pic: false } : null;
        const picAuthor = detail.picRole ? { role: detail.picRole, pic: true } : null;
        const followUpAuthor = handlingStatus(detail) === 'Baru' ? pelaporAuthor : picAuthor;
        return [['Masalah', detail.komplain, 'border-red-900/50 bg-red-950/20 text-red-200', AlertCircle, pelaporAuthor], ['Solusi awal pelapor', initialSolution(detail), 'border-teal-800/60 bg-teal-950/30 text-teal-200', Wrench, pelaporAuthor], ['Hasil penanganan PIC', handlingSolution(detail), 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200', Wrench, picAuthor], ['Rencana tindak lanjut (RTL)', detail.penangananSelanjutnya, 'border-violet-900/50 bg-violet-950/20 text-violet-200', ListChecks, followUpAuthor]].map(([label, value, color, Icon, author]) => <div key={label} className={`min-w-0 rounded-xl border p-3 sm:p-4 ${label === 'Masalah' ? 'lg:col-span-2' : ''} ${color}`}><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}{author && value && <RoleBadge role={author.role} pic={author.pic} />}</h3>{value ? <FormattedText text={value} className="mt-2 text-sm leading-6 text-slate-200" /> : <p className="mt-2 text-xs leading-5 text-slate-400">Belum diisi</p>}</div>);
      })()}
      <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/20 p-3 lg:col-span-2"><h3 className="text-sm font-semibold">Implant & Tindakan</h3><p className="mt-2 break-words text-sm text-slate-200">{detail.tindakan || 'Tindakan belum diisi'}</p>{detectImplants(detail).length > 0 && <div className="mt-2"><ImplantBadge item={detail} /></div>}</section>
      {detail.fotoUrls?.length > 0 && <div className="min-w-0 lg:col-span-2 lg:rounded-xl lg:border lg:border-slate-800 lg:p-3"><p className="mb-2 text-sm font-semibold">Foto laporan ({detail.fotoUrls.length})</p><PhotoGallery urls={detail.fotoUrls} label="Foto laporan" /></div>}
      </div>
      </div>
      <section aria-label="Riwayat perubahan laporan" className={`${detailTab !== 'history' ? 'hidden' : ''} min-h-0 min-w-0 lg:block lg:overflow-y-auto lg:p-5`}>
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Riwayat Perubahan</h3><span className="text-xs text-slate-400">{history.length} aktivitas</span></div>
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
            {changes.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-300">Detail perubahan ({changes.length})</summary><dl className="mt-2 space-y-3">{changes.map((change) => <div key={change.key}><dt className="mb-1.5 text-xs font-medium text-slate-300">{historyFieldLabel(change.key)}</dt><dd className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1"><div className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 p-2"><span className="text-[10px] uppercase tracking-wide text-slate-400">Sebelum</span><FormattedText text={String(formatHistoryValue(change.key, change.before, levels, formatDate))} className="mt-1 break-words text-xs leading-5 text-slate-400" /></div><div className="min-w-0 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-2"><span className="text-[10px] uppercase tracking-wide text-emerald-300">Sesudah</span><FormattedText text={String(formatHistoryValue(change.key, change.after, levels, formatDate))} className="mt-1 break-words text-xs leading-5 text-slate-200" /></div></dd></div>)}</dl></details>}
            {entry.catatan && <FormattedText text={entry.catatan} className={`mt-3 ${historyNote}`} />}
            {entry.fotoUrls?.length > 0 && <div className="mt-3"><PhotoGallery urls={entry.fotoUrls} label="Foto tindak lanjut" thumbClassName="h-16 w-16" /></div>}
          </article></li>;
        })}</ol>
      </section>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-slate-800 bg-slate-900 px-4 pt-2 lg:justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{canEditReport(detail, user) && <button disabled={busy || detailLoading || !!detailError} aria-label="Edit laporan ini" onClick={() => { const target = detail; detailVersion.current += 1; setDetail(null); onEdit(target); }} className={`${control} mr-auto hidden bg-slate-800 px-3 text-slate-300 hover:bg-slate-700 lg:inline-flex`}><Pencil aria-hidden="true" className="h-4 w-4" /></button>}<Dialog.Close className={`${control} min-w-0 flex-1 bg-slate-800 px-2 hover:bg-slate-700 lg:flex-none lg:min-w-40`}><X aria-hidden="true" className="h-4 w-4 shrink-0" />Tutup</Dialog.Close>{canFollowUp(detail, user) && <button disabled={busy || detailLoading || !!detailError} onClick={() => { detailVersion.current += 1; setDetail(null); if (!detail.picId && user.role === 'admin') onAssign(detail); else onOpenPicAction(detail, true); }} className={`${control} min-w-0 flex-1 bg-blue-600 px-2 text-white hover:bg-blue-500 lg:flex-none lg:min-w-40`}>{detail.picId ? <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0" /> : <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />}{detail.picId ? 'Tindak lanjuti' : 'Tentukan PIC'}</button>}</div>
      </>}</Dialog.Content></Dialog.Portal></Dialog.Root>
    {canBulkPurge && <Dialog.Root open={bulkOpen} onOpenChange={(open) => { if (!open && !bulkBusy) { setBulkOpen(false); setBulkConfirm(false); setBulkResults(null); setBulkError(''); } }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user.role} className={`${mobileDialog} max-w-lg`}>
      <div className="relative shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <Dialog.Title className="pr-10 text-base font-bold sm:text-xl">{bulkResults ? 'Hasil penghapusan permanen' : 'Hapus permanen laporan terpilih?'}</Dialog.Title>
        <Dialog.Description className="mt-1 pr-10 text-xs text-slate-400">{bulkResults ? `${bulkResults.filter((entry) => entry.status === 'ok').length} berhasil dihapus, ${bulkResults.filter((entry) => entry.status === 'error').length} gagal.` : `${selected.size} laporan dipilih.`}</Dialog.Description>
        <Dialog.Close disabled={bulkBusy} aria-label="Tutup" className={`${control} absolute right-2 top-2 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
        {bulkError && <p role="alert" className="mb-3 rounded-xl border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">{bulkError}</p>}
        {!bulkResults ? <>
          {selectedEligible.length === 0 ? <p className="text-sm text-amber-300">Tidak ada laporan terpilih yang sudah berhasil dibackup. Pilih laporan dengan status backup &quot;Backup&quot; untuk dapat dihapus permanen.</p> : <div className="space-y-3">
            <p className="text-sm">Akan menghapus permanen <strong>{selectedEligible.length}</strong> laporan — data, foto, dan riwayat tidak dapat dikembalikan.</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-2 text-xs">{selectedEligible.map((item) => <li key={item.id} className="truncate px-1 py-0.5 text-slate-300">{item.dokter || item.id}</li>)}</ul>
            {selectedIneligible.length > 0 && <p className="text-xs text-amber-300">{selectedIneligible.length} laporan lain dilewati karena belum berhasil dibackup.</p>}
            {bulkConfirm && <p className="text-xs font-semibold text-red-300">Yakin? Tindakan ini tidak bisa dibatalkan.</p>}
          </div>}
        </> : <ul className="space-y-1.5 text-xs">{bulkResults.map((entry) => <li key={entry.id} className={`rounded-lg border p-2 ${entry.status === 'ok' ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200' : 'border-red-900/50 bg-red-950/20 text-red-200'}`}>{entry.id} — {entry.status === 'ok' ? 'Berhasil dihapus' : entry.message}</li>)}</ul>}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-slate-800 bg-slate-900 px-4 py-3 sm:px-6">
        {bulkResults ? <Dialog.Close className={`${control} w-full bg-slate-800`}>Tutup</Dialog.Close> : <>
          <Dialog.Close disabled={bulkBusy} className={`${control} flex-1 bg-slate-800`}>Batal</Dialog.Close>
          {selectedEligible.length > 0 && <button disabled={bulkBusy} onClick={confirmBulkPurge} className={`${control} flex-1 bg-red-700 hover:bg-red-600`}>{bulkBusy ? 'Menghapus…' : bulkConfirm ? `Ya, hapus ${selectedEligible.length} laporan permanen` : 'Hapus permanen'}</button>}
        </>}
      </div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>}
  </section>;
}
