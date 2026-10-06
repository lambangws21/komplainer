'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PlusCircle, X, CheckCircle2, Lightbulb, AlertTriangle } from 'lucide-react';
import DataView from './data-view';
import './theme.css';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, formFooter, dialogHeader, dialogBody } from './ui-styles.mjs';
import LoadingState from './loading-state';
import InstallApp from './install-app';
import AccountsPanel from './accounts-panel';
import Navbar from './navbar';
import { LoginPanel, PasswordPanel, ProfilePanel, ApprovalPanel } from './auth-panel';
import WorkflowBadge from './workflow-badge';
import SimpleStatusBadge from './simple-status-badge';
import AlertBadge from './alert-badge';
import DatePicker from './date-picker';
import { apiRequest, postJson } from './api-client.mjs';
import { ROLE_LABELS, handlingStatus, isOverdue } from './workflow.mjs';

const LEVELS = [
  { code: 'C1 - Critical', label: 'C1 Critical', color: 'text-red-300 border-red-800 bg-red-950/40' },
  { code: 'C2 - Major', label: 'C2 Major', color: 'text-orange-300 border-orange-800 bg-orange-950/40' },
  { code: 'C3 - Moderate', label: 'C3 Moderate', color: 'text-amber-300 border-amber-800 bg-amber-950/40' },
  { code: 'C4 - Minor', label: 'C4 Minor', color: 'text-emerald-300 border-emerald-800 bg-emerald-950/40' },
];
const fields = [
  ['tanggal', 'Tanggal kejadian', 'date'], ['dokter', 'Dokter', 'text'],
  ['rumahSakit', 'Rumah Sakit (opsional)', 'text'], ['team', 'Team Pelapor', 'text'], ['tindakan', 'Tindakan Operasi', 'text'],
  ['komplain', 'Deskripsi masalah', 'textarea'], ['jalanKeluar', 'Solusi awal (opsional)', 'textarea'], ['penangananSelanjutnya', 'Penanganan selanjutnya (opsional)', 'textarea'],
];
const OPTIONAL_FIELDS = ['jalanKeluar', 'rumahSakit', 'penangananSelanjutnya'];
const fieldExamples = {
  tanggal: '2026-03-12', dokter: 'dr. Andi Saputra', rumahSakit: 'RS Harapan Bunda', team: 'Team yang operasi',
  tindakan: 'Tindakan Bipolar', komplain: 'Dokter komplain mengenai ketidak lengkapan instrument dan implant',
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
  const [tab, setTab] = useState('form');
  const [modal, setModal] = useState(null);
  const dialogStyle = useDialogViewport(modal !== null);
  const [editItem, setEditItem] = useState(null);
  const [workflowItem, setWorkflowItem] = useState(null);
  const [workflow, setWorkflow] = useState({});
  const [form, setForm] = useState(newForm);
  const [successText, setSuccessText] = useState('');
  const [showExample, setShowExample] = useState(false);
  const [picHistory, setPicHistory] = useState([]);
  const [picDetailLoading, setPicDetailLoading] = useState(false);
  const [picDetailError, setPicDetailError] = useState('');
  const picDetailVersion = useRef(0);
  const newButton = useRef(null);
  const masterButton = useRef(null);
  const modalReturnFocus = useRef(null);

  const endSession = useCallback((notice = 'Sesi berakhir. Silakan masuk kembali.') => {
    requestVersion.current += 1;
    setUser(null); setList([]); setAssignees([]); setLoaded(false); setLoading(false);
    setModal(null); setEditItem(null); setWorkflowItem(null); setForm(newForm());
    setTab('form'); setLoadError(''); setAuthError(''); setAuthNotice(notice);
  }, []);
  useEffect(() => {
    let alive = true;
    apiRequest('/api/auth/session').then((result) => { if (alive) setUser(result.user); })
      .catch((error) => { if (alive && error.code !== 401) setAuthError(error.message); })
      .finally(() => { if (alive) setAuthChecking(false); });
    return () => { alive = false; requestVersion.current += 1; };
  }, []);
  const fetchData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setLoadError('');
    try {
      const result = await apiRequest('/api/komplain');
      if (!Array.isArray(result.data)) throw new Error('Format data laporan tidak valid.');
      if (version === requestVersion.current) { setList(result.data); setAssignees(result.assignees || []); setLoaded(true); }
    } catch (error) {
      if (version === requestVersion.current) { if (error.code === 401) endSession(); else setLoadError(error.message); }
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [endSession]);
  useEffect(() => { if (user?.id && user.approval !== 'pending' && user.approval !== 'rejected' && !user.mustChangePassword) fetchData(); }, [user?.id, user?.approval, user?.mustChangePassword, fetchData]);

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
    setWorkflowItem(item);
    setWorkflow({ picId: item.picId || '', tenggat: item.tenggat || '', statusPenanganan: handlingStatus(item) === 'Baru' ? 'Diproses' : handlingStatus(item), jalanKeluar: item.jalanKeluar || '', penangananSelanjutnya: item.penangananSelanjutnya || '', catatan: '' });
    openModal('picAction');
    const version = ++picDetailVersion.current;
    setPicHistory([]); setPicDetailError(''); setPicDetailLoading(true);
    try {
      const result = await apiRequest(`/api/komplain?id=${encodeURIComponent(item.id)}`);
      if (version === picDetailVersion.current) {
        setWorkflowItem(result.data);
        setWorkflow((previous) => ({ ...previous, jalanKeluar: result.data.jalanKeluar || '', penangananSelanjutnya: result.data.penangananSelanjutnya || '' }));
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
  const header = <Navbar user={user} tab={tab} setTab={setTab} loading={loading} busy={busy} loggingOut={loggingOut} onRefresh={fetchData} onLogout={logout} newButtonRef={newButton} masterButtonRef={masterButton} />;

  return <main lang="id" data-role={user?.role || 'pelapor'} className="komplain-theme min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:p-8"><div className="mx-auto max-w-7xl space-y-6">{header}<InstallApp role={user?.role} />
    {authChecking ? <LoadingState title="Menyiapkan Komplainer…" description="Memeriksa sesi dan hak akses Anda." /> : !user ? <LoginPanel onLogin={(next) => { setUser(next); setAuthError(''); setAuthNotice(''); }} initialError={authError} notice={authNotice} /> : ['pending', 'rejected'].includes(user.approval) ? <ApprovalPanel user={user} onApproved={setUser} onExpired={endSession} /> : user.mustChangePassword ? <PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /> : tab === 'account' ? <div className="space-y-6"><ProfilePanel user={user} onChanged={endSession} onExpired={endSession} /><PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /></div> : tab === 'users' && user.role === 'admin' ? <AccountsPanel currentUser={user} onExpired={endSession} /> : <>
      {loadError && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"><p className="font-semibold">Laporan gagal dimuat</p><p className="mt-1 break-words">{loadError}</p>{loaded && <p className="mt-1">Menampilkan data terakhir yang berhasil dimuat.</p>}<button disabled={loading} onClick={fetchData} className={`${buttonClass} mt-3 bg-slate-800`}>Coba lagi</button></div>}
      {loading && <LoadingState compact={loaded} title={loaded ? 'Memperbarui laporan…' : 'Memuat laporan Anda…'} description={loaded ? 'Data terbaru sedang diambil.' : 'Menyiapkan daftar laporan dan rekap mingguan.'} />}
      {tab === 'form' ? <section aria-label="Ringkasan laporan" className="space-y-5"><div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Ada kendala di lapangan?</h2><p className="mt-1 text-sm text-slate-400">Buat laporan; solusi dapat ditambahkan selama penanganan.</p></div><button onClick={() => openForm()} className={`${buttonClass} bg-blue-600 hover:bg-blue-500`}><PlusCircle aria-hidden="true" className="h-5 w-5" />Buat laporan baru</button></div><p className="text-sm text-slate-400">{user.role === 'admin' ? 'Ringkasan seluruh laporan aktif.' : 'Ringkasan laporan yang dapat Anda akses.'}</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Belum selesai', list.filter((item) => handlingStatus(item) !== 'Selesai').length], ['Selesai', list.filter((item) => handlingStatus(item) === 'Selesai').length], ['Lewat tenggat', list.filter((item) => isOverdue(item, today())).length], ['Belum ada PIC', list.filter((item) => !item.picId && handlingStatus(item) !== 'Selesai').length]].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold">{loaded ? count : '—'}</p></div>)}</div><div className="flex items-center justify-between"><h2 className="font-semibold">Tingkat keparahan</h2><span className="text-sm text-slate-400">Laporan Masuk: {loaded ? list.length : '—'} laporan</span></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{LEVELS.map((level) => <div key={level.code} className={`rounded-2xl border p-5 ${level.color}`}><p className="text-sm font-semibold">{level.label}</p><p className="mt-3 text-3xl font-bold text-white">{loaded ? list.filter((item) => item.status === level.code).length : '—'}</p><p className="mt-1 text-xs">laporan</p></div>)}</div></section> : <DataView list={list} loaded={loaded} loading={loading} loadError={loadError} busy={busy} user={user} levels={LEVELS} Badge={Badge} formatDate={formatDate} today={today} onCreate={() => openForm()} onEdit={openForm} onDelete={(item) => openWorkflow('delete', item)} onAssign={(item) => openWorkflow('assign', item)} onSelfAssign={(item) => openWorkflow('selfAssign', item)} onOpenPicAction={openPicAction} onReopen={(item) => openWorkflow('reopen', item)} onExpired={endSession} />}
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
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([name, label, type]) => <div key={name} className={type === 'textarea' || name === 'tindakan' ? 'sm:col-span-2' : ''}><label htmlFor={`komplain-${name}`} className="mb-2 block text-sm font-medium">{label}{!OPTIONAL_FIELDS.includes(name) && <span aria-hidden="true"> *</span>}</label>{type === 'textarea' ? <textarea id={`komplain-${name}`} name={name} required={!OPTIONAL_FIELDS.includes(name)} maxLength={5000} rows={3} placeholder={name === 'komplain' ? 'Ceritakan apa yang terjadi dan dampaknya…' : name === 'penangananSelanjutnya' ? 'Rencana tindak lanjut ke depan, jika ada…' : 'Tuliskan penanganan awal jika sudah ada…'} aria-describedby={`hint-${name}`} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={`${inputClass} min-h-24 resize-y`} /> : type === 'date' ? <DatePicker id={`komplain-${name}`} value={form[name]} onChange={(value) => setForm({ ...form, [name]: value })} className={inputClass} /> : <input id={`komplain-${name}`} name={name} type={type} placeholder={name === 'rumahSakit' ? 'Contoh: RS Harapan' : name === 'dokter' ? 'Nama dokter terkait' : name === 'tindakan' ? 'Contoh: Total Knee Replacement' : 'Nama team pelapor'} autoComplete="off" required={name !== 'rumahSakit'} maxLength={name === 'tindakan' ? 500 : 200} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={inputClass} />}{type === 'textarea' && <p id={`hint-${name}`} className="mt-2 text-xs leading-5 text-slate-400">{name === 'komplain' ? 'Jelaskan masalah secara singkat dan jelas.' : name === 'penangananSelanjutnya' ? 'Boleh dikosongkan jika belum ada rencana lanjutan.' : 'Boleh dikosongkan jika belum ada penanganan.'}</p>}{name === 'team' && <p className="mt-2 text-xs text-slate-400">Isi nama team yang melaporkan kasus ini.</p>}</div>)}</div><fieldset><legend className="mb-2 text-sm font-medium">Tingkat keparahan *</legend><div className="grid gap-2 min-[380px]:grid-cols-2">{LEVELS.map((level) => <label key={level.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${form.status === level.code ? level.color : 'border-slate-700 text-slate-300'}`}><input type="radio" name="status" value={level.code} checked={form.status === level.code} required onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-4 w-4 accent-blue-500" />{level.label}</label>)}</div></fieldset><div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button className={`${buttonClass} flex-1 bg-blue-600`}>Tinjau laporan</button></div></form>}
    {modal === 'review' && <div className="mt-5 space-y-4"><dl className="space-y-3">{fields.map(([name, label]) => <div key={name}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{name === 'tanggal' ? formatDate(form[name]) : form[name] || (name === 'rumahSakit' ? 'Belum diisi' : name === 'penangananSelanjutnya' ? 'Belum ada rencana lanjutan' : 'Belum ada solusi awal')}</dd></div>)}</dl><Badge status={form.status} /><div className={formFooter}><button disabled={busy} onClick={() => { setModal('form'); setActionError(''); }} className={`${buttonClass} flex-1 bg-slate-800`}>Ubah lagi</button><button disabled={busy} onClick={() => mutate('save')} className={`${buttonClass} flex-1 bg-emerald-700`}>{busy ? 'Menyimpan…' : editItem ? 'Simpan perubahan' : 'Kirim laporan'}</button></div></div>}
    {['assign', 'selfAssign', 'reopen'].includes(modal) && <form onSubmit={(event) => { event.preventDefault(); mutate(modal === 'selfAssign' ? 'assign' : modal); }} className="mt-5 space-y-4"><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p><div className="flex flex-wrap gap-2"><WorkflowBadge status={handlingStatus(workflowItem || {})} /><SimpleStatusBadge item={workflowItem || {}} /><AlertBadge item={workflowItem || {}} /></div>
      {modal === 'selfAssign' && <p className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-3 text-sm text-violet-200">Anda akan ditugaskan sebagai PIC untuk laporan ini dan dapat langsung mencatat tindak lanjut.</p>}
      {modal === 'assign' && <div><label htmlFor="workflow-pic" className="mb-2 block text-sm">Penanggung jawab / PIC</label><select id="workflow-pic" value={workflow.picId} onChange={(event) => setWorkflow({ ...workflow, picId: event.target.value })} className={inputClass}><option value="">Belum ditugaskan</option>{assignees.map((pic) => <option key={pic.id} value={pic.id}>{pic.nama} · {ROLE_LABELS[pic.role]} · {pic.unit}</option>)}</select>{assignees.length === 0 && <p className="mt-2 text-xs text-amber-300">Tambahkan akun Pelapor atau Petugas aktif melalui menu Pengguna terlebih dahulu.</p>}</div>}
      {['assign', 'selfAssign'].includes(modal) && <div><label htmlFor="workflow-deadline" className="mb-2 block text-sm">Tenggat (opsional)</label><DatePicker id="workflow-deadline" value={workflow.tenggat} onChange={(value) => setWorkflow({ ...workflow, tenggat: value })} placeholder="Belum ditentukan" clearable className={inputClass} /></div>}
      <div><label htmlFor="workflow-note" className="mb-2 block text-sm">{modal === 'reopen' ? 'Alasan membuka kembali *' : 'Catatan penugasan (opsional)'}</label><textarea id="workflow-note" placeholder="Tuliskan perkembangan atau alasan perubahan…" rows={3} maxLength={2000} required={!['assign', 'selfAssign'].includes(modal)} value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} /></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>}
    {modal === 'picAction' && <div className="mt-5 space-y-5">
      <div className="flex flex-wrap gap-6">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Prioritas</p><div className="flex flex-wrap gap-2"><Badge status={workflowItem?.status} /><AlertBadge item={workflowItem || {}} /></div></div>
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Progres</p><div className="flex flex-wrap gap-2"><WorkflowBadge status={handlingStatus(workflowItem || {})} /><SimpleStatusBadge item={workflowItem || {}} /></div></div>
      </div>
      {picDetailLoading && <LoadingState compact title="Memuat detail laporan…" description="Mengambil informasi lengkap laporan ini." />}
      {picDetailError && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{picDetailError}</p>}
      <dl className="grid gap-4 rounded-xl border border-slate-800 bg-slate-800/30 p-4 sm:grid-cols-2">{[['Tanggal', formatDate(workflowItem?.tanggal)], ['Pelapor', workflowItem?.pelaporNama || 'Data lama'], ['Dokter', workflowItem?.dokter], ['Team', workflowItem?.team], ['Rumah Sakit', workflowItem?.rumahSakit || 'Belum diisi'], ['Tindakan', workflowItem?.tindakan], ['Tenggat', workflowItem?.tenggat ? formatDate(workflowItem.tenggat) : 'Belum ditentukan']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value || '—'}</dd></div>)}</dl>
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4"><h3 className="text-sm font-semibold">Masalah</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{workflowItem?.komplain || '—'}</p></div>
      <form onSubmit={(event) => { event.preventDefault(); mutate('followUp'); }} className="space-y-4 border-t border-slate-800 pt-5">
        <h3 className="font-semibold">Tindak lanjut</h3>
        <div><label htmlFor="pic-status" className="mb-2 block text-sm">Status penanganan</label><select id="pic-status" value={workflow.statusPenanganan} onChange={(event) => setWorkflow({ ...workflow, statusPenanganan: event.target.value })} className={inputClass}>{['Diproses', 'Menunggu', 'Selesai'].map((status) => <option key={status}>{status}</option>)}</select></div>
        <div><label htmlFor="pic-solution" className="mb-2 block text-sm">Penyelesaian tindak lanjut {workflow.statusPenanganan === 'Selesai' ? '*' : '(opsional)'}</label><textarea id="pic-solution" placeholder="Jelaskan solusi dan hasil penanganannya…" rows={3} maxLength={5000} required={workflow.statusPenanganan === 'Selesai'} value={workflow.jalanKeluar} onChange={(event) => setWorkflow({ ...workflow, jalanKeluar: event.target.value })} className={inputClass} /></div>
        <div><label htmlFor="pic-next" className="mb-2 block text-sm">Penanganan selanjutnya (opsional)</label><textarea id="pic-next" placeholder="Rencana tindak lanjut ke depan, jika ada…" rows={3} maxLength={5000} value={workflow.penangananSelanjutnya} onChange={(event) => setWorkflow({ ...workflow, penangananSelanjutnya: event.target.value })} className={inputClass} /></div>
        <div><label htmlFor="pic-note" className="mb-2 block text-sm">Catatan tindak lanjut *</label><textarea id="pic-note" placeholder="Tuliskan perkembangan penanganan…" rows={3} maxLength={2000} required value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} /></div>
        <div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan tindak lanjut'}</button></div>
      </form>
      <section className="border-t border-slate-800 pt-5"><h3 className="font-semibold">Riwayat tindak lanjut</h3>{!picDetailLoading && !picDetailError && !picHistory.length && <p className="mt-3 text-sm text-slate-400">Belum ada riwayat.</p>}<ol className="mt-4 space-y-4">{picHistory.map((entry) => <li key={entry.id} className="border-l-2 border-blue-800 pl-4"><p className="text-sm font-semibold">{entry.aksi}</p><p className="mt-1 break-words text-xs text-slate-400">{entry.nama} · {new Date(entry.tanggal).toLocaleString('id-ID')}</p>{entry.catatan && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{entry.catatan}</p>}</li>)}</ol></section>
    </div>}
    {modal === 'delete' && <div className="mt-5 space-y-5"><div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4"><AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-red-400" /><p className="break-words text-sm leading-6">Laporan <strong>{workflowItem?.dokter}</strong> · {formatDate(workflowItem?.tanggal)}</p></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} onClick={() => mutate('delete')} className={`${buttonClass} flex-1 bg-red-700`}>{busy ? 'Mengarsipkan…' : 'Arsipkan laporan'}</button></div></div>}
    {modal === 'success' && <div className="mt-5 flex flex-col items-center gap-4 py-2 text-center"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"><CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-400" /></span><p className="break-words text-sm leading-6 text-slate-300">{successText}</p><Dialog.Close className={`${buttonClass} w-full bg-blue-600`}>Tutup</Dialog.Close></div>}
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  </main>;
}
