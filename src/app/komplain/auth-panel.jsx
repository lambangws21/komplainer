'use client';
import { useState } from 'react';
import { LogIn, ShieldCheck, UserCog } from 'lucide-react';
import LoadingState from './loading-state';
import PasswordInput from './password-input';
import { apiRequest, postJson } from './api-client.mjs';

const REGISTRATION_UNITS = ['TS', 'Logistik'];
const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';
export function LoginPanel({ onLogin, initialError, notice }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nama, setNama] = useState('');
  const [unit, setUnit] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (register && password !== confirm) { setError('Konfirmasi password tidak sama.'); return; }
    setBusy(true); setError('');
    try {
      const result = await apiRequest(register ? '/api/auth/register' : '/api/auth/login', postJson({ email, password, ...(register ? { nama, unit, username } : {}) }));
      setPassword(''); setConfirm(''); onLogin(result.user);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  function switchMode() { setRegister(!register); setError(''); setPassword(''); setConfirm(''); }
  return <section aria-label={register ? 'Daftar sebagai Pelapor' : 'Masuk ke Komplainer'} className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
    <div className="mb-5 inline-flex rounded-2xl bg-blue-500/15 p-3 text-blue-300"><ShieldCheck aria-hidden="true" className="h-7 w-7" /></div>
    <h2 className="text-2xl font-bold">{register ? 'Daftar sebagai Pelapor' : 'Masuk ke Komplainer'}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-400">{register ? 'Buat akun Anda. Admin perlu menyetujui pendaftaran sebelum Anda dapat membuka atau membuat laporan.' : 'Masuk dengan akun Anda'}</p>
    {notice && <p role="status" className="mt-4 rounded-xl bg-blue-950/40 p-3 text-sm text-blue-200">{notice}</p>}
    {(error || (!register && initialError)) && <p role="alert" className="mt-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm leading-6 text-red-200">{error || initialError}</p>}
    <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}><fieldset disabled={busy} className="space-y-4">
      {register && <><div><label htmlFor="register-name" className="mb-2 block text-sm font-medium">Nama lengkap</label><input id="register-name" autoComplete="name" required maxLength={200} value={nama} onChange={(event) => setNama(event.target.value)} className={input} /></div><div><label htmlFor="register-username" className="mb-2 block text-sm font-medium">Username</label><input id="register-username" autoComplete="username" required pattern="[a-z0-9][a-z0-9_.-]{2,31}" title="3-32 karakter: huruf kecil, angka, titik, garis bawah, atau strip" maxLength={32} value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} className={input} /><p className="mt-2 text-xs text-slate-400">Dapat digunakan untuk masuk selain email, 3-32 karakter huruf kecil/angka.</p></div><div><label htmlFor="register-team" className="mb-2 block text-sm font-medium">Team Pelapor</label><select id="register-team" required value={unit} onChange={(event) => setUnit(event.target.value)} className={input}><option value="" disabled>Pilih team…</option>{REGISTRATION_UNITS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></>}
      <div><label htmlFor="login-email" className="mb-2 block text-sm font-medium">{register ? 'Email' : 'Email atau username'}</label><input id="login-email" type={register ? 'email' : 'text'} autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></div>
      <div><label htmlFor="login-password" className="mb-2 block text-sm font-medium">Password{register ? ' (minimal 6 karakter)' : ''}</label><PasswordInput id="login-password" disabled={busy} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 6 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className={input} /></div>
      {register && <div><label htmlFor="register-confirm" className="mb-2 block text-sm font-medium">Ulangi password</label><PasswordInput id="register-confirm" visibilityLabel="konfirmasi password" disabled={busy} autoComplete="new-password" required minLength={6} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} className={input} /></div>}
      <button disabled={busy} className={`${button} w-full bg-blue-600 hover:bg-blue-500`}><LogIn aria-hidden="true" className="h-4 w-4" />{busy ? register ? 'Mendaftarkan akun…' : 'Memeriksa akun…' : register ? 'Daftar' : 'Masuk'}</button>
    </fieldset></form>
    {busy && <div className="mt-4"><LoadingState compact title={register ? 'Mendaftarkan akun…' : 'Memeriksa akun…'} description="Tunggu hingga proses selesai." /></div>}
    <button type="button" disabled={busy} onClick={switchMode} className={`${button} mt-4 w-full border border-slate-700 text-blue-300`}>{register ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar sekarang'}</button>
    {!register && <p className="mt-5 text-xs leading-5 text-slate-400">Lupa password? Hubungi admin untuk mereset password.</p>}
  </section>;
}
export function ProfilePanel({ user, onChanged, onExpired }) {
  const [nama, setNama] = useState(user.nama);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { const result = await apiRequest('/api/auth/profile', postJson({ nama, email, username })); onChanged(result.message); }
    catch (error) { setError(error.message); if (error.code === 401) onExpired(); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><UserCog aria-hidden="true" className="h-5 w-5 text-blue-300" />Profil saya</h2><p className="mt-2 text-sm leading-6 text-slate-400">Ubah nama, username, atau email. Setelah disimpan, semua sesi akun ini berakhir dan Anda perlu masuk kembali.</p>{error && <p role="alert" className="mt-4 rounded-xl bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}<form onSubmit={submit} className="mt-5 space-y-4" aria-busy={busy}><fieldset disabled={busy} className="space-y-4"><div><label htmlFor="profile-name" className="mb-2 block text-sm">Nama</label><input id="profile-name" autoComplete="name" required maxLength={200} value={nama} onChange={(event) => setNama(event.target.value)} className={input} /></div><div><label htmlFor="profile-username" className="mb-2 block text-sm">Username (opsional)</label><input id="profile-username" autoComplete="username" pattern="[a-z0-9][a-z0-9_.-]{2,31}" title="3-32 karakter: huruf kecil, angka, titik, garis bawah, atau strip" maxLength={32} value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} className={input} /></div><div><label htmlFor="profile-email" className="mb-2 block text-sm">Email</label><input id="profile-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></div><button disabled={busy} className={`${button} w-full bg-blue-600 hover:bg-blue-500`}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button></fieldset></form></section>;
}
export function ApprovalPanel({ user, onApproved, onExpired }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function check() {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await apiRequest('/api/auth/session'); onApproved(result.user); }
    catch (error) { setError(error.message); if (error.code === 401) onExpired(); }
    finally { setBusy(false); }
  }
  const rejected = user.approval === 'rejected';
  return <section aria-label="Status persetujuan akun" className="mx-auto max-w-lg rounded-2xl border border-amber-800/60 bg-amber-950/20 p-6">
    <h2 className="text-xl font-bold text-amber-200">{rejected ? 'Pendaftaran belum disetujui' : 'Menunggu persetujuan Admin'}</h2>
    <p className="mt-3 break-words text-sm text-slate-300">{user.nama} · {user.email}</p>
    <p role="status" className="mt-3 text-sm leading-6 text-slate-300">{rejected ? 'Admin menolak pendaftaran Anda. Hubungi Admin untuk peninjauan kembali.' : 'Pendaftaran Anda sudah tersimpan. Anda dapat mengakses laporan setelah Admin menyetujui akun ini.'}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy} onClick={check} className={`${button} mt-5 w-full bg-slate-800`}>{busy ? 'Memeriksa status…' : 'Periksa status persetujuan'}</button>
  </section>;
}
export function PasswordPanel({ user, onChanged, onExpired }) {
  const [currentPassword, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    if (password !== confirm) { setError('Konfirmasi password tidak sama.'); return; }
    setBusy(true); setError('');
    try { const result = await apiRequest('/api/auth/password', postJson({ currentPassword, password })); onChanged(result.message); }
    catch (error) { setError(error.message); if (error.code === 401 && !error.message.includes('saat ini')) onExpired(); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-xl font-bold">{user.mustChangePassword ? 'Ganti password sementara' : 'Akun saya'}</h2><p className="mt-2 break-words text-sm text-slate-400">{user.nama} · {user.email} · {user.unit}</p><p className="mt-3 text-sm leading-6 text-slate-400">{user.mustChangePassword ? 'Buat password pribadi sebelum melanjutkan. ' : ''}Gunakan 6–128 karakter. Setelah disimpan, semua sesi akun ini berakhir dan Anda perlu masuk kembali.</p>{error && <p role="alert" className="mt-4 rounded-xl bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}<form onSubmit={submit} className="mt-5 space-y-4" aria-busy={busy}><fieldset disabled={busy} className="space-y-4">{[['current-password', 'Password saat ini', currentPassword, setCurrent, 'current-password'], ['new-password', 'Password baru', password, setPassword, 'new-password'], ['confirm-password', 'Ulangi password baru', confirm, setConfirm, 'new-password']].map(([id, label, value, setValue, autoComplete]) => <div key={id}><label htmlFor={id} className="mb-2 block text-sm">{label}</label><PasswordInput id={id} visibilityLabel={label.toLowerCase()} disabled={busy} autoComplete={autoComplete} minLength={id === 'current-password' ? 1 : 6} maxLength={128} required value={value} onChange={(event) => setValue(event.target.value)} className={input} /></div>)}<button disabled={busy} className={`${button} w-full bg-blue-600 hover:bg-blue-500`}>{busy ? 'Menyimpan…' : 'Simpan password'}</button></fieldset></form>{busy && <div className="mt-4"><LoadingState compact title="Menyimpan password…" description="Tunggu hingga perubahan dikonfirmasi." /></div>}</section>;
}
