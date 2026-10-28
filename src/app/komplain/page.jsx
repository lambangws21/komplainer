'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle, UserRound, Inbox, CheckCircle2, AtSign, ExternalLink, Trash2, LoaderCircle, PlusCircle } from 'lucide-react';
import HomePanel from './home-panel';
import KanbanBoard, { kanbanDropAction } from './kanban-board';
import SchedulePanel from './schedule-panel';
import ReportForm from './report-form';
import { readDraft, writeDraft, clearDraft } from './report-draft.mjs';
import './theme.css';
import { useDialogViewport } from './use-dialog-viewport';
import { mobileDialog, formFooter, dialogHeader, dialogBody, historyNote, picResponseBubble, buttonClass, inputClass } from './ui-styles.mjs';
import { fields, OPTIONAL_FIELDS, TINDAKAN_PRESETS } from './report-form-fields.mjs';
import LoadingState from './loading-state';
import InstallApp from './install-app';
import PushPrompt from './push-prompt';
import Navbar from './navbar';
import AnnouncementBanner from './announcement-banner';
import { LoginPanel, PasswordPanel, ProfilePanel, ApprovalPanel } from './auth-panel';
import WorkflowBadge from './workflow-badge';
import SimpleStatusBadge from './simple-status-badge';
import AlertBadge from './alert-badge';
import ImplantBadge from './implant-badge';
import RoleBadge from './role-badge';
import PhotoPicker from './photo-picker';
import LocationSearch from './location-search';
import PhotoGallery from './photo-gallery';
import VisualTextEditor from './visual-text-editor';
import FormattedText, { InlineText } from './formatted-text';
import { textToEditorDoc, editorPlainText } from './editor-format.mjs';
import StatusCaseBadge from './status-case-badge';
import FieldInfo from './field-info';
import FeatureTour from './feature-tour';
import AuthShell from './auth-shell';
import SeverityInfo from './severity-info';
import ShareButton from './share-button';
import ShareImageButton from './share-image-button';
import { initialSolution, handlingSolution, handlingDraft, mergeEditable } from './report-process.mjs';
import { ANNOUNCEMENT_AUDIENCES, announcementAudience } from '@/lib/announcement-policy.mjs';
import { apiRequest, postJson } from './api-client.mjs';
import { ROLE_LABELS, STATUS_CASE, WORKFLOW_STATUSES, handlingStatus, canEditReport, historyChanges, formatHistoryChange, editedFieldLabels } from './workflow.mjs';
import { loadReadIds, saveReadIds } from './read-tracking.mjs';
import { playNotificationChime } from './notification-sound.mjs';

// Code-split tabs/panels that aren't needed on first paint (login screen, or admin-only tabs)
// so the initial bundle a logged-out visitor downloads stays small.
function panelLoading(title) {
  function PanelLoading() { return <LoadingState compact title={title} />; }
  return PanelLoading;
}
const DataView = dynamic(() => import('./data-view'), { loading: panelLoading('Memuat tampilan laporan…') });
const AccountsPanel = dynamic(() => import('./accounts-panel'), { loading: panelLoading('Memuat panel pengguna…') });
const BackupPanel = dynamic(() => import('./backup-panel'), { loading: panelLoading('Memuat panel backup…') });
const BackupSheetPanel = dynamic(() => import('./backup-sheet-panel'), { loading: panelLoading('Memuat data Google Sheet…') });
const AnnouncementPanel = dynamic(() => import('./announcement-panel'), { loading: panelLoading('Memuat panel pengumuman…') });
const AdminSidebar = dynamic(() => import('./admin-sidebar'));

const LEVELS = [
  { code: 'C1 - Critical', label: 'C1 Critical', color: 'text-red-300 border-red-800 bg-red-950/40', accent: 'border-l-red-600', description: 'Berdampak langsung ke keselamatan pasien atau operasi terhenti. Butuh penanganan segera.' },
  { code: 'C2 - Major', label: 'C2 Major', color: 'text-orange-300 border-orange-800 bg-orange-950/40', accent: 'border-l-orange-500', description: 'Mengganggu jalannya operasi/jadwal secara signifikan, belum sampai membahayakan pasien.' },
  { code: 'C3 - Moderate', label: 'C3 Moderate', color: 'text-amber-300 border-amber-800 bg-amber-950/40', accent: 'border-l-amber-500', description: 'Kendala operasional sedang, dapat diatasi namun tetap perlu tindak lanjut.' },
  { code: 'C4 - Minor', label: 'C4 Minor', color: 'text-emerald-300 border-emerald-800 bg-emerald-950/40', accent: 'border-l-emerald-500', description: 'Dampak kecil/administratif, dapat ditangani dengan penanganan rutin.' },
];
const SEVERITY_DOT = { 'C1 - Critical': 'bg-red-400', 'C2 - Major': 'bg-orange-400', 'C3 - Moderate': 'bg-amber-400', 'C4 - Minor': 'bg-emerald-400' };
const SEVERITY_ACTIVE = { 'C1 - Critical': 'border-red-600 bg-red-600 text-white', 'C2 - Major': 'border-orange-600 bg-orange-600 text-white', 'C3 - Moderate': 'border-amber-600 bg-amber-600 text-white', 'C4 - Minor': 'border-emerald-600 bg-emerald-600 text-white' };
// Colors the modal's left edge to match the case's severity, when one has been set by the PIC.
function severityAccent(status) {
  return LEVELS.find((level) => level.code === status)?.accent || '';
}
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const draftStorage = () => { try { return window.localStorage; } catch { return null; } };
const toPhotoPayload = (photos) => photos.map((photo) => ({ base64: photo.base64, mimeType: photo.mimeType, filename: photo.filename }));
const mapsSearchUrl = (location, lat, lng) => `https://www.google.com/maps/search/?api=1&query=${typeof lat === 'number' && typeof lng === 'number' ? `${lat},${lng}` : encodeURIComponent(location)}`;
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
  const [mentionables, setMentionables] = useState([]);
  // Suggestions only (a <datalist>, not a <select>) — Team Pelapor still accepts free text, but
  // typing offers registered names first so people pick a consistent one instead of a typo'd one.
  const teamNameSuggestions = useMemo(() => [...new Set([user?.nama, ...mentionables.map((account) => account.nama)].filter(Boolean))], [user?.nama, mentionables]);
  const [mentionNotice, setMentionNotice] = useState([]);
  const mentionSeenRef = useRef(new Set());
  const [reactionNotice, setReactionNotice] = useState([]);
  const reactionSeenRef = useRef(new Set());
  const [announcementNotice, setAnnouncementNotice] = useState([]);
  const [announcementBannerOpen, setAnnouncementBannerOpen] = useState(true);
  const announcementReadRef = useRef(new Set());
  const announcementSeenRef = useRef(new Set());
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', durationDays: '7', audience: 'all', priority: 'info', recipientIds: [] });
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementDismissing, setAnnouncementDismissing] = useState(null);
  const announcementDismissLock = useRef(false);
  const [announcementRefresh, setAnnouncementRefresh] = useState(0);
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
  const [savedConfirm, setSavedConfirm] = useState(null);
  const [showExample, setShowExample] = useState(false);
  const [picEditMode, setPicEditMode] = useState(false);
  // True when the status was already decided by a desktop Kanban drag (the dialog was opened via
  // kanbanDropAction with a targetStatus) — the picker then stays hidden since re-picking what
  // was just dragged would be redundant. Mobile never drags, so it never sets this.
  const [picStatusLocked, setPicStatusLocked] = useState(false);
  const [showPicHistory, setShowPicHistory] = useState(false);
  const [showFormExtras, setShowFormExtras] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [customTindakan, setCustomTindakan] = useState(false);
  const [formPhotos, setFormPhotos] = useState([]);
  const [picPhotos, setPicPhotos] = useState([]);
  const [schedulePhotos, setSchedulePhotos] = useState([]);
  const photoPreviewUrls = useRef(new Set());
  useEffect(() => {
    const current = new Set([...formPhotos, ...picPhotos, ...schedulePhotos].map((photo) => photo.previewUrl).filter(Boolean));
    for (const url of photoPreviewUrls.current) if (!current.has(url)) URL.revokeObjectURL(url);
    photoPreviewUrls.current = current;
  }, [formPhotos, picPhotos, schedulePhotos]);
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
  const addSchedulePhoto = (photo) => setSchedulePhotos((previous) => [...previous, photo]);
  const removeSchedulePhoto = (id) => setSchedulePhotos((previous) => previous.filter((photo) => photo.id !== id));
  const [picHistory, setPicHistory] = useState([]);
  const [picDetailLoading, setPicDetailLoading] = useState(false);
  const [picDetailError, setPicDetailError] = useState('');
  const [mutationConflict, setMutationConflict] = useState(null);
  const [fieldConflicts, setFieldConflicts] = useState([]);
  const [picSaved, setPicSaved] = useState('');
  const [reviewExpanded, setReviewExpanded] = useState(true);
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
    requestVersion.current += 1; picDetailVersion.current += 1;
    previousListRef.current = null;
    setUser(null); setList([]); setAssignees([]); setLoaded(false); setLoading(false);
    setModal(null); setEditItem(null); setWorkflowItem(null); setForm(newForm()); setFormPhotos([]); setPicPhotos([]);
    setAssignedNotice([]); setIncomingNotice([]); setCriticalNotice([]); criticalSeenRef.current = new Set(); setReadIds(new Set());
    setMentionables([]); setMentionNotice([]); mentionSeenRef.current = new Set(); setReactionNotice([]); reactionSeenRef.current = new Set(); setAnnouncementNotice([]); setAnnouncementError(''); setAnnouncementDismissing(null); announcementSeenRef.current = new Set(); announcementReadRef.current = new Set(); setAnnouncementBannerOpen(true);
    setSuccessText(''); setSavedReportId(null); setSavedConfirm(null); setTab('form'); setLoadError(''); setAuthError(''); setAuthNotice(notice);
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
  // Mirrors the two badges already shown in the navbar (bell + megaphone) onto the PWA/home-screen
  // icon (Badging API) and the browser tab title — so the count is visible even when this tab
  // isn't focused, not just inside the open dropdown.
  const totalBadgeCount = unreadItems.length + announcementNotice.length;
  useEffect(() => {
    try { if (totalBadgeCount > 0) navigator.setAppBadge?.(totalBadgeCount); else navigator.clearAppBadge?.(); } catch { /* Badging API unsupported or blocked — no-op */ }
    const baseTitle = 'Laporan Komplain';
    document.title = totalBadgeCount > 0 ? `(${totalBadgeCount > 99 ? '99+' : totalBadgeCount}) ${baseTitle}` : baseTitle;
    return () => { document.title = baseTitle; };
  }, [totalBadgeCount]);
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
            // A brand-new report that's already "Ada Kendala" with no PIC also qualifies for the
            // critical-notice queue below — skip it here so it doesn't pop up in both "Laporan baru
            // masuk" and "Kasus ada kendala belum ada PIC" (dismissing one used to immediately
            // surface the other for the exact same report, reading as stacked modals).
            const alreadyCritical = item.statusCase === 'Ada Kendala' && !item.picId && handlingStatus(item) !== 'Selesai';
            if (!prevItem && item.pelaporId !== activeUser.id && ['admin', 'petugas'].includes(activeUser.role) && !alreadyCritical) newlyArrived.push(item);
          }
          if (newlyAssigned.length) setAssignedNotice((queue) => [...queue, ...newlyAssigned]);
          if (newlyArrived.length) setIncomingNotice((queue) => [...queue, ...newlyArrived]);
          if (newlyAssigned.length || newlyArrived.length) playNotificationChime();
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
            return [...kept, ...newCritical.filter((item) => !keptIds.has(item.id))];
          });
          if (newCritical.length) playNotificationChime();
        }
        previousListRef.current = result.data;
        setList(result.data); setAssignees(result.assignees || []); setLoaded(true);
      }
    } catch (error) {
      if (version === requestVersion.current) { if (error.code === 401) endSession(); else if (!silent) setLoadError(error.message); }
    } finally { if (version === requestVersion.current && !silent) setLoading(false); }
  }, [endSession]);
  const fetchNotices = useCallback(async () => {
    const accountId = userRef.current?.id;
    if (!accountId) return;
    const [mentions, announcements, reactions] = await Promise.allSettled([apiRequest('/api/mentions'), apiRequest('/api/announcements'), apiRequest('/api/reactions')]);
    if (userRef.current?.id !== accountId) return;
    if ([mentions, announcements, reactions].some((result) => result.status === 'rejected' && result.reason.code === 401)) { endSession(); return; }
    if (mentions.status === 'fulfilled') {
      const items = mentions.value.data || [];
      if (items.some((item) => !mentionSeenRef.current.has(item.id))) playNotificationChime();
      mentionSeenRef.current = new Set(items.map((item) => item.id));
      setMentionNotice(items);
    }
    if (announcements.status === 'fulfilled') {
      const activeAnnouncements = (announcements.value.data || []).filter((item) => !announcementReadRef.current.has(item.id));
      if (activeAnnouncements.some((item) => !announcementSeenRef.current.has(item.id))) { setAnnouncementBannerOpen(true); playNotificationChime(); }
      announcementSeenRef.current = new Set(activeAnnouncements.map((item) => item.id));
      setAnnouncementNotice(activeAnnouncements);
    }
    if (reactions.status === 'fulfilled') {
      const items = reactions.value.data || [];
      if (items.some((item) => !reactionSeenRef.current.has(item.id))) playNotificationChime();
      reactionSeenRef.current = new Set(items.map((item) => item.id));
      setReactionNotice(items);
    }
  }, [endSession]);
  useEffect(() => {
    if (user?.id && user.approval !== 'pending' && user.approval !== 'rejected' && !user.mustChangePassword) { fetchData(); fetchNotices(); apiRequest('/api/mentionables').then((result) => setMentionables(result.data || [])).catch(() => {}); }
  }, [user?.id, user?.approval, user?.mustChangePassword, fetchData, fetchNotices]);
  const sessionActive = !!user?.id && user.approval !== 'pending' && user.approval !== 'rejected' && !user.mustChangePassword;
  // Opens the report a shared WhatsApp/Telegram link points at (see share-report.mjs) — same
  // path a notification click already uses, so access control is identical (no report content
  // leaks into the URL itself, just an id the viewer must already be allowed to read).
  useEffect(() => {
    if (!sessionActive) return;
    const id = new URLSearchParams(window.location.search).get('report');
    if (!id) return;
    setTab('table'); setPendingDetailId(id);
    const url = new URL(window.location.href); url.searchParams.delete('report');
    window.history.replaceState({}, '', url);
  }, [sessionActive]);
  // First-login feature tour. Tracked per account in localStorage (not account metadata) —
  // it's a lightweight device-local nicety, not worth a server round-trip; worst case a user
  // sees it again once on a new device, which is harmless.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!sessionActive) return;
    try { if (!localStorage.getItem(`komplain-tour-seen:${user.id}`)) setTourOpen(true); } catch { /* localStorage unavailable (private mode) */ }
  }, [sessionActive, user?.id]);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    try { if (user?.id) localStorage.setItem(`komplain-tour-seen:${user.id}`, '1'); } catch { /* localStorage unavailable */ }
  }, [user?.id]);
  // SWR gives the Beranda its own cached, independently-revalidated fetch (stat counts + a
  // small page of the latest reports) instead of waiting on/recomputing from the full list the
  // Table/Recap tabs need — scoped by user id so a logout/login in the same tab can't show a
  // stale cached summary from the previous account.
  const { data: summaryData, error: summaryError, isLoading: summaryLoading, mutate: mutateSummary } = useSWR(
    sessionActive ? ['/api/komplain/summary', user.id] : null,
    ([url]) => apiRequest(url),
    { refreshInterval: 60000, revalidateOnFocus: true },
  );
  useEffect(() => { if (summaryError?.code === 401) endSession(); }, [summaryError, endSession]);
  const [extraLatest, setExtraLatest] = useState([]);
  const [latestCursor, setLatestCursor] = useState(null);
  const [loadingMoreLatest, setLoadingMoreLatest] = useState(false);
  useEffect(() => { setExtraLatest([]); setLatestCursor(summaryData?.latest?.nextCursor ?? null); }, [summaryData]);
  const loadMoreLatest = useCallback(async () => {
    if (latestCursor == null || loadingMoreLatest) return;
    setLoadingMoreLatest(true);
    try {
      const result = await apiRequest(`/api/komplain/summary?cursor=${latestCursor}&limit=5`);
      setExtraLatest((previous) => [...previous, ...result.latest.items]);
      setLatestCursor(result.latest.nextCursor);
    } catch (error) { if (error.code === 401) endSession(); }
    finally { setLoadingMoreLatest(false); }
  }, [latestCursor, loadingMoreLatest, endSession]);
  const homeSummary = useMemo(() => !summaryData ? null : { ...summaryData, latest: { ...summaryData.latest, items: [...summaryData.latest.items, ...extraLatest] } }, [summaryData, extraLatest]);
  // Jadwal & Agenda: its own SWR-cached fetch, same pattern as the summary above. A non-401
  // error (e.g. 503 when the backend isn't Firestore) is treated as "no schedules" rather than
  // surfaced as a blocking error — the panel just shows its empty state.
  // Admin-only while in development (server-side enforced too) — skip the fetch entirely for
  // other roles instead of letting every page load hit a guaranteed 403.
  const { data: scheduleData, error: scheduleError, isLoading: schedulesLoadingRaw, mutate: mutateScheduleList } = useSWR(
    sessionActive && user.role === 'admin' ? ['/api/schedules', user.id] : null,
    ([url]) => apiRequest(url),
    { refreshInterval: 60000, revalidateOnFocus: true },
  );
  useEffect(() => { if (scheduleError?.code === 401) endSession(); }, [scheduleError, endSession]);
  const schedulesLoading = schedulesLoadingRaw && !scheduleError;
  const upcomingSchedules = useMemo(() => {
    if (scheduleError) return [];
    if (!scheduleData?.data) return null;
    const todayStr = today();
    return [...scheduleData.data].filter((item) => item.date >= todayStr).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 5);
  }, [scheduleData, scheduleError]);
  const [scheduleForm, setScheduleForm] = useState(null);
  function openSchedule(seed = {}) {
    setScheduleForm({ id: seed.id || '', reportId: seed.reportId || '', title: seed.title || '', location: seed.location || '', locationLat: seed.locationLat ?? null, locationLng: seed.locationLng ?? null, date: seed.date || today(), startTime: seed.startTime || '', endTime: seed.endTime || '', picId: seed.picId || (user.role !== 'admin' ? user.id : ''), notes: seed.notes || '', fotoUrls: seed.fotoUrls || [] });
    setSchedulePhotos([]);
    openModal('schedule');
  }
  const onCreateSchedule = () => openSchedule();
  const onEditSchedule = (item) => openSchedule(item);
  const onScheduleReport = (item) => openSchedule({ reportId: item.id, title: `Follow-up Komplain ${item.dokter || ''} (${item.rumahSakit || ''})`.trim(), location: item.rumahSakit || '', picId: item.picId || user.id });
  async function mutateSchedule(action) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError('');
    try {
      await apiRequest('/api/schedules', postJson(action === 'delete' ? { action, id: scheduleForm.id } : { action, ...scheduleForm, photos: toPhotoPayload(schedulePhotos) }));
      mutationLock.current = false; setBusy(false);
      setSchedulePhotos([]); setModal(null); mutateScheduleList();
    } catch (error) {
      mutationLock.current = false; setBusy(false);
      if (error.code === 401) endSession(); else setActionError(error.message);
    }
  }
  useEffect(() => {
    if (!user?.id || user.approval === 'pending' || user.approval === 'rejected' || user.mustChangePassword) return undefined;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') { fetchData({ silent: true }); fetchNotices(); } }, 60000);
    return () => clearInterval(interval);
  }, [user?.id, user?.approval, user?.mustChangePassword, fetchData, fetchNotices]);

  function openModal(next) { picDetailVersion.current += 1; setPicDetailLoading(false); modalReturnFocus.current = document.activeElement; setActionError(''); setMutationConflict(null); setFieldConflicts([]); setPicSaved(''); setModal(next); }
  function openForm(item) {
    setEditItem(item || null);
    const draft = item ? null : readDraft(draftStorage(), user.id);
    if (!item) draftRequestId.current = draft?.requestId || crypto.randomUUID();
    const next = item ? { ...newForm(), ...Object.fromEntries(Object.keys(newForm()).map((key) => [key, String(item[key] ?? '')])), jalanKeluar: initialSolution(item), tanggal: String(item.tanggal || '').slice(0, 10), statusCase: item.statusCase || newForm().statusCase } : { ...newForm(), team: user.unit, ...draft?.form };
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
    setForm(trimmed); setActionError(''); setReviewExpanded(!window.matchMedia('(min-width: 1024px)').matches); setModal('review');
  }
  function openWorkflow(mode, item) {
    setWorkflowItem(item);
    setWorkflow({ picId: mode === 'selfAssign' ? user.id : item.picId || '', tenggat: item.tenggat || '', statusPenanganan: handlingStatus(item) === 'Baru' ? 'Menunggu' : handlingStatus(item), jalanKeluar: item.jalanKeluar || '', penangananSelanjutnya: item.penangananSelanjutnya || '', catatan: '' });
    openModal(mode);
  }
  // "Hapus permanen" (admin-only, inside the archive dialog) is only offered once this exact
  // report version has a confirmed-done backup job — checked fresh each time the dialog opens
  // rather than trusted from any cached state, since a report can be edited (new version) between
  // visits.
  const [purgeState, setPurgeState] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  useEffect(() => {
    if (modal !== 'delete' || !workflowItem || user?.role !== 'admin') return undefined;
    let alive = true;
    setPurgeState('loading'); setConfirmPurge(false);
    apiRequest(`/api/backup?reportId=${encodeURIComponent(workflowItem.id)}&version=${workflowItem.version}`)
      .then((result) => { if (alive) setPurgeState(result.data.state || 'none'); })
      .catch((error) => { if (!alive) return; setPurgeState('none'); if (error.code === 401) endSession(); });
    return () => { alive = false; };
  }, [modal, workflowItem, user?.role, endSession]);
  const picHistoryLoadedId = useRef(null);
  // The list item already carries everything the detail view and the handling form need
  // (content, status, photos) — only the audit history still requires its own request, so
  // that request is deferred until history is actually shown instead of firing on every open.
  async function loadPicHistory(item) {
    if (!item || picHistoryLoadedId.current === item.id) return;
    picHistoryLoadedId.current = item.id;
    const version = ++picDetailVersion.current;
    setPicDetailError(''); setPicDetailLoading(true);
    try {
      const result = await apiRequest(`/api/komplain?id=${encodeURIComponent(item.id)}`);
      if (version === picDetailVersion.current) {
        setPicHistory(result.history || []);
      }
    } catch (error) { if (version === picDetailVersion.current) { setPicDetailError(error.message); picHistoryLoadedId.current = null; if (error.code === 401) endSession(); } }
    finally { if (version === picDetailVersion.current) setPicDetailLoading(false); }
  }
  function openPicAction(item, editMode = false, presetStatus = null) {
    markRead(item.id);
    const enterEdit = editMode && handlingStatus(item) !== 'Selesai';
    const draft = handlingDraft(item);
    const locked = enterEdit && ['Diproses', 'Menunggu', 'Selesai'].includes(presetStatus) && presetStatus !== handlingStatus(item);
    if (locked) draft.statusPenanganan = presetStatus;
    setPicStatusLocked(locked);
    setPicEditMode(enterEdit); setShowPicHistory(false); setPicPhotos([]);
    setWorkflowItem(item);
    setWorkflow(draft);
    openModal('picAction');
    picHistoryLoadedId.current = null; setPicHistory([]); setPicDetailError('');
    if (enterEdit) loadPicHistory(item);
  }
  // Every mutation response already carries the full updated report, so the list can be
  // patched in place instead of re-fetching everything — the existing 60s poll still
  // catches other users' concurrent changes, this just avoids a redundant round trip here.
  function applyMutationResult(item) {
    if (!item) return;
    setList((previous) => {
      const exists = previous.some((entry) => entry.id === item.id);
      const next = item.deletedAt ? previous.filter((entry) => entry.id !== item.id) : exists ? previous.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...previous];
      previousListRef.current = next;
      return next;
    });
    criticalSeenRef.current.delete(item.id);
    const stillCritical = !item.deletedAt && item.statusCase === 'Ada Kendala' && !item.picId && handlingStatus(item) !== 'Selesai';
    if (!stillCritical) setCriticalNotice((queue) => queue.filter((entry) => entry.id !== item.id));
    mutateSummary();
  }
  // The detail dialog's own local `detail` state isn't derived from `list`, so the caller needs
  // the fresh report back to update what's actually on screen — patching `list` here just keeps
  // the table in sync for whenever that dialog closes.
  async function react(id, version, type) {
    try {
      const result = await apiRequest('/api/komplain', postJson({ action: 'react', id, version, type }));
      applyMutationResult(result.data);
      return result.data;
    } catch (error) { if (error.code === 401) endSession(); throw error; }
  }
  // DataView owns the selection UI and confirmation dialog; this just runs the API call and
  // reconciles whichever ids actually succeeded (the server validates each item independently —
  // one being mid-edit or missing its backup doesn't block the rest).
  async function bulkPurge(items) {
    try {
      const result = await apiRequest('/api/komplain', postJson({ action: 'bulkPurge', items }));
      const purgedIds = new Set(result.results.filter((entry) => entry.status === 'ok').map((entry) => entry.id));
      if (purgedIds.size) {
        setList((previous) => { const next = previous.filter((entry) => !purgedIds.has(entry.id)); previousListRef.current = next; return next; });
        mutateSummary();
      }
      return result.results;
    } catch (error) { if (error.code === 401) endSession(); throw error; }
  }
  async function mutate(action, workflowOverride = {}, target = workflowItem, selfAssign = false) {
    if (mutationLock.current) return;
    if (action === 'followUp' && (!target.picId || target.statusPenanganan === 'Selesai' || user.role !== 'admin' && target.picId !== user.id)) { setActionError('Penugasan atau status laporan sudah berubah. Periksa detail terbaru sebelum melanjutkan.'); return; }
    const accountId = userRef.current?.id;
    mutationLock.current = true; picDetailVersion.current += 1; setPicDetailLoading(false); setBusy(true); setActionError(''); setPicSaved('');
    let payload;
    if (action === 'save') payload = { action: editItem ? 'update' : 'create', ...(editItem ? { id: editItem.id, version: editItem.version } : { requestId: draftRequestId.current }), ...form, photos: toPhotoPayload(formPhotos) };
    else payload = { action, id: target.id, version: target.version, ...(selfAssign ? {} : workflow), ...workflowOverride, ...(action === 'followUp' ? { photos: toPhotoPayload(picPhotos) } : {}) };
    const wasSelfAssign = action === 'assign' && (selfAssign || modal === 'selfAssign');
    let result;
    try {
      result = await apiRequest('/api/komplain', postJson(payload));
    } catch (error) {
      mutationLock.current = false; setBusy(false);
      if (error.code === 401) endSession(); else { setActionError(error.message); if (error.code === 409 && (action !== 'save' || editItem)) setMutationConflict({ action, id: action === 'save' ? editItem?.id : target.id }); }
      return;
    }
    mutationLock.current = false; setBusy(false);
    if (userRef.current?.id !== accountId) return;
    if (action === 'save') { setFormPhotos([]); if (!editItem) clearDraft(draftStorage(), user.id); } else if (action === 'followUp') setPicPhotos([]);
    applyMutationResult(result.data);
    if (wasSelfAssign) {
      setTab('table');
      openPicAction(result.data || target, true);
      return;
    }
    setMutationConflict(null); setFieldConflicts([]);
    if (action === 'followUp' && result.data && result.data.statusPenanganan !== 'Selesai') {
      setWorkflowItem(result.data); setWorkflow(handlingDraft(result.data)); setPicHistory([]); picHistoryLoadedId.current = null;
      setPicSaved(result.data.statusPenanganan === 'Menunggu' ? 'RTL tersimpan. Status: Menunggu.' : 'RTL tersimpan. Status: Diproses.');
      setSavedConfirm({ item: result.data, message: result.data.statusPenanganan === 'Menunggu' ? 'RTL tersimpan. Status: Menunggu.' : 'RTL tersimpan. Status: Diproses.' });
      return;
    }
    // Creating a new report, finishing a PIC follow-up, or assigning a PIC (most often triggered
    // from a Kanban drag) is the moment worth a clear "it's saved" confirmation — distinct enough
    // from the muted inline banner that a user dragging a card on Kanban actually notices it,
    // and closes the assign/selfAssign dialog on the way in. Other mutations (delete/reopen/purge)
    // stay on the lighter inline banner instead of interrupting with a modal.
    if (action === 'followUp' || (action === 'save' && !editItem) || action === 'assign') {
      setSavedConfirm({ item: result.data, message: action === 'followUp' ? 'Tindak lanjut selesai dicatat.' : action === 'assign' ? 'Penanggung jawab (PIC) berhasil disimpan.' : 'Laporan terkirim. Pantau tindak lanjut di daftar laporan.' });
    } else {
      setSuccessText({ save: 'Perubahan laporan disimpan.', delete: 'Laporan diarsipkan. Data dan riwayat tetap tersimpan di sheet.', reopen: 'Laporan dibuka kembali.', purge: 'Laporan dihapus permanen dari sistem.' }[action]);
      setSavedReportId(['delete', 'purge'].includes(action) ? null : result.data?.id || workflowItem?.id || null);
    }
    setModal(null); setTab('table');
  }
  async function takeReport(item) {
    if (mutationLock.current) return;
    setWorkflowItem(item);
    await mutate('assign', { picId: user.id, tenggat: item.tenggat || '', catatan: '' }, item, true);
  }
  async function reloadConflict() {
    if (!mutationConflict || mutationLock.current) return;
    mutationLock.current = true; setBusy(true);
    const pending = mutationConflict;
    const accountId = userRef.current?.id;
    try {
      const result = await apiRequest(`/api/komplain?id=${encodeURIComponent(pending.id)}`);
      if (userRef.current?.id !== accountId) return;
      const latest = result.data;
      if (pending.action === 'save') {
        const editable = (item) => ({ ...Object.fromEntries(Object.keys(form).map((key) => [key, String(item[key] ?? '')])), tanggal: String(item.tanggal || '').slice(0, 10), jalanKeluar: initialSolution(item) });
        const merged = mergeEditable(editable(editItem), form, editable(latest));
        setForm(merged.merged); setFieldConflicts(merged.conflicts); setEditItem(latest);
      } else {
        const merged = mergeEditable(handlingDraft(workflowItem), workflow, handlingDraft(latest));
        setWorkflow(merged.merged); setFieldConflicts(merged.conflicts); setWorkflowItem(latest);
        setPicHistory(result.history || []); picHistoryLoadedId.current = latest.id;
      }
      applyMutationResult(latest); setMutationConflict(null);
      setActionError('Data terbaru dimuat. Isian yang Anda ubah dan foto pilihan tetap dipertahankan. Periksa sebelum menyimpan kembali.');
    } catch (error) { if (error.code === 401) endSession(); else setActionError(error.message); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  function openAnnouncement() {
    setAnnouncementForm({ title: '', body: '', durationDays: '7', audience: 'all', priority: 'info', recipientIds: [] });
    openModal('announcement');
  }
  async function publishAnnouncement(event) {
    event.preventDefault();
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError('');
    try {
      await apiRequest('/api/announcements', postJson({ action: 'create', title: announcementForm.title, body: announcementForm.body, durationDays: announcementForm.durationDays ? Number(announcementForm.durationDays) : null, audience: announcementForm.audience, priority: announcementForm.priority, recipientIds: announcementForm.recipientIds }));
      mutationLock.current = false; setBusy(false);
      setSuccessText(`Pengumuman diterbitkan untuk ${ANNOUNCEMENT_AUDIENCES[announcementForm.audience].toLowerCase()}.`); void fetchNotices();
      setModal(null); setSavedReportId(null); setAnnouncementRefresh((value) => value + 1);
    } catch (error) {
      mutationLock.current = false; setBusy(false);
      if (error.code === 401) endSession(); else setActionError(error.message);
    }
  }
  async function dismissMention(item) {
    setMentionNotice((queue) => queue.filter((entry) => entry.id !== item.id));
    try { await apiRequest('/api/mentions', postJson({ action: 'read', id: item.id })); } catch { /* Will reappear on next poll if the dismiss failed to save. */ }
  }
  async function dismissReactionNotice(item) {
    setReactionNotice((queue) => queue.filter((entry) => entry.id !== item.id));
    try { await apiRequest('/api/reactions', postJson({ action: 'read', id: item.id })); } catch { /* Will reappear on next poll if the dismiss failed to save. */ }
  }
  async function dismissAnnouncement(item) {
    if (announcementDismissLock.current) return;
    announcementDismissLock.current = true;
    const accountId = userRef.current?.id;
    setAnnouncementDismissing(item.id); setAnnouncementError('');
    try {
      await apiRequest('/api/announcements', postJson({ action: 'dismiss', id: item.id }));
      if (userRef.current?.id === accountId) { announcementReadRef.current.add(item.id); setAnnouncementNotice((queue) => queue.filter((entry) => entry.id !== item.id)); }
    } catch (error) {
      if (userRef.current?.id === accountId) { if (error.code === 401) endSession(); else setAnnouncementError('Belum berhasil menandai dibaca. Silakan coba lagi.'); }
    } finally { announcementDismissLock.current = false; setAnnouncementDismissing(null); }
  }
  async function logout() {
    if (loggingOut || busy) return;
    setLoggingOut(true);
    try { await apiRequest('/api/auth/logout', postJson({})); endSession('Anda sudah keluar.'); }
    catch (error) { if (error.code === 401) endSession('Anda sudah keluar.'); else { endSession('Cookie lokal sudah dihapus. Tutup perangkat bersama setelah selesai.'); setAuthError(error.message); } }
    finally { setLoggingOut(false); }
  }
  const titles = { form: editItem ? 'Edit laporan komplain' : 'Buat laporan komplain', review: 'Tinjau laporan', delete: 'Arsipkan laporan?', assign: 'Tentukan penanggung jawab', selfAssign: 'Ambil laporan sebagai PIC', picAction: picEditMode ? 'Tangani komplain' : 'Detail & Tindak Lanjut', reopen: 'Buka kembali laporan', announcement: 'Buat pengumuman', announcementView: 'Pengumuman', schedule: scheduleForm?.id ? 'Ubah jadwal' : 'Jadwalkan acara' };
  const descriptions = { form: 'Isi kolom bertanda *. Solusi awal boleh dikosongkan.', review: 'Pastikan informasi sudah benar sebelum disimpan.', delete: 'Laporan akan disembunyikan dan tidak lagi muncul di aplikasi — ini BUKAN hapus permanen. Data dan riwayat tetap tersimpan di sistem untuk keperluan audit, tapi tidak dapat Anda pulihkan sendiri dari aplikasi.', assign: 'Pilih PIC aktif untuk menangani komplain ini.', selfAssign: 'Anda akan menjadi penanggung jawab dan dapat langsung melakukan tindak lanjut.', picAction: picEditMode ? 'Pilih status penanganan, tulis catatan, lalu Simpan Pembaruan.' : 'Laporan masuk → Ambil sebagai PIC → RTL → Penyelesaian → Selesai.', reopen: 'Jelaskan mengapa masalah masih membutuhkan penanganan.', announcement: 'Pilih penerima, jenis, dan masa tampil. Pengumuman muncul tanpa menghalangi pekerjaan.', announcementView: announcementNotice.length > 1 ? `${announcementNotice.length} pengumuman aktif.` : '', schedule: 'Jadwal tersimpan di aplikasi dan otomatis masuk ke kalender yang Anda subscribe (lihat tile Google Calendar di Beranda).' };
  // Not signed in yet (or still checking) gets a standalone centered auth page, not the full app
  // shell — there's no sidebar/tabs/notifications to show before a session exists.
  const showAuthShell = authChecking || !user;
  const header = showAuthShell ? null : <Navbar user={user} tab={tab} setTab={setTab} loading={loading} busy={busy} loggingOut={loggingOut} onRefresh={fetchData} onLogout={logout} onExpired={endSession} newButtonRef={newButton} masterButtonRef={masterButton} unreadItems={unreadItems} formatDate={formatDate} onOpenNotification={(item) => { markRead(item.id); setTab('table'); setPendingDetailId(item.id); }} onMarkAllRead={() => markAllRead(unreadItems.map((item) => item.id))} reactionNotice={reactionNotice} onOpenReactionNotice={(item) => { dismissReactionNotice(item); setTab('table'); setPendingDetailId(item.reportId); }} onMarkAllReactionsRead={() => reactionNotice.forEach(dismissReactionNotice)} announcementCount={announcementNotice.length} onToggleAnnouncements={() => openModal('announcementView')} onOpenTour={() => setTourOpen(true)} reportCount={loaded ? list.length : null} />;
  // The sidebar only makes sense once the admin is actually inside the app — not while a session
  // is still being checked, or while a pending/rejected/forced-password-change screen is showing.
  const showAdminSidebar = !!user && user.role === 'admin' && !['pending', 'rejected'].includes(user.approval) && !user.mustChangePassword;
  // Petugas gets the same wide desktop canvas as admin (their Kanban board and stat cards benefit
  // from the extra room) without the admin-only sidebar/tabs that come with showAdminSidebar.
  const wideLayout = showAdminSidebar || (!!user && user.role === 'petugas' && !['pending', 'rejected'].includes(user.approval) && !user.mustChangePassword);
  const mainContent = authChecking ? <AuthShell><LoadingState title="Menyiapkan Komplainer…" description="Memeriksa sesi dan hak akses Anda." /></AuthShell> : !user ? <AuthShell><LoginPanel onLogin={(next) => { setUser(next); setAuthError(''); setAuthNotice(''); }} initialError={authError} notice={authNotice} /></AuthShell> : ['pending', 'rejected'].includes(user.approval) ? <ApprovalPanel user={user} onApproved={setUser} onExpired={endSession} /> : user.mustChangePassword ? <PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /> : tab === 'account' ? <div className="space-y-6"><ProfilePanel user={user} onChanged={endSession} onExpired={endSession} /><PasswordPanel user={user} onChanged={endSession} onExpired={endSession} /></div> : tab === 'users' && user.role === 'admin' ? <AccountsPanel currentUser={user} onExpired={endSession} reports={list} /> : tab === 'announcements' && user.role === 'admin' ? <AnnouncementPanel key={announcementRefresh} onCreate={openAnnouncement} onChanged={fetchNotices} /> : tab === 'backup' && user.role === 'admin' ? <div className="space-y-6"><BackupPanel /><BackupSheetPanel /></div> : <>
      {successText && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-800/50 bg-slate-900 p-3 text-sm text-emerald-200"><p className="min-w-0 flex-1">{successText}</p>{savedReportId && <button onClick={() => { setTab('table'); setPendingDetailId(savedReportId); }} className={`${buttonClass} text-blue-300`}>Lihat laporan</button>}{savedReportId && list.find((item) => item.id === savedReportId) && <ShareButton item={list.find((item) => item.id === savedReportId)} formatDate={formatDate} className={`${buttonClass} text-blue-300`} />}<button aria-label="Tutup pesan berhasil" onClick={() => setSuccessText('')} className={`${buttonClass} px-3`}><X aria-hidden="true" className="h-4 w-4" /></button></div>}
      {loadError && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"><p className="font-semibold">Laporan gagal dimuat</p><p className="mt-1 break-words">{loadError}</p>{loaded && <p className="mt-1">Menampilkan data terakhir yang berhasil dimuat.</p>}<button disabled={loading} onClick={fetchData} className={`${buttonClass} mt-3 bg-slate-800`}>Coba lagi</button></div>}
      {loading && <LoadingState compact={loaded} title={loaded ? 'Memperbarui laporan…' : 'Memuat laporan Anda…'} description={loaded ? 'Data terbaru sedang diambil.' : 'Menyiapkan daftar laporan dan rekap mingguan.'} />}
      {tab === 'form' ? <HomePanel summary={homeSummary} summaryLoading={summaryLoading} hasMoreLatest={latestCursor != null} loadingMoreLatest={loadingMoreLatest} onLoadMoreLatest={loadMoreLatest} schedules={upcomingSchedules} schedulesLoading={schedulesLoading} onScheduleReport={onScheduleReport} onCreateSchedule={onCreateSchedule} onEditSchedule={onEditSchedule} onExpired={endSession} user={user} busy={busy} list={list} Badge={Badge} formatDate={formatDate} onCreate={() => openForm()} onOpen={(item) => { markRead(item.id); setTab('table'); setPendingDetailId(item.id); }} onReports={() => setTab('table')} onRecap={() => setTab('recap')} onUsers={() => setTab('users')} onAnnouncement={openAnnouncement} onAssign={(item) => openWorkflow('assign', item)} onFollowUp={(item) => openPicAction(item, true)} onOpenPicAction={openPicAction} onReopen={(item) => openWorkflow('reopen', item)} onTakeReport={takeReport} onReact={react} onDelete={(item) => openWorkflow('delete', item)} />
      // Mobile-only destinations (see navbar.jsx) — desktop keeps Kanban/Jadwal inline on Beranda,
      // these pills hide themselves at lg+ there, so this branch is unreachable on desktop anyway.
      : tab === 'kanban' && (user.role === 'admin' || user.role === 'petugas') ? <div data-tour="kanban-tab" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"><KanbanBoard items={list || []} mobile onOpen={(item) => { markRead(item.id); setTab('table'); setPendingDetailId(item.id); }} Badge={Badge} formatDate={formatDate} onDropAction={(item, targetStatus) => kanbanDropAction(item, user, { onAssign: (target) => openWorkflow('assign', target), onSelfAssign: takeReport, onOpenPicAction: openPicAction, onReopen: (target) => openWorkflow('reopen', target) }, targetStatus)} /></div>
      : tab === 'jadwal' && user.role === 'admin' ? <SchedulePanel schedules={upcomingSchedules} schedulesLoading={schedulesLoading} busy={busy} onCreateSchedule={onCreateSchedule} onEditSchedule={onEditSchedule} isAdmin={user.role === 'admin'} onExpired={endSession} />
      : <DataView key={tab} initialView={tab === 'recap' ? 'weekly' : 'table'} list={list} loaded={loaded} loading={loading} loadError={loadError} busy={busy} user={user} levels={LEVELS} Badge={Badge} formatDate={formatDate} today={today} onCreate={() => openForm()} onEdit={openForm} onDelete={(item) => openWorkflow('delete', item)} onAssign={(item) => openWorkflow('assign', item)} onSelfAssign={takeReport} onOpenPicAction={openPicAction} onReopen={(item) => openWorkflow('reopen', item)} onExpired={endSession} onMarkRead={markRead} pendingDetailId={pendingDetailId} onPendingDetailHandled={() => setPendingDetailId(null)} onBulkPurge={bulkPurge} onReact={react} />}
    </>;

  if (showAuthShell) return <main lang="id" data-role="pelapor" className="komplain-theme min-h-screen bg-slate-950 text-slate-100">{mainContent}</main>;

  // Priority order for the stack of blocking "something happened" popups below — each notice
  // type keeps its own list (their items and actions differ too much to usefully merge into one
  // shape), but showing at most one at a time is now a single lookup instead of a hand-maintained
  // AND-chain repeated on every Dialog (which only grew more error-prone with each new type).
  const activeNotice = [['critical', criticalNotice], ['assigned', assignedNotice], ['incoming', incomingNotice], ['mention', mentionNotice]].find(([, queue]) => queue.length > 0)?.[0] || null;

  return <main lang="id" data-role={user?.role || 'pelapor'} className="komplain-theme min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:p-8"><div className={`mx-auto space-y-6 ${wideLayout ? 'max-w-screen-2xl' : 'max-w-7xl'}`}>{header}<FeatureTour open={tourOpen} onOpenChange={(next) => { if (!next) closeTour(); }} role={user?.role} /><AnnouncementBanner user={user} dismissing={announcementDismissing} items={announcementNotice} open={announcementBannerOpen} onMinimize={() => setAnnouncementBannerOpen(false)} onDismiss={dismissAnnouncement} onOpen={() => openModal('announcementView')} />{announcementError && <p role="alert" className="text-sm text-red-300">{announcementError}</p>}<PushPrompt userId={user?.id} active={sessionActive && !tourOpen} onExpired={endSession} /><InstallApp role={user?.role} />
    {showAdminSidebar ? <div className="flex items-start gap-6"><AdminSidebar tab={tab} setTab={setTab} /><div className="min-w-0 flex-1 space-y-6">{mainContent}</div></div> : mainContent}
  </div>
  {/* Mobile-only floating shortcut into the same "Buat laporan baru" flow Beranda's header button
      already opens — desktop keeps that button as the sole entry point. Hidden while any dialog
      is open so it never competes with a modal for focus/z-index. */}
  {sessionActive && !modal && ['form', 'kanban', 'table', 'jadwal'].includes(tab) && <button type="button" onClick={() => openForm()} aria-label="Buat laporan baru" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-20 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 lg:hidden"><PlusCircle aria-hidden="true" className="h-5 w-5 shrink-0" />Buat Laporan</button>}
  {busy && modal === null && <LoadingState compact title="Mengambil laporan sebagai PIC…" description="Penugasan sedang disimpan." />}{actionError && modal === null && <div role="alert" className="mt-3 rounded-xl border border-red-800 p-3 text-sm text-red-200">{actionError}{mutationConflict && <button type="button" disabled={busy} onClick={reloadConflict} className={`${buttonClass} mt-2 block bg-blue-600`}>Muat data terbaru</button>}</div>}
  {loggingOut && <div className="mx-auto mt-6 max-w-md"><LoadingState compact title="Keluar dari akun…" description="Mengakhiri sesi Anda dengan aman." /></div>}
  <Dialog.Root open={modal !== null && !!user} onOpenChange={(open) => { if (!open && !busy) { picDetailVersion.current += 1; setPicDetailLoading(false); setModal(null); } }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} style={dialogStyle} onCloseAutoFocus={(event) => { event.preventDefault(); const target = modalReturnFocus.current; (target?.isConnected ? target : tab === 'table' ? masterButton.current : newButton.current)?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()} className={`${mobileDialog} ${['form', 'review'].includes(modal) ? `max-w-xl lg:max-w-5xl ${modal === 'form' ? 'lg:h-[min(85dvh,860px)]' : ''}` : modal === 'picAction' ? 'max-w-2xl' : 'max-w-xl'} ${['assign', 'selfAssign', 'reopen', 'picAction', 'delete'].includes(modal) && severityAccent(workflowItem?.status) ? `border-l-4 ${severityAccent(workflowItem?.status)}` : ''}`}><div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">{titles[modal]}</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{descriptions[modal]}</Dialog.Description><Dialog.Close disabled={busy} aria-label="Tutup dialog" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    {busy && <div className="mt-5"><LoadingState title={modal === 'delete' ? (confirmPurge ? 'Menghapus permanen…' : 'Mengarsipkan laporan…') : 'Menyimpan perubahan…'} description="Tunggu hingga konfirmasi muncul. Jangan tutup halaman." /></div>}
    <div aria-busy={busy} hidden={busy} className={`${dialogBody} ${modal === 'form' && !busy ? 'lg:flex lg:flex-col lg:overflow-hidden lg:px-0 lg:pb-0' : ''}`} data-dialog-scroll>
    {actionError && <p role="alert" className="mt-4 break-words rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{actionError}</p>}{mutationConflict && <button type="button" disabled={busy} onClick={reloadConflict} className={`${buttonClass} mt-3 bg-blue-600`}>Muat data terbaru — pertahankan isian</button>}{fieldConflicts.length > 0 && <section className="mt-3 rounded-xl border border-amber-700 p-3"><h3 className="text-sm font-semibold text-amber-200">Perubahan yang perlu diperiksa</h3><p className="mt-1 text-xs text-slate-300">Kolom berikut diubah oleh Anda dan pengguna lain. Isian Anda tetap berada di form.</p>{fieldConflicts.map((entry) => <div key={entry.key} className="mt-3"><p className="text-xs font-semibold">{fields.find(([key]) => key === entry.key)?.[1] || entry.key}</p><p className="mt-1 text-xs text-slate-400">Versi terbaru:</p><FormattedText text={String(entry.latest || 'Belum diisi')} className="break-words text-sm leading-6" /></div>)}</section>}
    {(modal === 'form' || modal === 'review') && <ReportForm step={modal} form={form} setForm={setForm} editItem={editItem} contentLocked={!!editItem && !canEditReport(editItem, user)} user={user} formatDate={formatDate} busy={busy}
      formPhotos={formPhotos} addFormPhoto={addFormPhoto} removeFormPhoto={removeFormPhoto}
      customTindakan={customTindakan} setCustomTindakan={setCustomTindakan} showFormExtras={showFormExtras} setShowFormExtras={setShowFormExtras} showExample={showExample} setShowExample={setShowExample}
      draftRestored={draftRestored} onDiscardDraft={() => { clearDraft(draftStorage(), user.id); draftRequestId.current = crypto.randomUUID(); setForm({ ...newForm(), team: user.unit }); setFormPhotos([]); setCustomTindakan(false); setShowFormExtras(false); setDraftRestored(false); }}
      teamNameSuggestions={teamNameSuggestions} textareaRefs={textareaRefs} mentionables={mentionables}
      onSubmit={review} onBack={() => { setModal('form'); setActionError(''); }} onSave={() => mutate('save')}
      onReviewComplete={(target) => { optionalFocus.current = target; setShowFormExtras(true); setModal('form'); setActionError(''); }}
      reviewExpanded={reviewExpanded} setReviewExpanded={setReviewExpanded} />}
    {['assign', 'selfAssign', 'reopen'].includes(modal) && <form onSubmit={(event) => { event.preventDefault(); mutate(modal === 'selfAssign' ? 'assign' : modal); }} className="mt-5 space-y-4"><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p><div className="flex flex-wrap gap-2"><WorkflowBadge status={handlingStatus(workflowItem || {})} /><SimpleStatusBadge item={workflowItem || {}} /><AlertBadge item={workflowItem || {}} /></div>
      {modal === 'selfAssign' && <p className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-3 text-sm text-violet-200">Anda akan ditugaskan sebagai PIC untuk laporan ini dan dapat langsung mencatat tindak lanjut.</p>}
      {modal !== 'selfAssign' && <>      {modal === 'assign' && <div><label htmlFor="workflow-pic" className="mb-2 block text-sm">Penanggung jawab / PIC</label><select id="workflow-pic" value={workflow.picId} onChange={(event) => setWorkflow({ ...workflow, picId: event.target.value })} className={inputClass}><option value="">Belum ditugaskan</option>{assignees.filter((pic) => pic.role === 'petugas' || pic.id === workflowItem?.pelaporId).map((pic) => <option key={pic.id} value={pic.id}>{pic.nama} · {ROLE_LABELS[pic.role]} · {pic.unit}</option>)}</select>{assignees.length === 0 && <p className="mt-2 text-xs text-amber-300">Tambahkan akun Petugas (PIC) aktif melalui menu Pengguna terlebih dahulu.</p>}</div>}
      <div><label id="workflow-note-label" htmlFor="workflow-note" className="mb-2 block text-sm">{modal === 'reopen' ? 'Alasan membuka kembali *' : 'Catatan penugasan (opsional)'}</label><VisualTextEditor ref={(el) => { textareaRefs.current.workflowNote = el; }} id="workflow-note" placeholder="Tuliskan perkembangan atau alasan perubahan… (ketik @ untuk menyebut pengguna)" rows={3} maxLength={2000} required={!['assign', 'selfAssign'].includes(modal)} value={workflow.catatan} onChange={(event) => setWorkflow({ ...workflow, catatan: event.target.value })} className={inputClass} mentionables={mentionables} /></div></>}<div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />}{busy ? 'Menyimpan…' : modal === 'selfAssign' ? 'Ambil sebagai PIC' : 'Simpan'}</button></div>
    </form>}
    {modal === 'schedule' && scheduleForm && <form onSubmit={(event) => { event.preventDefault(); mutateSchedule(scheduleForm.id ? 'update' : 'create'); }} className="mt-5 space-y-4">
      <div><label htmlFor="schedule-title" className="mb-2 block text-sm">Judul acara</label><input id="schedule-title" required maxLength={200} value={scheduleForm.title} onChange={(event) => setScheduleForm({ ...scheduleForm, title: event.target.value })} className={inputClass} /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div><label htmlFor="schedule-date" className="mb-2 block text-sm">Tanggal</label><input id="schedule-date" type="date" required value={scheduleForm.date} onChange={(event) => setScheduleForm({ ...scheduleForm, date: event.target.value })} className={inputClass} /></div>
        <div><label htmlFor="schedule-start" className="mb-2 block text-sm">Mulai</label><input id="schedule-start" type="time" required value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} className={inputClass} /></div>
        <div><label htmlFor="schedule-end" className="mb-2 block text-sm">Selesai</label><input id="schedule-end" type="time" required value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} className={inputClass} /></div>
      </div>
      <div><label htmlFor="schedule-location" className="mb-2 block text-sm">Lokasi (opsional)</label><LocationSearch id="schedule-location" placeholder="Cari RS, klinik, atau alamat…" disabled={busy} value={scheduleForm.location} onChange={(value) => setScheduleForm((previous) => ({ ...previous, location: value }))} onSelect={(picked) => setScheduleForm((previous) => ({ ...previous, locationLat: picked?.lat ?? null, locationLng: picked?.lng ?? null }))} className={inputClass} />{scheduleForm.locationLat != null && <p className="mt-1.5 text-xs text-emerald-300">Lokasi presisi dipilih dari pencarian.</p>}{scheduleForm.location.trim() && <a href={mapsSearchUrl(scheduleForm.location, scheduleForm.locationLat, scheduleForm.locationLng)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200">Buka di Google Maps<ExternalLink aria-hidden="true" className="h-3 w-3" /></a>}</div>
      {user.role === 'admin' && <div><label htmlFor="schedule-pic" className="mb-2 block text-sm">PIC (opsional)</label><select id="schedule-pic" value={scheduleForm.picId} onChange={(event) => setScheduleForm({ ...scheduleForm, picId: event.target.value })} className={inputClass}><option value="">Tidak ditentukan</option>{assignees.map((pic) => <option key={pic.id} value={pic.id}>{pic.nama} · {ROLE_LABELS[pic.role]}</option>)}</select></div>}
      <div><label htmlFor="schedule-notes" className="mb-2 block text-sm">Catatan (opsional)</label><textarea id="schedule-notes" rows={3} maxLength={1000} value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} className={inputClass} /></div>
      <div><p className="mb-2 text-sm font-medium">Foto (opsional)</p><PhotoPicker photos={schedulePhotos} onAdd={addSchedulePhoto} onRemove={removeSchedulePhoto} existingUrls={scheduleForm.fotoUrls} /></div>
      <div className={formFooter}>{scheduleForm.id && <button type="button" disabled={busy} onClick={() => mutateSchedule('delete')} className={`${buttonClass} bg-red-950/60 text-red-200 hover:bg-red-900/60`}>Hapus</button>}<Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>}
    {modal === 'picAction' && (() => { const lastNote = picHistory.find((entry) => entry.catatan); return <div className="mt-5 space-y-4">
      {!picEditMode && <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><StatusCaseBadge statusCase={workflowItem?.statusCase} /><Badge status={workflowItem?.status} /><WorkflowBadge status={handlingStatus(workflowItem || {})} /><AlertBadge item={workflowItem || {}} /><ImplantBadge item={workflowItem || {}} /></div><p className="break-words text-sm text-slate-300">{workflowItem?.dokter} · {workflowItem?.tindakan}</p></div>}
      {picDetailError && <div role="alert" className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200"><p>Riwayat belum berhasil dimuat: {picDetailError}</p><button type="button" disabled={picDetailLoading} onClick={() => loadPicHistory(workflowItem)} className={`${buttonClass} mt-2 bg-slate-800`}>Coba muat riwayat lagi</button></div>}
      {!picEditMode ? <>
        {handlingStatus(workflowItem || {}) !== 'Selesai' ? workflowItem?.picId && <button type="button" onClick={() => { setPicEditMode(true); loadPicHistory(workflowItem); }} className={`${buttonClass} w-full bg-blue-600`}>Tangani komplain</button> : <div role="status" className="rounded-xl border border-emerald-500 bg-emerald-950/70 p-4"><p className="flex items-center gap-2 font-semibold text-emerald-200"><CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />Komplain selesai</p>{workflowItem?.selesaiPada && <p className="mt-2 text-xs text-emerald-100">Diselesaikan pada {new Date(workflowItem.selesaiPada).toLocaleString('id-ID')}</p>}<p className="mt-2 text-xs leading-5 text-slate-300">Hasil penyelesaian tersimpan. Untuk tindak lanjut baru, admin atau pelapor dapat membuka kembali laporan.</p></div>}
        {!workflowItem?.picId && <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/15 p-3"><div className="flex items-start gap-2"><UserRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><p className="text-sm font-semibold text-amber-200">Belum ada PIC</p><p className="mt-0.5 text-xs leading-5 text-amber-100/80">Tentukan penanggung jawab terlebih dahulu — tindak lanjut tidak dapat disimpan sebelum laporan ini punya PIC.</p></div></div><button type="button" onClick={() => user.role === 'petugas' ? takeReport(workflowItem) : openWorkflow('assign', workflowItem)} className={`${buttonClass} mt-3 w-full bg-amber-600 hover:bg-amber-500`}><UserRound aria-hidden="true" className="h-4 w-4" />{user.role === 'petugas' ? 'Ambil sebagai PIC' : 'Tentukan PIC sekarang'}</button></div>}
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-800/30 p-4">{[['Tanggal', formatDate(workflowItem?.tanggal)], ['Pelapor', workflowItem?.pelaporNama || 'Data lama'], ['PIC', workflowItem?.picId ? workflowItem.picNama : 'Belum ditugaskan'], ['Dokter', workflowItem?.dokter], ['Team Pelapor', workflowItem?.team], ['Rumah Sakit', workflowItem?.rumahSakit || 'Belum diisi'], ['Tindakan', workflowItem?.tindakan]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className={`mt-1 flex items-center gap-1.5 break-words text-sm font-medium ${label === 'PIC' && !workflowItem?.picId ? 'text-slate-400' : ''}`}>{value || '—'}{label === 'PIC' && workflowItem?.picId && workflowItem?.picRole && <RoleBadge role={workflowItem.picRole} pic />}</dd></div>)}</dl>
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3"><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Masalah{workflowItem?.komplain && workflowItem?.pelaporRole && <RoleBadge role={workflowItem.pelaporRole} />}</h3>{workflowItem?.komplain ? <FormattedText text={workflowItem.komplain} className="mt-2 text-sm leading-6 text-slate-200" /> : <p className="mt-2 text-sm leading-6 text-slate-200">—</p>}</div>
        {initialSolution(workflowItem) && <div className="rounded-xl border border-teal-800 bg-teal-950/30 p-3"><h3 className="text-sm font-semibold text-teal-200">Solusi awal pelapor</h3><FormattedText text={initialSolution(workflowItem)} className="mt-2 text-sm leading-6 text-slate-200" /></div>}
        {handlingSolution(workflowItem) && <div className="rounded-xl border border-emerald-700 bg-emerald-950/30 p-3"><h3 className="text-sm font-semibold text-emerald-200">Hasil penanganan PIC</h3><FormattedText text={handlingSolution(workflowItem)} className="mt-2 text-sm leading-6 text-slate-200" /></div>}
        {workflowItem?.penangananSelanjutnya && <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-3"><h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">RTL{handlingStatus(workflowItem) === 'Baru' ? (workflowItem?.pelaporRole && <RoleBadge role={workflowItem.pelaporRole} />) : (workflowItem?.picRole && <RoleBadge role={workflowItem.picRole} pic />)}</h3><FormattedText text={workflowItem.penangananSelanjutnya} className="mt-2 text-sm leading-6 text-violet-100" /></div>}
        {workflowItem?.fotoUrls?.length > 0 && <div><p className="mb-2 text-sm font-semibold">Foto laporan ({workflowItem.fotoUrls.length})</p><PhotoGallery urls={workflowItem.fotoUrls} label="Foto laporan" /></div>}
        <div className="border-t border-slate-800 pt-4">
          <button type="button" onClick={() => { setShowPicHistory((value) => { const next = !value; if (next) loadPicHistory(workflowItem); return next; }); }} className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-slate-200">Riwayat tindak lanjut {picHistory.length > 0 && `(${picHistory.length})`}<span className="text-xs text-blue-300">{showPicHistory ? 'Sembunyikan' : 'Tampilkan'}</span></button>
          {showPicHistory && <>{picDetailLoading && <p className="mt-3 text-sm text-slate-400">Memuat riwayat…</p>}{!picDetailLoading && !picDetailError && !picHistory.length && <p className="mt-3 text-sm text-slate-400">Belum ada riwayat.</p>}<ol className="mt-3 space-y-3">{picHistory.map((entry) => { const changes = historyChanges(entry.detail); const fields = editedFieldLabels(entry.detail); return <li key={entry.id} className="border-l-2 border-blue-800 pl-3"><p className="text-sm font-semibold">{entry.aksi}</p><p className="mt-0.5 break-words text-xs text-slate-400">{entry.nama} · {new Date(entry.tanggal).toLocaleString('id-ID')}</p>{fields.length > 0 && <p className="mt-1 text-xs text-slate-400">Diubah: {fields.join(', ')}</p>}{changes.length > 0 && <ul className="mt-1 space-y-0.5">{changes.map((change) => <li key={change.key} className="text-xs text-amber-300">{formatHistoryChange(change, LEVELS, formatDate)}</li>)}</ul>}{entry.catatan && <FormattedText text={entry.catatan} className={`mt-1.5 ${historyNote}`} />}{entry.fotoUrls?.length > 0 && <div className="mt-1.5"><PhotoGallery urls={entry.fotoUrls} label="Foto tindak lanjut" thumbClassName="h-16 w-16" /></div>}</li>; })}</ol></>}
        </div>
        <div className={formFooter}><ShareButton item={workflowItem} formatDate={formatDate} className={`${buttonClass} bg-slate-800 px-3 text-slate-300 hover:bg-slate-700`} /><ShareImageButton item={workflowItem} formatDate={formatDate} className={`${buttonClass} bg-slate-800 px-3 text-slate-300 hover:bg-slate-700`} /><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close></div>
      </> : <>
        <button type="button" onClick={() => { setPicEditMode(false); setPicSaved(''); }} className="flex items-center gap-1.5 text-sm text-blue-300 hover:underline">← Kembali ke detail</button>
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-800/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-medium text-slate-200">{workflowItem?.dokter || 'Dokter belum diisi'} · {workflowItem?.rumahSakit || 'RS belum diisi'}</p>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-300"><span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">{(workflowItem?.picNama || '?').trim().charAt(0).toUpperCase()}</span>{(workflowItem?.picNama || 'Belum ditugaskan').split(' ')[0]}</span>
          </div>
          <div className="max-h-28 overflow-y-auto rounded-lg bg-slate-950/50 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">Masalah</p>
            {workflowItem?.komplain ? <FormattedText text={workflowItem.komplain} className="mt-1 text-xs leading-5 text-slate-200" /> : <p className="mt-1 text-xs text-slate-400">—</p>}
          </div>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!LEVELS.some((level) => level.code === workflow.status)) {
            setActionError('Pilih tingkat keparahan terlebih dahulu.');
            event.currentTarget.querySelector('[name="status"]')?.focus();
            return;
          }
          if (!editorPlainText(textToEditorDoc(workflow.penangananSelanjutnya)).trim()) {
            setActionError('Isi catatan hasil penanganan terlebih dahulu.');
            textareaRefs.current.picNote?.focus();
            return;
          }
          const complete = workflow.statusPenanganan === 'Selesai';
          const rtlChanged = workflow.penangananSelanjutnya !== (workflowItem?.penangananSelanjutnya || '');
          const note = !complete || rtlChanged ? workflow.penangananSelanjutnya.length <= 2000 ? workflow.penangananSelanjutnya : 'RTL diperbarui. Isi lengkap tersedia pada riwayat perubahan RTL.' : '';
          mutate('followUp', { statusPenanganan: workflow.statusPenanganan, jalanKeluar: complete ? workflow.penangananSelanjutnya : workflow.jalanKeluar, catatan: note });
        }} className="space-y-3 border-t border-slate-800 pt-3">
          <div>
            {picStatusLocked ? <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">Status Penanganan:</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${{ Diproses: 'border-violet-600 bg-violet-600 text-white', Menunggu: 'border-amber-600 bg-amber-600 text-white', Selesai: 'border-emerald-600 bg-emerald-600 text-white' }[workflow.statusPenanganan]}`}><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-white" />{workflow.statusPenanganan}</span><span className="text-xs text-slate-500">(sesuai kolom yang dipilih di Kanban)</span></p> : <>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">Status Penanganan<FieldInfo text="Diproses: masih aktif Anda tangani sendiri. Menunggu: sudah ditangani, tapi menunggu konfirmasi dari pihak lain (RS, tim lain, dll). Selesai: masalah sudah teratasi dan laporan ditutup." /></p>
              <div role="radiogroup" aria-label="Status Penanganan" className="flex flex-wrap gap-2">
                {[['Diproses', 'bg-violet-400', 'border-violet-600 bg-violet-600 text-white'], ['Menunggu', 'bg-amber-400', 'border-amber-600 bg-amber-600 text-white'], ['Selesai', 'bg-emerald-400', 'border-emerald-600 bg-emerald-600 text-white']].filter(([value]) => WORKFLOW_STATUSES.indexOf(value) >= WORKFLOW_STATUSES.indexOf(handlingStatus(workflowItem || {}))).map(([value, dot, active]) => { const selected = workflow.statusPenanganan === value; return <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-blue-400 ${selected ? active : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-600'}`}><input type="radio" name="statusPenanganan" value={value} checked={selected} onChange={() => setWorkflow({ ...workflow, statusPenanganan: value })} className="sr-only" /><span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected ? 'bg-white' : dot}`} />{value}</label>; })}
              </div>
            </>}
          </div>
          <fieldset><legend className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">Tingkat Keparahan <span className="text-red-300">*</span><SeverityInfo levels={LEVELS} /></legend><div className="flex flex-wrap gap-2">{LEVELS.map((level) => { const selected = workflow.status === level.code; return <label key={level.code} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-blue-400 ${selected ? SEVERITY_ACTIVE[level.code] : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-600'}`}><input type="radio" name="status" required value={level.code} checked={selected} onChange={(event) => setWorkflow({ ...workflow, status: event.target.value })} className="sr-only" /><span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected ? 'bg-white' : SEVERITY_DOT[level.code]}`} />{level.label}</label>; })}</div></fieldset>
          <div><label id="pic-note-label" htmlFor="pic-note" className="mb-2 flex items-center gap-1.5 text-sm font-medium">Catatan Hasil Penanganan <span className="text-red-300">*</span><FieldInfo text="Tuliskan progres/tindakan yang sudah dilakukan. Jika status Selesai, tuliskan solusi akhir yang menyelesaikan masalah." /></label><VisualTextEditor ref={(el) => { textareaRefs.current.picNote = el; }} id="pic-note" placeholder="Tuliskan update penanganan atau solusi di sini… (@ untuk menyebut)" maxLength={5000} value={workflow.penangananSelanjutnya} onChange={(event) => setWorkflow({ ...workflow, penangananSelanjutnya: event.target.value })} className={inputClass} mentionables={mentionables} /></div>
          {picDetailLoading && !picHistory.length && <p className="text-xs text-slate-500">Memuat riwayat sebelumnya…</p>}
          {lastNote && <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm text-slate-300">Lihat catatan riwayat terakhir</summary><p className="mt-2 text-xs text-slate-400">{lastNote.nama} · {new Date(lastNote.tanggal).toLocaleString('id-ID')}</p><FormattedText text={lastNote.catatan} className="mt-1 text-sm leading-6" /></details>}
          <div><label className="mb-2 block text-sm">Lampiran (opsional)</label><PhotoPicker photos={picPhotos} onAdd={addPicPhoto} onRemove={removePicPhoto} totalExisting={(workflowItem?.fotoUrls?.length || 0) + picHistory.reduce((sum, entry) => sum + (entry.fotoUrls?.length || 0), 0)} /></div>
          {picSaved && <p role="status" className="rounded-xl border border-emerald-600 bg-emerald-950/40 p-3 text-sm text-emerald-200">{picSaved}</p>}
          <div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button type="submit" disabled={busy} className={`${buttonClass} flex-1 bg-violet-600 hover:bg-violet-500`}>{busy && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />}{busy ? 'Menyimpan…' : 'Simpan Pembaruan'}</button></div>
        </form>
      </>}
    </div>; })()}
    {modal === 'delete' && <div className="mt-5 space-y-5"><div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4"><AlertTriangle aria-hidden="true" className="h-6 w-6 shrink-0 text-red-400" /><p className="break-words text-sm leading-6">Laporan <strong>{workflowItem?.dokter}</strong> · {formatDate(workflowItem?.tanggal)}</p></div><div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} onClick={() => mutate('delete')} className={`${buttonClass} flex-1 bg-red-700`}>{busy ? 'Mengarsipkan…' : 'Arsipkan laporan'}</button></div>
      {user?.role === 'admin' && <div className="space-y-3 rounded-xl border border-red-900/40 bg-slate-950/40 p-4">
        <div className="flex items-start gap-2"><Trash2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-400" /><div><p className="text-sm font-semibold text-red-300">Hapus permanen</p><p className="mt-0.5 text-xs leading-5 text-slate-400">Berbeda dari arsip di atas — laporan, foto, dan riwayat benar-benar dihapus dan tidak dapat dikembalikan. Hanya tersedia untuk laporan yang sudah berhasil dibackup.</p></div></div>
        {purgeState === 'loading' && <p className="text-xs text-slate-400">Memeriksa status backup…</p>}
        {purgeState && !['loading', 'done'].includes(purgeState) && <p className="text-xs text-amber-300">{{ none: 'Laporan ini belum pernah dibackup.', pending: 'Backup masih menunggu diproses.', processing: 'Backup sedang diproses.', failed: 'Backup terakhir gagal. Coba kirim ulang dari panel Backup.' }[purgeState] || 'Status backup belum diketahui.'} Tidak dapat dihapus permanen sebelum backup berhasil.</p>}
        {purgeState === 'done' && !confirmPurge && <button type="button" disabled={busy} onClick={() => setConfirmPurge(true)} className={`${buttonClass} w-full border border-red-800 bg-red-950/40 text-red-200 hover:bg-red-900/40`}><Trash2 aria-hidden="true" className="h-4 w-4" />Hapus permanen</button>}
        {purgeState === 'done' && confirmPurge && <div className="space-y-2"><p className="text-xs font-semibold text-red-300">Yakin? Data akan hilang selamanya dan tidak dapat dibatalkan.</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => setConfirmPurge(false)} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</button><button type="button" disabled={busy} onClick={() => mutate('purge')} className={`${buttonClass} flex-1 bg-red-700`}>{busy ? 'Menghapus…' : 'Ya, hapus permanen'}</button></div></div>}
      </div>}
    </div>}
    {modal === 'announcement' && <form onSubmit={publishAnnouncement} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="announcement-audience" className="mb-2 block text-sm font-medium">Penerima *</label><select id="announcement-audience" value={announcementForm.audience} onChange={(event) => setAnnouncementForm({ ...announcementForm, audience: event.target.value, recipientIds: [] })} className={inputClass}>{Object.entries(ANNOUNCEMENT_AUDIENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label htmlFor="announcement-priority" className="mb-2 block text-sm font-medium">Jenis pengumuman</label><select id="announcement-priority" value={announcementForm.priority} onChange={(event) => setAnnouncementForm({ ...announcementForm, priority: event.target.value })} className={inputClass}><option value="info">Informasi</option><option value="important">Penting</option></select></div></div>
      {announcementForm.audience === 'users' && <fieldset className="rounded-xl border border-slate-700 p-3"><legend className="px-1 text-sm font-medium">Pilih pengguna penerima *</legend><div className="max-h-48 space-y-2 overflow-y-auto">{[...(user ? [user] : []), ...mentionables].map((account) => <label key={account.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-800"><input type="checkbox" checked={announcementForm.recipientIds.includes(account.id)} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, recipientIds: event.target.checked ? [...previous.recipientIds, account.id] : previous.recipientIds.filter((id) => id !== account.id) }))} className="h-4 w-4" /><span className="min-w-0 break-words text-sm">{account.nama} · {ROLE_LABELS[account.role]}</span></label>)}</div><p className="mt-2 text-xs text-slate-400">{announcementForm.recipientIds.length} pengguna dipilih. Hanya akun yang dipilih dapat menerima pengumuman.</p></fieldset>}

      <div><label htmlFor="announcement-title" className="mb-2 block text-sm font-medium">Judul *</label><input id="announcement-title" required autoFocus maxLength={150} value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} placeholder="Contoh: Maintenance sistem Sabtu malam" className={inputClass} /></div>
      <div><label htmlFor="announcement-body" className="mb-2 block text-sm font-medium">Isi pengumuman *</label><textarea id="announcement-body" required maxLength={2000} rows={4} value={announcementForm.body} onChange={(event) => setAnnouncementForm({ ...announcementForm, body: event.target.value })} placeholder="Jelaskan informasi untuk penerima yang dipilih…" className={`${inputClass} min-h-28`} /></div>
      <div><label htmlFor="announcement-duration" className="mb-2 block text-sm font-medium">Tampil selama</label><select id="announcement-duration" value={announcementForm.durationDays} onChange={(event) => setAnnouncementForm({ ...announcementForm, durationDays: event.target.value })} className={inputClass}>{[['1', '1 hari'], ['3', '3 hari'], ['7', '7 hari (mingguan)'], ['14', '14 hari'], ['30', '30 hari (bulanan)'], ['', 'Tidak dibatasi']].map(([value, label]) => <option key={value || 'unlimited'} value={value}>{label}</option>)}</select><p className="mt-2 text-xs text-slate-400">Setelah lewat, pengumuman otomatis tidak tampil lagi ke pengguna.</p></div>
      <p className="rounded-xl border border-slate-700 p-3 text-sm text-slate-300">Untuk: <strong>{ANNOUNCEMENT_AUDIENCES[announcementForm.audience]}</strong> · {announcementForm.priority === 'important' ? 'Penting — penerima membaca isi lalu menekan Saya mengerti.' : 'Informasi — banner ringkas, bisa ditandai dibaca.'}</p>
      <div className={formFooter}><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy || announcementForm.audience === 'users' && !announcementForm.recipientIds.length} className={`${buttonClass} flex-1 bg-blue-600`}>{busy ? 'Menerbitkan…' : 'Terbitkan pengumuman'}</button></div>
    </form>}
    {modal === 'announcementView' && <div className="mt-5 space-y-3">{announcementError && <p role="alert" className="text-sm text-red-300">{announcementError}</p>}
      {announcementNotice.length === 0 ? <p className="text-sm text-slate-400">Tidak ada pengumuman aktif.</p> : announcementNotice.map((item) => <div key={item.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="mb-2 text-xs text-amber-200">{item.priority === 'important' ? 'Penting' : 'Informasi'} · {announcementAudience(item)}</p><p className="break-words font-semibold text-amber-100">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.createdByNama} · {new Date(item.createdAt).toLocaleDateString('id-ID')}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-50/90">{item.body}</p>
        <button disabled={!!announcementDismissing} onClick={() => dismissAnnouncement(item)} className={`${buttonClass} mt-3 bg-amber-600 text-white hover:bg-amber-500`}>{announcementDismissing === item.id ? 'Menyimpan…' : item.priority === 'important' ? 'Saya mengerti' : 'Tandai dibaca'}</button>
      </div>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close></div>
    </div>}

    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={activeNotice === 'critical' && modal === null} onOpenChange={(open) => { if (!open) setCriticalNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="flex items-center gap-2 pr-12 text-xl font-bold text-red-300"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />Kasus ada kendala belum ada PIC</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{criticalNotice.length > 1 ? `${criticalNotice.length} laporan berstatus Ada Kendala` : '1 laporan berstatus Ada Kendala'} belum ditugaskan penanggung jawab. Segera tentukan PIC.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{criticalNotice.map((item) => <div key={item.id} className="rounded-xl border border-red-900/50 bg-red-950/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words text-sm font-semibold">{item.dokter} · {item.tindakan}</p><StatusCaseBadge statusCase={item.statusCase} /></div><p className="mt-1 break-words text-sm text-slate-300">Dilaporkan oleh <strong>{item.pelaporNama || 'Pengguna'}</strong> · {formatDate(item.tanggal)}</p><button type="button" onClick={() => { markRead(item.id); setCriticalNotice([]); setTab('table'); setPendingDetailId(item.id); }} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-blue-300">Lihat detail laporan →</button><button onClick={() => { setCriticalNotice((queue) => queue.filter((entry) => entry.id !== item.id)); if (user?.role === 'petugas') void takeReport(item); else openWorkflow('assign', item); }} className={`${buttonClass} mt-2 w-full bg-red-700 hover:bg-red-600`}><UserRound aria-hidden="true" className="h-4 w-4" />{user?.role === 'petugas' ? 'Ambil sebagai PIC' : 'Tentukan PIC sekarang'}</button></div>)}
      <Dialog.Close className={`${buttonClass} w-full bg-slate-800`}>Tutup untuk sekarang</Dialog.Close>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={activeNotice === 'assigned' && modal === null} onOpenChange={(open) => { if (!open) setAssignedNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Laporan Anda sudah ditangani</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Penanggung jawab (PIC) baru ditentukan untuk {assignedNotice.length > 1 ? `${assignedNotice.length} laporan Anda` : 'laporan Anda'}.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{assignedNotice.map((item) => <button key={item.id} type="button" onClick={() => { setAssignedNotice([]); setTab('table'); setPendingDetailId(item.id); }} className="w-full rounded-xl border border-violet-900/50 bg-violet-950/20 p-3 text-left transition hover:bg-violet-950/40"><p className="flex items-center gap-1.5 text-sm font-semibold"><UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-300" />{item.dokter} · {item.tindakan}</p><p className="mt-1 break-words text-sm text-slate-300">Ditangani oleh <strong>{item.picNama}</strong></p>{item.jalanKeluar && <p className={`mt-1 break-words text-xs ${picResponseBubble}`}><span className="font-semibold">{handlingStatus(item) === 'Baru' ? 'Solusi awal:' : 'Respons PIC:'}</span> <InlineText text={item.jalanKeluar} /></p>}<span className="mt-2 inline-block text-xs font-semibold text-blue-300">Lihat detail laporan →</span></button>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} w-full bg-slate-800`}>Tutup</Dialog.Close></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={activeNotice === 'incoming' && modal === null} onOpenChange={(open) => { if (!open) setIncomingNotice([]); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Laporan baru masuk</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{incomingNotice.length > 1 ? `${incomingNotice.length} laporan baru` : '1 laporan baru'} sejak terakhir Anda membuka halaman ini.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{incomingNotice.map((item) => <button key={item.id} type="button" onClick={() => { markRead(item.id); setIncomingNotice([]); setTab('table'); setPendingDetailId(item.id); }} className="w-full rounded-xl border border-blue-900/50 bg-blue-950/20 p-3 text-left transition hover:bg-blue-950/40"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-sm font-semibold"><Inbox aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-300" />{item.dokter} · {item.tindakan}</p><StatusCaseBadge statusCase={item.statusCase} /></div><p className="mt-1 break-words text-sm text-slate-300">Dilaporkan oleh <strong>{item.pelaporNama || 'Pengguna'}</strong> · {formatDate(item.tanggal)}</p><span className="mt-2 inline-block text-xs font-semibold text-blue-300">Lihat detail laporan →</span></button>)}
      <div className={formFooter}><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Tutup</Dialog.Close><button onClick={() => { setIncomingNotice([]); setTab('table'); }} className={`${buttonClass} flex-1 bg-blue-600`}>Lihat semua laporan</button></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={activeNotice === 'mention' && modal === null} onOpenChange={(open) => { if (!open) mentionNotice.forEach(dismissMention); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-lg`}>
    <div className={dialogHeader}><Dialog.Title className="flex items-center gap-2 pr-12 text-xl font-bold"><AtSign aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-300" />Anda disebut</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{mentionNotice.length > 1 ? `${mentionNotice.length} orang menyebut Anda` : 'Seseorang menyebut Anda'} di catatan atau tindak lanjut laporan.</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-3 pt-4`}>{mentionNotice.map((item) => <button key={item.id} type="button" onClick={() => { dismissMention(item); setTab('table'); setPendingDetailId(item.reportId); }} className="w-full rounded-xl border border-blue-900/50 bg-blue-950/20 p-3 text-left transition hover:bg-blue-950/40"><p className="text-sm font-semibold">{item.byNama} menyebut Anda</p>{item.snippet && <p className="mt-1 break-words text-xs text-slate-300">“{item.snippet}”</p>}<span className="mt-2 inline-block text-xs font-semibold text-blue-300">Lihat laporan →</span></button>)}
      <div className={formFooter}><button onClick={() => mentionNotice.forEach(dismissMention)} className={`${buttonClass} flex-1 bg-slate-800`}>Tandai sudah dibaca</button></div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={!!savedConfirm} onOpenChange={(open) => { if (!open) setSavedConfirm(null); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content data-role={user?.role || 'pelapor'} className={`${mobileDialog} max-w-md`}>
    <div className={dialogHeader}><Dialog.Title className="flex items-center gap-2 pr-12 text-xl font-bold text-emerald-300"><CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0" />Laporan tersimpan</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{savedConfirm?.message}</Dialog.Description><Dialog.Close aria-label="Tutup" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
    <div className={`${dialogBody} space-y-4 pt-4`}>
      {savedConfirm?.item && <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-800/30 p-3"><p className="break-words text-sm font-semibold">{savedConfirm.item.dokter || 'Dokter belum diisi'}</p><p className="mt-0.5 break-words text-xs text-slate-400">{savedConfirm.item.rumahSakit || 'RS belum diisi'}</p></div>}
      <div className={formFooter}>
        {savedConfirm?.item && <ShareButton item={savedConfirm.item} formatDate={formatDate} label="Bagikan laporan" className={`${buttonClass} flex-1 bg-blue-600 text-white hover:bg-blue-500`} />}
        {savedConfirm?.item && <ShareImageButton item={savedConfirm.item} formatDate={formatDate} className={`${buttonClass} w-11 px-0 bg-slate-800 text-slate-300 hover:bg-slate-700`} />}
        <button onClick={() => { const id = savedConfirm?.item?.id; setSavedConfirm(null); if (id) { setModal(null); setTab('table'); setPendingDetailId(id); } }} className={`${buttonClass} flex-1 bg-slate-800`}>Lihat laporan</button>
      </div>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
  </main>;
}
