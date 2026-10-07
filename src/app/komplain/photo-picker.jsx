'use client';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { compressImage, MAX_PHOTOS } from './image-utils.mjs';
import { displaySrc } from './photo-url.mjs';

export default function PhotoPicker({ photos, onAdd, onRemove, existingUrls = [], disabled = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remainingSlots = MAX_PHOTOS - photos.length - existingUrls.length;

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    const allowed = files.slice(0, Math.max(0, remainingSlots));
    if (files.length > allowed.length) setError(`Maksimal ${MAX_PHOTOS} foto per laporan.`);
    setBusy(true);
    try {
      for (const file of allowed) {
        const compressed = await compressImage(file);
        onAdd({ ...compressed, id: crypto.randomUUID() });
      }
    } catch (err) { setError(err.message || 'Gagal memproses foto.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {existingUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800"><img src={displaySrc(url)} alt="Foto laporan" className="h-full w-full object-cover" /></a>)}
      {photos.map((photo) => <div key={photo.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800"><img src={photo.previewUrl} alt={photo.filename} className="h-full w-full object-cover" />{!disabled && <button type="button" onClick={() => onRemove(photo.id)} aria-label={`Hapus ${photo.filename}`} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/80 text-white"><X aria-hidden="true" className="h-3 w-3" /></button>}</div>)}
      {!disabled && remainingSlots > 0 && <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-700 text-slate-400 transition hover:border-blue-400 hover:text-blue-300 disabled:opacity-50">{busy ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <ImagePlus aria-hidden="true" className="h-5 w-5" />}<span className="text-[11px]">Tambah foto</span></button>}
    </div>
    <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} className="hidden" />
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <p className="text-xs text-slate-500">Ambil foto langsung atau pilih dari galeri. Maksimal {MAX_PHOTOS} foto, otomatis dikompres sebelum dikirim.</p>
  </div>;
}
