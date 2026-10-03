import { LoaderCircle } from 'lucide-react';

export default function LoadingState({ title = 'Memuat data…', description = 'Mohon tunggu sebentar.', compact = false }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={`flex items-center gap-4 rounded-2xl border border-blue-900/60 bg-slate-900 ${compact ? 'p-4' : 'min-h-60 flex-col justify-center p-8 text-center'}`}>
      <div aria-hidden="true" className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10">
        <LoaderCircle className="h-8 w-8 animate-spin text-blue-400 motion-reduce:animate-none" />
      </div>
      <div><p className="font-semibold text-slate-100">{title}</p><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div>
    </div>
  );
}
