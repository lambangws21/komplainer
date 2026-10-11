'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { apiRequest } from './api-client.mjs';

// Search-as-you-type location picker backed by /api/calendar/geocode (free, OpenStreetMap-based,
// no API key). Typing freely still works without picking a suggestion — onSelect only fires when
// the user actually clicks/chooses one, so the parent can tell "typed text" apart from "a real
// geocoded point" (used to decide whether to build a precise coordinate-based Maps link or a
// plain text search).
export default function LocationSearch({ id, value, onChange, onSelect, placeholder, disabled, className }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = value.trim();
    if (query.length < 3) { setResults([]); setLoading(false); return undefined; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try { const result = await apiRequest(`/api/calendar/geocode?q=${encodeURIComponent(query)}`); setResults(result.data || []); setActiveIndex(-1); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    function onClickOutside(event) { if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function pick(item) { onChange(item.label); onSelect(item); setOpen(false); setResults([]); }
  function onKeyDown(event) {
    if (!open || !results.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % results.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => (index - 1 + results.length) % results.length); }
    else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); pick(results[activeIndex]); }
    else if (event.key === 'Escape') setOpen(false);
  }

  return <div ref={containerRef} className="relative">
    <div className="relative">
      <input id={id} disabled={disabled} autoComplete="off" placeholder={placeholder} value={value} onChange={(event) => { onChange(event.target.value); onSelect(null); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} className={`${className} pr-10`} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</span>
    </div>
    {open && results.length > 0 && <ul role="listbox" aria-label="Saran lokasi" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-blue-500/40 bg-slate-900 shadow-lg">
      {results.map((item, index) => <li key={`${item.lat},${item.lng}`}><button type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(item)} className={`flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{item.label}</span></button></li>)}
    </ul>}
    {open && !loading && value.trim().length >= 3 && results.length === 0 && <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 shadow-lg">Lokasi tidak ditemukan. Teks tetap tersimpan apa adanya.</div>}
  </div>;
}
