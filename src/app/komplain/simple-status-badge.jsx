import { CheckCircle2, AlertCircle } from 'lucide-react';
import { handlingStatus } from './workflow.mjs';

export default function SimpleStatusBadge({ item }) {
  const done = handlingStatus(item) === 'Selesai';
  const className = done ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white';
  const Icon = done ? CheckCircle2 : AlertCircle;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${className}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{done ? 'Selesai' : 'Perlu Tindak Lanjut'}</span>;
}
