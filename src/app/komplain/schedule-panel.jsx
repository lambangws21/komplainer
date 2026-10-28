'use client';
import { CalendarPlus, CalendarDays, CalendarClock, MapPin, Camera, UserRound } from 'lucide-react';
import GoogleCalendarStatus from './google-calendar-status';
import MiniCalendar from './mini-calendar';
import { RowSkeleton } from './skeleton';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';
function MetaBadge({ icon: Icon, children, emphasis = false }) {
  return <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${emphasis ? 'border-slate-600 bg-slate-800 font-semibold text-slate-100' : 'border-slate-700 bg-slate-800/70 text-slate-300'}`}><Icon aria-hidden="true" className={`h-3 w-3 shrink-0 ${emphasis ? 'text-slate-300' : 'text-slate-400'}`} /><span className="truncate">{children}</span></span>;
}

// The upcoming-schedule list + mini calendar — shared by the desktop Beranda's sticky right rail
// and the dedicated mobile "Jadwal" tab (see navbar.jsx/page.jsx), so the two don't drift apart.
export default function SchedulePanel({ schedules, schedulesLoading, busy, onCreateSchedule, onEditSchedule, isAdmin, onExpired }) {
  const schedulesLoaded = !schedulesLoading && !!schedules;
  const upcoming = schedules || [];
  return <div className="space-y-6">
    <section id="jadwal-agenda" className="space-y-3 scroll-mt-24 lg:rounded-2xl lg:border lg:border-slate-800 lg:bg-slate-900/50 lg:p-5" aria-label="Jadwal & Agenda">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Jadwal &amp; Agenda</h3><div className="flex flex-wrap gap-2"><GoogleCalendarStatus isAdmin={isAdmin} onExpired={onExpired} /><button disabled={busy} onClick={onCreateSchedule} className={`${button} bg-slate-800 text-blue-300`}><CalendarPlus aria-hidden="true" className="h-4 w-4" />Buat Acara</button></div></div>
      <p className="text-xs text-slate-400">Hubungkan Google Calendar sekali, lalu jadwal di sini otomatis tersinkron.</p>
      {!schedulesLoaded ? <div role="status"><span className="sr-only">Memuat jadwal…</span><RowSkeleton count={2} /></div> : !upcoming.length ? <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Tidak ada jadwal mendatang. Klik &quot;Jadwalkan&quot; pada laporan, atau &quot;Buat Acara&quot; di atas.</p> : <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">{upcoming.map((item) => <button key={item.id} disabled={busy} onClick={() => onEditSchedule(item)} className="block w-full p-4 text-left hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset"><div className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{item.date} · {item.startTime}–{item.endTime}</div><p className="mt-1 break-words text-sm font-semibold">{item.title}</p>{(item.picNama || item.location || item.fotoUrls?.length > 0) && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{item.picNama && <MetaBadge icon={UserRound}>{item.picNama}</MetaBadge>}{item.location && <MetaBadge icon={MapPin}>{item.location}</MetaBadge>}{item.fotoUrls?.length > 0 && <MetaBadge icon={Camera}>{item.fotoUrls.length}</MetaBadge>}</div>}</button>)}</div>}
    </section>
    <MiniCalendar schedules={upcoming} />
  </div>;
}
