'use client';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { pushSupported, existingPushSubscription, subscribePush } from './push-subscription.mjs';

const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50';
const dismissKey = (userId) => `komplain-push-prompt-seen:${userId}`;

// A one-time, dismissible nudge to turn on HP push notifications — separate from the manual
// toggle buried in the account menu, so new accounts actually discover that reports/mentions can
// reach them as a real OS notification even when the app/tab isn't open. Shown once per account;
// silently skipped if the browser has no Push API, the subscription already exists, or the user
// (or browser) already said no (re-asking after a denial is futile — the browser blocks it).
export default function PushPrompt({ userId, active, onExpired }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active || !userId || !pushSupported()) return;
    let alive = true;
    try { if (localStorage.getItem(dismissKey(userId))) return; } catch { /* localStorage unavailable */ }
    if (Notification.permission === 'denied') return;
    existingPushSubscription().then((existing) => { if (alive && !existing) setVisible(true); }).catch(() => {});
    return () => { alive = false; };
  }, [active, userId]);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(dismissKey(userId), '1'); } catch { /* localStorage unavailable */ }
  }

  async function enable() {
    setBusy(true); setError('');
    try { await subscribePush(); dismiss(); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message || 'Gagal mengaktifkan notifikasi.'); }
    finally { setBusy(false); }
  }

  if (!visible) return null;
  return <aside role="status" aria-label="Aktifkan notifikasi" className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Bell aria-hidden="true" className="h-4 w-4" /></span>
    <div className="min-w-0 flex-1">
      <p className="font-semibold">Aktifkan notifikasi?</p>
      <p className="mt-0.5 text-xs leading-5 text-slate-400">Dapatkan info laporan baru, penugasan, dan sebutan langsung di layar HP/laptop meski aplikasi ini sedang tertutup.</p>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-300">{error}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={enable} className={`${button} bg-blue-600 text-white hover:bg-blue-500`}>{busy ? 'Mengaktifkan…' : 'Aktifkan notifikasi'}</button>
        <button disabled={busy} onClick={dismiss} className={`${button} text-slate-300 hover:bg-slate-800`}>Nanti saja</button>
      </div>
    </div>
    <button aria-label="Tutup" onClick={dismiss} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><X aria-hidden="true" className="h-4 w-4" /></button>
  </aside>;
}
