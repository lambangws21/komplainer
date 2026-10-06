import { AlertOctagon } from 'lucide-react';
import { handlingStatus } from './workflow.mjs';

export default function AlertBadge({ item }) {
  const critical = /^C[12] - /.test(String(item?.status));
  if (!critical || handlingStatus(item) === 'Selesai') return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm"><AlertOctagon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Perlu Perhatian Segera</span>;
}
