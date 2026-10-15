'use client';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Play, Upload, Trash2, X } from 'lucide-react';
import { mobileDialog, dialogHeader, dialogBody } from './ui-styles.mjs';
import { SOUND_PRESETS, CUSTOM_SOUND_MAX_BYTES, getSoundChoice, setSoundChoice, getCustomSound, setCustomSound, clearCustomSound, previewSound } from './notification-sound.mjs';

const optionRow = (active) => `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${active ? 'border-emerald-600 bg-emerald-950/30 text-emerald-100' : 'border-slate-700 text-slate-300 hover:border-slate-600'}`;
const iconButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800';

export default function SoundSettings({ open, onOpenChange }) {
  const [choice, setChoice] = useState('chime');
  const [custom, setCustom] = useState({ dataUrl: '', name: '' });
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  useEffect(() => { if (open) { setChoice(getSoundChoice()); setCustom(getCustomSound()); setError(''); } }, [open]);

  function choose(id) { setChoice(id); setSoundChoice(id); }

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setError('Pilih file suara (mp3, wav, ogg, dll).'); return; }
    if (file.size > CUSTOM_SOUND_MAX_BYTES) { setError(`Ukuran file maksimal ${Math.round(CUSTOM_SOUND_MAX_BYTES / 1024)} KB.`); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setCustomSound(dataUrl, file.name);
      setCustom({ dataUrl, name: file.name });
      choose('custom');
    };
    reader.onerror = () => setError('Gagal membaca file suara.');
    reader.readAsDataURL(file);
  }

  function removeCustom() {
    clearCustomSound();
    setCustom({ dataUrl: '', name: '' });
    if (choice === 'custom') choose('chime');
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70" /><Dialog.Content className={`komplain-theme ${mobileDialog} max-w-md`}>
      <div className={dialogHeader}><Dialog.Title className="pr-12 text-xl font-bold">Suara Notifikasi</Dialog.Title><Dialog.Description className="mt-2 pr-8 text-sm text-slate-400">Pilih suara bawaan atau unggah suara sendiri untuk notifikasi dalam aplikasi.</Dialog.Description><Dialog.Close aria-label="Tutup" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close></div>
      <div className={`${dialogBody} space-y-2 pt-5`}>
        <div role="radiogroup" aria-label="Pilihan suara" className="space-y-2">
          {SOUND_PRESETS.map((preset) => <label key={preset.id} className={optionRow(choice === preset.id)}>
            <input type="radio" name="sound-choice" checked={choice === preset.id} onChange={() => choose(preset.id)} className="h-4 w-4 accent-emerald-500" />
            <span className="flex-1">{preset.label}</span>
            <button type="button" onClick={() => previewSound(preset.id)} className={iconButton} aria-label={`Tes suara ${preset.label}`}><Play aria-hidden="true" className="h-4 w-4" /></button>
          </label>)}
          <label className={`${optionRow(choice === 'custom')} ${!custom.dataUrl ? 'opacity-50' : ''}`}>
            <input type="radio" name="sound-choice" checked={choice === 'custom'} disabled={!custom.dataUrl} onChange={() => choose('custom')} className="h-4 w-4 accent-emerald-500" />
            <span className="min-w-0 flex-1 truncate">{custom.name || 'Suara kustom (belum diunggah)'}</span>
            {custom.dataUrl && <button type="button" onClick={() => previewSound('custom')} className={iconButton} aria-label="Tes suara kustom"><Play aria-hidden="true" className="h-4 w-4" /></button>}
            {custom.dataUrl && <button type="button" onClick={removeCustom} className={`${iconButton} text-red-300 hover:bg-red-950/40`} aria-label="Hapus suara kustom"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>}
          </label>
        </div>
        <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-2.5 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800/50"><Upload aria-hidden="true" className="h-4 w-4" />Unggah suara sendiri</button>
        <input ref={fileInput} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        <p className="text-xs leading-5 text-slate-500">Maksimal {Math.round(CUSTOM_SOUND_MAX_BYTES / 1024)} KB, tersimpan hanya di perangkat ini.</p>
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
