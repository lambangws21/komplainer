import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleToEventBody, subscribeUrl } from '../src/lib/server/google-calendar.mjs';

test('maps a schedule into a Google Calendar event body with local Asia/Jakarta dateTime + timeZone', () => {
  const body = scheduleToEventBody({ title: 'Kalibrasi Alat', date: '2026-03-12', startTime: '09:00', endTime: '10:30' });
  assert.equal(body.summary, 'Kalibrasi Alat');
  assert.deepEqual(body.start, { dateTime: '2026-03-12T09:00:00', timeZone: 'Asia/Jakarta' });
  assert.deepEqual(body.end, { dateTime: '2026-03-12T10:30:00', timeZone: 'Asia/Jakarta' });
  assert.equal('location' in body, false);
  assert.equal('description' in body, false);
});

test('includes location only when set, and combines notes + PIC into description', () => {
  const withLocation = scheduleToEventBody({ title: 'A', date: '2026-03-12', startTime: '09:00', endTime: '10:00', location: 'RS Harapan Bunda' });
  assert.equal(withLocation.location, 'RS Harapan Bunda');
  const withNotesAndPic = scheduleToEventBody({ title: 'A', date: '2026-03-12', startTime: '09:00', endTime: '10:00', notes: 'Bawa alat cadangan', picNama: 'Siti' });
  assert.equal(withNotesAndPic.description, 'Bawa alat cadangan\nPIC: Siti');
  const picOnly = scheduleToEventBody({ title: 'A', date: '2026-03-12', startTime: '09:00', endTime: '10:00', picNama: 'Siti' });
  assert.equal(picOnly.description, 'PIC: Siti');
});

test('subscribeUrl builds the documented public-calendar ICS address', () => {
  assert.equal(subscribeUrl('abc123@group.calendar.google.com'), 'https://calendar.google.com/calendar/ical/abc123%40group.calendar.google.com/public/basic.ics');
});
