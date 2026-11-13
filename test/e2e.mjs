// Bisik end-to-end tests: uses the SAME crypto module as the browser
// (public/crypto.js) against a real relay server.
// What's checked: (1) same code can chat & the server only sees ciphertext,
// (2) a different code gets nothing — not even the key exchange, (3) recipient
// offline = message dropped, (4) reconnect after a hard drop, (5) a 1 MB
// image arrives intact, (6) a foreign Origin is rejected, (7) flooding above
// the cap is trimmed, (8) forward secrecy: the code key alone can't open
// recorded traffic, and a new session's key can't open the previous session,
// (9) delivery receipts name their message, (10) the anti-replay cache.
import { spawn } from 'node:child_process';
import { createHash, randomFillSync } from 'node:crypto';
import WebSocket from 'ws';
import { deriveSession, encryptWith, decryptWith, makeKeyPair, exportPub, deriveShared, makeSeenCache } from '../public/crypto.js';

const PORT = 3210;
const enc = new TextEncoder();
const dec = new TextDecoder();
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const server = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name); if (!ok) failures++; };
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

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
// Simulate what two browsers do once they're both in the room (v0.5):
// exchange ephemeral public keys, each encrypted under the code key, then
// derive the shared session key that actually encrypts messages.
async function pairSession(a, b, code) {
  const { key: codeKey, room } = await deriveSession(code);
  const pairA = await makeKeyPair(), pairB = await makeKeyPair();
  a.send(JSON.stringify({ type: 'key', data: await encryptWith(codeKey, 'key', await exportPub(pairA)) }));
  b.send(JSON.stringify({ type: 'key', data: await encryptWith(codeKey, 'key', await exportPub(pairB)) }));
  await wait(250);
  // Latest offer wins — a reconnecting peer's inbox can still hold the
  // previous session's offer, which belongs to a dead key pair.
  const aGot = a.inbox.filter((m) => m.type === 'key').at(-1);
  const bGot = b.inbox.filter((m) => m.type === 'key').at(-1);
  const pubForA = new Uint8Array((await decryptWith(codeKey, aGot.data)).data);
  const pubForB = new Uint8Array((await decryptWith(codeKey, bGot.data)).data);
  return {
    codeKey,
    keyFrameAtB: bGot,
    skeyA: await deriveShared(pairA, pubForA, room),
    skeyB: await deriveShared(pairB, pubForB, room),
  };
}

try {
  await wait(600);
  const CODE = 'Amber-Anchor-Lantern-4821'; // mixed case: codes are used exactly as typed

  // (3) sending alone -> the server must discard the message
  const solo = await client(); await join(solo, 'solo-room-123');
  const { key: keySolo } = await deriveSession('solo-room-123');
  solo.send(JSON.stringify({ type: 'msg', data: await encryptWith(keySolo, 'text', enc.encode('hello?')) }));
  await wait(250);
  check('recipient offline: message is discarded (dropped)', solo.inbox.some((m) => m.type === 'dropped'));
  solo.close();

  // (1)+(2) A & B share a code, C uses a different one
  const a = await client(), b = await client(), c = await client();
  await join(a, CODE); await join(b, CODE); await join(c, 'a-different-code-999');
  const { key: keyC } = await deriveSession('a-different-code-999');
  const { codeKey, keyFrameAtB, skeyA, skeyB } = await pairSession(a, b, CODE);
  check('key exchange: the peer receives the key offer', !!keyFrameAtB);
  check('key exchange: a different code receives no key offer', !c.inbox.some((m) => m.type === 'key'));
  check('key exchange: the offer is unreadable without the code key',
    await fails(() => decryptWith(keyC, keyFrameAtB.data)));

  const secret = 'secret message at 7';
  a.send(JSON.stringify({ type: 'msg', data: await encryptWith(skeyA, 'text', enc.encode(secret)) }));
  await wait(300);

  const gotB = b.inbox.find((m) => m.type === 'msg');
  check('same code: message reaches B', !!gotB);
  check('server only sees ciphertext (no plaintext on the wire)',
    gotB && !gotB.data.includes('secret') && !gotB.data.includes(secret));
  check('same code: B can decrypt it back to plaintext',
    gotB && dec.decode((await decryptWith(skeyB, gotB.data)).data) === secret);
  check('different code: C receives nothing', !c.inbox.some((m) => m.type === 'msg'));

  // (8) forward secrecy, both directions of the claim
  check('forward secrecy: recorded traffic + the code alone cannot open it',
    gotB && await fails(() => decryptWith(codeKey, gotB.data)));
  const pairA2 = await makeKeyPair(), pairB2 = await makeKeyPair();
  const { room: roomA } = await deriveSession(CODE);
  const skeyA2 = await deriveShared(pairA2, await exportPub(pairB2), roomA);
  const nextSessionMsg = await encryptWith(skeyA2, 'text', enc.encode(secret));
  check('forward secrecy: the previous session key cannot open the next session',
    await fails(() => decryptWith(skeyB, nextSessionMsg)));

  // (5) 1 MB image — the path that used to crash in the browser (base64 spread)
  const img = randomFillSync(new Uint8Array(1024 * 1024));
  a.send(JSON.stringify({ type: 'msg', data: await encryptWith(skeyA, 'image', img, 'image/png') }));
  await wait(800);
  const gotImg = b.inbox.filter((m) => m.type === 'msg').at(-1);
  let imgOk = false;
  if (gotImg) {
    const back = new Uint8Array((await decryptWith(skeyB, gotImg.data)).data);
    imgOk = back.length === img.length && sha(back) === sha(img);
  }
  check('1 MB image: delivered and decrypted intact', imgOk);

  // (4) reconnect: hard-dropped connection, a fresh client with the same
  // code rejoins and a FRESH key exchange makes messages flow again
  const CODE2 = 'reconnect-room-77';
  const d = await client(), e = await client();
  await join(d, CODE2); await join(e, CODE2);
  await pairSession(d, e, CODE2);
  d.terminate(); // drops without a goodbye, like a network failure
  await wait(300);
  const d2 = await client(); await join(d2, CODE2);
  check('reconnect: can rejoin after a hard drop', d2.inbox.some((m) => m.type === 'joined'));
  const sess2 = await pairSession(d2, e, CODE2);
  e.send(JSON.stringify({ type: 'msg', data: await encryptWith(sess2.skeyB, 'text', enc.encode('back online')) }));
  await wait(300);
  const gotD2 = d2.inbox.find((m) => m.type === 'msg');
  check('reconnect: messages flow again after rejoining',
    !!gotD2 && dec.decode((await decryptWith(sess2.skeyA, gotD2.data)).data) === 'back online');
  d2.close(); e.close();

  // (7) flooding: 40 messages blasted at once, at most the 30/second cap may arrive
  b.inbox.length = 0;
  const envelopes = await Promise.all(
    Array.from({ length: 40 }, (_, i) => encryptWith(skeyA, 'text', enc.encode('spam ' + i))));
  for (const data of envelopes) a.send(JSON.stringify({ type: 'msg', data }));
  await wait(500);
  const spamGot = b.inbox.filter((m) => m.type === 'msg').length;
  check(`flooding: ${spamGot} forwarded <= cap of 30`, spamGot <= 30 && spamGot >= 20);

  // (7b) the cap counts EVERY frame type, not just messages: 40 joins and
  // 40 acks blasted at once are trimmed the same way
  const flooder = await client();
  const { room: floodRoom } = await deriveSession('flood-room-5');
  for (let i = 0; i < 40; i++) flooder.send(JSON.stringify({ type: 'join', room: floodRoom }));
  await wait(500);
  const joinGot = flooder.inbox.filter((m) => m.type === 'joined').length;
  check(`flooding: join frames also capped (${joinGot} <= 30)`, joinGot <= 30 && joinGot >= 20);
  flooder.close();

  await wait(1100); // let A's rate window reset after the message flood
  b.inbox.length = 0;
  for (let i = 0; i < 40; i++) a.send(JSON.stringify({ type: 'ack', id: 'ack-' + i }));
  await wait(500);
  const ackGot = b.inbox.filter((m) => m.type === 'ack').length;
  check(`flooding: ack frames also capped (${ackGot} <= 30)`, ackGot <= 30 && ackGot >= 20);

  // (6) a foreign Origin is rejected before it can join
  const evil = new WebSocket(`ws://localhost:${PORT}`, { headers: { Origin: 'https://evil-site.example' } });
  let evilJoined = false, evilClosed = false;
  evil.on('message', (d2) => { if (JSON.parse(d2.toString()).type === 'joined') evilJoined = true; });
  evil.on('close', () => { evilClosed = true; });
  await new Promise((res) => { evil.on('open', res); evil.on('error', res); });
  const { room: evilRoom } = await deriveSession(CODE);
  try { evil.send(JSON.stringify({ type: 'join', room: evilRoom })); } catch { /* already closed */ }
  await wait(300);
  check('foreign origin: rejected (cannot join)', !evilJoined && evilClosed);
  try { evil.close(); } catch { /* ignore */ }

  // (9) delivery receipts: the receiver's ack must be relayed back to the
  // sender, and a dropped message must name WHICH message died. Fresh pair
  // on purpose: A's socket just tripped the flood cap in test (7), and its
  // 1-second window would silently eat this message too.
  const r1 = await client(), r2 = await client();
  await join(r1, 'receipt-room-42'); await join(r2, 'receipt-room-42');
  const rsess = await pairSession(r1, r2, 'receipt-room-42');
  const rdata = await encryptWith(rsess.skeyA, 'text', enc.encode('receipt-test'), undefined, 'msg-1');
  r1.send(JSON.stringify({ type: 'msg', data: rdata, id: 'msg-1' }));
  await wait(250);
  const r2Got = r2.inbox.find((m) => m.type === 'msg');
  check('receipt: message reaches the peer with its id inside the payload',
    !!r2Got && (await decryptWith(rsess.skeyB, r2Got.data)).id === 'msg-1');
  r2.send(JSON.stringify({ type: 'ack', id: 'msg-1' }));
  await wait(200);
  check('receipt: the peer\'s ack is relayed back to the sender',
    r1.inbox.some((m) => m.type === 'ack' && m.id === 'msg-1'));
  r1.close(); r2.close();
  const solo2 = await client(); await join(solo2, 'receipt-solo-room');
  solo2.inbox.length = 0;
  solo2.send(JSON.stringify({ type: 'msg', data: 'AAAA', id: 'msg-2' }));
  await wait(200);
  check('receipt: a dropped message names its own id',
    solo2.inbox.some((m) => m.type === 'dropped' && m.id === 'msg-2'));
  solo2.close();

  // seat replacement: the same tab reconnecting while its old socket still
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

  // (10) anti-replay cache: first sight passes, repeats are refused, and the
  // bound evicts the oldest id instead of growing forever.
  const seen = makeSeenCache(3);
  check('anti-replay: a new id passes, the same id again is refused',
    seen.add('a') === true && seen.add('a') === false);
  seen.add('b'); seen.add('c'); seen.add('d');
  check('anti-replay: the oldest id is evicted once the cache is full', seen.add('a') === true);

  a.close(); b.close(); c.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
