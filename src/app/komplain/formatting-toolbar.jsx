import { Bold, Italic, Underline, List } from 'lucide-react';
import { wrapSelection, toggleListLines, MARKERS } from './rich-text.mjs';

const toolbarButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

export default function FormattingToolbar({ getTextarea, value, onChange, controls }) {
  const run = (fn) => (event) => { event.preventDefault(); fn(getTextarea(), value, onChange); };
  return <div role="toolbar" aria-label="Format teks" aria-controls={controls} className="mb-1.5 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-1">
    <button type="button" title="Tebal" aria-label="Tebal" onMouseDown={(event) => event.preventDefault()} onClick={run((ta, val, onCh) => wrapSelection(ta, val, onCh, MARKERS.bold))} className={toolbarButton}><Bold aria-hidden="true" className="h-4 w-4" /></button>
    <button type="button" title="Miring" aria-label="Miring" onMouseDown={(event) => event.preventDefault()} onClick={run((ta, val, onCh) => wrapSelection(ta, val, onCh, MARKERS.italic))} className={toolbarButton}><Italic aria-hidden="true" className="h-4 w-4" /></button>
    <button type="button" title="Garis bawah" aria-label="Garis bawah" onMouseDown={(event) => event.preventDefault()} onClick={run((ta, val, onCh) => wrapSelection(ta, val, onCh, MARKERS.underline))} className={toolbarButton}><Underline aria-hidden="true" className="h-4 w-4" /></button>
    <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-700" />
    <button type="button" title="Daftar bertitik" aria-label="Daftar bertitik" onMouseDown={(event) => event.preventDefault()} onClick={run((ta, val, onCh) => toggleListLines(ta, val, onCh))} className={toolbarButton}><List aria-hidden="true" className="h-4 w-4" /></button>
  </div>;
}
