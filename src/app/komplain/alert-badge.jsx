import { AlertOctagon, UserRound } from 'lucide-react';
import { handlingStatus } from './workflow.mjs';

export default function AlertBadge({ item, compact = false, onClick }) {
  const severityCritical = /^C[12] - /.test(String(item?.status));
  // Before a PIC has triaged severity, an "Ada Kendala" case with no owner is the one signal we
  // already have — flag it the same way so it isn't invisible until someone opens the dashboard.
  const needsTriage = item?.statusCase === 'Ada Kendala' && !item?.picId;
  if ((!severityCritical && !needsTriage) || handlingStatus(item) === 'Selesai') return null;
  const label = severityCritical ? 'Perlu Perhatian Segera' : 'Belum Ada PIC';
  const Icon = severityCritical ? AlertOctagon : UserRound;
  const bg = severityCritical ? 'bg-red-600' : 'bg-orange-600';
  const hover = severityCritical ? 'hover:bg-red-500' : 'hover:bg-orange-500';
  const ring = severityCritical ? 'focus-visible:ring-red-300' : 'focus-visible:ring-orange-300';
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'span';
  const interactiveClass = interactive ? `cursor-pointer transition ${hover} focus-visible:outline-none focus-visible:ring-2 ${ring}` : '';
  const sharedProps = interactive
    ? { type: 'button', onClick, title: `${label} · klik untuk membuka detail`, 'aria-label': `${label}, klik untuk membuka detail dan tindak lanjut` }
    : { title: label };
  if (compact) return <Tag {...sharedProps} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bg} text-white shadow-sm ${interactiveClass}`}><Icon aria-hidden="true" className="h-3.5 w-3.5" />{!interactive && <span className="sr-only">{label}</span>}</Tag>;
  return <Tag {...sharedProps} className={`inline-flex items-center gap-1.5 rounded-full ${bg} px-3 py-1 text-xs font-bold text-white shadow-sm ${interactiveClass}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{label}</Tag>;
}
