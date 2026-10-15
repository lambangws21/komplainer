'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Info, X, Share2, Check, ClipboardList, UserRound, Workflow, BarChart3, SlidersHorizontal, Users, Eye, KeyRound, Smartphone, Mail, Package } from 'lucide-react';
import { mobileDialog, dialogHeader, dialogBody } from './ui-styles.mjs';

// Grouped by "what are you trying to do" rather than a flat feature dump — a newcomer opening
// this wants "what can I do here", not an undifferentiated changelog-style list.
const SECTIONS = [
  { title: 'Alur kerja laporan', items: [
    { icon: Workflow, color: 'text-amber-300 bg-amber-500/15', text: 'Baru → ditentukan PIC-nya → PIC mencatat tindak lanjut (RTL) → Selesai, dengan opsi dibuka kembali jika perlu' },
    { icon: Package, color: 'text-orange-300 bg-orange-500/15', text: 'Implant terkait terdeteksi otomatis dari isi laporan' },
    { icon: Eye, color: 'text-sky-300 bg-sky-500/15', text: 'Semua pengguna bisa melihat seluruh laporan secara penuh — masalah, solusi, dan penanganannya — untuk transparansi tim' },
  ] },
  { title: 'Peran pengguna', items: [
    { icon: ClipboardList, color: 'text-blue-300 bg-blue-500/15', text: 'Pelapor — buat, edit, dan arsipkan laporan milik sendiri; pendaftaran perlu disetujui Admin' },
    { icon: UserRound, color: 'text-violet-300 bg-violet-500/15', text: 'Petugas (PIC) — ambil tugas penanganan dan catat RTL hingga laporan selesai' },
    { icon: Users, color: 'text-pink-300 bg-pink-500/15', text: 'Admin — tentukan PIC, kelola akun & pengumuman, pantau rekap seluruh tim' },
  ] },
  { title: 'Pencarian & rekap', items: [
    { icon: SlidersHorizontal, color: 'text-cyan-300 bg-cyan-500/15', text: 'Pencarian dan filter berdasarkan tingkat keparahan, status, atau rentang tanggal kustom' },
    { icon: BarChart3, color: 'text-emerald-300 bg-emerald-500/15', text: 'Rekap mingguan & bulanan, plus export data ke Excel (CSV)' },
  ] },
  { title: 'Akun & perangkat', items: [
    { icon: KeyRound, color: 'text-indigo-300 bg-indigo-500/15', text: 'Login dengan email atau username, kelola profil & password sendiri' },
    { icon: Smartphone, color: 'text-teal-300 bg-teal-500/15', text: 'Bisa dipasang sebagai aplikasi (PWA); internet tetap diperlukan untuk memuat dan menyimpan laporan' },
  ] },
];
const RENCANA = [
  { icon: Mail, color: 'text-amber-300 bg-amber-500/15', text: 'Notifikasi email otomatis ke PIC & admin saat ada laporan kritis (C1/C2) yang belum ditangani' },
];
const INTRO = 'Komplainer membantu tim mencatat, menindaklanjuti, dan menyelesaikan komplain lapangan — dari laporan masuk sampai selesai ditangani, dengan jejak riwayat yang jelas.';
const SHARE_TEXT = `Komplainer — Aplikasi pelaporan & tindak lanjut komplain lapangan.\n\n${INTRO}\n\n${SECTIONS.map((section) => `${section.title}:\n${section.items.map((item) => `• ${item.text}`).join('\n')}`).join('\n\n')}\n\nRencana ke depan:\n${RENCANA.map((item) => `• ${item.text}`).join('\n')}`;

function FeatureItem({ icon: Icon, color, text }) {
  return <li className="flex items-start gap-3"><span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon className="h-4 w-4" /></span><span className="pt-1">{text}</span></li>;
}

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
      <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Tentang Komplainer</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{INTRO}</Dialog.Description><Dialog.Close aria-label="Tutup" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
      <div className={`${dialogBody} space-y-5 pt-5`}>
        {SECTIONS.map((section) => <section key={section.title}><h3 className="font-semibold text-slate-100">{section.title}</h3><ul className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{section.items.map((item) => <FeatureItem key={item.text} {...item} />)}</ul></section>)}
        <section><h3 className="font-semibold text-slate-100">Rencana ke depan</h3><ul className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{RENCANA.map((item) => <FeatureItem key={item.text} {...item} />)}</ul></section>
        <button type="button" onClick={share} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500">{copied ? <><Check aria-hidden="true" className="h-4 w-4" />Tersalin ke clipboard</> : <><Share2 aria-hidden="true" className="h-4 w-4" />Bagikan info aplikasi</>}</button>
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
