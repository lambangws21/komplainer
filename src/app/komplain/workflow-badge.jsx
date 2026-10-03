const colors = { Baru: 'border-blue-800 bg-blue-950/50 text-blue-200', Diproses: 'border-violet-800 bg-violet-950/50 text-violet-200', Menunggu: 'border-amber-800 bg-amber-950/50 text-amber-200', Selesai: 'border-emerald-800 bg-emerald-950/50 text-emerald-200' };
export default function WorkflowBadge({ status = 'Baru' }) {
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${colors[status] || colors.Baru}`}>{status}</span>;
}
