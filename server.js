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

const httpServer = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(PUBLIC, path));
    if (!file.startsWith(PUBLIC)) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
});

// room hash (SHA-256 dari kode, bukan kodenya sendiri) -> Set isi maks 2 klien
const rooms = new Map();

const wss = new WebSocketServer({ server: httpServer, maxPayload: 10 * 1024 * 1024 });

wss.on('connection', (ws) => {
  let room = null;

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === 'join' && typeof m.room === 'string' && /^[a-f0-9]{64}$/.test(m.room)) {
      let set = rooms.get(m.room);
      if (!set) rooms.set(m.room, (set = new Set()));
      if (set.size >= 2) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
      room = m.room;
      set.add(ws);
      ws.send(JSON.stringify({ type: 'joined', peers: set.size }));
      for (const peer of set) if (peer !== ws) peer.send(JSON.stringify({ type: 'peer', online: true }));
      return;
    }

    if (m.type === 'msg' && room && typeof m.data === 'string') {
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
