// Service worker Bisik: cache HANYA file aplikasi (shell), supaya bisa
// diinstal sebagai PWA. Isi chat tidak pernah lewat sini dan tidak pernah
// di-cache — chat berjalan lewat WebSocket, bukan HTTP.
const CACHE = 'bisik-v2';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/privacy.html', '/terms.html', '/security.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
