'use client';
import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { announcementAudience } from '@/lib/announcement-policy.mjs';
import { apiRequest, postJson } from './api-client.mjs';

function expiryLabel(item) {
  if (!item.expiresAt) return 'Tidak dibatasi';
  const remainingMs = new Date(item.expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'Kedaluwarsa';
  const days = Math.ceil(remainingMs / 86400000);
  return `Sisa ${days} hari`;
}
export default function AnnouncementPanel({ onCreate, onChanged }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const load = () => apiRequest('/api/announcements?all=1').then((result) => setItems(result.data)).catch((failure) => setError(failure.message));
  useEffect(() => { load(); }, []);
  async function toggle(item) {
    setBusy(true); setError('');
    try { await apiRequest('/api/announcements', postJson({ action: 'update', id: item.id, active: !item.active })); await load(); onChanged?.(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function remove(item) {
    setBusy(true); setError('');
    try { await apiRequest('/api/announcements', postJson({ action: 'delete', id: item.id })); await load(); setConfirmDelete(null); onChanged?.(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section aria-label="Pengumuman" className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Pengumuman</h2><p className="mt-1 text-sm text-slate-400">Atur penerima dan masa tampil. Pengumuman muncul sebagai banner; status dibaca tersimpan per akun.</p></div><button onClick={onCreate} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Megaphone aria-hidden="true" className="h-4 w-4" />Buat pengumuman</button></div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {items == null ? <p role="status" className="text-sm text-slate-400">Memuat pengumuman…</p> : items.length === 0 ? <p className="text-sm text-slate-400">Belum ada pengumuman.</p> : <ul className="space-y-2">{items.map((item) => { const expired = expiryLabel(item) === 'Kedaluwarsa'; return <li key={item.id} className={`rounded-xl border p-3 ${item.active && !expired ? 'border-slate-700 bg-slate-950/30' : 'border-slate-800 bg-slate-950/10 opacity-60'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="mb-2 flex flex-wrap gap-2 text-xs"><span className={`rounded-full border px-2 py-1 ${item.priority === 'important' ? 'border-amber-500/60 text-amber-200' : 'border-blue-500/60 text-blue-200'}`}>{item.priority === 'important' ? 'Penting' : 'Informasi'}</span><span className="rounded-full border border-slate-600 px-2 py-1 text-slate-200">{announcementAudience(item)}{item.audience === 'users' ? ` (${item.recipientIds?.length || 0})` : ''}</span></p><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{item.body}</p><p className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500"><span>{item.active ? 'Aktif' : 'Nonaktif'} · oleh {item.createdByNama}</span><span className={expired ? 'text-red-300' : 'text-blue-300'}>· {expiryLabel(item)}</span></p></div>
      <div className="flex shrink-0 flex-wrap gap-1.5"><button disabled={busy} onClick={() => toggle(item)} className="min-h-11 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">{item.active ? 'Nonaktifkan' : 'Aktifkan'}</button><button disabled={busy} onClick={() => setConfirmDelete(item.id)} className="min-h-11 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10">Hapus</button></div></div>{confirmDelete === item.id && <div className="mt-3 rounded-lg border border-red-800 p-3"><p className="text-sm text-red-200">Hapus pengumuman ini untuk semua penerimanya?</p><div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => setConfirmDelete(null)} className="min-h-11 rounded-lg bg-slate-800 px-3 text-sm">Batal</button><button disabled={busy} onClick={() => remove(item)} className="min-h-11 rounded-lg bg-red-700 px-3 text-sm font-semibold">{busy ? 'Menghapus…' : 'Ya, hapus'}</button></div></div>}
    </li>; })}</ul>}
  </section>;
}
