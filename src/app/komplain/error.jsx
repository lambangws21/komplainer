'use client';
import { useEffect, useMemo } from 'react';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';

const isChunkLoadError = (error) => error?.name === 'ChunkLoadError' || /loading chunk/i.test(error?.message || '');

// Next.js route-level error boundary for /komplain. A failed dynamic import (next/dynamic chunk,
// e.g. after a fresh deploy changes chunk hashes while a tab is still open on the old build) throws
// a ChunkLoadError that `reset()` alone can't fix — the browser needs to actually re-fetch index.html
// to pick up the new chunk manifest, so that case gets a hard reload instead of React's soft retry.
export default function KomplainError({ error, reset }) {
  useEffect(() => { console.error('Komplain route error:', error); }, [error]);
  const chunkError = useMemo(() => isChunkLoadError(error), [error]);

  return <main lang="id" className="komplain-theme min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:p-8">
    <div className="mx-auto flex max-w-lg min-h-[80vh] flex-col items-center justify-center gap-5 text-center">
      <div aria-hidden="true" className={`flex h-16 w-16 items-center justify-center rounded-2xl ${chunkError ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
        {chunkError ? <WifiOff className="h-8 w-8 text-blue-400" /> : <AlertTriangle className="h-8 w-8 text-red-400" />}
      </div>
      <div>
        <h1 className="text-xl font-bold">{chunkError ? 'Aplikasi baru saja diperbarui' : 'Terjadi kesalahan'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{chunkError ? 'Halaman ini perlu dimuat ulang untuk memakai versi terbaru. Data yang sudah tersimpan tidak akan hilang.' : 'Sebagian halaman gagal ditampilkan. Coba muat ulang bagian ini, atau muat ulang seluruh halaman jika masalah berlanjut.'}</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <RefreshCw aria-hidden="true" className="h-4 w-4" />Muat ulang halaman
        </button>
        {!chunkError && <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 text-sm font-semibold text-slate-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          Coba lagi
        </button>}
      </div>
    </div>
  </main>;
}
