const styles = {
  admin: 'border-violet-700/70 bg-violet-950/60 text-violet-200',
  pelapor: 'border-sky-700/70 bg-sky-950/60 text-sky-200',
  petugas: 'border-emerald-700/70 bg-emerald-950/60 text-emerald-200',
  delegated: 'border-amber-700/70 bg-amber-950/60 text-amber-200',
};
export function roleCardStyle(role, pic = false) {
  const key = role === 'pelapor' && pic ? 'delegated' : role;
  return {
    admin: 'border-violet-800/70 bg-violet-950/15',
    pelapor: 'border-sky-800/70 bg-sky-950/15',
    petugas: 'border-emerald-800/70 bg-emerald-950/15',
    delegated: 'border-amber-800/70 bg-amber-950/15',
  }[key] || 'border-slate-700/70 bg-slate-950/50';
}
export default function RoleBadge({ role, pic = false }) {
  const key = role === 'pelapor' && pic ? 'delegated' : role;
  const label = pic && role === 'pelapor' ? 'Pelapor · PIC' : pic || role === 'petugas' ? 'PIC' : role === 'admin' ? 'Admin' : role === 'pelapor' ? 'Pelapor' : 'Akun lama';
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[key] || 'border-slate-700 bg-slate-800 text-slate-300'}`}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{label}</span>;
}
