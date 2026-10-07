import { STATUS_CASE } from './workflow.mjs';

export default function StatusCaseBadge({ statusCase }) {
  const option = STATUS_CASE.find((item) => item.code === statusCase);
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${option?.color || 'border-slate-600 text-slate-300'}`}>{option?.label || 'Belum diklasifikasikan'}</span>;
}
