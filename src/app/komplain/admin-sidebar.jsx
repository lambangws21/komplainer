'use client';
import { LayoutDashboard, Table2, Users, Megaphone, DatabaseBackup, CalendarClock } from 'lucide-react';

const itemClass = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

// Jadwal doesn't have its own tab yet (it's a widget on Dashboard, not a full page) — its entry
// jumps to and highlights that section instead of switching tabs, so it still gets a dedicated
// nav spot without pretending there's more to it than the Beranda widget.
function scrollToSchedule() {
  document.getElementById('jadwal-agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function AdminSidebar({ tab, setTab }) {
  const items = [
    ['form', 'Dashboard', LayoutDashboard, () => setTab('form')],
    ['table', 'Laporan', Table2, () => setTab('table')],
    ['users', 'Pengguna', Users, () => setTab('users')],
    ['announcements', 'Pengumuman', Megaphone, () => setTab('announcements')],
    ['backup', 'Backup', DatabaseBackup, () => setTab('backup')],
    [null, 'Jadwal', CalendarClock, () => { setTab('form'); setTimeout(scrollToSchedule, 50); }],
  ];
  return <nav aria-label="Navigasi admin" className="sticky top-20 hidden w-56 shrink-0 space-y-1 self-start lg:block">
    {items.map(([value, label, Icon, onSelect]) => <button key={label} type="button" onClick={onSelect} aria-current={value && tab === value ? 'page' : undefined} className={`${itemClass} ${value && tab === value ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}
    </button>)}
  </nav>;
}
