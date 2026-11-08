// Bisik service worker: caches ONLY the app files (the shell), so the app
// can be installed as a PWA. Chat contents never pass through here and are
// never cached — chat runs over WebSocket, not HTTP.
// Network-first strategy: the latest version always wins, the cache is just
// an offline fallback. (The old cache-first version made updates depend on
// a human remembering to rename the cache every release.)
const CACHE = 'bisik-v6';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/crypto.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/privacy.html', '/terms.html', '/security.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
