'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, X, Copy, Check, RefreshCw } from 'lucide-react';
import { mobileDialog, dialogHeader, dialogBody } from './ui-styles.mjs';
import { apiRequest, postJson } from './api-client.mjs';

const STEPS = [
  ['Google Calendar', ['Buka Google Calendar di browser.', 'Klik "+" di samping "Kalender lain", pilih "Dari URL".', 'Tempel tautan di atas, lalu klik "Tambahkan kalender".']],
  ['Outlook', ['Buka Outlook Calendar → "Tambah kalender" → "Berlangganan dari web".', 'Tempel tautan di atas, beri nama, lalu simpan.']],
  ['Apple Calendar', ['Buka app Kalender → menu File → "Kalender Baru" → "Berlangganan Kalender".', 'Tempel tautan di atas, lalu klik "Berlangganan".']],
];

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';

export default function CalendarConnect({ onExpired }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const result = await apiRequest('/api/calendar/token'); setUrl(result.url); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message); }
    finally { setLoading(false); }
  }
  function onOpenChange(next) { setOpen(next); setCopied(false); if (next && !url && !loading) load(); }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function reset() {
    if (resetting) return;
    setResetting(true); setError(''); setCopied(false);
    try { const result = await apiRequest('/api/calendar/token', postJson({ action: 'reset' })); setUrl(result.url); }
    catch (err) { if (err.code === 401) onExpired?.(); else setError(err.message); }
    finally { setResetting(false); }
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger asChild>
      <button type="button" className={`${button} border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20`}><CalendarDays aria-hidden="true" className="h-4 w-4" />Google Calendar</button>
    </Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content className={`komplain-theme ${mobileDialog} max-w-lg`}>
      <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Hubungkan Google Calendar</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Subscribe sekali — jadwal baru akan otomatis muncul di kalender Anda secara berkala (bukan instan, biasanya beberapa jam).</Dialog.Description><Dialog.Close aria-label="Tutup" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
      <div className={`${dialogBody} space-y-5 pt-5`}>
        {error && <p role="alert" className="rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="calendar-feed-url">Tautan kalender pribadi Anda</label>
          <div className="flex gap-2">
            <input id="calendar-feed-url" readOnly value={loading ? 'Memuat tautan…' : url} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" />
            <button type="button" disabled={loading || !url} onClick={copy} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}{copied ? 'Tersalin' : 'Salin'}</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Jangan bagikan tautan ini — siapa pun yang memilikinya bisa melihat jadwal Anda. Bocor?{' '}
            <button type="button" disabled={resetting || loading} onClick={reset} className="inline-flex items-center gap-1 font-semibold text-blue-300 hover:text-blue-200 disabled:opacity-50"><RefreshCw aria-hidden="true" className="h-3 w-3" />{resetting ? 'Mereset…' : 'Reset tautan'}</button>
          </p>
        </div>
        <div className="space-y-4">{STEPS.map(([name, items]) => <section key={name}><h3 className="text-sm font-semibold">{name}</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">{items.map((step) => <li key={step}>{step}</li>)}</ol></section>)}</div>
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
