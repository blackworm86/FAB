// The offline helper of the installed app. Pages: network first (always the latest build), the last copy when offline.
// Built files (assets/, hashed names): cache first. Maps, relief and art: the cached copy at once, refreshed in the background.
// Never touches other sites (Firebase, fonts): online play always talks to the server directly.
const CACHE = 'fab-v1';
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
