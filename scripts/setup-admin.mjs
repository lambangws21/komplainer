import nextEnv from '@next/env';
import { hashPassword } from '../src/lib/server/password.mjs';
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
const apiKey = process.env.GOOGLE_SCRIPT_API_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const nama = process.env.BOOTSTRAP_ADMIN_NAME;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
try {
  if (!url || !apiKey || !email || !nama || !password) throw new Error('Isi GOOGLE_SCRIPT_URL, GOOGLE_SCRIPT_API_KEY, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, dan BOOTSTRAP_ADMIN_PASSWORD dalam .env.local.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'bootstrap', apiKey, email, nama, unit: process.env.BOOTSTRAP_ADMIN_UNIT || 'Pusat', passwordHash: await hashPassword(password) }), signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Setup admin gagal.');
  console.log('Admin pertama berhasil dibuat. Hapus BOOTSTRAP_ADMIN_PASSWORD dari .env.local, lalu masuk menggunakan email dan password yang Anda tetapkan.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
