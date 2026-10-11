import { google } from 'googleapis';
import { ApiError } from './api-error.mjs';
import { firestoreDb } from './firestore-store.mjs';

export const CONFIG = 'komplainer_config';
const CONFIG_DOC = 'google_calendar';
// userinfo.email is needed to label the connection ("Terhubung sebagai x@gmail.com") — without
// it, oauth2.userinfo.get() in completeConnection() fails with an insufficient-scope error.
const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/userinfo.email'];
const CALENDAR_NAME = 'Jadwal Komplainer';
export const OAUTH_STATE_COOKIE = 'komplain_google_oauth_state';

function redirectUri(origin) {
  return `${origin}/api/calendar/google/callback`;
}

export function oauthClient(origin) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ApiError('Integrasi Google Calendar belum dikonfigurasi (GOOGLE_OAUTH_CLIENT_ID/SECRET).', 503);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri(origin));
}

export function consentUrl(origin, state) {
  return oauthClient(origin).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state });
}

export async function loadConfig(db = firestoreDb()) {
  const doc = await db.collection(CONFIG).doc(CONFIG_DOC).get();
  return doc.exists ? doc.data() : null;
}

async function saveConfig(data, db = firestoreDb()) {
  await db.collection(CONFIG).doc(CONFIG_DOC).set(data);
}

export async function clearConfig(db = firestoreDb()) {
  await db.collection(CONFIG).doc(CONFIG_DOC).delete();
}

// Exchanges the OAuth `code` for tokens, creates (or reuses) the shared calendar, makes it
// readable via link (ACL default:reader — "public via link, not listed anywhere", per the
// confirmed sharing model), and persists everything. Called once, right after the consent
// redirect lands back on our callback route.
// Wraps a Google API step so a raw GaxiosError never bubbles up as the generic "Permintaan
// tidak dapat diproses" — each step says plainly which part of the connection flow broke.
async function step(label, fn) {
  try { return await fn(); }
  catch (error) { throw new ApiError(`${label}: ${error?.response?.data?.error_description || error?.message || 'gagal tidak diketahui'}`, 502); }
}

export async function completeConnection(code, origin, user, db = firestoreDb()) {
  const auth = oauthClient(origin);
  const { tokens } = await step('Tukar kode otorisasi', () => auth.getToken(code));
  if (!tokens.refresh_token) throw new ApiError('Google tidak mengirim refresh token. Putuskan akses aplikasi ini di myaccount.google.com/permissions lalu coba hubungkan lagi.', 502);
  auth.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth, version: 'v2' });
  const profile = await step('Ambil info akun Google', async () => (await oauth2.userinfo.get()).data);
  const existing = await loadConfig(db);
  const calendar = google.calendar({ version: 'v3', auth });
  let calendarId = existing?.calendarId;
  if (!calendarId) {
    calendarId = await step('Buat kalender bersama', async () => (await calendar.calendars.insert({ requestBody: { summary: CALENDAR_NAME } })).data.id);
    await step('Atur akses kalender (link publik)', () => calendar.acl.insert({ calendarId, requestBody: { role: 'reader', scope: { type: 'default' } } }));
  }
  await step('Simpan konfigurasi', () => saveConfig({ refreshToken: tokens.refresh_token, calendarId, email: profile.email || '', connectedByNama: user.nama, connectedAt: new Date().toISOString() }, db));
  return { calendarId, email: profile.email || '' };
}

export function subscribeUrl(calendarId) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

// Pure mapping, no network — kept separate from syncEvent() so it's unit-testable without
// live Google credentials.
export function scheduleToEventBody(schedule) {
  const description = [schedule.notes, schedule.picNama ? `PIC: ${schedule.picNama}` : ''].filter(Boolean).join('\n');
  return {
    summary: schedule.title,
    ...(schedule.location ? { location: schedule.location } : {}),
    ...(description ? { description } : {}),
    start: { dateTime: `${schedule.date}T${schedule.startTime}:00`, timeZone: 'Asia/Jakarta' },
    end: { dateTime: `${schedule.date}T${schedule.endTime}:00`, timeZone: 'Asia/Jakarta' },
  };
}

// Best-effort: a schedule must still save in our own data store even if Google is unreachable,
// the token was revoked, or the feature was never connected — so this never throws.
export async function syncEvent(action, schedule, db = firestoreDb()) {
  try {
    const config = await loadConfig(db);
    if (!config?.refreshToken || !config.calendarId) return { synced: false };
    const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: config.refreshToken });
    const calendar = google.calendar({ version: 'v3', auth });
    if (action === 'delete') {
      if (!schedule.googleEventId) return { synced: false };
      await calendar.events.delete({ calendarId: config.calendarId, eventId: schedule.googleEventId }).catch((error) => { if (error.code !== 404 && error.code !== 410) throw error; });
      return { synced: true };
    }
    const requestBody = scheduleToEventBody(schedule);
    if (action === 'update' && schedule.googleEventId) {
      await calendar.events.update({ calendarId: config.calendarId, eventId: schedule.googleEventId, requestBody });
      return { synced: true, googleEventId: schedule.googleEventId };
    }
    const { data: created } = await calendar.events.insert({ calendarId: config.calendarId, requestBody });
    return { synced: true, googleEventId: created.id };
  } catch { return { synced: false }; }
}
