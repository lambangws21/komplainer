'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PlusCircle, X, Lightbulb, AlertTriangle, UserRound, Inbox } from 'lucide-react';
import DataView from './data-view';
import HomePanel from './home-panel';
import ReviewChecklist from './review-checklist';
import { readDraft, writeDraft, clearDraft } from './report-draft.mjs';
import './theme.css';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, formFooter, dialogHeader, dialogBody, historyNote, picResponseBubble } from './ui-styles.mjs';
import LoadingState from './loading-state';
import InstallApp from './install-app';
import AccountsPanel from './accounts-panel';
import Navbar from './navbar';
import { LoginPanel, PasswordPanel, ProfilePanel, ApprovalPanel } from './auth-panel';
import WorkflowBadge from './workflow-badge';
import SimpleStatusBadge from './simple-status-badge';
import AlertBadge from './alert-badge';
import ImplantBadge from './implant-badge';
import RoleBadge from './role-badge';
import PhotoPicker from './photo-picker';
import PhotoGallery from './photo-gallery';
import VisualTextEditor from './visual-text-editor';
import FormattedText, { InlineText } from './formatted-text';
import StatusCaseBadge from './status-case-badge';
import FieldInfo from './field-info';
import { apiRequest, postJson } from './api-client.mjs';
import { ROLE_LABELS, STATUS_CASE, handlingStatus, historyChanges, formatHistoryChange, editedFieldLabels } from './workflow.mjs';
import { loadReadIds, saveReadIds } from './read-tracking.mjs';

const TINDAKAN_PRESETS = ['TKR ZIMMER', 'TKR NORMMED', 'THR ZIMMER', 'UKA OXFORD ZIMMER', 'THR NORMMED', 'BIPOLAR ZIMMER'];
const LEVELS = [
  { code: 'C1 - Critical', label: 'C1 Critical', color: 'text-red-300 border-red-800 bg-red-950/40', accent: 'border-l-red-600' },
  { code: 'C2 - Major', label: 'C2 Major', color: 'text-orange-300 border-orange-800 bg-orange-950/40', accent: 'border-l-orange-500' },
  { code: 'C3 - Moderate', label: 'C3 Moderate', color: 'text-amber-300 border-amber-800 bg-amber-950/40', accent: 'border-l-amber-500' },
  { code: 'C4 - Minor', label: 'C4 Minor', color: 'text-emerald-300 border-emerald-800 bg-emerald-950/40', accent: 'border-l-emerald-500' },
];
// Colors the modal's left edge to match the case's severity, when one has been set by the PIC.
function severityAccent(status) {
  return LEVELS.find((level) => level.code === status)?.accent || '';
}
const fields = [
  ['tanggal', 'Tanggal kejadian', 'date'], ['dokter', 'Dokter', 'text'],
  ['rumahSakit', 'Rumah Sakit', 'text'], ['team', 'Team Pelapor', 'text'], ['tindakan', 'Tindakan Operasi', 'text'],
  ['komplain', 'Deskripsi Komplain', 'textarea'], ['jalanKeluar', 'Solusi awal (opsional)', 'textarea'], ['penangananSelanjutnya', 'Rencana tindak lanjut (opsional)', 'textarea'],
];
const OPTIONAL_FIELDS = ['jalanKeluar', 'penangananSelanjutnya'];
const fieldExamples = {
  tanggal: '2026-03-12', dokter: 'dr. Andi Saputra', rumahSakit: 'RS Harapan Bunda', team: 'Team yang operasi',
  tindakan: 'BIPOLAR ZIMMER', komplain: 'Dokter komplain mengenai ketidak lengkapan instrument dan implant',
  jalanKeluar: 'Menghubungi tim untuk mengantarkan kekurangan implant dan instrumen yang tidak lengkap',
  penangananSelanjutnya: 'Meminta tim untuk melakukan pengadaan instrument dan implant.',
};
const FIELD_HINTS = {
  team: 'Isi nama team yang melaporkan kasus ini.',
  komplain: 'Jelaskan masalah secara singkat dan jelas.',
  jalanKeluar: 'Boleh dikosongkan jika belum ada penanganan.',
  penangananSelanjutnya: 'Boleh dikosongkan jika belum ada rencana lanjutan.',
};
const inputClass = 'min-h-12 min-w-0 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white placeholder:text-slate-400 read-only:bg-slate-800/50 read-only:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:text-slate-400';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const draftStorage = () => { try { return window.localStorage; } catch { return null; } };
const newForm = () => ({ tanggal: today(), dokter: '', rumahSakit: '', team: '', tindakan: '', komplain: '', jalanKeluar: '', penangananSelanjutnya: '', statusCase: STATUS_CASE[1].code });
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
  const [pendingDetailId, setPendingDetailId] = useState(null);
  const [incomingNotice, setIncomingNotice] = useState([]);
  const [criticalNotice, setCriticalNotice] = useState([]);
  const criticalSeenRef = useRef(new Set());
  const [readIds, setReadIds] = useState(() => new Set());
  const [tab, setTab] = useState('form');
  const [modal, setModal] = useState(null);
  const dialogStyle = useDialogViewport(modal !== null);
  const [editItem, setEditItem] = useState(null);
  const [workflowItem, setWorkflowItem] = useState(null);
  const [workflow, setWorkflow] = useState({});
  const [form, setForm] = useState(newForm);
  const [successText, setSuccessText] = useState('');
  const [savedReportId, setSavedReportId] = useState(null);
  const [showExample, setShowExample] = useState(false);
  const [picEditMode, setPicEditMode] = useState(false);
  const [showPicHistory, setShowPicHistory] = useState(false);
  const [showSolutionField, setShowSolutionField] = useState(false);
  const [showNextPlanField, setShowNextPlanField] = useState(false);
  const [showNoteField, setShowNoteField] = useState(false);
  const [showFormExtras, setShowFormExtras] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [customTindakan, setCustomTindakan] = useState(false);
  const [formPhotos, setFormPhotos] = useState([]);
  const [picPhotos, setPicPhotos] = useState([]);
  const photoPreviewUrls = useRef(new Set());
  useEffect(() => {
    const current = new Set([...formPhotos, ...picPhotos].map((photo) => photo.previewUrl).filter(Boolean));
    for (const url of photoPreviewUrls.current) if (!current.has(url)) URL.revokeObjectURL(url);
    photoPreviewUrls.current = current;
  }, [formPhotos, picPhotos]);
  useEffect(() => () => { for (const url of photoPreviewUrls.current) URL.revokeObjectURL(url); }, []);

  useEffect(() => {
    if (user?.id && !editItem && ['form', 'review'].includes(modal)) {
      if (['dokter', 'rumahSakit', 'tindakan', 'komplain', 'jalanKeluar', 'penangananSelanjutnya'].some((key) => form[key]?.trim())) writeDraft(draftStorage(), user.id, form, draftRequestId.current);
      else clearDraft(draftStorage(), user.id);
    }
  }, [user?.id, editItem, modal, form]);

  const addFormPhoto = (photo) => setFormPhotos((previous) => [...previous, photo]);
  const removeFormPhoto = (id) => setFormPhotos((previous) => previous.filter((photo) => photo.id !== id));
  const addPicPhoto = (photo) => setPicPhotos((previous) => [...previous, photo]);
  const removePicPhoto = (id) => setPicPhotos((previous) => previous.filter((photo) => photo.id !== id));
  const [picHistory, setPicHistory] = useState([]);
  const [picDetailLoading, setPicDetailLoading] = useState(false);
  const [picDetailError, setPicDetailError] = useState('');
  const picDetailVersion = useRef(0);
  const newButton = useRef(null);
  const masterButton = useRef(null);
  const modalReturnFocus = useRef(null);
  const textareaRefs = useRef({});
  const optionalFocus = useRef(null);
  useEffect(() => {
    if (modal !== 'review') return;
    const frame = requestAnimationFrame(() => {
      const body = document.querySelector('[data-dialog-scroll]');
      if (body) body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [modal]);
  useEffect(() => {
    if (modal !== 'form' || !optionalFocus.current) return;
    const target = optionalFocus.current;
    optionalFocus.current = null;
    const frame = requestAnimationFrame(() => {
      const element = target === 'foto' ? document.querySelector('#komplain-photo-input button') : document.getElementById(`komplain-${target}`);
      element?.focus(); element?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [modal]);

  const endSession = useCallback((notice = 'Sesi berakhir. Silakan masuk kembali.') => {
    clearDraft(draftStorage(), userRef.current?.id);
    requestVersion.current += 1;
    previousListRef.current = null;
    setUser(null); setList([]); setAssignees([]); setLoaded(false); setLoading(false);
    setModal(null); setEditItem(null); setWorkflowItem(null); setForm(newForm()); setFormPhotos([]); setPicPhotos([]);
    setAssignedNotice([]); setIncomingNotice([]); setCriticalNotice([]); criticalSeenRef.current = new Set(); setReadIds(new Set());
    setSuccessText(''); setSavedReportId(null); setTab('form'); setLoadError(''); setAuthError(''); setAuthNotice(notice);
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
  const unreadItems = useMemo(() => {
    if (!user) return [];
    const items = ['admin', 'petugas'].includes(user.role)
      ? list.filter((item) => item.id != null && item.pelaporId !== user.id && !readIds.has(item.id))
      : list.filter((item) => item.id != null && item.pelaporId === user.id && item.picId && !readIds.has(item.id));
    return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [list, user, readIds]);
  useEffect(() => {
    let alive = true;
    apiRequest('/api/auth/session').then((result) => { if (alive) setUser(result.user); })
      .catch((error) => { if (alive && error.code !== 401) setAuthError(error.message); })
      .finally(() => { if (alive) setAuthChecking(false); });
    return () => { alive = false; requestVersion.current += 1; };
  }, []);
  const fetchData = useCallback(async (options = {}) => {
    const { silent = false, updatedId = null } = options;
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
            if (item.id !== updatedId && item.pelaporId === activeUser.id && item.picId && !prevItem?.picId) newlyAssigned.push(item);
            if (!prevItem && item.pelaporId !== activeUser.id && ['admin', 'petugas'].includes(activeUser.role)) newlyArrived.push(item);
          }
          if (newlyAssigned.length) setAssignedNotice((queue) => [...queue, ...newlyAssigned]);
          if (newlyArrived.length) setIncomingNotice((queue) => [...queue, ...newlyArrived]);
        }
        if (activeUser && ['admin', 'petugas'].includes(activeUser.role)) {
          const criticalNow = result.data.filter((item) => item.statusCase === 'Ada Kendala' && !item.picId && handlingStatus(item) !== 'Selesai');
          const criticalIds = new Set(criticalNow.map((item) => item.id));
          for (const id of Array.from(criticalSeenRef.current)) if (!criticalIds.has(id)) criticalSeenRef.current.delete(id);
          const newCritical = criticalNow.filter((item) => item.id != null && !criticalSeenRef.current.has(item.id));
          newCritical.forEach((item) => criticalSeenRef.current.add(item.id));
          setCriticalNotice((queue) => {
            const kept = queue.filter((item) => criticalIds.has(item.id));
            const keptIds = new Set(kept.map((item) => item.id));
            return [...kept, ...newCritical.filter((item) => item.id !== updatedId && !keptIds.has(item.id))];
          });
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
    const draft = item ? null : readDraft(draftStorage(), user.id);
    if (!item) draftRequestId.current = draft?.requestId || crypto.randomUUID();
    const next = item ? { ...newForm(), ...Object.fromEntries(Object.keys(newForm()).map((key) => [key, String(item[key] ?? '')])), tanggal: String(item.tanggal || '').slice(0, 10), statusCase: item.statusCase || newForm().statusCase } : { ...newForm(), team: user.unit, ...draft?.form };
    setForm(next); setDraftRestored(!!draft);
    setShowFormExtras(OPTIONAL_FIELDS.some((key) => !!next[key]) || !!item?.fotoUrls?.length);
    setCustomTindakan(!!(next.tindakan && !TINDAKAN_PRESETS.includes(next.tindakan)));
    setFormPhotos([]);

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
    setWorkflow({ picId: mode === 'selfAssign' ? user.id : item.picId || '', tenggat: item.tenggat || '', statusPenanganan: handlingStatus(item) === 'Baru' ? 'Menunggu' : handlingStatus(item), jalanKeluar: item.jalanKeluar || '', penangananSelanjutnya: item.penangananSelanjutnya || '', catatan: '' });
    openModal(mode);
  }
  async function openPicAction(item, editMode = false) {
    markRead(item.id);
    setPicEditMode(editMode); setShowPicHistory(false); setShowNoteField(false); setPicPhotos([]);
    setShowSolutionField(!!item.jalanKeluar || handlingStatus(item) === 'Selesai');
    setShowNextPlanField(!!item.penangananSelanjutnya);
    setWorkflowItem(item);
    setWorkflow({ picId: item.picId || '', tenggat: item.tenggat || '', statusPenanganan: handlingStatus(item) === 'Baru' ? 'Menunggu' : handlingStatus(item), jalanKeluar: item.jalanKeluar || '', penangananSelanjutnya: item.penangananSelanjutnya || '', status: item.status || '', catatan: '' });
    openModal('picAction');
    const version = ++picDetailVersion.current;
    setPicHistory([]); setPicDetailError(''); setPicDetailLoading(true);
    try {
      const result = await apiRequest(`/api/komplain?id=${encodeURIComponent(item.id)}`);
      if (version === picDetailVersion.current) {
        setWorkflowItem(result.data);
        setShowSolutionField((previous) => previous || !!result.data.jalanKeluar);
        setShowNextPlanField((previous) => previous || !!result.data.penangananSelanjutnya);
        setWorkflow((previous) => ({ ...previous, statusPenanganan: handlingStatus(result.data) === 'Baru' ? 'Menunggu' : handlingStatus(result.data), jalanKeluar: result.data.jalanKeluar || '', penangananSelanjutnya: result.data.penangananSelanjutnya || '', status: result.data.status || '' }));
        setPicHistory(result.history || []);
      }
    } catch (error) { if (version === picDetailVersion.current) { setPicDetailError(error.message); if (error.code === 401) endSession(); } }
    finally { if (version === picDetailVersion.current) setPicDetailLoading(false); }
  }
  async function mutate(action) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError('');
    let payload;
    const toPhotoPayload = (photos) => photos.map((photo) => ({ base64: photo.base64, mimeType: photo.mimeType, filename: photo.filename }));
    if (action === 'save') payload = { action: editItem ? 'update' : 'create', ...(editItem ? { id: editItem.id, version: editItem.version } : { requestId: draftRequestId.current }), ...form, photos: toPhotoPayload(formPhotos) };
    else payload = { action, id: workflowItem.id, version: workflowItem.version, ...workflow, ...(action === 'followUp' ? { photos: toPhotoPayload(picPhotos) } : {}) };
    const wasSelfAssign = action === 'assign' && modal === 'selfAssign';
    let result;
    try {
      result = await apiRequest('/api/komplain', postJson(payload));
    } catch (error) {
      mutationLock.current = false; setBusy(false);
      if (error.code === 401) endSession(); else setActionError(error.message);
      return;
    }
    mutationLock.current = false; setBusy(false);
    if (action === 'save') { setFormPhotos([]); if (!editItem) clearDraft(draftStorage(), user.id); } else if (action === 'followUp') setPicPhotos([]);
    void fetchData({ updatedId: result.data?.id || workflowItem?.id });
    if (wasSelfAssign) {
      setTab('table');
      await openPicAction(result.data || workflowItem, true);
      return;
    }
    setSuccessText({ save: editItem ? 'Perubahan laporan disimpan.' : 'Laporan terkirim. Pantau tindak lanjut di daftar laporan.', delete: 'Laporan diarsipkan. Data dan riwayat tetap tersimpan di sheet.', assign: 'Penanggung jawab dan tenggat diperbarui.', followUp: 'Tindak lanjut berhasil disimpan.', reopen: 'Laporan dibuka kembali.' }[action]);
    setModal(null); setTab('table');
    setSavedReportId(action === 'delete' ? null : result.data?.id || workflowItem?.id || null);
  }
  async function logout() {
    if (loggingOut || busy) return;
    setLoggingOut(true);
    try { await apiRequest('/api/auth/logout', postJson({})); endSession('Anda sudah keluar.'); }
    catch (error) { if (error.code === 401) endSession('Anda sudah keluar.'); else { endSession('Cookie lokal sudah dihapus. Tutup perangkat bersama setelah selesai.'); setAuthError(error.message); } }
    finally { setLoggingOut(false); }
  }
  const renderFormField = ([name, label, type]) => name === 'tindakan' ? <div key={name} className="sm:col-span-2"><label htmlFor="komplain-tindakan" className="mb-2 block text-sm font-medium">{label}<span aria-hidden="true"> *</span></label><select id="komplain-tindakan" required value={customTindakan ? 'Lainnya' : form.tindakan} onChange={(event) => { const next = event.target.value; if (next === 'Lainnya') { setCustomTindakan(true); setForm({ ...form, tindakan: '' }); } else { setCustomTindakan(false); setForm({ ...form, tindakan: next }); } }} className={inputClass}><option value="" disabled>Pilih tindakan…</option>{TINDAKAN_PRESETS.map((option) => <option key={option} value={option}>{option}</option>)}<option value="Lainnya">Tindakan lainnya…</option></select>{customTindakan && <input id="komplain-tindakan-lainnya" aria-label="Tindakan lainnya" type="text" placeholder="Ketik tindakan lainnya…" autoComplete="off" required maxLength={500} value={form.tindakan} onChange={(event) => setForm({ ...form, tindakan: event.target.value })} className={`${inputClass} mt-2`} />}</div> : <div key={name} className={type === 'textarea' ? 'sm:col-span-2' : ''}><label id={`komplain-${name}-label`} htmlFor={`komplain-${name}`} className="mb-2 flex items-center gap-1.5 text-sm font-medium">{label}{!OPTIONAL_FIELDS.includes(name) && <span aria-hidden="true"> *</span>}<FieldInfo text={FIELD_HINTS[name]} /></label>{type === 'textarea' ? <><VisualTextEditor ref={(el) => { textareaRefs.current[name] = el; }} id={`komplain-${name}`} name={name} required={!OPTIONAL_FIELDS.includes(name)} maxLength={5000} rows={3} placeholder={name === 'komplain' ? 'Ceritakan apa yang terjadi dan dampaknya…' : name === 'penangananSelanjutnya' ? 'Rencana tindak lanjut ke depan, jika ada…' : 'Tuliskan penanganan awal jika sudah ada…'} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={`${inputClass} min-h-24`} /></> : <input id={`komplain-${name}`} name={name} type={type} placeholder={name === 'tanggal' ? undefined : name === 'rumahSakit' ? 'Contoh: RS Harapan' : name === 'dokter' ? 'Nama dokter terkait' : name === 'tindakan' ? 'Contoh: TKR Zimmer/Normmed' : 'Nama team pelapor'} autoComplete="off" required={!OPTIONAL_FIELDS.includes(name)} maxLength={name === 'tindakan' ? 500 : 200} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={inputClass} />}</div>;
  const titles = { form: editItem ? 'Edit laporan komplain' : 'Buat laporan komplain', review: 'Tinjau laporan', delete: 'Arsipkan laporan?', assign: 'Tentukan penanggung jawab', selfAssign: 'Ambil laporan sebagai PIC', picAction: 'Detail & Tindak Lanjut', reopen: 'Buka kembali laporan' };
  const descriptions = { form: 'Isi kolom bertanda *. Solusi awal boleh dikosongkan.', review: 'Pastikan informasi sudah benar sebelum disimpan.', delete: 'Laporan disembunyikan dari daftar aktif. Data dan riwayat tetap tersimpan.', assign: 'Pilih petugas (PIC) aktif untuk menangani kasus ini, lalu tentukan tenggat.', selfAssign: 'Anda akan menjadi penanggung jawab dan dapat langsung melakukan tindak lanjut.', picAction: 'Tinjau informasi lengkap laporan, lalu catat perkembangan penanganan dan rencana lanjutan.', reopen: 'Jelaskan mengapa masalah masih membutuhkan penanganan.' };
  const header = <Navbar user={user} tab={tab} setTab={setTab} loading={loading} busy={busy} loggingOut={loggingOut} onRefresh={fetchData} onLogout={logout} newButtonRef={newButton} masterButtonRef={masterButton} unreadItems={unreadItems} formatDate={formatDate} onOpenNotification={(item) => { markRead(item.id); setTab('table'); setPendingDetailId(item.id); }} onMarkAllRead={() => markAllRead(unreadItems.map((item) => item.id))} />;

  return <main lang="id" data-role={user?.role || 'pelapor'} className="komplain-theme min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:p-8"><div className="mx-auto max-w-7xl space-y-6">{header}<InstallApp role={user?.role} />
    {authChecking ? <LoadingState title="Menyiapkan Komplainer…" description="Memeriksa sesi dan hak akses Anda." /> : !user ? <LoginPanel onLogin={(next) => { setUser(next); setAuthError(''); setAuthNotice(''); }} initialError={authError} notice={authNotice} /> : ['pending', 'rejected'].includes(user.approval) ? <ApprovalPanel user={user} onApproved={setUser} onExpired={endSession} /> : user.mustChangePassword ? <PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /> : tab === 'account' ? <div className="space-y-6"><ProfilePanel user={user} onChanged={endSession} onExpired={endSession} /><PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /></div> : tab === 'users' && user.role === 'admin' ? <AccountsPanel currentUser={user} onExpired={endSession} /> : <>
      {successText && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-800/50 bg-slate-900 p-3 text-sm text-emerald-200"><p className="min-w-0 flex-1">{successText}</p>{savedReportId && <button onClick={() => { setTab('table'); setPendingDetailId(savedReportId); }} className={`${buttonClass} text-blue-300`}>Lihat laporan</button>}<button aria-label="Tutup pesan berhasil" onClick={() => setSuccessText('')} className={`${buttonClass} px-3`}><X aria-hidden="true" className="h-4 w-4" /></button></div>}
      {loadError && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"><p className="font-semibold">Laporan gagal dimuat</p><p className="mt-1 break-words">{loadError}</p>{loaded && <p className="mt-1">Menampilkan data terakhir yang berhasil dimuat.</p>}<button disabled={loading} onClick={fetchData} className={`${buttonClass} mt-3 bg-slate-800`}>Coba lagi</button></div>}
      {loading && <LoadingState compact={loaded} title={loaded ? 'Memperbarui laporan…' : 'Memuat laporan Anda…'} description={loaded ? 'Data terbaru sedang diambil.' : 'Menyiapkan daftar laporan dan rekap mingguan.'} />}
      {tab === 'form' ? <HomePanel list={list} user={user} loaded={loaded} busy={busy} today={today()} formatDate={formatDate} onCreate={() => openForm()} onOpen={(item) => { markRead(item.id); setTab('table'); setPendingDetailId(item.id); }} onReports={() => setTab('table')} onRecap={() => setTab('recap')} onUsers={() => setTab('users')} onAssign={(item) => openWorkflow('assign', item)} onFollowUp={(item) => openPicAction(item, true)} /> : <DataView key={tab} initialView={tab === 'recap' ? 'weekly' : 'table'} list={list} loaded={loaded} loading={loading} loadError={loadError} busy={busy} user={user} levels={LEVELS} Badge={Badge} formatDate={formatDate} today={today} onCreate={() => openForm()} onEdit={openForm} onDelete={(item) => openWorkflow('delete', item)} onAssign={(item) => openWorkflow('assign', item)} onSelfAssign={(item) => openWorkflow('selfAssign', item)} onOpenPicAction={openPicAction} onReopen={(item) => openWorkflow('reopen', item)} onExpired={endSession} onMarkRead={markRead} pendingDetailId={pendingDetailId} onPendingDetailHandled={() => setPendingDetailId(null)} />}
    </>}
  </div>
  {loggingOut && <div className="mx-auto mt-6 max-w-md"><LoadingState compact title="Keluar dari akun…" description="Mengakhiri sesi Anda dengan aman." /></div>}
  <Dialog.Root open={modal !== null && !!user} onOpenChange={(open) => { if (!open && !busy) setModal(null); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} style={dialogStyle} onCloseAutoFocus={(event) => { event.preventDefault(); const target = modalReturnFocus.current; (target?.isConnected ? target : tab === 'table' ? masterButton.current : newButton.current)?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()} className={`${mobileDialog} ${modal === 'picAction' ? 'max-w-2xl' : 'max-w-xl'} ${['assign', 'selfAssign', 'reopen', 'picAction', 'delete'].includes(modal) && severityAccent(workflowItem?.status) ? `border-l-4 ${severityAccent(workflowItem?.status)}` : ''}`}><div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">{titles[modal]}</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{descriptions[modal]}</Dialog.Description><Dialog.Close disabled={busy} aria-label="Tutup dialog" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    {busy && <div className="mt-5"><LoadingState title={modal === 'delete' ? 'Mengarsipkan laporan…' : 'Menyimpan perubahan…'} description="Tunggu hingga konfirmasi muncul. Jangan tutup halaman." /></div>}
    <div aria-busy={busy} hidden={busy} className={dialogBody} data-dialog-scroll>
    {actionError && <p role="alert" className="mt-4 break-words rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{actionError}</p>}
    {modal === 'form' && <form onSubmit={review} className="mt-4 space-y-4"><p className="text-xs text-slate-400">{draftRestored ? 'Draft sebelumnya dipulihkan. ' : ''}Isian teks tersimpan otomatis di perangkat ini. Foto perlu dipilih ulang setelah halaman dimuat ulang.</p>{draftRestored && !editItem && <button type="button" onClick={() => { clearDraft(draftStorage(), user.id); draftRequestId.current = crypto.randomUUID(); setForm({ ...newForm(), team: user.unit }); setFormPhotos([]); setCustomTindakan(false); setShowFormExtras(false); setDraftRestored(false); }} className={`${buttonClass} text-slate-300`}>Hapus draft & mulai baru</button>}
      <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-3"><button type="button" onClick={() => setShowExample((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-blue-200"><span className="flex items-center gap-2"><Lightbulb aria-hidden="true" className="h-4 w-4 shrink-0" />Lihat contoh pengisian</span><span className="text-xs text-blue-300">{showExample ? 'Sembunyikan' : 'Tampilkan'}</span></button>
        {showExample && <dl className="mt-3 space-y-2 border-t border-blue-900/60 pt-3">{fields.map(([name, label]) => <div key={name}><dt className="text-xs text-blue-300">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{name === 'tanggal' ? formatDate(fieldExamples[name]) : fieldExamples[name]}</dd></div>)}</dl>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{fields.filter(([name]) => !OPTIONAL_FIELDS.includes(name)).map(renderFormField)}</div>
      <details open={showFormExtras} onToggle={(event) => setShowFormExtras(event.currentTarget.open)} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3"><summary className="cursor-pointer py-2 text-sm font-semibold text-blue-300">Tambahkan informasi (opsional)</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{fields.filter(([name]) => OPTIONAL_FIELDS.includes(name)).map(renderFormField)}<div id="komplain-photo-input" className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Foto (opsional)</p><PhotoPicker photos={formPhotos} onAdd={addFormPhoto} onRemove={removeFormPhoto} existingUrls={editItem?.fotoUrls || []} /></div></div></details>
      <fieldset><legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">Kondisi kasus *<FieldInfo text="Apakah kasus ini berjalan sukses atau ada kendala? Tingkat keparahan akan ditentukan oleh PIC saat meninjau laporan." /></legend><div className="grid gap-2 min-[380px]:grid-cols-2">{STATUS_CASE.map((option) => <label key={option.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${form.statusCase === option.code ? option.color : 'border-slate-700 text-slate-300'}`}><input type="radio" name="statusCase" value={option.code} checked={form.statusCase === option.code} required onChange={(event) => setForm({ ...form, statusCase: event.target.value })} className="h-4 w-4 accent-blue-500" />{option.label}</label>)}</div></fieldset><div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button className={`${buttonClass} flex-1 bg-blue-600`}>Tinjau laporan</button></div></form>}
    {modal === 'review' && <div className="mt-5 space-y-4"><ReviewChecklist form={form} photoCount={formPhotos.length + (editItem?.fotoUrls?.length || 0)} onComplete={(target) => { optionalFocus.current = target; setShowFormExtras(true); setModal('form'); setActionError(''); }} /><dl className="space-y-3">{fields.map(([name, label, type]) => <div key={name}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 text-sm leading-6">{name === 'tanggal' ? formatDate(form[name]) : form[name] ? (type === 'textarea' ? <FormattedText text={form[name]} /> : <span className="whitespace-pre-wrap break-words">{form[name]}</span>) : (name === 'rumahSakit' ? 'Belum diisi' : name === 'penangananSelanjutnya' ? 'Belum ada rencana lanjutan' : 'Belum ada solusi awal')}</dd></div>)}</dl><StatusCaseBadge statusCase={form.statusCase} />{(formPhotos.length > 0 || (editItem?.fotoUrls?.length || 0) > 0) && <div><p className="mb-2 text-sm text-slate-400">Foto ({formPhotos.length + (editItem?.fotoUrls?.length || 0)})</p><PhotoGallery urls={[...(editItem?.fotoUrls || []), ...formPhotos.map((photo) => photo.previewUrl)]} label="Foto laporan" thumbClassName="h-16 w-16" /></div>}<div className={formFooter}><button disabled={busy} onClick={() => { setModal('form'); setActionError(''); }} className={`${buttonClass} flex-1 bg-slate-800`}>Ubah lagi</button><button disabled={busy} onClick={() => mutate('save')} className={`${buttonClass} flex-1 bg-emerald-700`}>{busy ? 'Menyimpan…' : editItem ? 'Simpan perubahan' : 'Kirim laporan'}</button></div></div>}
    {['assign', 'selfAssign', 'reopen'].includes(modal) && <form onSubmit={(event) => { event.preventDefault(); mutate(modal === 'selfAssign' ? 'assign' : modal); }} className="mt-5 space-y-4"><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p><div className="flex flex-wrap gap-2"><WorkflowBadge status={handlingStatus(workflowItem || {})} /><SimpleStatusBadge item={workflowItem || {}} /><AlertBadge item={workflowItem || {}} /></div>
      {modal === 'selfAssign' && <p className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-3 text-sm text-violet-200">Anda akan ditugaskan sebagai PIC untuk laporan ini dan dapat langsung mencatat tindak lanjut.</p>}
      {modal === 'assign' && <div><label htmlFor="workflow-pic" className="mb-2 block text-sm">Penanggung jawab / PIC</label><select id="workflow-pic" value={workflow.picId} onChange={(event) => setWorkflow({ ...workflow, picId: event.target.value })} className={inputClass}><option value="">Belum ditugaskan</option>{assignees.map((pic) => <option key={pic.id} value={pic.id}>{pic.nama} · {ROLE_LABELS[pic.role]} · {pic.unit}</option>)}</select>{assignees.length === 0 && <p className="mt-2 text-xs text-amber-300">Tambahkan akun Petugas (PIC) aktif melalui menu Pengguna terlebih dahulu.</p>}</div>}
      {['assign', 'selfAssign'].includes(modal) && <div><label htmlFor="workflow-deadline" className="mb-2 block text-sm">Tenggat (opsional)</label><input id="workflow-deadline" type="date" value={workflow.tenggat} onChange={(event) => setWorkflow({ ...workflow, tenggat: event.target.value })} className={inputClass} /></div>}
      <div><label id="workflow-note-label" htmlFor="workflow-note" className="mb-2 block text-sm">{modal === 'reopen' ? 'Alasan membuka kembali *' : 'Catatan penugasan (opsional)'}</label><VisualTextEditor ref={(el) => { textareaRefs.current.workflowNote = el; }} id="workflow-note" placeholder="Tuliskan perkembangan atau alasan perubahan…" rows={3} maxLength={2000} required={!['assign', 'selfAssign'].includes(modal)} value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} /></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>}
    {modal === 'picAction' && (() => { const lastNote = picHistory.find((entry) => entry.catatan); return <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><StatusCaseBadge statusCase={workflowItem?.statusCase} /><Badge status={workflowItem?.status} /><WorkflowBadge status={handlingStatus(workflowItem || {})} /><AlertBadge item={workflowItem || {}} /><ImplantBadge item={workflowItem || {}} /></div><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p></div>
      {picDetailLoading && <LoadingState compact title="Memuat detail laporan…" description="Mengambil informasi lengkap laporan ini." />}
      {picDetailError && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{picDetailError}</p>}
      {!picEditMode ? <>
        {!workflowItem?.picId && <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/15 p-3"><div className="flex items-start gap-2"><UserRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><p className="text-sm font-semibold text-amber-200">Belum ada PIC</p><p className="mt-0.5 text-xs leading-5 text-amber-100/80">Tentukan penanggung jawab terlebih dahulu — tindak lanjut tidak dapat disimpan sebelum laporan ini punya PIC.</p></div></div><button type="button" onClick={() => openWorkflow(user.role === 'petugas' ? 'selfAssign' : 'assign', workflowItem)} className={`${buttonClass} mt-3 w-full bg-amber-600 hover:bg-amber-500`}><UserRound aria-hidden="true" className="h-4 w-4" />{user.role === 'petugas' ? 'Jadi PIC sekarang' : 'Tentukan PIC sekarang'}</button></div>}
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-800/30 p-4">{[['Tanggal', formatDate(workflowItem?.tanggal)], ['Pelapor', workflowItem?.pelaporNama || 'Data lama'], ['PIC', workflowItem?.picId ? workflowItem.picNama : 'Belum ditugaskan'], ['Dokter', workflowItem?.dokter], ['Team Pelapor', workflowItem?.team], ['Rumah Sakit', workflowItem?.rumahSakit || 'Belum diisi'], ['Tindakan', workflowItem?.tindakan], ['Tenggat', workflowItem?.tenggat ? formatDate(workflowItem.tenggat) : 'Belum ditentukan']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className={`mt-1 flex items-center gap-1.5 break-words text-sm font-medium ${label === 'PIC' && !workflowItem?.picId ? 'text-slate-400' : ''}`}>{value || '—'}{label === 'PIC' && workflowItem?.picId && workflowItem?.picRole && <RoleBadge role={workflowItem.picRole} pic />}</dd></div>)}</dl>
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3"><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Masalah{workflowItem?.komplain && workflowItem?.pelaporRole && <RoleBadge role={workflowItem.pelaporRole} />}</h3>{workflowItem?.komplain ? <FormattedText text={workflowItem.komplain} className="mt-2 text-sm leading-6 text-slate-200" /> : <p className="mt-2 text-sm leading-6 text-slate-200">—</p>}</div>
        {workflowItem?.jalanKeluar && <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3"><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{handlingStatus(workflowItem) === 'Baru' ? 'Solusi awal' : 'Penyelesaian tindak lanjut'}{handlingStatus(workflowItem) === 'Baru' ? (workflowItem?.pelaporRole && <RoleBadge role={workflowItem.pelaporRole} />) : (workflowItem?.picRole && <RoleBadge role={workflowItem.picRole} pic />)}</h3><FormattedText text={workflowItem.jalanKeluar} className="mt-2 text-sm leading-6 text-emerald-100" /></div>}
        {workflowItem?.penangananSelanjutnya && <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-3"><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">RTL{handlingStatus(workflowItem) === 'Baru' ? (workflowItem?.pelaporRole && <RoleBadge role={workflowItem.pelaporRole} />) : (workflowItem?.picRole && <RoleBadge role={workflowItem.picRole} pic />)}</h3><FormattedText text={workflowItem.penangananSelanjutnya} className="mt-2 text-sm leading-6 text-violet-100" /></div>}
        {workflowItem?.fotoUrls?.length > 0 && <div><p className="mb-2 text-sm font-semibold">Foto laporan ({workflowItem.fotoUrls.length})</p><PhotoGallery urls={workflowItem.fotoUrls} label="Foto laporan" /></div>}
        <div className="border-t border-slate-800 pt-4">
          <button type="button" onClick={() => setShowPicHistory((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-slate-200">Riwayat tindak lanjut {picHistory.length > 0 && `(${picHistory.length})`}<span className="text-xs text-blue-300">{showPicHistory ? 'Sembunyikan' : 'Tampilkan'}</span></button>
          {showPicHistory && <>{!picDetailLoading && !picDetailError && !picHistory.length && <p className="mt-3 text-sm text-slate-400">Belum ada riwayat.</p>}<ol className="mt-3 space-y-3">{picHistory.map((entry) => { const changes = historyChanges(entry.detail); const fields = editedFieldLabels(entry.detail); return <li key={entry.id} className="border-l-2 border-blue-800 pl-3"><p className="text-sm font-semibold">{entry.aksi}</p><p className="mt-0.5 break-words text-xs text-slate-400">{entry.nama} · {new Date(entry.tanggal).toLocaleString('id-ID')}</p>{fields.length > 0 && <p className="mt-1 text-xs text-slate-400">Diubah: {fields.join(', ')}</p>}{changes.length > 0 && <ul className="mt-1 space-y-0.5">{changes.map((change) => <li key={change.key} className="text-xs text-amber-300">{formatHistoryChange(change, LEVELS, formatDate)}</li>)}</ul>}{entry.catatan && <FormattedText text={entry.catatan} className={`mt-1.5 ${historyNote}`} />}{entry.fotoUrls?.length > 0 && <div className="mt-1.5"><PhotoGallery urls={entry.fotoUrls} label="Foto tindak lanjut" thumbClassName="h-16 w-16" /></div>}</li>; })}</ol></>}
        </div>
        <div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close><button type="button" disabled={!workflowItem?.picId} title={workflowItem?.picId ? undefined : 'Tentukan PIC terlebih dahulu'} onClick={() => setPicEditMode(true)} className={`${buttonClass} flex-1 bg-blue-600`}>Tindak Lanjuti</button></div>
      </> : <>
        <button type="button" onClick={() => setPicEditMode(false)} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline">← Kembali ke detail</button>
        <form onSubmit={(event) => { event.preventDefault(); mutate('followUp'); }} className="space-y-4 border-t border-slate-800 pt-4">
          <h3 className="font-semibold">Tindak lanjut</h3>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3"><div><p className="text-sm font-medium">Tandai laporan ini selesai</p><p className="mt-0.5 text-xs text-slate-400">{workflow.statusPenanganan === 'Selesai' ? 'Status akan disimpan sebagai Selesai.' : 'Status akan disimpan sebagai Menunggu.'}</p></div><label className="relative inline-flex h-[44px] w-12 shrink-0 cursor-pointer items-center"><input type="checkbox" aria-label="Tandai laporan selesai" className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" checked={workflow.statusPenanganan === 'Selesai'} onChange={(event) => { const checked = event.target.checked; setWorkflow({ ...workflow, statusPenanganan: checked ? 'Selesai' : 'Menunggu' }); if (checked) setShowSolutionField(true); }} /><span className="h-7 w-12 rounded-full bg-slate-700 transition peer-checked:bg-emerald-600" /><span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" /></label></div>
          {showSolutionField ? <div><label id="pic-solution-label" htmlFor="pic-solution" className="mb-2 block text-sm">Penyelesaian tindak lanjut {workflow.statusPenanganan === 'Selesai' ? '*' : '(opsional)'}</label><VisualTextEditor ref={(el) => { textareaRefs.current.picSolution = el; }} id="pic-solution" placeholder="Jelaskan solusi dan hasil penanganannya…" rows={2} maxLength={5000} required={workflow.statusPenanganan === 'Selesai'} value={workflow.jalanKeluar} onChange={(event) => setWorkflow({ ...workflow, jalanKeluar: event.target.value })} className={inputClass} /></div> : <button type="button" onClick={() => setShowSolutionField(true)} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline"><PlusCircle aria-hidden="true" className="h-4 w-4" />Tambah penyelesaian tindak lanjut</button>}
          {lastNote && <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/15 p-3"><p className="text-xs font-semibold text-amber-200">Komentar terakhir Anda · {new Date(lastNote.tanggal).toLocaleString('id-ID')}</p><FormattedText text={lastNote.catatan} className="mt-1 text-sm leading-6 text-amber-50" /></div>}
          {showNextPlanField ? <div><label id="pic-next-label" htmlFor="pic-next" className="mb-2 block text-sm">RTL (opsional)</label><VisualTextEditor ref={(el) => { textareaRefs.current.picNext = el; }} id="pic-next" placeholder="Rencana tindak lanjut ke depan, jika ada…" rows={2} maxLength={5000} value={workflow.penangananSelanjutnya} onChange={(event) => setWorkflow({ ...workflow, penangananSelanjutnya: event.target.value })} className={inputClass} /></div> : <button type="button" onClick={() => setShowNextPlanField(true)} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline"><PlusCircle aria-hidden="true" className="h-4 w-4" />Tambah RTL</button>}
          <div><label htmlFor="pic-status" className="mb-2 block text-sm">Tingkat keparahan (opsional)</label><select id="pic-status" value={workflow.status || ''} onChange={(event) => setWorkflow({ ...workflow, status: event.target.value })} className={inputClass}><option value="">Belum ditentukan</option>{LEVELS.map((level) => <option key={level.code} value={level.code}>{level.label}</option>)}</select></div>
          {showNoteField ? <div><label id="pic-note-label" htmlFor="pic-note" className="mb-2 block text-sm">Catatan tindak lanjut (opsional)</label><VisualTextEditor ref={(el) => { textareaRefs.current.picNote = el; }} id="pic-note" placeholder="Tuliskan perkembangan penanganan…" rows={2} maxLength={2000} value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} /></div> : <button type="button" onClick={() => setShowNoteField(true)} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline"><PlusCircle aria-hidden="true" className="h-4 w-4" />Tambah catatan tindak lanjut</button>}
          <div><label className="mb-2 block text-sm">Foto bukti penanganan (opsional)</label><PhotoPicker photos={picPhotos} onAdd={addPicPhoto} onRemove={removePicPhoto} totalExisting={(workflowItem?.fotoUrls?.length || 0) + picHistory.reduce((sum, entry) => sum + (entry.fotoUrls?.length || 0), 0)} /></div>
          <div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy || picDetailLoading || !!picDetailError} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan tindak lanjut'}</button></div>
        </form>
      </>}
    </div>; })()}
    {modal === 'delete' && <div className="mt-5 space-y-5"><div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4"><AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-red-400" /><p className="break-words text-sm leading-6">Laporan <strong>{workflowItem?.dokter}</strong> · {formatDate(workflowItem?.tanggal)}</p></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} onClick={() => mutate('delete')} className={`${buttonClass} flex-1 bg-red-700`}>{busy ? 'Mengarsipkan…' : 'Arsipkan laporan'}</button></div></div>}

    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={criticalNotice.length > 0 && modal === null} onOpenChange={(open) => { if (!open) setCriticalNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="flex items-center gap-2 pr-12 text-xl font-bold text-red-300"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />Kasus ada kendala belum ada PIC</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{criticalNotice.length > 1 ? `${criticalNotice.length} laporan berstatus Ada Kendala` : '1 laporan berstatus Ada Kendala'} belum ditugaskan penanggung jawab. Segera tentukan PIC.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{criticalNotice.map((item) => <div key={item.id} role="button" tabIndex={0} onClick={() => { markRead(item.id); setCriticalNotice([]); setTab('table'); setPendingDetailId(item.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); markRead(item.id); setCriticalNotice([]); setTab('table'); setPendingDetailId(item.id); } }} className="cursor-pointer rounded-xl border border-red-900/50 bg-red-950/20 p-3 transition hover:bg-red-950/30"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words text-sm font-semibold">{item.dokter} · {item.tindakan}</p><StatusCaseBadge statusCase={item.statusCase} /></div><p className="mt-1 break-words text-sm text-slate-300">Dilaporkan oleh <strong>{item.pelaporNama || 'Pengguna'}</strong> · {formatDate(item.tanggal)}</p><span className="mt-1 inline-block text-xs font-semibold text-blue-300">Lihat detail laporan →</span><button onClick={(event) => { event.stopPropagation(); setCriticalNotice((queue) => queue.filter((entry) => entry.id !== item.id)); openWorkflow(user?.role === 'petugas' ? 'selfAssign' : 'assign', item); }} className={`${buttonClass} mt-2 w-full bg-red-700 hover:bg-red-600`}><UserRound aria-hidden="true" className="h-4 w-4" />{user?.role === 'petugas' ? 'Jadi PIC sekarang' : 'Tentukan PIC sekarang'}</button></div>)}
      <Dialog.Close className={`${buttonClass} w-full bg-slate-800`}>Tutup untuk sekarang</Dialog.Close>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={assignedNotice.length > 0 && criticalNotice.length === 0 && modal === null} onOpenChange={(open) => { if (!open) setAssignedNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Laporan Anda sudah ditangani</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Penanggung jawab (PIC) baru ditentukan untuk {assignedNotice.length > 1 ? `${assignedNotice.length} laporan Anda` : 'laporan Anda'}.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{assignedNotice.map((item) => <button key={item.id} type="button" onClick={() => { setAssignedNotice([]); setTab('table'); setPendingDetailId(item.id); }} className="w-full rounded-xl border border-violet-900/50 bg-violet-950/20 p-3 text-left transition hover:bg-violet-950/40"><p className="flex items-center gap-1.5 text-sm font-semibold"><UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-300" />{item.dokter} · {item.tindakan}</p><p className="mt-1 break-words text-sm text-slate-300">Ditangani oleh <strong>{item.picNama}</strong>{item.tenggat ? ` · Tenggat ${formatDate(item.tenggat)}` : ''}</p>{item.jalanKeluar && <p className={`mt-1 break-words text-xs ${picResponseBubble}`}><span className="font-semibold">{handlingStatus(item) === 'Baru' ? 'Solusi awal:' : 'Respons PIC:'}</span> <InlineText text={item.jalanKeluar} /></p>}<span className="mt-2 inline-block text-xs font-semibold text-blue-300">Lihat detail laporan →</span></button>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} w-full bg-slate-800`}>Tutup</Dialog.Close></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={incomingNotice.length > 0 && assignedNotice.length === 0 && criticalNotice.length === 0 && modal === null} onOpenChange={(open) => { if (!open) setIncomingNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Laporan baru masuk</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{incomingNotice.length > 1 ? `${incomingNotice.length} laporan baru` : '1 laporan baru'} sejak terakhir Anda membuka halaman ini.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{incomingNotice.map((item) => <button key={item.id} type="button" onClick={() => { markRead(item.id); setIncomingNotice([]); setTab('table'); setPendingDetailId(item.id); }} className="w-full rounded-xl border border-blue-900/50 bg-blue-950/20 p-3 text-left transition hover:bg-blue-950/40"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-sm font-semibold"><Inbox aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-300" />{item.dokter} · {item.tindakan}</p><StatusCaseBadge statusCase={item.statusCase} /></div><p className="mt-1 break-words text-sm text-slate-300">Dilaporkan oleh <strong>{item.pelaporNama || 'Pengguna'}</strong> · {formatDate(item.tanggal)}</p><span className="mt-2 inline-block text-xs font-semibold text-blue-300">Lihat detail laporan →</span></button>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close><button onClick={() => { setIncomingNotice([]); setTab('table'); }} className={`${buttonClass} flex-1 bg-blue-600`}>Lihat semua laporan</button></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  </main>;
}
