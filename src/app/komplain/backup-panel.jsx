'use client';
import { useEffect, useState } from 'react';
import { apiRequest, postJson } from './api-client.mjs';

export default function BackupPanel() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { setData((await apiRequest('/api/backup')).data); };
  useEffect(() => { let live = true; apiRequest('/api/backup').then((result) => { if (live) setData(result.data); }).catch((failure) => { if (live) setError(failure.message); }); return () => { live = false; }; }, []);
  const retry = async () => { setBusy(true); setError(''); try { await apiRequest('/api/backup', postJson({})); await load(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  if (data?.provider === 'apps-script') return null;
  return <section aria-label="Cadangan data" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-semibold">Cadangan Google Sheet</h2><p className="text-sm text-slate-400">Data utama tersimpan di Firebase. Pengiriman cadangan berjalan di belakang layar.</p>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{data ? <><p className="text-sm">{data.counts.done} berhasil · {data.counts.pending + data.counts.processing} menunggu · {data.counts.failed} tertunda</p>{!data.enabled && <p className="text-sm text-amber-300">Pengiriman backup belum diaktifkan oleh konfigurasi server.</p>}<details><summary className="cursor-pointer py-2 text-sm text-blue-300">Lihat pengiriman terakhir</summary><ul className="divide-y divide-slate-800">{data.jobs.map((job) => <li key={job.id} className="break-words py-2 text-xs"><p>{job.reportId} · versi {job.version}</p><p className="mt-1 text-slate-400">{({ pending: 'Menunggu', processing: 'Diproses', failed: 'Akan dicoba ulang', done: 'Berhasil' })[job.state]}</p>{job.error && <p className="mt-1 text-amber-300">{job.error}</p>}</li>)}</ul></details></> : !error && <p role="status" className="text-sm text-slate-400">Memuat status backup…</p>}<button disabled={busy || !data?.enabled} onClick={retry} className="min-h-11 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold disabled:opacity-40">{busy ? 'Memproses…' : 'Coba kirim cadangan'}</button></section>;
}
