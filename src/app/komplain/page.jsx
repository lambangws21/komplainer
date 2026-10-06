'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PlusCircle, X, CheckCircle2, Lightbulb, AlertTriangle, UserRound, Inbox } from 'lucide-react';
import DataView from './data-view';
import './theme.css';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, formFooter, dialogHeader, dialogBody, historyNote } from './ui-styles.mjs';
import LoadingState from './loading-state';
import InstallApp from './install-app';
import AccountsPanel from './accounts-panel';
import Navbar from './navbar';
import { LoginPanel, PasswordPanel, ProfilePanel, ApprovalPanel } from './auth-panel';
import WorkflowBadge from './workflow-badge';
import SimpleStatusBadge from './simple-status-badge';
import AlertBadge from './alert-badge';
import ImplantBadge from './implant-badge';
import { apiRequest, postJson } from './api-client.mjs';
import { ROLE_LABELS, handlingStatus, isOverdue } from './workflow.mjs';
import { loadReadIds, saveReadIds } from './read-tracking.mjs';

const LEVELS = [
  { code: 'C1 - Critical', label: 'C1 Critical', color: 'text-red-300 border-red-800 bg-red-950/40' },
  { code: 'C2 - Major', label: 'C2 Major', color: 'text-orange-300 border-orange-800 bg-orange-950/40' },
  { code: 'C3 - Moderate', label: 'C3 Moderate', color: 'text-amber-300 border-amber-800 bg-amber-950/40' },
  { code: 'C4 - Minor', label: 'C4 Minor', color: 'text-emerald-300 border-emerald-800 bg-emerald-950/40' },
];
const fields = [
  ['tanggal', 'Tanggal kejadian', 'date'], ['dokter', 'Dokter', 'text'],
  ['rumahSakit', 'Rumah Sakit (opsional)', 'text'], ['team', 'Team Pelapor', 'text'], ['tindakan', 'Tindakan Operasi', 'text'],
  ['komplain', 'Deskripsi Komplain', 'textarea'], ['jalanKeluar', 'Solusi awal (opsional)', 'textarea'], ['penangananSelanjutnya', 'Penanganan selanjutnya (opsional)', 'textarea'],
];
const OPTIONAL_FIELDS = ['jalanKeluar', 'rumahSakit', 'penangananSelanjutnya'];
const fieldExamples = {
  tanggal: '2026-03-12', dokter: 'dr. Andi Saputra', rumahSakit: 'RS Harapan Bunda', team: 'Team yang operasi',
  tindakan: 'Tindakan Bipolar Zimmer/Normmed', komplain: 'Dokter komplain mengenai ketidak lengkapan instrument dan implant',
  jalanKeluar: 'Menghubungi tim untuk mengantarkan kekurangan implant dan instrumen yang tidak lengkap',
  penangananSelanjutnya: 'Meminta tim untuk melakukan pengadaan instrument dan implant.',
};
const inputClass = 'min-h-12 min-w-0 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white placeholder:text-slate-400 read-only:bg-slate-800/50 read-only:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:text-slate-400';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const newForm = () => ({ tanggal: today(), dokter: '', rumahSakit: '', team: '', tindakan: '', komplain: '', jalanKeluar: '', penangananSelanjutnya: '', status: LEVELS[2].code });
const formatDate = (value) => {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak tersedia' : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};
function Badge({ status }) {
  const level = LEVELS.find((item) => item.code === status);
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${level?.color || 'border-slate-600 text-slate-300'}`}>{level?.label || status || 'Belum diklasifikasikan'}</span>;
}

export default function KomplainPage() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [list, setList] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const requestVersion = useRef(0);
  const mutationLock = useRef(false);
  const draftRequestId = useRef(null);
  const previousListRef = useRef(null);
  const userRef = useRef(null);
  const [assignedNotice, setAssignedNotice] = useState([]);
  const [incomingNotice, setIncomingNotice] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const [tab, setTab] = useState('form');
  const [modal, setModal] = useState(null);
  const dialogStyle = useDialogViewport(modal !== null);
  const [editItem, setEditItem] = useState(null);
  const [workflowItem, setWorkflowItem] = useState(null);
  const [workflow, setWorkflow] = useState({});
  const [form, setForm] = useState(newForm);
  const [successText, setSuccessText] = useState('');
  const [showExample, setShowExample] = useState(false);
  const [showPicDetail, setShowPicDetail] = useState(false);
  const [showPicHistory, setShowPicHistory] = useState(false);
  const [showSolutionField, setShowSolutionField] = useState(false);
  const [showNextPlanField, setShowNextPlanField] = useState(false);
  const [picHistory, setPicHistory] = useState([]);
  const [picDetailLoading, setPicDetailLoading] = useState(false);
  const [picDetailError, setPicDetailError] = useState('');
  const picDetailVersion = useRef(0);
  const newButton = useRef(null);
  const masterButton = useRef(null);
  const modalReturnFocus = useRef(null);

  const endSession = useCallback((notice = 'Sesi berakhir. Silakan masuk kembali.') => {
    requestVersion.current += 1;
    previousListRef.current = null;
    setUser(null); setList([]); setAssignees([]); setLoaded(false); setLoading(false);
    setModal(null); setEditItem(null); setWorkflowItem(null); setForm(newForm());
    setAssignedNotice([]); setIncomingNotice([]); setReadIds(new Set());
    setTab('form'); setLoadError(''); setAuthError(''); setAuthNotice(notice);
  }, []);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { if (user?.id) setReadIds(loadReadIds(user.id)); }, [user?.id]);
  const markRead = useCallback((id) => {
    if (id == null) return;
    setReadIds((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous); next.add(id);
      saveReadIds(userRef.current?.id, next);
      return next;
    });
  }, []);
  const markAllRead = useCallback((ids) => {
    setReadIds((previous) => {
      const next = new Set(previous); ids.forEach((id) => next.add(id));
      saveReadIds(userRef.current?.id, next);
      return next;
    });
  }, []);
  const unreadItems = useMemo(() => (user && ['admin', 'petugas'].includes(user.role) ? list.filter((item) => item.id != null && item.pelaporId !== user.id && !readIds.has(item.id)) : []), [list, user, readIds]);
  useEffect(() => {
    let alive = true;
    apiRequest('/api/auth/session').then((result) => { if (alive) setUser(result.user); })
      .catch((error) => { if (alive && error.code !== 401) setAuthError(error.message); })
      .finally(() => { if (alive) setAuthChecking(false); });
    return () => { alive = false; requestVersion.current += 1; };
  }, []);
  const fetchData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    const version = ++requestVersion.current;
    if (!silent) { setLoading(true); setLoadError(''); }
    try {
      const result = await apiRequest('/api/komplain');
      if (!Array.isArray(result.data)) throw new Error('Format data laporan tidak valid.');
      if (version === requestVersion.current) {
        const activeUser = userRef.current;
        const previous = previousListRef.current;
        if (previous && activeUser) {
          const prevMap = new Map(previous.map((item) => [item.id, item]));
          const newlyAssigned = []; const newlyArrived = [];
          for (const item of result.data) {
            const prevItem = prevMap.get(item.id);
            if (item.pelaporId === activeUser.id && item.picId && !prevItem?.picId) newlyAssigned.push(item);
            if (!prevItem && item.pelaporId !== activeUser.id && ['admin', 'petugas'].includes(activeUser.role)) newlyArrived.push(item);
          }
          if (newlyAssigned.length) setAssignedNotice((queue) => [...queue, ...newlyAssigned]);
          if (newlyArrived.length) setIncomingNotice((queue) => [...queue, ...newlyArrived]);
        }
        previousListRef.current = result.data;
        setList(result.data); setAssignees(result.assignees || []); setLoaded(true);
      }
    } catch (error) {
      if (version === requestVersion.current) { if (error.code === 401) endSession(); else if (!silent) setLoadError(error.message); }
    } finally { if (version === requestVersion.current && !silent) setLoading(false); }
  }, [endSession]);
  useEffect(() => { if (user?.id && user.approval !== 'pending' && user.approval !== 'rejected' && !user.mustChangePassword) fetchData(); }, [user?.id, user?.approval, user?.mustChangePassword, fetchData]);
  useEffect(() => {
    if (!user?.id || user.approval === 'pending' || user.approval === 'rejected' || user.mustChangePassword) return undefined;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') fetchData({ silent: true }); }, 60000);
    return () => clearInterval(interval);
  }, [user?.id, user?.approval, user?.mustChangePassword, fetchData]);

  function openModal(next) { modalReturnFocus.current = document.activeElement; setActionError(''); setModal(next); }
  function openForm(item) {
    setEditItem(item || null);
    if (!item) draftRequestId.current = crypto.randomUUID();
    setForm(item ? { ...newForm(), ...Object.fromEntries(Object.keys(newForm()).map((key) => [key, String(item[key] ?? '')])), tanggal: String(item.tanggal || '').slice(0, 10) } : { ...newForm(), team: user.unit });
    openModal('form');
  }
  function review(event) {
    event.preventDefault();
    const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    if (fields.some(([key]) => !OPTIONAL_FIELDS.includes(key) && !trimmed[key])) { setActionError('Lengkapi semua kolom wajib. Isian tidak boleh hanya berisi spasi.'); return; }
    setForm(trimmed); setActionError(''); setModal('review');
  }
  function openWorkflow(mode, item) {
    setWorkflowItem(item);
    setWorkflow({ picId: mode === 'selfAssign' ? user.id : item.picId || '', tenggat: item.tenggat || '', statusPenanganan: handlingStatus(item) === 'Baru' ? 'Diproses' : handlingStatus(item), jalanKeluar: item.jalanKeluar || '', penangananSelanjutnya: item.penangananSelanjutnya || '', catatan: '' });
    openModal(mode);
  }
  async function openPicAction(item) {
    markRead(item.id);
    setShowPicDetail(false); setShowPicHistory(false);
    setShowSolutionField(!!item.jalanKeluar || handlingStatus(item) === 'Selesai');
    setShowNextPlanField(!!item.penangananSelanjutnya);
    setWorkflowItem(item);
    setWorkflow({ picId: item.picId || '', tenggat: item.tenggat || '', statusPenanganan: handlingStatus(item) === 'Baru' ? 'Diproses' : handlingStatus(item), jalanKeluar: item.jalanKeluar || '', penangananSelanjutnya: item.penangananSelanjutnya || '', catatan: '' });
    openModal('picAction');
    const version = ++picDetailVersion.current;
    setPicHistory([]); setPicDetailError(''); setPicDetailLoading(true);
    try {
      const result = await apiRequest(`/api/komplain?id=${encodeURIComponent(item.id)}`);
      if (version === picDetailVersion.current) {
        setWorkflowItem(result.data);
        setShowSolutionField((previous) => previous || !!result.data.jalanKeluar);
        setShowNextPlanField((previous) => previous || !!result.data.penangananSelanjutnya);
        setWorkflow((previous) => ({ ...previous, statusPenanganan: handlingStatus(result.data) === 'Baru' ? 'Diproses' : handlingStatus(result.data), jalanKeluar: result.data.jalanKeluar || '', penangananSelanjutnya: result.data.penangananSelanjutnya || '' }));
        setPicHistory(result.history || []);
      }
    } catch (error) { if (version === picDetailVersion.current) { setPicDetailError(error.message); if (error.code === 401) endSession(); } }
    finally { if (version === picDetailVersion.current) setPicDetailLoading(false); }
  }
  async function mutate(action) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError('');
    let payload;
    if (action === 'save') payload = { action: editItem ? 'update' : 'create', ...(editItem ? { id: editItem.id, version: editItem.version } : { requestId: draftRequestId.current }), ...form };
    else payload = { action, id: workflowItem.id, version: workflowItem.version, ...workflow };
    try {
      await apiRequest('/api/komplain', postJson(payload));
      setSuccessText({ save: editItem ? 'Perubahan laporan disimpan.' : 'Laporan terkirim. Pantau tindak lanjut di daftar laporan.', delete: 'Laporan diarsipkan. Data dan riwayat tetap tersimpan di sheet.', assign: 'Penanggung jawab dan tenggat diperbarui.', followUp: 'Tindak lanjut berhasil disimpan.', reopen: 'Laporan dibuka kembali.' }[action]);
      setModal('success'); setTab('table'); void fetchData();
    } catch (error) { if (error.code === 401) endSession(); else setActionError(error.message); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  async function logout() {
    if (loggingOut || busy) return;
    setLoggingOut(true);
    try { await apiRequest('/api/auth/logout', postJson({})); endSession('Anda sudah keluar.'); }
    catch (error) { if (error.code === 401) endSession('Anda sudah keluar.'); else { endSession('Cookie lokal sudah dihapus. Tutup perangkat bersama setelah selesai.'); setAuthError(error.message); } }
    finally { setLoggingOut(false); }
  }
  const titles = { form: editItem ? 'Edit laporan komplain' : 'Buat laporan komplain', review: 'Tinjau laporan', delete: 'Arsipkan laporan?', assign: 'Tentukan penanggung jawab', selfAssign: 'Ambil laporan sebagai PIC', picAction: 'Detail & Tindak Lanjut', reopen: 'Buka kembali laporan', success: 'Berhasil' };
  const descriptions = { form: 'Isi kolom bertanda *. Solusi awal boleh dikosongkan.', review: 'Pastikan informasi sudah benar sebelum disimpan.', delete: 'Laporan disembunyikan dari daftar aktif. Data dan riwayat tetap tersimpan.', assign: 'Pilih petugas atau pelapor aktif untuk menangani kasus ini, lalu tentukan tenggat.', selfAssign: 'Anda akan menjadi penanggung jawab dan dapat langsung melakukan tindak lanjut.', picAction: 'Tinjau informasi lengkap laporan, lalu catat perkembangan penanganan dan rencana lanjutan.', reopen: 'Jelaskan mengapa masalah masih membutuhkan penanganan.', success: successText };
  const header = <Navbar user={user} tab={tab} setTab={setTab} loading={loading} busy={busy} loggingOut={loggingOut} onRefresh={fetchData} onLogout={logout} newButtonRef={newButton} masterButtonRef={masterButton} unreadItems={unreadItems} formatDate={formatDate} onOpenNotification={(item) => { markRead(item.id); setTab('table'); }} onMarkAllRead={() => markAllRead(unreadItems.map((item) => item.id))} />;

  return <main lang="id" data-role={user?.role || 'pelapor'} className="komplain-theme min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:p-8"><div className="mx-auto max-w-7xl space-y-6">{header}<InstallApp role={user?.role} />
    {authChecking ? <LoadingState title="Menyiapkan Komplainer…" description="Memeriksa sesi dan hak akses Anda." /> : !user ? <LoginPanel onLogin={(next) => { setUser(next); setAuthError(''); setAuthNotice(''); }} initialError={authError} notice={authNotice} /> : ['pending', 'rejected'].includes(user.approval) ? <ApprovalPanel user={user} onApproved={setUser} onExpired={endSession} /> : user.mustChangePassword ? <PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /> : tab === 'account' ? <div className="space-y-6"><ProfilePanel user={user} onChanged={endSession} onExpired={endSession} /><PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /></div> : tab === 'users' && user.role === 'admin' ? <AccountsPanel currentUser={user} onExpired={endSession} /> : <>
      {loadError && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"><p className="font-semibold">Laporan gagal dimuat</p><p className="mt-1 break-words">{loadError}</p>{loaded && <p className="mt-1">Menampilkan data terakhir yang berhasil dimuat.</p>}<button disabled={loading} onClick={fetchData} className={`${buttonClass} mt-3 bg-slate-800`}>Coba lagi</button></div>}
      {loading && <LoadingState compact={loaded} title={loaded ? 'Memperbarui laporan…' : 'Memuat laporan Anda…'} description={loaded ? 'Data terbaru sedang diambil.' : 'Menyiapkan daftar laporan dan rekap mingguan.'} />}
      {tab === 'form' ? <section aria-label="Ringkasan laporan" className="space-y-5"><div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Ada kendala di lapangan?</h2><p className="mt-1 text-sm text-slate-400">Buat laporan; solusi dapat ditambahkan selama penanganan.</p></div><button onClick={() => openForm()} className={`${buttonClass} bg-blue-600 hover:bg-blue-500`}><PlusCircle aria-hidden="true" className="h-5 w-5" />Buat laporan baru</button></div><p className="text-sm text-slate-400">{user.role === 'admin' ? 'Ringkasan seluruh laporan aktif.' : 'Ringkasan laporan yang dapat Anda akses.'}</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Belum selesai', list.filter((item) => handlingStatus(item) !== 'Selesai').length], ['Selesai', list.filter((item) => handlingStatus(item) === 'Selesai').length], ['Lewat tenggat', list.filter((item) => isOverdue(item, today())).length], ['Belum ada PIC', list.filter((item) => !item.picId && handlingStatus(item) !== 'Selesai').length]].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold">{loaded ? count : '—'}</p></div>)}</div><div className="flex items-center justify-between"><h2 className="font-semibold">Tingkat Urgensi</h2><span className="text-sm text-slate-400">Laporan Masuk: {loaded ? list.length : '—'} laporan</span></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{LEVELS.map((level) => <div key={level.code} className={`rounded-2xl border p-5 ${level.color}`}><p className="text-sm font-semibold">{level.label}</p><p className="mt-3 text-3xl font-bold text-white">{loaded ? list.filter((item) => item.status === level.code).length : '—'}</p><p className="mt-1 text-xs">laporan</p></div>)}</div></section> : <DataView list={list} loaded={loaded} loading={loading} loadError={loadError} busy={busy} user={user} levels={LEVELS} Badge={Badge} formatDate={formatDate} today={today} onCreate={() => openForm()} onEdit={openForm} onDelete={(item) => openWorkflow('delete', item)} onAssign={(item) => openWorkflow('assign', item)} onSelfAssign={(item) => openWorkflow('selfAssign', item)} onOpenPicAction={openPicAction} onReopen={(item) => openWorkflow('reopen', item)} onExpired={endSession} onMarkRead={markRead} />}
    </>}
  </div>
  {loggingOut && <div className="mx-auto mt-6 max-w-md"><LoadingState compact title="Keluar dari akun…" description="Mengakhiri sesi Anda dengan aman." /></div>}
  <Dialog.Root open={modal !== null && !!user} onOpenChange={(open) => { if (!open && !busy) setModal(null); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} style={dialogStyle} onCloseAutoFocus={(event) => { event.preventDefault(); const target = modalReturnFocus.current; (target?.isConnected ? target : tab === 'table' ? masterButton.current : newButton.current)?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()} className={`${mobileDialog} ${modal === 'picAction' ? 'max-w-2xl' : 'max-w-xl'}`}><div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">{titles[modal]}</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{descriptions[modal]}</Dialog.Description><Dialog.Close disabled={busy} aria-label="Tutup dialog" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    {busy && <div className="mt-5"><LoadingState title={modal === 'delete' ? 'Mengarsipkan laporan…' : 'Menyimpan perubahan…'} description="Tunggu hingga konfirmasi muncul. Jangan tutup halaman." /></div>}
    <div aria-busy={busy} hidden={busy} className={dialogBody} data-dialog-scroll>
    {actionError && <p role="alert" className="mt-4 break-words rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{actionError}</p>}
    {modal === 'form' && <form onSubmit={review} className="mt-4 space-y-4"><p className="text-xs leading-5 text-slate-400">Kolom bertanda * wajib diisi. Anda dapat meninjau laporan sebelum mengirim.</p>
      <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-3"><button type="button" onClick={() => setShowExample((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-blue-200"><span className="flex items-center gap-2"><Lightbulb aria-hidden="true" className="h-4 w-4 shrink-0" />Lihat contoh pengisian</span><span className="text-xs text-blue-300">{showExample ? 'Sembunyikan' : 'Tampilkan'}</span></button>
        {showExample && <dl className="mt-3 space-y-2 border-t border-blue-900/60 pt-3">{fields.map(([name, label]) => <div key={name}><dt className="text-xs text-blue-300">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{name === 'tanggal' ? formatDate(fieldExamples[name]) : fieldExamples[name]}</dd></div>)}</dl>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([name, label, type]) => <div key={name} className={type === 'textarea' || name === 'tindakan' ? 'sm:col-span-2' : ''}><label htmlFor={`komplain-${name}`} className="mb-2 block text-sm font-medium">{label}{!OPTIONAL_FIELDS.includes(name) && <span aria-hidden="true"> *</span>}</label>{type === 'textarea' ? <textarea id={`komplain-${name}`} name={name} required={!OPTIONAL_FIELDS.includes(name)} maxLength={5000} rows={3} placeholder={name === 'komplain' ? 'Ceritakan apa yang terjadi dan dampaknya…' : name === 'penangananSelanjutnya' ? 'Rencana tindak lanjut ke depan, jika ada…' : 'Tuliskan penanganan awal jika sudah ada…'} aria-describedby={`hint-${name}`} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={`${inputClass} min-h-24 resize-y`} /> : <input id={`komplain-${name}`} name={name} type={type} placeholder={name === 'tanggal' ? undefined : name === 'rumahSakit' ? 'Contoh: RS Harapan' : name === 'dokter' ? 'Nama dokter terkait' : name === 'tindakan' ? 'Contoh: Total Knee Replacement Zimmer/Normmed' : 'Nama team pelapor'} autoComplete="off" required={name !== 'rumahSakit'} maxLength={name === 'tindakan' ? 500 : 200} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={inputClass} />}{type === 'textarea' && <p id={`hint-${name}`} className="mt-2 text-xs leading-5 text-slate-400">{name === 'komplain' ? 'Jelaskan masalah secara singkat dan jelas.' : name === 'penangananSelanjutnya' ? 'Boleh dikosongkan jika belum ada rencana lanjutan.' : 'Boleh dikosongkan jika belum ada penanganan.'}</p>}{name === 'team' && <p className="mt-2 text-xs text-slate-400">Isi nama team yang melaporkan kasus ini.</p>}</div>)}</div><fieldset><legend className="mb-2 text-sm font-medium">Tingkat Urgensi *</legend><div className="grid gap-2 min-[380px]:grid-cols-2">{LEVELS.map((level) => <label key={level.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${form.status === level.code ? level.color : 'border-slate-700 text-slate-300'}`}><input type="radio" name="status" value={level.code} checked={form.status === level.code} required onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-4 w-4 accent-blue-500" />{level.label}</label>)}</div></fieldset><div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button className={`${buttonClass} flex-1 bg-blue-600`}>Tinjau laporan</button></div></form>}
    {modal === 'review' && <div className="mt-5 space-y-4"><dl className="space-y-3">{fields.map(([name, label]) => <div key={name}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{name === 'tanggal' ? formatDate(form[name]) : form[name] || (name === 'rumahSakit' ? 'Belum diisi' : name === 'penangananSelanjutnya' ? 'Belum ada rencana lanjutan' : 'Belum ada solusi awal')}</dd></div>)}</dl><Badge status={form.status} /><div className={formFooter}><button disabled={busy} onClick={() => { setModal('form'); setActionError(''); }} className={`${buttonClass} flex-1 bg-slate-800`}>Ubah lagi</button><button disabled={busy} onClick={() => mutate('save')} className={`${buttonClass} flex-1 bg-emerald-700`}>{busy ? 'Menyimpan…' : editItem ? 'Simpan perubahan' : 'Kirim laporan'}</button></div></div>}
    {['assign', 'selfAssign', 'reopen'].includes(modal) && <form onSubmit={(event) => { event.preventDefault(); mutate(modal === 'selfAssign' ? 'assign' : modal); }} className="mt-5 space-y-4"><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p><div className="flex flex-wrap gap-2"><WorkflowBadge status={handlingStatus(workflowItem || {})} /><SimpleStatusBadge item={workflowItem || {}} /><AlertBadge item={workflowItem || {}} /></div>
      {modal === 'selfAssign' && <p className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-3 text-sm text-violet-200">Anda akan ditugaskan sebagai PIC untuk laporan ini dan dapat langsung mencatat tindak lanjut.</p>}
      {modal === 'assign' && <div><label htmlFor="workflow-pic" className="mb-2 block text-sm">Penanggung jawab / PIC</label><select id="workflow-pic" value={workflow.picId} onChange={(event) => setWorkflow({ ...workflow, picId: event.target.value })} className={inputClass}><option value="">Belum ditugaskan</option>{assignees.map((pic) => <option key={pic.id} value={pic.id}>{pic.nama} · {ROLE_LABELS[pic.role]} · {pic.unit}</option>)}</select>{assignees.length === 0 && <p className="mt-2 text-xs text-amber-300">Tambahkan akun Pelapor atau Petugas aktif melalui menu Pengguna terlebih dahulu.</p>}</div>}
      {['assign', 'selfAssign'].includes(modal) && <div><label htmlFor="workflow-deadline" className="mb-2 block text-sm">Tenggat (opsional)</label><input id="workflow-deadline" type="date" value={workflow.tenggat} onChange={(event) => setWorkflow({ ...workflow, tenggat: event.target.value })} className={inputClass} /></div>}
      <div><label htmlFor="workflow-note" className="mb-2 block text-sm">{modal === 'reopen' ? 'Alasan membuka kembali *' : 'Catatan penugasan (opsional)'}</label><textarea id="workflow-note" placeholder="Tuliskan perkembangan atau alasan perubahan…" rows={3} maxLength={2000} required={!['assign', 'selfAssign'].includes(modal)} value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} /></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>}
    {modal === 'picAction' && (() => { const lastNote = picHistory.find((entry) => entry.catatan); return <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><Badge status={workflowItem?.status} /><WorkflowBadge status={handlingStatus(workflowItem || {})} /><AlertBadge item={workflowItem || {}} /><ImplantBadge item={workflowItem || {}} /></div><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p></div>
      {picDetailLoading && <LoadingState compact title="Memuat detail laporan…" description="Mengambil informasi lengkap laporan ini." />}
      {picDetailError && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{picDetailError}</p>}
      <div className="rounded-xl border border-slate-800 bg-slate-800/30">
        <button type="button" onClick={() => setShowPicDetail((value) => !value)} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium text-slate-200">Detail laporan<span className="text-xs text-blue-300">{showPicDetail ? 'Sembunyikan' : 'Tampilkan'}</span></button>
        {showPicDetail && <div className="space-y-4 border-t border-slate-800 p-4">
          <dl className="grid grid-cols-2 gap-3">{[['Tanggal', formatDate(workflowItem?.tanggal)], ['Pelapor', workflowItem?.pelaporNama || 'Data lama'], ['Dokter', workflowItem?.dokter], ['Team', workflowItem?.team], ['Rumah Sakit', workflowItem?.rumahSakit || 'Belum diisi'], ['Tindakan', workflowItem?.tindakan], ['Tenggat', workflowItem?.tenggat ? formatDate(workflowItem.tenggat) : 'Belum ditentukan']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value || '—'}</dd></div>)}</dl>
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3"><h3 className="text-sm font-semibold">Masalah</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{workflowItem?.komplain || '—'}</p></div>
        </div>}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); mutate('followUp'); }} className="space-y-4 border-t border-slate-800 pt-4">
        <h3 className="font-semibold">Tindak lanjut</h3>
        <div><label htmlFor="pic-status" className="mb-2 block text-sm">Status penanganan</label><select id="pic-status" value={workflow.statusPenanganan} onChange={(event) => { const next = event.target.value; setWorkflow({ ...workflow, statusPenanganan: next }); if (next === 'Selesai') setShowSolutionField(true); }} className={inputClass}>{['Diproses', 'Menunggu', 'Selesai'].map((status) => <option key={status}>{status}</option>)}</select></div>
        {showSolutionField ? <div><label htmlFor="pic-solution" className="mb-2 block text-sm">Penyelesaian tindak lanjut {workflow.statusPenanganan === 'Selesai' ? '*' : '(opsional)'}</label><textarea id="pic-solution" placeholder="Jelaskan solusi dan hasil penanganannya…" rows={2} maxLength={5000} required={workflow.statusPenanganan === 'Selesai'} value={workflow.jalanKeluar} onChange={(event) => setWorkflow({ ...workflow, jalanKeluar: event.target.value })} className={inputClass} /></div> : <button type="button" onClick={() => setShowSolutionField(true)} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline"><PlusCircle aria-hidden="true" className="h-4 w-4" />Tambah penyelesaian tindak lanjut</button>}
        {lastNote && <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/15 p-3"><p className="text-xs font-semibold text-amber-200">Komentar terakhir Anda · {new Date(lastNote.tanggal).toLocaleString('id-ID')}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-amber-50">{lastNote.catatan}</p></div>}
        {showNextPlanField ? <div><label htmlFor="pic-next" className="mb-2 block text-sm">Penanganan selanjutnya (opsional)</label><textarea id="pic-next" placeholder="Rencana tindak lanjut ke depan, jika ada…" rows={2} maxLength={5000} value={workflow.penangananSelanjutnya} onChange={(event) => setWorkflow({ ...workflow, penangananSelanjutnya: event.target.value })} className={inputClass} /></div> : <button type="button" onClick={() => setShowNextPlanField(true)} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline"><PlusCircle aria-hidden="true" className="h-4 w-4" />Tambah penanganan selanjutnya</button>}
        <div><label htmlFor="pic-note" className="mb-2 block text-sm">Catatan tindak lanjut *</label><textarea id="pic-note" placeholder="Tuliskan perkembangan penanganan…" rows={2} maxLength={2000} required value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} /></div>
        <div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan tindak lanjut'}</button></div>
      </form>
      <div className="border-t border-slate-800 pt-4">
        <button type="button" onClick={() => setShowPicHistory((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-slate-200">Riwayat tindak lanjut {picHistory.length > 0 && `(${picHistory.length})`}<span className="text-xs text-blue-300">{showPicHistory ? 'Sembunyikan' : 'Tampilkan'}</span></button>
        {showPicHistory && <>{!picDetailLoading && !picDetailError && !picHistory.length && <p className="mt-3 text-sm text-slate-400">Belum ada riwayat.</p>}<ol className="mt-3 space-y-3">{picHistory.map((entry) => <li key={entry.id} className="border-l-2 border-blue-800 pl-3"><p className="text-sm font-semibold">{entry.aksi}</p><p className="mt-0.5 break-words text-xs text-slate-400">{entry.nama} · {new Date(entry.tanggal).toLocaleString('id-ID')}</p>{entry.catatan && <p className={`mt-1.5 ${historyNote}`}>{entry.catatan}</p>}</li>)}</ol></>}
      </div>
    </div>; })()}
    {modal === 'delete' && <div className="mt-5 space-y-5"><div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4"><AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-red-400" /><p className="break-words text-sm leading-6">Laporan <strong>{workflowItem?.dokter}</strong> · {formatDate(workflowItem?.tanggal)}</p></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} onClick={() => mutate('delete')} className={`${buttonClass} flex-1 bg-red-700`}>{busy ? 'Mengarsipkan…' : 'Arsipkan laporan'}</button></div></div>}
    {modal === 'success' && <div className="mt-5 flex flex-col items-center gap-4 py-2 text-center"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"><CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-400" /></span><p className="break-words text-sm leading-6 text-slate-300">{successText}</p><Dialog.Close className={`${buttonClass} w-full bg-blue-600`}>Tutup</Dialog.Close></div>}
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={assignedNotice.length > 0 && modal === null} onOpenChange={(open) => { if (!open) setAssignedNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Laporan Anda sudah ditangani</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Penanggung jawab (PIC) baru ditentukan untuk {assignedNotice.length > 1 ? `${assignedNotice.length} laporan Anda` : 'laporan Anda'}.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{assignedNotice.map((item) => <div key={item.id} className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-3"><p className="flex items-center gap-1.5 text-sm font-semibold"><UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-300" />{item.dokter} · {item.tindakan}</p><p className="mt-1 break-words text-sm text-slate-300">Ditangani oleh <strong>{item.picNama}</strong>{item.tenggat ? ` · Tenggat ${formatDate(item.tenggat)}` : ''}</p></div>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close><button onClick={() => { setAssignedNotice([]); setTab('table'); }} className={`${buttonClass} flex-1 bg-blue-600`}>Lihat laporan saya</button></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={incomingNotice.length > 0 && assignedNotice.length === 0 && modal === null} onOpenChange={(open) => { if (!open) setIncomingNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Laporan baru masuk</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{incomingNotice.length > 1 ? `${incomingNotice.length} laporan baru` : '1 laporan baru'} sejak terakhir Anda membuka halaman ini.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{incomingNotice.map((item) => <div key={item.id} className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-sm font-semibold"><Inbox aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-300" />{item.dokter} · {item.tindakan}</p><Badge status={item.status} /></div><p className="mt-1 break-words text-sm text-slate-300">Dilaporkan oleh <strong>{item.pelaporNama || 'Pengguna'}</strong> · {formatDate(item.tanggal)}</p></div>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close><button onClick={() => { setIncomingNotice([]); setTab('table'); }} className={`${buttonClass} flex-1 bg-blue-600`}>Lihat semua laporan</button></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  </main>;
}
