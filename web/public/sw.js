// The offline helper of the installed app. Pages: network first (always the latest build), the last copy when offline.
// Built files (assets/, hashed names): cache first. Maps, relief and art: the cached copy at once, refreshed in the background.
// Never touches other sites (Firebase, fonts): online play always talks to the server directly.
const CACHE = 'fab-v6';   // bumped when a file must not be served stale (v2: hatch without <pattern>; v3: figure orientations; v4: new figures; v5: figures set 2; v6: set 4)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req); const c = await caches.open(CACHE); c.put('./', res.clone()); return res; }
      catch { return (await caches.match('./')) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(req);
    const net = fetch(req).then((res) => { if (res.ok && res.status === 200) c.put(req, res.clone()); return res; });
    if (hit) { if (!url.pathname.includes('/assets/')) e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
// A tap on a "your move" notice opens (or focuses) that game.
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = e.notification.data?.url || './';
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) if (c.url === url && 'focus' in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
// The closed-app "your move" push (4.3 step 2): the relay sends no text, so the notice is generic and opens the list of games.
self.addEventListener('push', (e) => {
  e.waitUntil(self.registration.showNotification('Your move · Fast Action Battles', { body: 'The other player has moved. Tap to play.', tag: 'fab-move', renotify: true, icon: './icons/app-192.png', badge: './icons/app-192.png', data: { url: self.registration.scope } }));
});
