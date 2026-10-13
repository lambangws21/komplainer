'use client';
import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { id } from 'date-fns/locale';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';

const fromKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const classNames = {
  months: 'flex flex-col',
  month: 'space-y-3',
  caption: 'flex items-center justify-between px-1',
  caption_label: 'text-sm font-semibold text-slate-100',
  nav: 'flex items-center gap-1',
  nav_button: 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-30',
  nav_button_previous: '',
  nav_button_next: '',
  table: 'w-full border-collapse',
  head_row: 'flex justify-between',
  head_cell: 'flex-1 text-center text-[11px] font-medium text-slate-500',
  row: 'flex w-full justify-between mt-1',
  cell: 'relative flex-1 p-0 text-center text-sm',
  day: 'mx-auto h-8 w-8 rounded-lg p-0 text-xs font-normal text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
  day_today: 'border border-blue-500 text-blue-300 font-semibold',
  day_outside: 'text-slate-600 opacity-50',
  day_hidden: 'invisible',
};

// Read-only month view for the Beranda rail — no date selection, just orientation (today) and a
// dot marker on days that already have a scheduled event, so admin sees at a glance which days
// this month are busy without opening the full Jadwal & Agenda list.
export default function MiniCalendar({ schedules = [] }) {
  const [month, setMonth] = useState(new Date());
  const eventDays = useMemo(() => schedules.map((item) => fromKey(item.date)).filter(Boolean), [schedules]);
  return <section data-tour="calendar" aria-label="Kalender" className="w-full min-w-0 space-y-2 lg:rounded-2xl lg:border lg:border-slate-800 lg:bg-slate-900/50 lg:p-4">
    <div className="flex items-center gap-2"><CalendarRange aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><h3 className="text-sm font-semibold">Kalender</h3></div>
    <DayPicker
      mode="default"
      locale={id}
      month={month}
      onMonthChange={setMonth}
      modifiers={{ hasEvent: eventDays }}
      modifiersClassNames={{ hasEvent: 'relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-blue-400' }}
      onDayClick={(day, modifiers) => { if (modifiers.hasEvent) document.getElementById('jadwal-agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
      classNames={classNames}
      components={{
        IconLeft: ({ className: iconClassName }) => <ChevronLeft aria-hidden="true" className={`h-4 w-4 ${iconClassName || ''}`} />,
        IconRight: ({ className: iconClassName }) => <ChevronRight aria-hidden="true" className={`h-4 w-4 ${iconClassName || ''}`} />,
      }}
    />
  </section>;
}
