// Treat incident dates as calendar dates, without timezone conversion.
export function dateKey(value) {
  const key = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const parsed = new Date(`${key}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key ? null : key;
}
export function shiftDate(value, days) {
  const key = dateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekStart(value) {
  const key = dateKey(value);
  if (!key) return null;
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return shiftDate(key, -((day + 6) % 7));
}
export function summarizeWeek(records, selectedDate) {
  const start = weekStart(selectedDate);
  if (!start) throw new Error('Tanggal periode tidak valid');
  const end = shiftDate(start, 6);
  const previousStart = shiftDate(start, -7);
  const valid = records.filter((item) => dateKey(item.tanggal));
  const current = valid.filter((item) => dateKey(item.tanggal) >= start && dateKey(item.tanggal) <= end);
  const previous = valid.filter((item) => dateKey(item.tanggal) >= previousStart && dateKey(item.tanggal) < start);
  return {
    start, end, current, previous, invalidDates: records.length - valid.length,
    days: Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(start, index);
      return { date, count: current.filter((item) => dateKey(item.tanggal) === date).length };
    }),
  };
}
