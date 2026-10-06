'use client';
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDate, shiftMonth, monthStart, monthEnd } from './weekly-summary.mjs';

const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const formatShort = (key) => { const date = fromKey(key); return date ? date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const dayPickerClassNames = {
  months: 'flex flex-col',
  month: 'space-y-3',
  caption: 'flex items-center justify-between px-1',
  caption_label: 'text-sm font-semibold text-white',
  nav: 'flex items-center gap-1',
  nav_button: 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-30',
  nav_button_previous: '',
  nav_button_next: '',
  table: 'w-full border-collapse',
  head_row: 'flex',
  head_cell: 'w-9 text-center text-xs font-medium text-slate-500',
  row: 'flex w-full mt-1',
  cell: 'relative p-0 text-center text-sm [&:has([aria-selected])]:bg-blue-500/15 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg',
  day: 'h-9 w-9 rounded-lg p-0 font-normal text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 aria-selected:opacity-100',
  day_selected: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white',
  day_range_start: 'bg-blue-600 text-white rounded-l-lg',
  day_range_end: 'bg-blue-600 text-white rounded-r-lg',
  day_range_middle: 'bg-transparent text-blue-200 rounded-none',
  day_today: 'border border-blue-500 text-blue-300',
  day_outside: 'text-slate-600 opacity-50',
  day_disabled: 'text-slate-700 opacity-40',
  day_hidden: 'invisible',
};

function presetsFor(today) {
  const yesterday = shiftDate(today, -1);
  const last7Start = shiftDate(today, -6);
  const curMonthStart = monthStart(today);
  const curMonthEnd = monthEnd(curMonthStart);
  const nextMonthStart = shiftMonth(curMonthStart, 1);
  const nextMonthEnd = monthEnd(nextMonthStart);
  return [
    ['Hari ini', today, today],
    ['Kemarin', yesterday, yesterday],
    ['7 hari terakhir', last7Start, today],
    ['Bulan ini', curMonthStart, curMonthEnd],
    ['Bulan depan', nextMonthStart, nextMonthEnd],
  ];
}

export default function DateRangePicker({ start, end, onApply, onClear, today, className = '' }) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const active = !!(start && end);
  function openChange(next) {
    if (next) { setDraftStart(start); setDraftEnd(end); }
    setOpen(next);
  }
  const selectedRange = { from: fromKey(draftStart), to: fromKey(draftEnd) };
  return <Popover.Root open={open} onOpenChange={openChange}>
    <Popover.Trigger asChild>
      <button type="button" aria-pressed={active} className={`${className} ${active ? 'border-blue-500 text-blue-200' : ''} inline-flex items-center gap-2`}>
        <CalendarRange aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">{active ? `${formatShort(start)} – ${formatShort(end)}` : 'Rentang tanggal'}</span>
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="start" sideOffset={8} className="komplain-theme z-[70] w-[min(22rem,90vw)] rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
        <DayPicker
          mode="range"
          selected={selectedRange}
          defaultMonth={selectedRange.from || fromKey(today)}
          onSelect={(range) => { setDraftStart(range?.from ? toKey(range.from) : ''); setDraftEnd(range?.to ? toKey(range.to) : ''); }}
          classNames={dayPickerClassNames}
          components={{
            IconLeft: ({ className: iconClassName }) => <ChevronLeft aria-hidden="true" className={`h-4 w-4 ${iconClassName || ''}`} />,
            IconRight: ({ className: iconClassName }) => <ChevronRight aria-hidden="true" className={`h-4 w-4 ${iconClassName || ''}`} />,
          }}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">{presetsFor(today).map(([label, presetStart, presetEnd]) => <button key={label} type="button" onClick={() => { setDraftStart(presetStart); setDraftEnd(presetEnd); }} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800">{label}</button>)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-950 p-2"><p className="text-slate-500">Mulai</p><p className="font-medium text-white">{draftStart ? formatShort(draftStart) : '—'}</p></div><div className="rounded-lg bg-slate-950 p-2"><p className="text-slate-500">Selesai</p><p className="font-medium text-white">{draftEnd ? formatShort(draftEnd) : '—'}</p></div></div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => { setDraftStart(''); setDraftEnd(''); onClear(); setOpen(false); }} className="flex-1 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800">Hapus</button>
          <button type="button" disabled={!draftStart || !draftEnd} onClick={() => { onApply(draftStart, draftEnd); setOpen(false); }} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Terapkan Filter</button>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
