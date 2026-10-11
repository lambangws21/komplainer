import 'server-only';
import { ApiError } from './api-error.mjs';
import { usesFirebase } from './firebase-auth';
import { currentFirebaseUser, firebaseDirectory } from './firebase-accounts';
import { usesFirestore } from './firestore-store.mjs';
import { executeSchedule } from './firestore-schedule.mjs';

// Jadwal & Agenda is Firestore-only — the legacy Apps Script backend never gets this feature,
// so callers surface a clear 503 instead of silently doing nothing.
export async function callSchedules(action, body = {}) {
  if (!usesFirestore() || !usesFirebase()) throw new ApiError('Fitur jadwal belum tersedia.', 503);
  const user = await currentFirebaseUser();
  const accounts = await firebaseDirectory();
  return executeSchedule(action, body, { user, accounts });
}
