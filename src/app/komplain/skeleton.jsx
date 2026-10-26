// Loading placeholders shaped like the content they stand in for, so the Beranda doesn't jump
// around once real data lands — plain "Menunggu data…" text reserves no space and reads as
// stalled rather than loading. aria-hidden on the blocks themselves; callers wrap these in a
// role="status" with an sr-only label so screen readers still get one loading announcement.
function Block({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-800 ${className}`} />;
}

// Mirrors the attention/stale/incoming row shape: a title line, a subtitle line, an action button.
export function RowSkeleton({ count = 3 }) {
  return <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
    {Array.from({ length: count }, (_, index) => <div key={index} className="space-y-2 p-4">
      <Block className="h-4 w-1/2" />
      <Block className="h-3 w-full" />
      <Block className="h-8 w-28 rounded-lg" />
    </div>)}
  </div>;
}

// Mirrors FeedCard's layout: status row, title, avatar + name, two content lines.
export function FeedCardSkeleton({ count = 2 }) {
  return <div className="space-y-3">
    {Array.from({ length: count }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2"><Block className="h-3 w-28" /><Block className="h-5 w-20 rounded-full" /></div>
      <Block className="mt-3 h-5 w-3/4" />
      <div className="mt-3 flex items-center gap-2.5"><Block className="h-8 w-8 rounded-full" /><Block className="h-3 w-28" /></div>
      <div className="mt-3 space-y-1.5"><Block className="h-3 w-full" /><Block className="h-3 w-5/6" /></div>
    </div>)}
  </div>;
}
