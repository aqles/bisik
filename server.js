// Bisik relay server.
// It does exactly one thing: forward ALREADY-encrypted messages from one
// browser to the other browser that uses the same code.
// Messages are never written to disk, a database, or a log. Everything only
// passes through RAM and is gone once forwarded / once the connection drops.
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
  // Revalidate app files on every load: without this, a browser may keep
  // serving a stale cached shell (seen during the 2026-11-08 outage) long
  // after a new version is live. The service worker stays the offline
  // fallback — this only stops the plain HTTP cache from going stale.
  'Cache-Control': 'no-cache',
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

// room id (derived from the code, never the code itself) -> Set of max 2 clients
const rooms = new Map();

const wss = new WebSocketServer({ server: httpServer, maxPayload: 10 * 1024 * 1024 });

// Heartbeat: connections that stay silent too long (or died quietly) are cut,
// so rooms don't fill up with ghosts and proxies don't hang the relay.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);
wss.on('close', () => clearInterval(heartbeat));

// Sane limits for a 2-person chat: stops one script from eating the free
// tier's RAM with thousands of connections, or flooding a single room.
const MAX_CONN = 200, MAX_PER_IP = 10, MAX_FRAMES_PER_SEC = 30;
const perIp = new Map();
const ALLOWED_HOSTS = new Set(['bisik.onrender.com', 'bisik.ednasalam.com']);

wss.on('connection', (ws, req) => {
  // Origin check: other websites must not open sockets from their visitors'
  // browsers. Non-browser clients (the tests) send no Origin and are allowed.
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

    // One rate limit for EVERY frame type (join/key/ack/msg): the old code
    // only counted messages, so a socket could spam joins (flapping the
    // peer's "friend joined/left" status) or relay huge key frames without
    // ever hitting the cap. Normal use is a few frames a second at most.
    const now = Date.now();
    if (now - winStart > 1000) { winStart = now; winCount = 0; }
    if (++winCount > MAX_FRAMES_PER_SEC) return; // flooding: drop silently

    if (m.type === 'join' && typeof m.room === 'string' && /^[a-f0-9]{64}$/.test(m.room)) {
      let set = rooms.get(m.room);
      if (!set) rooms.set(m.room, (set = new Set()));
      for (const p of set) if (p.readyState !== 1) set.delete(p); // prune dead connections
      // Seat replacement: a reconnecting client sends the same random seat id
      // it always sends (kept only in page memory). Its lingering old socket
      // is itself, not a second person — close it before counting heads, so
      // a reconnect never reads as "your friend joined".
      if (typeof m.seat === 'string' && m.seat) {
        for (const p of [...set]) if (p.seat === m.seat) { p.replaced = true; set.delete(p); p.close(); }
        ws.seat = m.seat;
      }
      if (set.size >= 2) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
      room = m.room;
      set.add(ws);
      ws.send(JSON.stringify({ type: 'joined', peers: set.size }));
      for (const peer of set) if (peer !== ws) peer.send(JSON.stringify({ type: 'peer', online: true }));
      return;
    }

    // Session key exchange (v0.5+): one peer's ephemeral public key, itself
    // encrypted under the code key, relayed to the other peer. The server
    // can't read it and keeps nothing; if the peer isn't there it's dropped.
    if (m.type === 'key' && room && typeof m.data === 'string') {
      const set = rooms.get(room);
      const peer = set && [...set].find((p) => p !== ws);
      if (peer) peer.send(JSON.stringify({ type: 'key', data: m.data }));
      return;
    }

    // Delivery receipt: a bare id echoed by the receiver, relayed to the
    // sender. Carries no content; the sender marks that message delivered.
    if (m.type === 'ack' && room && typeof m.id === 'string') {
      const set = rooms.get(room);
      const peer = set && [...set].find((p) => p !== ws);
      if (peer) peer.send(JSON.stringify({ type: 'ack', id: m.id }));
      return;
    }

    if (m.type === 'msg' && room && typeof m.data === 'string') {
      const set = rooms.get(room);
      const peer = set && [...set].find((p) => p !== ws);
      if (!peer) {
        // Recipient offline: the message is discarded — not queued, not
        // stored. The id tells the sender exactly which message died.
        ws.send(JSON.stringify({ type: 'dropped', id: typeof m.id === 'string' ? m.id : undefined }));
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
    if (ws.replaced) return; // its replacement is already seated; nobody "left"
    for (const peer of set) peer.send(JSON.stringify({ type: 'peer', online: false }));
    if (set.size === 0) rooms.delete(room);
  });
});

httpServer.listen(PORT, () => console.log(`Bisik running at http://localhost:${PORT}`));
