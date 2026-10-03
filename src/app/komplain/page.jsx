'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import DataView from './data-view';
import InstallApp from './install-app';
import { PlusCircle, RefreshCw, Lock, Unlock, X, CheckCircle2 } from 'lucide-react';

const LEVELS = [
  { code: 'C1 - Critical', label: 'C1 Critical', color: 'text-red-300 border-red-800 bg-red-950/40' },
  { code: 'C2 - Major', label: 'C2 Major', color: 'text-orange-300 border-orange-800 bg-orange-950/40' },
  { code: 'C3 - Moderate', label: 'C3 Moderate', color: 'text-amber-300 border-amber-800 bg-amber-950/40' },
  { code: 'C4 - Minor', label: 'C4 Minor', color: 'text-emerald-300 border-emerald-800 bg-emerald-950/40' },
];
const fields = [
  ['tanggal', 'Tanggal kejadian', 'date'], ['dokter', 'Dokter', 'text'],
  ['team', 'Tim / unit', 'text'], ['tindakan', 'Tindakan operasional', 'text'],
  ['komplain', 'Deskripsi masalah', 'textarea'], ['jalanKeluar', 'Jalan keluar / solusi', 'textarea'],
];
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const newForm = () => ({ tanggal: today(), dokter: '', team: '', tindakan: '', komplain: '', jalanKeluar: '', status: LEVELS[2].code });
const formatDate = (value) => {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak tersedia' : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};
function Badge({ status }) {
  const level = LEVELS.find((item) => item.code === status);
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${level?.color || 'border-slate-600 text-slate-300'}`}>{level?.label || status || 'Belum diklasifikasikan'}</span>;
}
async function requestApi(options) {
  const response = await fetch('/api/komplain', options);
  const result = await response.json();
  if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Permintaan gagal. Silakan coba lagi.');
  return result;
}

export default function KomplainPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const mutationLock = useRef(false);
  const [tab, setTab] = useState('form');
  const [unlocked, setUnlocked] = useState(false);
  const [modal, setModal] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [editId, setEditId] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(newForm);
  const [successText, setSuccessText] = useState('');
  const newButton = useRef(null);
  const masterButton = useRef(null);
  const modalReturnFocus = useRef(null);

  async function fetchData() {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError('');
    try {
      const result = await requestApi({ cache: 'no-store' });
      if (!Array.isArray(result.data)) throw new Error('Format data laporan tidak valid.');
      if (version === requestVersion.current) { setList(result.data); setLoaded(true); }
    } catch (error) {
      if (version === requestVersion.current) setLoadError(error.message || 'Tidak dapat memuat laporan.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }
  useEffect(() => { fetchData(); return () => { requestVersion.current += 1; }; }, []);

  function openModal(next) {
    modalReturnFocus.current = document.activeElement;
    setActionError('');
    setModal(next);
  }
  function openForm(item) {
    setEditId(item ? item.id : null);
    setForm(item ? { ...newForm(), ...Object.fromEntries(Object.keys(newForm()).map((key) => [key, String(item[key] ?? '')])), tanggal: String(item.tanggal || '').slice(0, 10) } : newForm());
    openModal('form');
  }
  function review(event) {
    event.preventDefault();
    const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    if (fields.some(([key]) => !trimmed[key])) { setActionError('Lengkapi semua kolom. Isian tidak boleh hanya berisi spasi.'); return; }
    setForm(trimmed);
    setActionError('');
    setModal('review');
  }
  async function mutate(action) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setActionError('');
    const editing = editId !== null;
    try {
      await requestApi({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'delete' ? { action, id: deleteItem.id } : { action: editing ? 'update' : 'create', ...(editing ? { id: editId } : {}), ...form }) });
      setSuccessText(action === 'delete' ? 'Laporan berhasil dihapus.' : editing ? 'Perubahan laporan berhasil disimpan.' : 'Laporan berhasil dikirim.');
      setModal('success');
      if (editing || action === 'delete') setTab('table');
      void fetchData();
    } catch (error) { setActionError(error.message || 'Koneksi gagal. Silakan coba lagi.'); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  const titles = { form: editId !== null ? 'Edit laporan komplain' : 'Buat laporan komplain', review: 'Tinjau laporan', pin: 'Akses Data Master', delete: 'Hapus laporan?', success: 'Berhasil' };
  const descriptions = { form: 'Lengkapi semua kolom bertanda *. Tinjau laporan sebelum mengirim.', review: 'Pastikan informasi sudah benar sebelum disimpan.', pin: 'Masukkan PIN untuk membuka daftar laporan.', delete: 'Laporan yang dihapus tidak dapat dipulihkan dari halaman ini.', success: successText };

  return (
    <main lang="id" className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="mb-1 text-sm text-blue-300">Monitoring lapangan</p><h1 className="text-2xl font-bold sm:text-3xl">Laporan Komplain</h1><p className="mt-2 text-sm text-slate-400">Catat kendala dan pantau tingkat keparahan laporan.</p></div>
            <button onClick={fetchData} disabled={loading || busy} aria-label="Muat ulang laporan" className={`${buttonClass} shrink-0 border border-slate-700 bg-slate-800 px-3`}><RefreshCw aria-hidden="true" className={`h-5 w-5 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
          </div>
          <nav aria-label="Halaman komplain" className="mt-5 flex gap-2 border-t border-slate-800 pt-4">
            <button ref={newButton} onClick={() => setTab('form')} aria-current={tab === 'form' ? 'page' : undefined} className={`${buttonClass} flex-1 sm:flex-none ${tab === 'form' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Input Laporan</button>
            <button ref={masterButton} onClick={() => { if (unlocked) setTab('table'); else { setPin(''); setPinError(''); openModal('pin'); } }} aria-current={tab === 'table' ? 'page' : undefined} className={`${buttonClass} flex-1 sm:flex-none ${tab === 'table' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{unlocked ? <Unlock aria-hidden="true" className="h-4 w-4" /> : <Lock aria-hidden="true" className="h-4 w-4" />}Data Master</button>
            {unlocked && <button aria-label="Kunci Data Master" className={`${buttonClass} border border-slate-700 px-3 sm:ml-auto`} onClick={() => { setUnlocked(false); setTab('form'); }}><Lock aria-hidden="true" className="h-4 w-4" /></button>}
          </nav>
        </header>

        <InstallApp />

        {loadError && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"><p className="font-semibold">Laporan gagal dimuat</p><p className="mt-1 break-words">{loadError}</p>{loaded && <p className="mt-1">Menampilkan data terakhir yang berhasil dimuat.</p>}<button disabled={loading} onClick={fetchData} className={`${buttonClass} mt-3 bg-slate-800`}>Coba lagi</button></div>}
        {loading && <p role="status" className="text-sm text-slate-300">{loaded ? 'Memperbarui laporan…' : 'Memuat laporan…'}</p>}

        {tab === 'form' ? <section aria-label="Ringkasan laporan" className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Ada kendala di lapangan?</h2><p className="mt-1 text-sm text-slate-400">Laporkan masalah beserta solusi yang dilakukan.</p></div><button onClick={() => openForm()} className={`${buttonClass} bg-blue-600 hover:bg-blue-500`}><PlusCircle aria-hidden="true" className="h-5 w-5" />Buat laporan baru</button></div>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Tingkat keparahan</h2><span className="text-sm text-slate-400">Total: {loaded ? list.length : '—'} laporan</span></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{LEVELS.map((level) => <div key={level.code} className={`rounded-2xl border p-5 ${level.color}`}><p className="text-sm font-semibold">{level.label}</p><p className="mt-3 text-3xl font-bold text-white">{loaded ? list.filter((item) => item.status === level.code).length : '—'}</p><p className="mt-1 text-xs">laporan</p></div>)}</div>
        </section> : unlocked && <DataView
          list={list} loaded={loaded} loading={loading} loadError={loadError} busy={busy}
          levels={LEVELS} Badge={Badge} formatDate={formatDate} today={today}
          onCreate={() => openForm()} onEdit={openForm}
          onDelete={(item) => { setDeleteItem(item); openModal('delete'); }}
        />}

      </div>

      <Dialog.Root open={modal !== null} onOpenChange={(open) => { if (!open && !busy) { setModal(null); setPin(''); setPinError(''); } }}>
        <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm" /><Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); const target = modalReturnFocus.current; (target?.isConnected ? target : tab === 'table' ? masterButton.current : newButton.current)?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6">
          <Dialog.Title className="pr-12 text-xl font-bold">{titles[modal]}</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">{descriptions[modal]}</Dialog.Description>
          <Dialog.Close disabled={busy} aria-label="Tutup dialog" className={`${buttonClass} absolute right-3 top-3 px-3 text-slate-300 hover:bg-slate-800`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
          {actionError && <p role="alert" className="mt-4 break-words rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{actionError}</p>}
          {modal === 'form' && <form onSubmit={review} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">{fields.map(([name, label, type]) => <div key={name} className={type === 'textarea' || name === 'tindakan' ? 'sm:col-span-2' : ''}><label htmlFor={`komplain-${name}`} className="mb-2 block text-sm font-medium">{label} <span aria-hidden="true">*</span></label>{type === 'textarea' ? <textarea id={`komplain-${name}`} name={name} required rows={3} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={`${inputClass} min-h-24 resize-y`} /> : <input id={`komplain-${name}`} name={name} type={type} required value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className={inputClass} />}</div>)}</div>
            <fieldset><legend className="mb-2 text-sm font-medium">Tingkat keparahan *</legend><div className="grid grid-cols-2 gap-2">{LEVELS.map((level) => <label key={level.code} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${form.status === level.code ? level.color : 'border-slate-700 text-slate-300'}`}><input type="radio" name="status" value={level.code} checked={form.status === level.code} required onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-4 w-4 accent-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" />{level.label}</label>)}</div></fieldset>
            <div className="flex gap-3 border-t border-slate-800 pt-4"><Dialog.Close className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button type="submit" className={`${buttonClass} flex-1 bg-blue-600 hover:bg-blue-500`}>Tinjau laporan</button></div>
          </form>}
          {modal === 'review' && <div className="mt-5 space-y-4"><dl className="space-y-3">{fields.map(([name, label]) => <div key={name}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{name === 'tanggal' ? formatDate(form[name]) : form[name]}</dd></div>)}</dl><Badge status={form.status} /><div className="flex gap-3 border-t border-slate-800 pt-4"><button disabled={busy} onClick={() => { setModal('form'); setActionError(''); }} className={`${buttonClass} flex-1 bg-slate-800`}>Ubah lagi</button><button disabled={busy} onClick={() => mutate('save')} className={`${buttonClass} flex-1 bg-emerald-700 hover:bg-emerald-600`}>{busy && <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? 'Menyimpan…' : editId !== null ? 'Simpan perubahan' : 'Kirim laporan'}</button></div><p role="status" className="sr-only">{busy ? 'Laporan sedang disimpan. Tunggu hingga selesai.' : ''}</p></div>}
          {modal === 'pin' && <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); if (pin === '1234') { setUnlocked(true); setTab('table'); setModal(null); setPin(''); } else setPinError('PIN salah. Silakan coba lagi.'); }}><div><label htmlFor="access-pin" className="mb-2 block text-sm">PIN akses</label><input id="access-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} required value={pin} aria-invalid={!!pinError} aria-describedby={pinError ? 'pin-error' : undefined} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setPinError(''); }} className={inputClass} />{pinError && <p id="pin-error" role="alert" className="mt-2 text-sm text-red-300">{pinError}</p>}</div><button type="submit" className={`${buttonClass} w-full bg-blue-600 hover:bg-blue-500`}>Buka Data Master</button></form>}
          {modal === 'delete' && <div className="mt-5 space-y-4"><p className="break-words text-sm">Laporan <strong>{deleteItem?.dokter}</strong> · {formatDate(deleteItem?.tanggal)}</p><div className="flex gap-3"><Dialog.Close disabled={busy} className={`${buttonClass} flex-1 bg-slate-800`}>Batal</Dialog.Close><button disabled={busy} onClick={() => mutate('delete')} className={`${buttonClass} flex-1 bg-red-700 hover:bg-red-600`}>{busy ? 'Menghapus…' : 'Hapus laporan'}</button></div><p className="sr-only" role="status">{busy ? 'Laporan sedang dihapus.' : ''}</p></div>}
          {modal === 'success' && <div className="mt-5 space-y-4"><CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-400" /><Dialog.Close className={`${buttonClass} w-full bg-blue-600 hover:bg-blue-500`}>Tutup</Dialog.Close></div>}
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
