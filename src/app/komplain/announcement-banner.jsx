'use client';
import { Megaphone, ChevronUp, Check, AlertCircle } from 'lucide-react';
import { announcementAudience } from '@/lib/announcement-policy.mjs';

export default function AnnouncementBanner({ items, open, onMinimize, onDismiss, onOpen, user, dismissing }) {
  if (!open || !items.length || !user) return null;
  const item = items[0];
  const important = item.priority === 'important';
  const heading = item.audience === 'users' ? 'Pesan untuk Anda' : item.audience && item.audience !== 'all' ? `Pengumuman ${announcementAudience(item)}` : 'Pengumuman';
  const color = important ? 'border-amber-400/70 bg-amber-950/50 text-amber-100' : user.role === 'petugas' ? 'border-teal-600/60 bg-teal-950/40 text-teal-100' : user.role === 'admin' ? 'border-violet-600/60 bg-violet-950/40 text-violet-100' : 'border-blue-600/60 bg-blue-950/40 text-blue-100';
  return <aside aria-label={heading} className={`rounded-xl border p-3 sm:p-4 ${color}`}>
    <div className="flex items-center gap-2">{important ? <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" /> : <Megaphone aria-hidden="true" className="h-5 w-5 shrink-0" />}<p className="min-w-0 flex-1 text-xs font-semibold">{heading}{important && ' · Penting'}</p>{items.length > 1 && <span className="text-xs">+{items.length - 1} lagi</span>}<button type="button" aria-label="Sembunyikan sementara pengumuman" onClick={onMinimize} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"><ChevronUp aria-hidden="true" className="h-5 w-5" /></button></div>
    <h2 className="break-words text-sm font-semibold sm:text-base">{item.title}</h2><p className="mt-1 line-clamp-2 break-words text-sm leading-6">{item.body}</p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onOpen} className="min-h-11 rounded-lg border border-current px-3 py-2 text-sm font-semibold hover:bg-white/10">Baca selengkapnya</button>{!important && <button type="button" disabled={!!dismissing} onClick={() => onDismiss(item)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"><Check aria-hidden="true" className="h-4 w-4" />{dismissing === item.id ? 'Menyimpan…' : 'Tandai dibaca'}</button>}</div>
  </aside>;
}
