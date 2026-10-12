'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, X, Copy, Check, Unlink, Users } from 'lucide-react';
import { mobileDialog, dialogHeader, dialogBody } from './ui-styles.mjs';
import { apiRequest, postJson } from './api-client.mjs';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';

// Shows whether a shared Google Calendar is connected (one calendar for the whole team, written
// to directly via the Calendar API — see src/lib/server/google-calendar.mjs). Connecting itself
// is a full-page OAuth redirect (/api/calendar/google/connect), not something this component can
// drive via fetch; it only displays status and the resulting subscribe link.
export default function GoogleCalendarStatus({ isAdmin, onExpired }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { const result = await apiRequest('/api/calendar/google/status'); setStatus(result); setGroupInput(result.groupEmail || ''); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message); }
    finally { setLoading(false); }
  }
  function onOpenChange(next) { setOpen(next); setCopied(false); if (next) load(); }
  async function shareGroup(event) {
    event.preventDefault();
    if (groupBusy || !groupInput.trim()) return;
    setGroupBusy(true); setError('');
    try { await apiRequest('/api/calendar/google/group', postJson({ action: 'share', groupEmail: groupInput.trim() })); await load(); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message); }
    finally { setGroupBusy(false); }
  }
  async function removeGroup() {
    if (groupBusy) return;
    setGroupBusy(true); setError('');
    try { await apiRequest('/api/calendar/google/group', postJson({ action: 'unshare' })); setGroupInput(''); await load(); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message); }
    finally { setGroupBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(status.subscribeUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function disconnect() {
    if (disconnecting) return;
    setDisconnecting(true); setError('');
    try { await apiRequest('/api/calendar/google/disconnect', postJson({ action: 'disconnect' })); await load(); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message); }
    finally { setDisconnecting(false); }
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger asChild>
      <button type="button" className={`${button} border ${status?.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'}`}><CalendarDays aria-hidden="true" className="h-4 w-4" />Google Calendar</button>
    </Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content className={`komplain-theme ${mobileDialog} max-w-lg`}>
      <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Google Calendar</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Satu kalender bersama untuk seluruh tim — jadwal yang dibuat di sini otomatis masuk ke kalender itu.</Dialog.Description><Dialog.Close aria-label="Tutup" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
      <div className={`${dialogBody} space-y-5 pt-5`}>
        {error && <p role="alert" className="rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        {loading ? <p className="text-sm text-slate-400">Memeriksa status…</p> : !status?.available ? <p className="text-sm text-slate-400">Fitur ini belum tersedia di mode data saat ini.</p> : status.connected ? <>
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><Check aria-hidden="true" className="h-4 w-4 shrink-0" />Terhubung sebagai {status.email}</p></div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="gcal-subscribe-url">Tautan subscribe (bagikan ke tim)</label>
            <div className="flex gap-2"><input id="gcal-subscribe-url" readOnly value={status.subscribeUrl} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-100" /><button type="button" onClick={copy} className={`${button} shrink-0 bg-blue-600 text-white hover:bg-blue-500`}>{copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}{copied ? 'Tersalin' : 'Salin'}</button></div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Tiap orang buka Google Calendar → Kalender lain → Dari URL → tempel tautan ini, sekali saja. Update jadwal muncul otomatis secara berkala (bukan instan).</p>
          </div>
          {isAdmin && <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Users aria-hidden="true" className="h-4 w-4 text-slate-400" />Bagikan ke Google Group (opsional)</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">Lebih praktis dari tautan di atas — anggota group otomatis lihat kalender ini di Google Calendar mereka sendiri, tanpa subscribe manual. Group-nya buat & kelola sendiri di <span className="text-slate-300">groups.google.com</span>; di sini cuma mengatur aksesnya (lihat saja, semua perubahan tetap lewat aplikasi).</p>
            <form onSubmit={shareGroup} className="mt-3 flex gap-2">
              <input type="email" disabled={groupBusy} placeholder="tim-komplainer@googlegroups.com" value={groupInput} onChange={(event) => setGroupInput(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500" />
              <button type="submit" disabled={groupBusy || !groupInput.trim()} className={`${button} shrink-0 bg-blue-600 px-3 text-white hover:bg-blue-500`}>{groupBusy ? '…' : status.groupEmail ? 'Ubah' : 'Bagikan'}</button>
            </form>
            {status.groupEmail && <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-emerald-300">Aktif untuk: {status.groupEmail}</p><button type="button" disabled={groupBusy} onClick={removeGroup} className="text-xs font-semibold text-red-300 hover:text-red-200 disabled:opacity-50">Hapus akses group</button></div>}
          </div>}
          {isAdmin && <button type="button" disabled={disconnecting} onClick={disconnect} className={`${button} w-full bg-red-950/60 text-red-200 hover:bg-red-900/60`}><Unlink aria-hidden="true" className="h-4 w-4" />{disconnecting ? 'Memutuskan…' : 'Putuskan koneksi'}</button>}
        </> : isAdmin ? <>
          <p className="text-sm leading-6 text-slate-300">Belum terhubung. Hubungkan satu akun Google — semua jadwal akan otomatis tersinkron ke kalender bersama, dan tim bisa subscribe lewat satu tautan.</p>
          <a href="/api/calendar/google/connect" className={`${button} w-full bg-blue-600 text-white hover:bg-blue-500`}><CalendarDays aria-hidden="true" className="h-4 w-4" />Hubungkan Google Calendar</a>
        </> : <p className="text-sm text-slate-400">Belum terhubung ke Google Calendar. Hubungi admin untuk menghubungkannya.</p>}
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
