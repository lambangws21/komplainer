import { AlertOctagon } from 'lucide-react';
import { handlingStatus } from './workflow.mjs';

export default function AlertBadge({ item, compact = false, onClick }) {
  const critical = /^C[12] - /.test(String(item?.status));
  if (!critical || handlingStatus(item) === 'Selesai') return null;
  const label = 'Perlu Perhatian Segera';
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'span';
  const interactiveClass = interactive ? 'cursor-pointer transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300' : '';
  const sharedProps = interactive
    ? { type: 'button', onClick, title: `${label} · klik untuk membuka detail`, 'aria-label': `${label}, klik untuk membuka detail dan tindak lanjut` }
    : { title: label };
  if (compact) return <Tag {...sharedProps} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm ${interactiveClass}`}><AlertOctagon aria-hidden="true" className="h-3.5 w-3.5" />{!interactive && <span className="sr-only">{label}</span>}</Tag>;
  return <Tag {...sharedProps} className={`inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm ${interactiveClass}`}><AlertOctagon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{label}</Tag>;
}
