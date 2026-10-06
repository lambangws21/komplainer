import { detectImplants } from './implant.mjs';

export default function ImplantBadge({ item, compact = false }) {
  const implants = detectImplants(item);
  if (!implants.length) return null;
  return <span className="flex flex-wrap gap-1">{implants.map((implant) => <span key={implant.key} className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${implant.color} ${compact ? 'px-1.5' : ''}`}>{implant.label}</span>)}</span>;
}
