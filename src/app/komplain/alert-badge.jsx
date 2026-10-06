import { AlertOctagon } from 'lucide-react';
import { handlingStatus } from './workflow.mjs';

export default function AlertBadge({ item, compact = false }) {
  const critical = /^C[12] - /.test(String(item?.status));
  if (!critical || handlingStatus(item) === 'Selesai') return null;
  if (compact) return <span title="Perlu Perhatian Segera" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm"><AlertOctagon aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">Perlu Perhatian Segera</span></span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm"><AlertOctagon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Perlu Perhatian Segera</span>;
}
