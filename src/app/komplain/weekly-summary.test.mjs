import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, shiftDate, weekStart, summarizeWeek } from './weekly-summary.mjs';

test('Senin–Minggu dan pergantian tahun', () => {
  assert.equal(weekStart('2026-10-04'), '2026-09-28');
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
  assert.equal(shiftDate('2026-12-28', 6), '2027-01-03');
});
test('tanggal kalender valid dan timestamp tanpa konversi zona waktu', () => {
  assert.equal(dateKey('2024-02-29'), '2024-02-29');
  assert.equal(dateKey('2026-02-29'), null);
  assert.equal(dateKey('2026-04-31'), null);
  assert.equal(dateKey(null), null);
  assert.equal(dateKey('2026-10-04T23:00:00Z'), '2026-10-04');
});
test('rekap memisahkan batas minggu, minggu sebelumnya, dan tanggal invalid', () => {
  const data = ['2026-09-20', '2026-09-21', '2026-09-27', '2026-09-28', '2026-10-04T23:00:00Z', '2026-10-05', '2026-02-30', ''].map((tanggal) => ({ tanggal }));
  const summary = summarizeWeek(data, '2026-10-03');
  assert.equal(summary.start, '2026-09-28');
  assert.equal(summary.end, '2026-10-04');
  assert.equal(summary.current.length, 2);
  assert.equal(summary.previous.length, 2);
  assert.equal(summary.invalidDates, 2);
  assert.deepEqual(summary.days.map((day) => day.count), [1, 0, 0, 0, 0, 0, 1]);
  assert.equal(summary.days.reduce((sum, day) => sum + day.count, 0), summary.current.length);
});
test('minggu kosong tetap memiliki tujuh hari', () => {
  const summary = summarizeWeek([], '2026-10-03');
  assert.equal(summary.current.length, 0);
  assert.equal(summary.previous.length, 0);
  assert.equal(summary.days.length, 7);
  assert.throws(() => summarizeWeek([], 'invalid'));
});
