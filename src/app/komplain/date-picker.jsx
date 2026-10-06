'use client';
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const formatLabel = (date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
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
  cell: 'relative p-0 text-center text-sm',
  day: 'h-9 w-9 rounded-lg p-0 font-normal text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 aria-selected:opacity-100',
  day_selected: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white',
  day_today: 'border border-blue-500 text-blue-300',
  day_outside: 'text-slate-600 opacity-50',
  day_disabled: 'text-slate-700 opacity-40',
  day_hidden: 'invisible',
};

export default function DatePicker({ id, value, onChange, placeholder = 'Pilih tanggal', className = '', clearable = false, disabled = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const selected = fromKey(value);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button type="button" id={id} aria-label={ariaLabel} disabled={disabled} className={`${className} flex items-center justify-between gap-2 text-left`}>
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? formatLabel(selected) : placeholder}</span>
        <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content data-komplain-popover align="start" sideOffset={8} className="komplain-theme z-[70] rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => { if (date) { onChange(toKey(date)); setOpen(false); } }}
          classNames={dayPickerClassNames}
          components={{
            IconLeft: ({ className: iconClassName }) => <ChevronLeft aria-hidden="true" className={`h-4 w-4 ${iconClassName || ''}`} />,
            IconRight: ({ className: iconClassName }) => <ChevronRight aria-hidden="true" className={`h-4 w-4 ${iconClassName || ''}`} />,
          }}
        />
        {clearable && value && <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"><X aria-hidden="true" className="h-4 w-4" />Hapus tanggal</button>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
