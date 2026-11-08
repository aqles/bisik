// Bisik relay server.
// Tugasnya cuma satu: meneruskan pesan yang SUDAH terenkripsi dari satu
// browser ke browser lain yang memakai kode yang sama.
// Pesan tidak pernah ditulis ke disk, database, atau log. Semuanya hanya
// lewat di RAM dan hilang begitu diteruskan / koneksi putus.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const PUBLIC = new URL('./public/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const httpServer = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(PUBLIC, path));
    if (!file.startsWith(PUBLIC)) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { ...HEADERS, 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { ...HEADERS, 'Content-Type': 'text/plain' });
    res.end('404');
  }
});

// room hash (SHA-256 dari kode, bukan kodenya sendiri) -> Set isi maks 2 klien
const rooms = new Map();

const wss = new WebSocketServer({ server: httpServer, maxPayload: 10 * 1024 * 1024 });

// Heartbeat: koneksi yang diam terlalu lama (atau mati diam-diam) diputus
// supaya ruangan tidak penuh oleh hantu dan relay tidak digantung proxy.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);
wss.on('close', () => clearInterval(heartbeat));

// Batas wajar untuk demo 2-orang: mencegah satu skrip menghabiskan RAM
// free tier dengan ribuan koneksi, atau membanjiri satu ruangan.
const MAX_CONN = 200, MAX_PER_IP = 10, MAX_MSG_PER_SEC = 30;
const perIp = new Map();
const ALLOWED_HOSTS = new Set(['bisik.onrender.com', 'bisik.ednasalam.com']);

wss.on('connection', (ws, req) => {
  // Cek Origin: situs lain tidak boleh membuka soket dari browser pengunjungnya.
  // Klien non-browser (tes) tidak mengirim Origin dan dibiarkan lewat.
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).hostname; } catch { /* origin rusak */ }
    if (!ALLOWED_HOSTS.has(host) && host !== 'localhost' && host !== '127.0.0.1') { ws.close(1008); return; }
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (wss.clients.size > MAX_CONN || (perIp.get(ip) || 0) >= MAX_PER_IP) { ws.close(1013); return; }
  perIp.set(ip, (perIp.get(ip) || 0) + 1);
  ws.on('close', () => perIp.set(ip, Math.max(0, (perIp.get(ip) || 1) - 1)));

  let room = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let winStart = Date.now(), winCount = 0;

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === 'join' && typeof m.room === 'string' && /^[a-f0-9]{64}$/.test(m.room)) {
      let set = rooms.get(m.room);
      if (!set) rooms.set(m.room, (set = new Set()));
      for (const p of set) if (p.readyState !== 1) set.delete(p); // bersihkan sisa koneksi mati
      if (set.size >= 2) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
      room = m.room;
      set.add(ws);
      ws.send(JSON.stringify({ type: 'joined', peers: set.size }));
      for (const peer of set) if (peer !== ws) peer.send(JSON.stringify({ type: 'peer', online: true }));
      return;
    }

    if (m.type === 'msg' && room && typeof m.data === 'string') {
      const now = Date.now();
      if (now - winStart > 1000) { winStart = now; winCount = 0; }
      if (++winCount > MAX_MSG_PER_SEC) return; // banjir: buang diam-diam
      const set = rooms.get(room);
      const peer = set && [...set].find((p) => p !== ws);
      if (!peer) {
        // Penerima offline: pesan dibuang, tidak diantrekan, tidak disimpan.
        ws.send(JSON.stringify({ type: 'dropped' }));
        return;
      }
      peer.send(JSON.stringify({ type: 'msg', data: m.data }));
    }
  });

  ws.on('close', () => {
    if (!room) return;
    const set = rooms.get(room);
    if (!set) return;
    set.delete(ws);
    for (const peer of set) peer.send(JSON.stringify({ type: 'peer', online: false }));
    if (set.size === 0) rooms.delete(room);
  });
});

httpServer.listen(PORT, () => console.log(`Bisik jalan di http://localhost:${PORT}`));
