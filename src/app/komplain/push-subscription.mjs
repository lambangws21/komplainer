'use client';
import { apiRequest, postJson } from './api-client.mjs';

// Shared by PushToggle (account menu) and PushPrompt (first-login nudge) so both drive the same
// subscribe/unsubscribe path instead of duplicating the Web Push plumbing.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function existingPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi ditolak di browser/HP Anda.');
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('Notifikasi belum dikonfigurasi di server.');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await apiRequest('/api/push/subscribe', postJson({ subscription: subscription.toJSON() }));
  return subscription;
}

export async function unsubscribePush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) { await apiRequest('/api/push/unsubscribe', postJson({ endpoint: subscription.endpoint })); await subscription.unsubscribe(); }
}
