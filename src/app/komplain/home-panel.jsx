'use client';
import { PlusCircle, ChevronRight, ChevronDown, ClipboardList, Clock3, CheckCircle2, AlertCircle, Megaphone, Stethoscope, Building2, UserRound, LoaderCircle, CalendarPlus, CalendarDays, CalendarClock, MapPin, Camera } from 'lucide-react';
import WorkflowBadge from './workflow-badge';
import { InlineText } from './formatted-text';
import { handlingStatus, canFollowUp } from './workflow.mjs';
import GoogleCalendarStatus from './google-calendar-status';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';
function MetaBadge({ icon: Icon, children, emphasis = false }) {
  return <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${emphasis ? 'border-slate-600 bg-slate-800 font-semibold text-slate-100' : 'border-slate-700 bg-slate-800/70 text-slate-300'}`}><Icon aria-hidden="true" className={`h-3 w-3 shrink-0 ${emphasis ? 'text-slate-300' : 'text-slate-400'}`} /><span className="truncate">{children}</span></span>;
}
export default function HomePanel({ summary, summaryLoading, hasMoreLatest, loadingMoreLatest, onLoadMoreLatest, schedules, schedulesLoading, user, busy, onCreate, onOpen, onReports, onRecap, onUsers, onAnnouncement, onAssign, onFollowUp, onScheduleReport, onCreateSchedule, onEditSchedule, onExpired }) {
  const loaded = !summaryLoading && !!summary;
  const counts = summary?.counts || {};
  const attention = summary?.attention || [];
  const latest = summary?.latest?.items || [];
  const schedulesLoaded = !schedulesLoading && !!schedules;
  const upcoming = schedules || [];
  // Jadwal & Agenda is admin-only while in development (server-side enforced too, in
  // executeSchedule()) — petugas/pelapor don't even see the entry points for it yet.
  const isAdmin = user.role === 'admin';
  const openSection = (title, items, actionable = false) => <section className="min-w-0 space-y-3 lg:rounded-2xl lg:border lg:border-slate-800 lg:bg-slate-900/50 lg:p-5" aria-label={title}><h3 className="font-semibold">{title}</h3>{!loaded ? <p className="text-sm text-slate-400">Menunggu data laporan…</p> : !items.length ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">{actionable ? 'Tidak ada laporan yang perlu tindakan Anda saat ini.' : 'Belum ada laporan. Mulai dengan membuat laporan baru.'}</p> : <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">{items.map((item) => <div key={item.id} className="p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><MetaBadge icon={Stethoscope} emphasis>{item.dokter || 'Dokter belum diisi'}</MetaBadge><MetaBadge icon={Building2}>{item.rumahSakit || 'RS belum diisi'}</MetaBadge>{!actionable && <MetaBadge icon={UserRound}>{item.picNama ? `PIC: ${item.picNama}` : 'Belum ditugaskan'}</MetaBadge>}</div><WorkflowBadge status={handlingStatus(item)} /></div>
    <p className="mt-2 line-clamp-2 break-words text-sm text-slate-300"><InlineText text={item.komplain || 'Deskripsi belum diisi'} /></p>
    <div className="mt-3 space-y-2">{actionable && <p className="break-words text-xs text-slate-400">{!item.picId ? 'Perlu penanggung jawab' : 'Menunggu tindak lanjut Anda'}</p>}<div className="flex flex-wrap gap-2">{isAdmin && <button disabled={busy} onClick={() => onScheduleReport(item)} className={`${button} bg-slate-800/70 text-slate-300`}><CalendarPlus aria-hidden="true" className="h-4 w-4" />{actionable ? 'Jadwalkan Tindakan' : 'Jadwalkan'}</button>}<button disabled={busy} onClick={() => actionable && user.role === 'admin' && !item.picId ? onAssign(item) : actionable && canFollowUp(item, user) ? onFollowUp(item) : onOpen(item)} className={`${button} bg-slate-800 text-blue-300`}>{actionable && user.role === 'admin' && !item.picId ? 'Tentukan PIC' : actionable && canFollowUp(item, user) ? 'Tangani komplain' : handlingStatus(item) === 'Selesai' ? 'Lihat penyelesaian' : 'Lihat detail'}<ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div></div>
  </div>)}</div>}</section>;
  const showAttention = !loaded || attention.length > 0;
  const columns = (showAttention ? 1 : 0) + 1 + (isAdmin ? 1 : 0);
  const gridColsClass = { 1: '', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' }[columns];
  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 lg:p-6">
      <p className="text-sm text-slate-400">Halo, {user.nama || 'selamat datang'}</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-semibold lg:text-2xl">{user.role === 'admin' ? 'Pantau laporan dan penanganan' : user.role === 'petugas' ? 'Tugas Anda hari ini' : 'Ada kendala di lapangan?'}</h2><p className="mt-2 text-sm text-slate-400">{user.role === 'pelapor' ? 'Laporkan masalah dan pantau perkembangannya di sini.' : 'Prioritaskan laporan yang membutuhkan tindakan Anda.'}</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">{user.role === 'admin' && <button disabled={busy} onClick={onAnnouncement} className={`${button} border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}><Megaphone aria-hidden="true" className="h-4 w-4" />Buat pengumuman</button>}<button disabled={busy} onClick={onCreate} className={`${button} bg-blue-600 text-white hover:bg-blue-500`}><PlusCircle aria-hidden="true" className="h-4 w-4" />Buat laporan baru</button></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3"><p role="status" className="text-sm text-slate-300">{loaded ? `${counts.active} laporan belum selesai · ${counts.attention} perlu tindakan Anda` : 'Memuat ringkasan…'}</p><button disabled={busy} onClick={onRecap} className={`${button} text-blue-300`}>Lihat rekap<ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div>
    </section>
    <div aria-label="Ringkasan laporan beranda" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {[
        ['Laporan belum selesai', counts.active, 'Masih dalam proses penanganan', Clock3, 'text-blue-300', true],
        ['Perlu tindakan Anda', counts.attention, 'Prioritas penanganan saat ini', AlertCircle, 'text-violet-300', true],
        ['Menunggu', counts.waiting, 'Menunggu konfirmasi atau pihak terkait', ClipboardList, 'text-amber-300', false],
        ['Selesai', counts.completed, 'Penanganan telah diselesaikan', CheckCircle2, 'text-emerald-300', false],
      ].map(([label, count, hint, Icon, color, primary]) => <div key={label} className={`min-w-0 rounded-2xl border bg-slate-900/70 p-4 sm:p-5 ${primary ? 'border-slate-700' : 'border-slate-800'}`}><div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-400">{label}</p><Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${color}`} /></div><p className={`mt-3 text-2xl font-semibold tabular-nums sm:mt-4 sm:text-3xl ${color}`}>{loaded ? count : '—'}</p><p className="mt-2 hidden text-xs leading-5 text-slate-400 sm:block">{hint}</p></div>)}
    </div>
    <div className={`grid items-start gap-6 ${gridColsClass}`}>
      {showAttention && <div className="min-w-0 space-y-3">{openSection('Perlu tindakan Anda', attention, true)}{loaded && counts.attention > attention.length && <p className="text-xs text-slate-400">Menampilkan {attention.length} dari {counts.attention} laporan. Lihat daftar laporan untuk lainnya.</p>}</div>}
      <div className="min-w-0 space-y-3">
        {openSection(user.role === 'admin' ? 'Laporan terbaru' : 'Laporan saya terbaru', latest)}
        {hasMoreLatest && <button disabled={loadingMoreLatest} onClick={onLoadMoreLatest} className={`${button} w-full bg-slate-800/70 text-slate-300`}>{loadingMoreLatest ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}{loadingMoreLatest ? 'Memuat…' : 'Muat lebih banyak'}</button>}
      </div>
      {isAdmin && <section className="min-w-0 space-y-3 lg:rounded-2xl lg:border lg:border-slate-800 lg:bg-slate-900/50 lg:p-5" aria-label="Jadwal & Agenda">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Jadwal & Agenda</h3><div className="flex flex-wrap gap-2"><GoogleCalendarStatus isAdmin={isAdmin} onExpired={onExpired} /><button disabled={busy} onClick={onCreateSchedule} className={`${button} bg-slate-800 text-blue-300`}><CalendarPlus aria-hidden="true" className="h-4 w-4" />Buat Acara</button></div></div>
        <p className="text-xs text-slate-400">Hubungkan Google Calendar sekali, lalu jadwal di sini otomatis tersinkron.</p>
        {!schedulesLoaded ? <p className="text-sm text-slate-400">Menunggu data jadwal…</p> : !upcoming.length ? <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Tidak ada jadwal mendatang. Klik &quot;Jadwalkan&quot; pada laporan, atau &quot;Buat Acara&quot; di atas.</p> : <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">{upcoming.map((item) => <button key={item.id} disabled={busy} onClick={() => onEditSchedule(item)} className="block w-full p-4 text-left hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset"><div className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{item.date} · {item.startTime}–{item.endTime}</div><p className="mt-1 break-words text-sm font-semibold">{item.title}</p>{(item.picNama || item.location || item.fotoUrls?.length > 0) && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{item.picNama && <MetaBadge icon={UserRound}>{item.picNama}</MetaBadge>}{item.location && <MetaBadge icon={MapPin}>{item.location}</MetaBadge>}{item.fotoUrls?.length > 0 && <MetaBadge icon={Camera}>{item.fotoUrls.length}</MetaBadge>}</div>}</button>)}</div>}
      </section>}
    </div>
    <div className="flex flex-wrap gap-2 lg:justify-end"><button disabled={busy} onClick={onReports} className={`${button} bg-slate-800`}>Lihat semua laporan<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>{user.role === 'admin' && <button disabled={busy} onClick={onUsers} className={`${button} text-blue-300`}>Kelola akun & persetujuan</button>}</div>
  </div>;
}
