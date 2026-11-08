// Test ujung-ke-ujung Bisik: niru persis yang dilakukan browser
// (hash ruangan + PBKDF2 + AES-GCM) lewat server relay beneran.
// Yang dicek: (1) kode sama bisa ngobrol & server cuma lihat ciphertext,
// (2) kode beda tidak nyasar, (3) penerima offline = pesan dibuang.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 3210;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64');

async function roomOf(code) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('bisik-room-v1:' + code));
  return Buffer.from(h).toString('hex');
}
async function keyOf(code) {
  const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const salt = await crypto.subtle.digest('SHA-256', enc.encode('bisik-salt-v1:' + code));
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return JSON.stringify({ kind: 'text', iv: b64(iv), ct: b64(ct) });
}
async function decryptText(key, envelope) {
  const m = JSON.parse(envelope);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, key, unb64(m.ct));
  return dec.decode(pt);
}

const server = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok) => { console.log((ok ? 'LOLOS' : 'GAGAL') + ' - ' + name); if (!ok) failures++; };

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  ws.inbox = [];
  ws.on('message', (d) => ws.inbox.push(JSON.parse(d.toString())));
  return new Promise((res) => ws.on('open', () => res(ws)));
}
async function join(ws, code) {
  ws.send(JSON.stringify({ type: 'join', room: await roomOf(code) }));
  await wait(150);
}

try {
  await wait(600);
  const CODE = 'senja-kopi-bulan-4821';
  const keyA = await keyOf(CODE);

  // (3) sendirian kirim pesan -> harus dibuang server
  const solo = await client(); await join(solo, 'ruang-sendiri-123');
  solo.send(JSON.stringify({ type: 'msg', data: await encryptText(await keyOf('ruang-sendiri-123'), 'halo?') }));
  await wait(250);
  check('penerima offline: pesan dibuang (dropped)', solo.inbox.some((m) => m.type === 'dropped'));
  solo.close();

  // (1)+(2) A & B sekode, C kode lain
  const a = await client(), b = await client(), c = await client();
  await join(a, CODE); await join(b, CODE); await join(c, 'kode-yang-lain-999');
  const secret = 'pesan rahasia jam 7';
  a.send(JSON.stringify({ type: 'msg', data: await encryptText(keyA, secret) }));
  await wait(300);

  const gotB = b.inbox.find((m) => m.type === 'msg');
  check('kode sama: pesan sampai ke B', !!gotB);
  check('server cuma lihat ciphertext (plaintext tidak ada di kabel)',
    gotB && !gotB.data.includes('rahasia') && !gotB.data.includes(secret));
  check('kode sama: B bisa mendekripsi jadi plaintext',
    gotB && (await decryptText(keyA, gotB.data)) === secret);
  check('kode beda: C tidak menerima apa-apa', !c.inbox.some((m) => m.type === 'msg'));

  // (4) reconnect: koneksi putus kasar, klien baru berkode sama harus bisa
  // masuk lagi ke ruangan yang sama dan lanjut mengobrol.
  const CODE2 = 'ruang-reconnect-77';
  const key2 = await keyOf(CODE2);
  const d = await client(), e = await client();
  await join(d, CODE2); await join(e, CODE2);
  d.terminate(); // putus tanpa pamit, seperti jaringan drop
  await wait(300);
  const d2 = await client(); await join(d2, CODE2);
  check('reconnect: bisa masuk lagi setelah putus kasar', d2.inbox.some((m) => m.type === 'joined'));
  e.send(JSON.stringify({ type: 'msg', data: await encryptText(key2, 'nyambung lagi') }));
  await wait(300);
  const gotD2 = d2.inbox.find((m) => m.type === 'msg');
  check('reconnect: pesan tetap mengalir setelah nyambung lagi',
    !!gotD2 && (await decryptText(key2, gotD2.data)) === 'nyambung lagi');
  d2.close(); e.close();

  a.close(); b.close(); c.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'SEMUA LOLOS' : failures + ' GAGAL');
process.exit(failures === 0 ? 0 : 1);
