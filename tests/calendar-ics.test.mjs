import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../src/lib/server/calendar-ics.mjs';

const now = new Date('2026-01-01T00:00:00Z');

test('builds a valid VCALENDAR wrapper even with no events', () => {
  const ics = buildIcs([], { now });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

test('converts Asia/Jakarta (UTC+7) local date/time to UTC DTSTART/DTEND, same day', () => {
  const ics = buildIcs([{ id: 'SCH-1', title: 'Kalibrasi Alat', date: '2026-03-12', startTime: '09:00', endTime: '10:30' }], { now });
  assert.match(ics, /DTSTART:20260312T020000Z/);
  assert.match(ics, /DTEND:20260312T033000Z/);
  assert.match(ics, /UID:SCH-1@komplainer/);
  assert.match(ics, /DTSTAMP:20260101T000000Z/);
  assert.match(ics, /SUMMARY:Kalibrasi Alat/);
});

test('rolls over to the previous UTC day for early Jakarta morning times', () => {
  const ics = buildIcs([{ id: 'SCH-2', title: 'Pagi', date: '2026-03-12', startTime: '01:00', endTime: '02:00' }], { now });
  assert.match(ics, /DTSTART:20260311T180000Z/);
  assert.match(ics, /DTEND:20260311T190000Z/);
});

test('escapes commas, semicolons, backslashes and newlines in text fields, in the correct order', () => {
  const ics = buildIcs([{ id: 'SCH-3', title: 'Follow-up; dr. A, B\\C', date: '2026-03-12', startTime: '09:00', endTime: '10:00', notes: 'Baris 1\nBaris 2', picNama: 'Siti' }], { now });
  assert.match(ics, /SUMMARY:Follow-up\\; dr\. A\\, B\\\\C/);
  assert.match(ics, /DESCRIPTION:Baris 1\\nBaris 2\\nPIC: Siti/);
});

test('includes an escaped LOCATION line when a location is set, omits it otherwise', () => {
  const withLocation = buildIcs([{ id: 'SCH-6', title: 'Kalibrasi', date: '2026-03-12', startTime: '09:00', endTime: '10:00', location: 'RS Harapan, Ruang OK 3' }], { now });
  assert.match(withLocation, /LOCATION:RS Harapan\\, Ruang OK 3/);
  const withoutLocation = buildIcs([{ id: 'SCH-7', title: 'Kalibrasi', date: '2026-03-12', startTime: '09:00', endTime: '10:00' }], { now });
  assert.doesNotMatch(withoutLocation, /LOCATION:/);
});

test('includes a GEO line only when both coordinates are numbers (a geocoded pick, not free-typed text)', () => {
  const withCoords = buildIcs([{ id: 'SCH-8', title: 'Kalibrasi', date: '2026-03-12', startTime: '09:00', endTime: '10:00', location: 'RSUPN', locationLat: -6.2, locationLng: 106.8 }], { now });
  assert.match(withCoords, /GEO:-6\.2;106\.8/);
  const freeTyped = buildIcs([{ id: 'SCH-9', title: 'Kalibrasi', date: '2026-03-12', startTime: '09:00', endTime: '10:00', location: 'Lokasi bebas' }], { now });
  assert.doesNotMatch(freeTyped, /GEO:/);
});

test('omits DESCRIPTION entirely when there are no notes and no PIC', () => {
  const ics = buildIcs([{ id: 'SCH-4', title: 'Acara kosong', date: '2026-03-12', startTime: '09:00', endTime: '10:00' }], { now });
  assert.doesNotMatch(ics, /DESCRIPTION:/);
});

test('folds long lines at 75 octets with a CRLF + single-space continuation, without losing content', () => {
  const longTitle = 'A'.repeat(120);
  const ics = buildIcs([{ id: 'SCH-5', title: longTitle, date: '2026-03-12', startTime: '09:00', endTime: '10:00' }], { now });
  const summaryLine = ics.split('BEGIN:VEVENT')[1].split('END:VEVENT')[0];
  assert.match(summaryLine, /SUMMARY:A+\r\n A+/);
  const rejoined = summaryLine.replace(/\r\n /g, '');
  assert.match(rejoined, new RegExp(`SUMMARY:${longTitle}`));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line exceeds 75 octets: ${line.slice(0, 20)}…`);
});

test('renders one VEVENT per schedule, in the order given', () => {
  const ics = buildIcs([{ id: 'SCH-A', title: 'Pertama', date: '2026-03-12', startTime: '09:00', endTime: '10:00' }, { id: 'SCH-B', title: 'Kedua', date: '2026-03-13', startTime: '11:00', endTime: '12:00' }], { now });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.indexOf('UID:SCH-A@komplainer') < ics.indexOf('UID:SCH-B@komplainer'));
});
