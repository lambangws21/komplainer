'use client';
import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import LoadingState from './loading-state';
import { apiRequest, postJson } from './api-client.mjs';

const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';
export function LoginPanel({ onLogin, initialError, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await apiRequest('/api/auth/login', postJson({ email, password })); setPassword(''); onLogin(result.user); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <section aria-label="Masuk ke Komplainer" className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8"><div className="mb-5 inline-flex rounded-2xl bg-blue-500/15 p-3 text-blue-300"><ShieldCheck aria-hidden="true" className="h-7 w-7" /></div><h2 className="text-2xl font-bold">Masuk ke Komplainer</h2><p className="mt-2 text-sm leading-6 text-slate-400">Gunakan akun dari admin. Laporan dan tugas ditampilkan sesuai peran Anda.</p>{notice && <p role="status" className="mt-4 rounded-xl bg-blue-950/40 p-3 text-sm text-blue-200">{notice}</p>}{(error || initialError) && <p role="alert" className="mt-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm leading-6 text-red-200">{error || initialError}</p>}<form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}><fieldset disabled={busy} className="space-y-4"><div><label htmlFor="login-email" className="mb-2 block text-sm font-medium">Email atau username</label><input id="login-email" type="text" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></div><div><label htmlFor="login-password" className="mb-2 block text-sm font-medium">Password</label><input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className={input} /></div><button disabled={busy} className={`${button} w-full bg-blue-600 hover:bg-blue-500`}><LogIn aria-hidden="true" className="h-4 w-4" />{busy ? 'Memeriksa akun…' : 'Masuk'}</button></fieldset></form>{busy && <div className="mt-4"><LoadingState compact title="Memeriksa akun…" description="Menghubungkan akun Anda ke Komplainer." /></div>}<p className="mt-5 text-xs leading-5 text-slate-400">Belum punya akun atau lupa password? Hubungi admin unit untuk membuat akun atau mereset password.</p></section>;
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
  return <section className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-xl font-bold">{user.mustChangePassword ? 'Ganti password sementara' : 'Akun saya'}</h2><p className="mt-2 break-words text-sm text-slate-400">{user.nama} · {user.email} · {user.unit}</p><p className="mt-3 text-sm leading-6 text-slate-400">{user.mustChangePassword ? 'Buat password pribadi sebelum melanjutkan. ' : ''}Gunakan 12–128 karakter. Setelah disimpan, semua sesi akun ini berakhir dan Anda perlu masuk kembali.</p>{error && <p role="alert" className="mt-4 rounded-xl bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}<form onSubmit={submit} className="mt-5 space-y-4" aria-busy={busy}><fieldset disabled={busy} className="space-y-4">{[['current-password', 'Password saat ini', currentPassword, setCurrent, 'current-password'], ['new-password', 'Password baru', password, setPassword, 'new-password'], ['confirm-password', 'Ulangi password baru', confirm, setConfirm, 'new-password']].map(([id, label, value, setValue, autoComplete]) => <div key={id}><label htmlFor={id} className="mb-2 block text-sm">{label}</label><input id={id} type="password" autoComplete={autoComplete} minLength={id === 'current-password' ? 1 : 12} maxLength={128} required value={value} onChange={(event) => setValue(event.target.value)} className={input} /></div>)}<button disabled={busy} className={`${button} w-full bg-blue-600 hover:bg-blue-500`}>{busy ? 'Menyimpan…' : 'Simpan password'}</button></fieldset></form>{busy && <div className="mt-4"><LoadingState compact title="Menyimpan password…" description="Tunggu hingga perubahan dikonfirmasi." /></div>}</section>;
}
