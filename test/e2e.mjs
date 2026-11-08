// Bisik end-to-end tests: uses the SAME crypto module as the browser
// (public/crypto.js) against a real relay server.
// What's checked: (1) same code can chat & the server only sees ciphertext,
// (2) a different code gets nothing, (3) recipient offline = message dropped,
// (4) reconnect after a hard drop, (5) a 1 MB image arrives intact,
// (6) a foreign Origin is rejected, (7) flooding above the cap is trimmed.
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
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name); if (!ok) failures++; };

function client(options) {
  const ws = new WebSocket(`ws://localhost:${PORT}`, options);
  ws.inbox = [];
  ws.on('message', (d) => ws.inbox.push(JSON.parse(d.toString())));
  return new Promise((res) => ws.on('open', () => res(ws)));
}
async function join(ws, code, seat) {
  const { room } = await deriveSession(code);
  ws.send(JSON.stringify({ type: 'join', room, seat }));
  await wait(150);
}

try {
  await wait(600);
  const CODE = 'Amber-Anchor-Lantern-4821'; // mixed case: codes are used exactly as typed
  const { key: keyA } = await deriveSession(CODE);

  // (3) sendirian kirim pesan -> harus dibuang server
  const solo = await client(); await join(solo, 'solo-room-123');
  const { key: keySolo } = await deriveSession('solo-room-123');
  solo.send(JSON.stringify({ type: 'msg', data: await encryptWith(keySolo, 'text', enc.encode('hello?')) }));
  await wait(250);
  check('recipient offline: message is discarded (dropped)', solo.inbox.some((m) => m.type === 'dropped'));
  solo.close();

  // (1)+(2) A & B sekode, C kode lain
  const a = await client(), b = await client(), c = await client();
  await join(a, CODE); await join(b, CODE); await join(c, 'a-different-code-999');
  const secret = 'secret message at 7';
  a.send(JSON.stringify({ type: 'msg', data: await encryptWith(keyA, 'text', enc.encode(secret)) }));
  await wait(300);

  const gotB = b.inbox.find((m) => m.type === 'msg');
  check('same code: message reaches B', !!gotB);
  check('server only sees ciphertext (no plaintext on the wire)',
    gotB && !gotB.data.includes('secret') && !gotB.data.includes(secret));
  check('same code: B can decrypt it back to plaintext',
    gotB && dec.decode((await decryptWith(keyA, gotB.data)).data) === secret);
  check('different code: C receives nothing', !c.inbox.some((m) => m.type === 'msg'));

  // (5) 1 MB image — the path that used to crash in the browser (base64 spread)
  const img = randomFillSync(new Uint8Array(1024 * 1024));
  a.send(JSON.stringify({ type: 'msg', data: await encryptWith(keyA, 'image', img, 'image/png') }));
  await wait(800);
  const gotImg = b.inbox.filter((m) => m.type === 'msg').at(-1);
  let imgOk = false;
  if (gotImg) {
    const back = new Uint8Array((await decryptWith(keyA, gotImg.data)).data);
    imgOk = back.length === img.length && sha(back) === sha(img);
  }
  check('1 MB image: delivered and decrypted intact', imgOk);

  // (4) reconnect: hard-dropped connection, a fresh client with the same code can rejoin
  const CODE2 = 'reconnect-room-77';
  const { key: key2 } = await deriveSession(CODE2);
  const d = await client(), e = await client();
  await join(d, CODE2); await join(e, CODE2);
  d.terminate(); // drops without a goodbye, like a network failure
  await wait(300);
  const d2 = await client(); await join(d2, CODE2);
  check('reconnect: can rejoin after a hard drop', d2.inbox.some((m) => m.type === 'joined'));
  e.send(JSON.stringify({ type: 'msg', data: await encryptWith(key2, 'text', enc.encode('back online')) }));
  await wait(300);
  const gotD2 = d2.inbox.find((m) => m.type === 'msg');
  check('reconnect: messages flow again after rejoining',
    !!gotD2 && dec.decode((await decryptWith(key2, gotD2.data)).data) === 'back online');
  d2.close(); e.close();

  // (7) flooding: 40 messages blasted at once, at most the 30/second cap may arrive
  b.inbox.length = 0;
  const envelopes = await Promise.all(
    Array.from({ length: 40 }, (_, i) => encryptWith(keyA, 'text', enc.encode('spam ' + i))));
  for (const data of envelopes) a.send(JSON.stringify({ type: 'msg', data }));
  await wait(500);
  const spamGot = b.inbox.filter((m) => m.type === 'msg').length;
  check(`flooding: ${spamGot} forwarded <= cap of 30`, spamGot <= 30 && spamGot >= 20);

  // (6) a foreign Origin is rejected before it can join
  const evil = new WebSocket(`ws://localhost:${PORT}`, { headers: { Origin: 'https://evil-site.example' } });
  let evilJoined = false, evilClosed = false;
  evil.on('message', (d2) => { if (JSON.parse(d2.toString()).type === 'joined') evilJoined = true; });
  evil.on('close', () => { evilClosed = true; });
  await new Promise((res) => { evil.on('open', res); evil.on('error', res); });
  const { room: evilRoom } = await deriveSession(CODE);
  try { evil.send(JSON.stringify({ type: 'join', room: evilRoom })); } catch { /* sudah ditutup */ }
  await wait(300);
  check('foreign origin: rejected (cannot join)', !evilJoined && evilClosed);
  try { evil.close(); } catch { /* ignore */ }

  // (8) seat replacement: the same tab reconnecting while its old socket still
  // lingers must REPLACE itself — not count as a second person ("friend").
  const SEAT_CODE = 'seat-reconnect-room';
  const s1 = await client(); await join(s1, SEAT_CODE, 'seat-xyz');
  let s1Closed = false; s1.on('close', () => { s1Closed = true; });
  const s2 = await client(); await join(s2, SEAT_CODE, 'seat-xyz');
  await wait(250);
  const s2Joined = s2.inbox.find((m) => m.type === 'joined');
  check('seat reconnect: rejoins as itself, not as a friend (peers=1)',
    !!s2Joined && s2Joined.peers === 1 && !s2.inbox.some((m) => m.type === 'full'));
  check('seat reconnect: the lingering old socket is closed by the server', s1Closed);
  s2.close();

  a.close(); b.close(); c.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
