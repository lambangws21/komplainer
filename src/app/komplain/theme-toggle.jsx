'use client';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50';

// Renders nothing until mounted — the server can't know the persisted preference, so rendering
// either icon before hydration would briefly show the wrong one.
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span aria-hidden="true" className={`${buttonClass} border border-slate-700 bg-slate-800 px-2.5 opacity-0`} />;
  const isLight = theme === 'light';
  return <button type="button" onClick={() => setTheme(isLight ? 'dark' : 'light')} aria-label={isLight ? 'Pakai mode gelap' : 'Pakai mode terang'} className={`${buttonClass} border border-slate-700 bg-slate-800 px-2.5`}>
    {isLight ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
  </button>;
}
