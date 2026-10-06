'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Info, X, Share2, Check } from 'lucide-react';
import { mobileDialog, dialogHeader, dialogBody } from './ui-styles.mjs';

const FUNGSI = [
  'Catat & kelola laporan komplain lapangan — buat, edit, dan arsipkan laporan milik sendiri',
  'Tentukan PIC, pantau tenggat, dan catat tindak lanjut hingga laporan selesai',
  'Alur status: Baru → Diproses/Menunggu → Selesai, dengan opsi buka kembali',
  'Rekap mingguan & bulanan, plus export data ke Excel (CSV)',
  'Pencarian, filter tingkat keparahan/status, dan filter rentang tanggal kustom',
  'Peran berbeda — Admin, Petugas/PIC, dan Pelapor — dengan akses yang disesuaikan',
  'Semua pengguna bisa melihat status laporan lain (tanpa isi) untuk transparansi',
  'Login dengan email atau username, kelola profil & password sendiri',
  'Bisa di-install sebagai aplikasi (PWA) dan tetap bisa dibuka saat offline',
];
const RENCANA = [
  'Notifikasi email otomatis ke PIC & admin saat ada laporan kritis (C1/C2) yang belum ditangani',
  'Pencatatan produk/implant yang terlibat dalam laporan',
];
const SHARE_TEXT = `Komplainer — Aplikasi pelaporan & tindak lanjut komplain lapangan.\n\nFitur saat ini:\n${FUNGSI.map((item) => `• ${item}`).join('\n')}\n\nRencana ke depan:\n${RENCANA.map((item) => `• ${item}`).join('\n')}`;

export default function InfoPanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Komplainer', text: SHARE_TEXT }); } catch { /* user cancelled the share sheet */ }
      return;
    }
    try { await navigator.clipboard.writeText(SHARE_TEXT); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" aria-label="Info aplikasi" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3 text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><Info aria-hidden="true" className="h-5 w-5" /></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content className={`komplain-theme ${mobileDialog} max-w-lg`}>
      <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Tentang Komplainer</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Ringkasan fungsi aplikasi dan rencana pengembangan ke depan.</Dialog.Description><Dialog.Close aria-label="Tutup" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
      <div className={`${dialogBody} space-y-5 pt-5`}>
        <section><h3 className="font-semibold text-white">Fungsi aplikasi</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{FUNGSI.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />{item}</li>)}</ul></section>
        <section><h3 className="font-semibold text-white">Rencana ke depan</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{RENCANA.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{item}</li>)}</ul></section>
        <button type="button" onClick={share} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500">{copied ? <><Check aria-hidden="true" className="h-4 w-4" />Tersalin ke clipboard</> : <><Share2 aria-hidden="true" className="h-4 w-4" />Bagikan info aplikasi</>}</button>
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
