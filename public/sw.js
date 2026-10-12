/* Cache only public fallback assets. Complaint pages and API data stay network-only. */
const CACHE_NAME = 'komplain-public-v1';
const FALLBACK = '/offline.html';
const PUBLIC_ASSETS = [FALLBACK, '/icons/komplain-192.png', '/icons/komplain-512.png', '/icons/komplain-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('komplain-public-') && key !== CACHE_NAME).map((key) => caches.delete(key)))));
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/komplain')) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(FALLBACK)) || Response.error()));
  } else if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* Non-JSON payload is ignored, not fatal. */ }
  const title = data.title || 'Komplainer';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/komplain-192.png',
    badge: '/icons/komplain-192.png',
    data: { url: data.url || '/komplain' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/komplain';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    const existing = windowClients.find((client) => new URL(client.url).pathname === url);
    if (existing) return existing.focus();
    return clients.openWindow(url);
  }));
});
