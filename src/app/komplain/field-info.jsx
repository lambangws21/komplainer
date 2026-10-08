'use client';
import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';

// A small tap/click-to-reveal hint next to a label, so the form itself stays just
// fields + buttons instead of a paragraph of instructions under every input.
export default function FieldInfo({ text }) {
  if (!text) return null;
  return <Popover.Root>
    <Popover.Trigger asChild><button type="button" aria-label="Info kolom" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><Info aria-hidden="true" className="h-3.5 w-3.5" /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} collisionPadding={12} className="komplain-theme z-[70] max-w-[240px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs leading-5 text-slate-200 shadow-xl">{text}<Popover.Arrow className="fill-slate-700" /></Popover.Content></Popover.Portal>
  </Popover.Root>;
}
