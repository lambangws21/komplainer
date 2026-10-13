'use client';
import { ClipboardList } from 'lucide-react';
import ThemeToggle from './theme-toggle';

// Wraps the login/approval/loading screens shown before a session exists — a standalone,
// centered page instead of the full app shell (no sidebar/tabs/notifications to show yet).
export default function AuthShell({ children }) {
  return <div className="relative flex min-h-screen flex-col items-center px-4 py-10 sm:py-14">
    <div className="absolute right-4 top-4"><ThemeToggle /></div>
    <div className="flex flex-col items-center gap-3 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300"><ClipboardList aria-hidden="true" className="h-6 w-6" /></span>
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Monitoring</p><h1 className="text-xl font-bold sm:text-2xl">Laporan Komplain</h1></div>
    </div>
    <div className="flex w-full flex-1 items-center justify-center py-8">{children}</div>
    <p className="text-center text-xs text-slate-500">© {new Date().getFullYear()} Monitoring Laporan Komplain. Semua hak dilindungi.</p>
  </div>;
}
