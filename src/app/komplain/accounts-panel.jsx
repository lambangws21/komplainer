'use client';
import { useEffect, useRef, useState } from 'react';
import { PlusCircle, Pencil, KeyRound, Users, RefreshCw } from 'lucide-react';
import { apiRequest, postJson } from './api-client.mjs';
import LoadingState from './loading-state';
import RoleBadge, { roleCardStyle } from './role-badge';
import PasswordInput from './password-input';
import { ROLE_LABELS } from './workflow.mjs';
const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';
const blank = { nama: '', email: '', role: 'pelapor', unit: '', password: '', active: true };
export default function AccountsPanel({ currentUser, onExpired }) {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const formHeading = useRef(null);
  const mounted = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  async function load() {
    setLoading(true);
    try { const result = await apiRequest('/api/users'); if (mounted.current) setUsers(result.data); }
    catch (error) { if (mounted.current) { setError(error.message); if (error.code === 401) onExpiredRef.current(); } }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (mode) formHeading.current?.focus(); }, [mode]);
  function open(next, item) { setError(''); setNotice(''); setForm(item ? { ...item, password: '' } : { ...blank, unit: currentUser.unit }); setMode(next); }
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest('/api/users', postJson({ ...form, action: mode }));
      setMode(null); setForm(blank);
      setNotice(mode === 'createUser' ? 'Akun dibuat. Sampaikan email dan password sementara kepada pengguna melalui saluran pribadi. Password wajib diganti saat masuk pertama.' : mode === 'resetPassword' ? 'Password direset. Sampaikan password sementara kepada pengguna; sesi lamanya sudah berakhir.' : 'Akun diperbarui; sesi pengguna tersebut sudah berakhir.');
      if (form.id === currentUser.id) onExpired('Akun diperbarui. Silakan masuk kembali.'); else await load();
    } catch (error) { setError(error.message); if (error.code === 401) onExpired(); }
    finally { setBusy(false); }
  }
  async function decide(user, action) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest('/api/users', postJson({ id: user.id, action })); setNotice(action === 'approveUser' ? `Akun ${user.nama} disetujui sebagai Pelapor.` : `Pendaftaran ${user.nama} ditolak.`); await load(); }
    catch (error) { setError(error.message); if (error.code === 401) onExpired(); }
    finally { setBusy(false); }
  }
  const pendingCount = users.filter((user) => user.approval === 'pending').length;
  const shownUsers = users.filter((user) => filter !== 'pending' || user.approval === 'pending').sort((a, b) => Number(b.approval === 'pending') - Number(a.approval === 'pending'));
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Users aria-hidden="true" className="h-6 w-6 text-blue-300" />Pengguna</h2><p className="mt-1 text-sm text-slate-400">Atur akun, unit, dan hak akses. Admin aktif terakhir tetap dilindungi.</p></div><div className="flex gap-2"><button disabled={loading || busy} onClick={() => { setError(''); load(); }} aria-label="Muat ulang pengguna" className={`${button} bg-slate-800 px-3`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button disabled={busy} onClick={() => open('createUser')} className={`${button} bg-blue-600`}><PlusCircle aria-hidden="true" className="h-4 w-4" />Tambah akun</button></div></div>{error && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200">{notice}</p>}
    {(loading || busy) && <LoadingState compact={users.length > 0 || !!mode} title={busy ? 'Menyimpan akun…' : 'Memuat pengguna…'} description="Tunggu hingga proses selesai." />}
    {mode && <form onSubmit={save} aria-busy={busy} className="space-y-4 rounded-2xl border border-blue-900 bg-slate-900 p-5"><h3 ref={formHeading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">{mode === 'createUser' ? 'Tambah akun' : mode === 'resetPassword' ? `Reset password ${form.nama}` : `Edit akun ${form.nama}`}</h3><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{mode !== 'resetPassword' && <>{[['nama', 'Nama', 'text'], ['email', 'Email / username awal', mode === 'updateUser' ? 'text' : 'email'], ['unit', 'Team Pelapor', 'text']].map(([key, label, type]) => <div key={key}><label htmlFor={`user-${key}`} className="mb-2 block text-sm">{label}</label><input id={`user-${key}`} type={type} required maxLength={key === 'email' ? 254 : 200} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={input} /></div>)}<div><label htmlFor="user-role" className="mb-2 block text-sm">Peran</label><select id="user-role" className={input} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></>}{mode !== 'updateUser' && <div className="sm:col-span-2"><label htmlFor="user-password" className="mb-2 block text-sm">Password sementara (6–128 karakter)</label><PasswordInput key={`${mode}-${form.id || 'new'}`} id="user-password" visibilityLabel="password sementara" disabled={busy} autoComplete="new-password" minLength={6} maxLength={128} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={input} /><p className="mt-2 text-xs text-slate-400">Pengguna wajib membuat password sendiri saat masuk pertama. Aplikasi tidak mengirim email secara otomatis.</p></div>}{mode === 'updateUser' && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-5 w-5" />Akun aktif</label>}</fieldset><div className="flex gap-3"><button type="button" disabled={busy} onClick={() => { setMode(null); setForm(blank); }} className={`${button} bg-slate-800`}>Batal</button><button disabled={busy} className={`${button} bg-blue-600`}>{busy ? 'Menyimpan…' : 'Simpan akun'}</button></div></form>}
    <div className="flex flex-wrap gap-2" aria-label="Filter persetujuan pengguna"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={`${button} ${filter === 'all' ? 'bg-blue-600' : 'bg-slate-800'}`}>Semua akun</button><button aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')} className={`${button} ${filter === 'pending' ? 'bg-blue-600' : 'bg-slate-800'}`}>Menunggu persetujuan ({pendingCount})</button></div>
    {!loading && shownUsers.length === 0 && <p className="rounded-xl border border-slate-700 p-5 text-sm text-slate-400">Tidak ada akun pada filter ini.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{shownUsers.map((user) => <article key={user.id} className={`rounded-2xl border p-5 ${roleCardStyle(user.role)}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words font-semibold">{user.nama}{user.id === currentUser.id ? ' (Anda)' : ''}</h3><span className={`rounded-full px-3 py-1 text-xs ${user.approval === 'pending' ? 'bg-amber-950 text-amber-200' : user.approval === 'rejected' ? 'bg-red-950 text-red-200' : user.active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{user.approval === 'pending' ? 'Menunggu persetujuan' : user.approval === 'rejected' ? 'Ditolak' : user.active ? 'Aktif' : 'Nonaktif'}</span></div><p className="mt-2 break-words text-sm text-slate-400">{user.email}</p><p className="mt-1 break-words text-sm text-slate-300"><RoleBadge role={user.role} /> <span className="ml-2">{user.unit}</span></p>{user.mustChangePassword && <p className="mt-2 text-xs text-amber-300">Wajib mengganti password sementara</p>}<div className="mt-4 flex flex-wrap gap-2">{['pending', 'rejected'].includes(user.approval) ? <><button disabled={busy} onClick={() => decide(user, 'approveUser')} className={`${button} bg-emerald-700`}>Setujui sebagai Pelapor</button>{user.approval === 'pending' && <button disabled={busy} onClick={() => decide(user, 'rejectUser')} className={`${button} bg-red-950 text-red-200`}>Tolak pendaftaran</button>}</> : <><button disabled={busy} onClick={() => open('updateUser', user)} className={`${button} bg-slate-800`}><Pencil aria-hidden="true" className="h-4 w-4" />Edit akun</button><button disabled={busy} onClick={() => open('resetPassword', user)} className={`${button} bg-slate-800`}><KeyRound aria-hidden="true" className="h-4 w-4" />Reset password</button></>}</div></article>)}</div>
  </section>;
}
