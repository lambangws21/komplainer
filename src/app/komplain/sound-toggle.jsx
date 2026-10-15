'use client';
import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Volume2, VolumeX, Music2 } from 'lucide-react';
import { isSoundMuted, setSoundMuted } from './notification-sound.mjs';

// Local-only mute switch + sound picker for the in-app chime (new report/mention/assignment
// while the tab is open) — separate from PushToggle, which controls OS-level push. The sound
// picker dialog itself is owned by Navbar (not here), since this component lives inside the
// account DropdownMenu and unmounts whenever that menu closes.
export default function SoundToggle({ onOpenSoundSettings }) {
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(isSoundMuted()); }, []);
  return <>
    <DropdownMenu.Item onSelect={(event) => { event.preventDefault(); setSoundMuted(!muted); setMuted(!muted); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-slate-800 focus:bg-slate-800">
      {muted ? <VolumeX aria-hidden="true" className="h-4 w-4 text-slate-400" /> : <Volume2 aria-hidden="true" className="h-4 w-4 text-emerald-300" />}
      <span className="flex-1 text-left">{muted ? 'Suara notifikasi dimatikan' : 'Suara notifikasi aktif'}</span>
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => onOpenSoundSettings?.()} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-slate-800 focus:bg-slate-800">
      <Music2 aria-hidden="true" className="h-4 w-4 text-slate-400" />
      <span className="flex-1 text-left">Pilih suara notifikasi</span>
    </DropdownMenu.Item>
  </>;
}
