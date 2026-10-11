import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { usesFirebase, firebaseAuth } from '@/lib/server/firebase-auth';
import { usesFirestore } from '@/lib/server/firestore-store.mjs';
import { firebaseUid } from '@/lib/server/firebase-identity.mjs';
import { profileFromAccount } from '@/lib/server/firebase-profile.mjs';
import { firebaseDirectory } from '@/lib/server/firebase-accounts';
import { executeSchedule } from '@/lib/server/firestore-schedule.mjs';
import { buildIcs } from '@/lib/server/calendar-ics.mjs';

export const maxDuration = 15;
// Public, token-gated route: Google/Outlook/Apple Calendar poll this URL directly and can't send
// our session cookie or a custom Authorization header, so the secret has to live in the URL
// itself. Deliberately returns a generic 404 for every failure mode (unknown id, wrong token,
// feature disabled) rather than 401/403 — a feed URL is a bearer secret, so the response should
// not confirm or deny which part of it was wrong.
function notFound() {
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function GET(_request, { params }) {
  if (!usesFirestore() || !usesFirebase()) return notFound();
  const { id, token: rawToken } = await params;
  const token = rawToken?.endsWith('.ics') ? rawToken.slice(0, -4) : rawToken;
  if (!/^USR-[a-f0-9-]{36}$/i.test(id || '') || !/^[a-f0-9]{48}$/.test(token || '')) return notFound();
  let account;
  try { account = await firebaseAuth().getUser(firebaseUid(id)); } catch { return notFound(); }
  const user = profileFromAccount(account);
  if (!user || !user.calendarToken) return notFound();
  const expected = Buffer.from(user.calendarToken);
  const supplied = Buffer.from(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return notFound();
  const accounts = await firebaseDirectory();
  const result = await executeSchedule('list', {}, { user, accounts });
  const ics = buildIcs(result.data);
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="komplainer.ics"', 'Cache-Control': 'private, max-age=300' } });
}
