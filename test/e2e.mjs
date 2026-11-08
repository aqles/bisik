// Test ujung-ke-ujung Bisik: memakai modul kripto yang SAMA dengan browser
// (public/crypto.js) terhadap server relay beneran.
// Yang dicek: (1) kode sama bisa ngobrol & server cuma lihat ciphertext,
// (2) kode beda tidak nyasar, (3) penerima offline = pesan dibuang,
// (4) reconnect setelah putus kasar, (5) gambar 1MB terkirim utuh,
// (6) Origin asing ditolak, (7) banjir pesan di atas batas dibuang sebagian.
import { spawn } from 'node:child_process';
import { createHash, randomFillSync } from 'node:crypto';
import WebSocket from 'ws';
import { deriveSession, encryptWith, decryptWith } from '../public/crypto.js';

const PORT = 3210;
const enc = new TextEncoder();
const dec = new TextDecoder();
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const server = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok) => { console.log((ok ? 'LOLOS' : 'GAGAL') + ' - ' + name); if (!ok) failures++; };

function client(options) {
  const ws = new WebSocket(`ws://localhost:${PORT}`, options);
  ws.inbox = [];
  ws.on('message', (d) => ws.inbox.push(JSON.parse(d.toString())));
  return new Promise((res) => ws.on('open', () => res(ws)));
}
async function join(ws, code) {
  const { room } = await deriveSession(code);
  ws.send(JSON.stringify({ type: 'join', room }));
  await wait(150);
}

try {
  await wait(600);
  const CODE = 'Senja-Kopi-Bulan-4821'; // huruf campuran: kode sekarang persis seperti diketik
  const { key: keyA } = await deriveSession(CODE);

  // (3) sendirian kirim pesan -> harus dibuang server
  const solo = await client(); await join(solo, 'ruang-sendiri-123');
  const { key: keySolo } = await deriveSession('ruang-sendiri-123');
  solo.send(JSON.stringify({ type: 'msg', data: await encryptWith(keySolo, 'text', enc.encode('halo?')) }));
  await wait(250);
  check('penerima offline: pesan dibuang (dropped)', solo.inbox.some((m) => m.type === 'dropped'));
  solo.close();

  // (1)+(2) A & B sekode, C kode lain
  const a = await client(), b = await client(), c = await client();
  await join(a, CODE); await join(b, CODE); await join(c, 'kode-yang-lain-999');
  const secret = 'pesan rahasia jam 7';
  a.send(JSON.stringify({ type: 'msg', data: await encryptWith(keyA, 'text', enc.encode(secret)) }));
  await wait(300);

  const gotB = b.inbox.find((m) => m.type === 'msg');
  check('kode sama: pesan sampai ke B', !!gotB);
  check('server cuma lihat ciphertext (plaintext tidak ada di kabel)',
    gotB && !gotB.data.includes('rahasia') && !gotB.data.includes(secret));
  check('kode sama: B bisa mendekripsi jadi plaintext',
    gotB && dec.decode((await decryptWith(keyA, gotB.data)).data) === secret);
  check('kode beda: C tidak menerima apa-apa', !c.inbox.some((m) => m.type === 'msg'));

  // (5) gambar 1MB — jalur yang dulu crash di browser (base64 spread)
  const img = randomFillSync(new Uint8Array(1024 * 1024));
  a.send(JSON.stringify({ type: 'msg', data: await encryptWith(keyA, 'image', img, 'image/png') }));
  await wait(800);
  const gotImg = b.inbox.filter((m) => m.type === 'msg').at(-1);
  let imgOk = false;
  if (gotImg) {
    const back = new Uint8Array((await decryptWith(keyA, gotImg.data)).data);
    imgOk = back.length === img.length && sha(back) === sha(img);
  }
  check('gambar 1MB: terkirim dan terdekripsi utuh', imgOk);

  // (4) reconnect: koneksi putus kasar, klien baru berkode sama bisa masuk lagi
  const CODE2 = 'ruang-reconnect-77';
  const { key: key2 } = await deriveSession(CODE2);
  const d = await client(), e = await client();
  await join(d, CODE2); await join(e, CODE2);
  d.terminate(); // putus tanpa pamit, seperti jaringan drop
  await wait(300);
  const d2 = await client(); await join(d2, CODE2);
  check('reconnect: bisa masuk lagi setelah putus kasar', d2.inbox.some((m) => m.type === 'joined'));
  e.send(JSON.stringify({ type: 'msg', data: await encryptWith(key2, 'text', enc.encode('nyambung lagi')) }));
  await wait(300);
  const gotD2 = d2.inbox.find((m) => m.type === 'msg');
  check('reconnect: pesan tetap mengalir setelah nyambung lagi',
    !!gotD2 && dec.decode((await decryptWith(key2, gotD2.data)).data) === 'nyambung lagi');
  d2.close(); e.close();

  // (7) banjir: 40 pesan diledakkan sekaligus, yang sampai harus <= batas 30/detik
  b.inbox.length = 0;
  const envelopes = await Promise.all(
    Array.from({ length: 40 }, (_, i) => encryptWith(keyA, 'text', enc.encode('spam ' + i))));
  for (const data of envelopes) a.send(JSON.stringify({ type: 'msg', data }));
  await wait(500);
  const spamGot = b.inbox.filter((m) => m.type === 'msg').length;
  check(`banjir pesan: yang diteruskan ${spamGot} <= batas 30`, spamGot <= 30 && spamGot >= 20);

  // (6) Origin asing ditolak sebelum bisa gabung
  const evil = new WebSocket(`ws://localhost:${PORT}`, { headers: { Origin: 'https://situs-jahat.example' } });
  let evilJoined = false, evilClosed = false;
  evil.on('message', (d2) => { if (JSON.parse(d2.toString()).type === 'joined') evilJoined = true; });
  evil.on('close', () => { evilClosed = true; });
  await new Promise((res) => { evil.on('open', res); evil.on('error', res); });
  const { room: evilRoom } = await deriveSession(CODE);
  try { evil.send(JSON.stringify({ type: 'join', room: evilRoom })); } catch { /* sudah ditutup */ }
  await wait(300);
  check('origin asing: ditolak (tidak bisa gabung)', !evilJoined && evilClosed);
  try { evil.close(); } catch { /* abaikan */ }

  a.close(); b.close(); c.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'SEMUA LOLOS' : failures + ' GAGAL');
process.exit(failures === 0 ? 0 : 1);
