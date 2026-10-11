// Hand-written RFC 5545 (iCalendar) generator — no ICS library is installed in this project.
// Pure text transform, no I/O, so it's testable without live Firebase credentials.

// Asia/Jakarta has no DST and is fixed UTC+7 year-round, so a static offset is correct here
// (schedules are entered as local Jakarta wall-clock time, not stored with a timezone).
const JAKARTA_OFFSET_MINUTES = 7 * 60;

const pad = (value) => String(value).padStart(2, '0');

function utcStamp(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

// dateStr: "YYYY-MM-DD", timeStr: "HH:MM", both interpreted as Asia/Jakarta local time.
function toUtcStamp(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return utcStamp(new Date(Date.UTC(year, month - 1, day, hour, minute) - JAKARTA_OFFSET_MINUTES * 60000));
}

// Order matters: escape backslashes first so the \n inserted for real newlines isn't re-escaped.
function escapeText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// RFC 5545 §3.1: lines SHOULD be folded at 75 octets, continuation lines start with one space.
// Iterates by code point (not UTF-16 unit) so a multi-byte character is never split mid-way.
function foldLine(line) {
  let result = '';
  let chunk = '';
  let limit = 75;
  for (const char of line) {
    const candidate = chunk + char;
    if (Buffer.byteLength(candidate, 'utf8') > limit) {
      result += `${chunk}\r\n `;
      chunk = char;
      limit = 74;
    } else chunk = candidate;
  }
  return result + chunk;
}

export function buildIcs(schedules, { now = new Date(), calendarName = 'Jadwal Komplainer' } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Komplainer//Jadwal//ID', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(calendarName)}`, 'X-WR-TIMEZONE:Asia/Jakarta'];
  for (const item of schedules) {
    const description = [item.notes, item.picNama ? `PIC: ${item.picNama}` : ''].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:${item.id}@komplainer`, `DTSTAMP:${utcStamp(now)}`, `DTSTART:${toUtcStamp(item.date, item.startTime)}`, `DTEND:${toUtcStamp(item.date, item.endTime)}`, `SUMMARY:${escapeText(item.title)}`);
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (typeof item.locationLat === 'number' && typeof item.locationLng === 'number') lines.push(`GEO:${item.locationLat};${item.locationLng}`);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
