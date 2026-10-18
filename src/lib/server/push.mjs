import { createHash } from 'node:crypto';
import webpush from 'web-push';
import { ApiError } from './api-error.mjs';
import { firestoreDb } from './firestore-store.mjs';

export const PUSH_SUBSCRIPTIONS = 'komplainer_push_subscriptions';
const subscriptionId = (endpoint) => createHash('sha256').update(endpoint).digest('hex');

function vapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new ApiError('Notifikasi HP belum dikonfigurasi (VAPID belum diisi).', 503);
  return { subject, publicKey, privateKey };
}

export async function saveSubscription(userId, subscription, db = firestoreDb()) {
  const { endpoint, keys } = subscription || {};
  if (typeof endpoint !== 'string' || !endpoint || !keys?.p256dh || !keys?.auth) throw new ApiError('Data langganan notifikasi tidak valid.');
  const id = subscriptionId(endpoint);
  await db.collection(PUSH_SUBSCRIPTIONS).doc(id).set({ id, userId, endpoint, keys, updatedAt: new Date().toISOString() });
}

export async function removeSubscription(endpoint, db = firestoreDb()) {
  if (typeof endpoint !== 'string' || !endpoint) return;
  await db.collection(PUSH_SUBSCRIPTIONS).doc(subscriptionId(endpoint)).delete();
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

// Best-effort, per-subscription: a notification failing to send must never surface as an error
// to the person who triggered the mutation. A 404/410 response means the browser dropped that
// subscription (uninstalled, permission revoked, etc.) — standard web-push cleanup is to delete
// it so we stop trying.
export async function sendPush(userIds, payload, db = firestoreDb()) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  let config;
  try { config = vapidDetails(); } catch { return; }
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const subscriptions = [];
  for (const group of chunk(ids, 30)) {
    const snapshot = await db.collection(PUSH_SUBSCRIPTIONS).where('userId', 'in', group).get();
    subscriptions.push(...snapshot.docs.map((doc) => doc.data()));
  }
  const body = JSON.stringify(payload);
  await Promise.allSettled(subscriptions.map(async (sub) => {
    try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body); }
    catch (error) { if (error?.statusCode === 404 || error?.statusCode === 410) await removeSubscription(sub.endpoint, db); }
  }));
}

// Broadcasts to every subscribed device directly — unlike sendPush, this isn't scoped to a
// handful of userIds from one mutation, so it skips the per-user "in" query and just fans out
// over the whole subscriptions collection once a day (see the cron entry in vercel.json).
export async function sendBroadcast(payload, db = firestoreDb()) {
  let config;
  try { config = vapidDetails(); } catch { return { sent: 0, total: 0 }; }
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const snapshot = await db.collection(PUSH_SUBSCRIPTIONS).get();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(snapshot.docs.map(async (doc) => {
    const sub = doc.data();
    try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body); }
    catch (error) { if (error?.statusCode === 404 || error?.statusCode === 410) await removeSubscription(sub.endpoint, db); throw error; }
  }));
  return { sent: results.filter((r) => r.status === 'fulfilled').length, total: snapshot.size };
}

// Centralizes "who gets notified about what" for report mutations — see the Web Push plan's
// scope note: this fires once at the moment of the event rather than replicating the in-app
// bell's polling/dedup semantics.
export function pushTargetsForMutation(action, item, mentions, accounts) {
  const targets = [];
  const push = (userId, title, body) => { if (userId) targets.push({ userId, title, body, url: '/komplain' }); };
  if (action === 'create') {
    for (const account of accounts) if (['admin', 'petugas'].includes(account.role) && account.active && account.id !== item.pelaporId) push(account.id, 'Laporan baru', `${item.dokter || 'Dokter'} · ${item.rumahSakit || 'RS'}`);
  }
  if (action === 'assign' && item.picId) {
    push(item.picId, 'Tugas komplain baru', `${item.dokter || 'Dokter'} · ${item.rumahSakit || 'RS'}`);
    if (item.pelaporId && item.pelaporId !== item.picId) push(item.pelaporId, 'Laporan Anda ditugaskan', `PIC: ${item.picNama || '-'}`);
  }
  if (action === 'followUp' && item.pelaporId) push(item.pelaporId, item.statusPenanganan === 'Selesai' ? 'Laporan Anda selesai ditangani' : 'Ada update penanganan laporan Anda', `${item.dokter || 'Laporan'} · ${item.rumahSakit || ''}`.trim());
  if (action === 'reopen' && item.picId) push(item.picId, 'Komplain dibuka kembali', `${item.dokter || 'Dokter'} · ${item.rumahSakit || 'RS'}`);
  for (const mentionedId of mentions || []) push(mentionedId, 'Anda disebut', `${item.dokter || 'Laporan'} · ${item.rumahSakit || ''}`.trim());
  return targets;
}

export function announcementRecipientIds(item, accounts) {
  return [...new Set(accounts.filter((account) => account.active && account.id !== item.createdBy && (
    item.audience === 'all' || item.audience === account.role || (item.audience === 'users' && item.recipientIds?.includes(account.id))
  )).map((account) => account.id))];
}
