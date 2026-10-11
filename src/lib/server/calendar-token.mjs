import 'server-only';
import { randomBytes } from 'node:crypto';
import { writeFirebaseMetadata } from './firebase-accounts';

export const generateCalendarToken = () => randomBytes(24).toString('hex');

export async function ensureCalendarToken(user) {
  if (user.calendarToken) return user.calendarToken;
  const token = generateCalendarToken();
  await writeFirebaseMetadata(user.firebaseUid, { calendarToken: token });
  return token;
}

export async function resetCalendarToken(user) {
  const token = generateCalendarToken();
  await writeFirebaseMetadata(user.firebaseUid, { calendarToken: token });
  return token;
}
