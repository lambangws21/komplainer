'use client';
import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, BellOff } from 'lucide-react';
import { apiRequest, postJson } from './api-client.mjs';

// Standard Web Push helper: the VAPID public key is base64url text, pushManager.subscribe()
// needs it as raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Toggle lives in the account menu, visible to every role (not admin-gated, unlike Jadwal &
// Agenda) — notifications are useful to pelapor/petugas too. Renders nothing if the browser has
// no Push API at all (older browsers, or iOS Safari not yet added to the Home Screen).
export default function PushToggle({ onExpired }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setSupported(true);
    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    }).catch(() => {});
  }, []);

  async function enable() {
    setBusy(true); setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setError('Izin notifikasi ditolak di browser/HP Anda.'); return; }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) { setError('Notifikasi belum dikonfigurasi di server.'); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await apiRequest('/api/push/subscribe', postJson({ subscription: subscription.toJSON() }));
      setSubscribed(true);
    } catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message || 'Gagal mengaktifkan notifikasi.'); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) { await apiRequest('/api/push/unsubscribe', postJson({ endpoint: subscription.endpoint })); await subscription.unsubscribe(); }
      setSubscribed(false);
    } catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message || 'Gagal menonaktifkan notifikasi.'); }
    finally { setBusy(false); }
  }

  if (!supported) return null;
  return <>
    <DropdownMenu.Item disabled={busy} onSelect={(event) => { event.preventDefault(); if (busy) return; if (subscribed) disable(); else enable(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-slate-800 focus:bg-slate-800 data-[disabled]:opacity-50">
      {subscribed ? <Bell aria-hidden="true" className="h-4 w-4 text-emerald-300" /> : <BellOff aria-hidden="true" className="h-4 w-4 text-slate-400" />}
      <span className="flex-1 text-left">{busy ? 'Memproses…' : subscribed ? 'Notifikasi HP aktif' : 'Aktifkan notifikasi HP'}</span>
    </DropdownMenu.Item>
    {error && <p className="px-3 pb-1 text-xs leading-5 text-red-300">{error}</p>}
    {!subscribed && !error && <p className="px-3 pb-1 text-xs leading-5 text-slate-500">Di iPhone, pasang dulu ke layar utama (Add to Home Screen) sebelum ini bisa aktif.</p>}
  </>;
}
