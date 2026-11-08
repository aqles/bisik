// Bisik — all encryption happens in this browser (WebCrypto).
// The key is derived from the shared code and is NEVER sent to the server.
// The server only receives the room id (to pair two people up) and relays
// ciphertext. Chat history lives only in this page's variables:
// refresh / close the tab = gone. No localStorage/sessionStorage anywhere.
import { deriveSession, encryptWith, decryptWith, makeKeyPair, exportPub, deriveShared, makeSeenCache } from './crypto.js';

const $ = (s) => document.querySelector(s);
const t = (k, v) => window.BisikI18n.t(k, v); // UI language: device language by default (see i18n.js)
const enc = new TextEncoder();
const dec = new TextDecoder();

const WORDS = ['amber','anchor','apple','arrow','atlas','autumn','bamboo','banana','beacon','berry',
  'birch','breeze','bridge','brook','candle','canyon','cedar','cherry','cinder','cliff',
  'cloud','clover','coast','comet','copper','coral','cosmos','cricket','delta','desert',
  'ember','falcon','fern','fjord','flint','forest','garnet','glacier','harbor','hazel',
  'heron','ivory','jasmine','juniper','lagoon','lantern','laurel','linden','meadow','mercury'];

let ws, codeKey, roomHash, peerOnline = false;
// Forward secrecy: messages are encrypted with an ephemeral session key,
// re-negotiated on every connection (see offerKey/handleKey below). The code
// key only authenticates that exchange. No session key = nothing can be sent.
let sessionKey = null, myPair = null;
const seen = makeSeenCache(); // ids of messages already shown (anti-replay)
// A random seat id for this page load, kept only in memory and sent with
// every join: when this tab reconnects, the server replaces our lingering
// old socket instead of counting it as a second person.
const seat = crypto.randomUUID();
let ownTabPeer = false;       // the other seat is this browser's own other tab
let leaving = false;          // true when the user ends the session themselves
let reconnectTimer = null, reconnectAttempts = 0, slowTimer = null;
const pending = new Map(); // message id -> { el, tick, timer } while awaiting its receipt

const encrypt = (kind, data, mime, id) => encryptWith(sessionKey, kind, data, mime, id);
const decrypt = (envelope) => decryptWith(sessionKey, envelope);

// Offer our ephemeral public key to the peer, encrypted under the code key:
// only a code-holder can take part in the exchange. A fresh pair is made for
// every (re)connection, so every session gets its own key.
async function offerKey() {
  if (!ws || ws.readyState !== 1 || !codeKey) return;
  myPair = await makeKeyPair();
  const pub = await exportPub(myPair);
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'key', data: await encryptWith(codeKey, 'key', pub) }));
  }
}
async function handleKey(envelope) {
  try {
    const d = await decryptWith(codeKey, envelope);
    if (!myPair) await offerKey();
    if (myPair) {
      sessionKey = await deriveShared(myPair, new Uint8Array(d.data), roomHash);
      peerStatus();
    }
  } catch { /* a key offer we can't open isn't from a code-holder — ignore */ }
}

// Delivery receipts for our own messages, WhatsApp-style but honest:
// ✓ sent → ✓✓ delivered (your friend's app showed it and acked) or
// ✕ not delivered (the server dropped it — your friend is offline). If no
// ack comes back in 6 s the mark stays "unconfirmed" rather than faking success.
function trackSent(id, el) {
  const tick = document.createElement('div');
  tick.className = 'meta'; tick.textContent = t('sent');
  el.append(tick);
  const timer = setTimeout(() => { pending.delete(id); tick.textContent = t('sentUnconfirmed'); }, 6000);
  pending.set(id, { el, tick, timer });
}
function resolveSent(id, delivered) {
  const p = pending.get(id); if (!p) return;
  pending.delete(id); clearTimeout(p.timer);
  if (delivered) { p.tick.textContent = t('delivered'); return; }
  p.el.classList.add('failed'); p.tick.classList.add('bad');
  p.tick.textContent = t('notDelivered');
}

function systemNote(text) {
  const el = document.createElement('div');
  el.className = 'system'; el.textContent = text;
  $('#messages').append(el); el.scrollIntoView();
}

function addBubble(mine, build) {
  const el = document.createElement('div');
  el.className = 'bubble' + (mine ? ' me' : '');
  build(el);
  $('#messages').append(el); el.scrollIntoView();
  return el;
}

function setStatus(text, online) {
  const s = $('#status');
  s.textContent = text;
  s.classList.toggle('online', !!online);
}

function peerStatus() {
  if (peerOnline && ownTabPeer) setStatus(t('statusOwnTab'), true);
  else if (peerOnline && !sessionKey) setStatus(t('statusSecuring'), true);
  else setStatus(peerOnline ? t('statusConnected')
                            : t('statusWaiting'), peerOnline);
}

// Tabs of the same browser can hear each other over a BroadcastChannel that
// never leaves this device. When the "other person" in the room turns out
// to be your own other tab, say so — and undo any friend-joined title flash.
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('bisik-tabs') : null;
if (bc) bc.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.room !== roomHash || !codeKey || ownTabPeer) return;
  ownTabPeer = true;
  peerStatus();
  systemNote(t('noteOwnTab'));
  clearInterval(flashTimer); document.title = 'Bisik';
  if (!m.reply) bc.postMessage({ room: roomHash, from: seat, reply: true });
};

// Title flash: if the tab is in the background when your friend arrives or
// leaves, blink the tab title until you come back to it. In-foreground users
// already see the status line, so nothing happens for them. No permission
// prompt, no sound — deliberately quiet.
let flashTimer = null;
function flashTitle(text) {
  if (!document.hidden) return;
  clearInterval(flashTimer);
  let show = false;
  flashTimer = setInterval(() => { document.title = (show = !show) ? text : 'Bisik'; }, 1000);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { clearInterval(flashTimer); document.title = 'Bisik'; }
});

// If the visitor flips the language mid-session, refresh the live status
// line (already-printed notes and receipts keep the language they were
// written in — same as a person switching mid-conversation).
window.addEventListener('bisik:lang', () => { if (codeKey) peerStatus(); });

function connect() {
  clearTimeout(reconnectTimer);
  $('#reconnect').hidden = true;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  // Free hosting sleeps when idle and can take ±30 s to wake. Tell the user,
  // so they don't think the app is broken.
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    if (ws.readyState !== 1) {
      const msg = t('noteWaking');
      if ($('#chat-screen').hidden) $('#join-error').textContent = msg;
      else systemNote(msg);
    }
  }, 10000);
  ws.onopen = () => { clearTimeout(slowTimer); ws.send(JSON.stringify({ type: 'join', room: roomHash, seat })); };
  ws.onmessage = onMessage;
  ws.onclose = onClose;
}

function onClose() {
  if (leaving) return;
  peerOnline = false;
  setStatus(t('statusDisconnected'), false);
  $('#reconnect').hidden = false;
  if ($('#auto-reconnect').checked && reconnectAttempts < 10) {
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
    reconnectAttempts++;
    systemNote(t('noteReconnecting', { n: Math.round(delay / 1000) }));
    reconnectTimer = setTimeout(connect, delay);
  } else {
    systemNote(t('noteLost'));
  }
}

async function onMessage(ev) {
  const m = JSON.parse(ev.data);
  if (m.type === 'key') {
    await handleKey(m.data);
  } else if (m.type === 'joined') {
    reconnectAttempts = 0;
    sessionKey = null; myPair = null; // every connection negotiates fresh keys
    $('#reconnect').hidden = true;
    if (bc) bc.postMessage({ room: roomHash, from: seat }); // ask: is the other seat my own tab?
    if ($('#chat-screen').hidden) {
      $('#join-screen').hidden = true;
      $('#chat-screen').hidden = false;
      $('#fingerprint').textContent = '#' + roomHash.slice(0, 6);
      systemNote(t('noteSessionStarted'));
    } else {
      systemNote(t('noteReconnected'));
    }
    peerOnline = m.peers > 1; peerStatus();
    if (peerOnline) offerKey();
  } else if (m.type === 'full') {
    leaving = true; // don't reconnect — the server refused us on purpose
    $('#join-error').textContent = t('errFull');
    $('#join-screen').hidden = false;
    $('#chat-screen').hidden = true;
    ws.close();
  } else if (m.type === 'peer') {
    peerOnline = m.online;
    if (!m.online) { ownTabPeer = false; sessionKey = null; myPair = null; } // whoever held the other seat is gone — and so is that session's key
    peerStatus();
    if (m.online) offerKey();
    systemNote(m.online ? t('noteFriendJoined') : t('noteFriendLeft'));
    flashTitle(m.online ? t('flashJoined') : t('flashLeft'));
  } else if (m.type === 'dropped') {
    // The server discarded a message because the recipient isn't there.
    // Flag exactly that message — never resend (gone means gone).
    if (m.id) resolveSent(m.id, false);
    else for (const id of [...pending.keys()]) resolveSent(id, false);
  } else if (m.type === 'ack') {
    resolveSent(m.id, true); // your friend's app showed the message
  } else if (m.type === 'msg') {
    if (!sessionKey) return; // arrived before the key exchange finished — can't be opened anyway
    try {
      const m2 = await decrypt(m.data);
      if (m2.id && !seen.add(m2.id)) return; // replay of a message already shown — drop it
      if (m2.kind === 'text') addBubble(false, (el) => { el.textContent = dec.decode(m2.data); });
      else addBubble(false, (el) => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(new Blob([m2.data], { type: m2.mime }));
        img.alt = t('imgAltFriend');
        el.append(img);
      });
      // Shown on screen: acknowledge it so the sender gets their ✓✓.
      if (m2.id && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ack', id: m2.id }));
    } catch {
      systemNote(t('noteUnopenable'));
    }
  }
}

function sendPayload(envelope, id) {
  ws.send(JSON.stringify({ type: 'msg', id, data: envelope }));
}

$('#gen').addEventListener('click', () => {
  const pick = () => WORDS[crypto.getRandomValues(new Uint8Array(1))[0] % WORDS.length];
  const num = String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, '0');
  $('#code').value = `${pick()}-${pick()}-${pick()}-${pick()}-${num}`;
  $('#join-error').textContent = '';
});

// shortcut: a random code of 4 words + 4 digits is easy to share but has
// limited entropy. For serious use, recommend a long custom code (see README).
$('#copy').addEventListener('click', async () => {
  const value = $('#code').value.trim();
  if (!value) { $('#join-error').textContent = t('errEnterCode'); return; }
  $('#join-error').textContent = '';
  try { await navigator.clipboard.writeText(value); }
  catch { $('#code').select(); document.execCommand('copy'); } // fallback for older browsers
  const btn = $('#copy');
  btn.textContent = t('copied');
  setTimeout(() => { btn.textContent = t('copy'); }, 1600);
});

// A short custom code is the one weak spot a user can choose for themselves:
// warn while they type (never block — a generated code is 30+ characters and
// never triggers this).
$('#code').addEventListener('input', () => {
  const n = $('#code').value.trim().length;
  $('#join-error').textContent =
    (n >= 8 && n < 12) ? t('warnShortCode') : '';
});

$('#enter').addEventListener('click', async () => {
  // The code is used exactly as typed (capitals are different characters) —
  // forcing lowercase would silently weaken custom codes.
  const code = $('#code').value.trim();
  if (code.length < 8) { $('#join-error').textContent = t('errShortCode'); return; }
  $('#join-error').textContent = t('notePreparing');
  ({ key: codeKey, room: roomHash } = await deriveSession(code));
  leaving = false;
  connect();
});

$('#reconnect').addEventListener('click', () => { reconnectAttempts = 0; connect(); });

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text || !ws || ws.readyState !== 1) {
    if (text) systemNote(t('noteNotConnectedMsg'));
    return;
  }
  $('#text').value = '';
  const id = crypto.randomUUID();
  const el = addBubble(true, (b) => { b.textContent = text; });
  trackSent(id, el);
  // No session key = no peer secured yet: the message has nowhere safe to
  // go, so it dies right here — the same honest ✕, just without the server.
  if (!sessionKey) { resolveSent(id, false); return; }
  sendPayload(await encrypt('text', enc.encode(text), undefined, id), id);
});

// Re-encode an image through a canvas before sending: camera photos carry
// EXIF metadata (GPS location, device info) and your friend doesn't need it.
// Drawing the pixels into a fresh canvas leaves all of that behind. Falls
// back to the original bytes for formats the browser can't decode (rare).
async function stripImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92));
    if (blob) return { buf: await blob.arrayBuffer(), mime: blob.type, blob };
  } catch { /* undecodable format — fall through to the raw file */ }
  return { buf: await file.arrayBuffer(), mime: file.type, blob: file };
}

$('#attach').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async () => {
  const file = $('#file').files[0];
  $('#file').value = '';
  if (!file) return;
  if (!ws || ws.readyState !== 1) { systemNote(t('noteNotConnectedImg')); return; }
  if (file.size > 5 * 1024 * 1024) { systemNote(t('noteTooBig')); return; }
  const { buf, mime, blob } = await stripImage(file);
  if (buf.byteLength > 6_800_000) { systemNote(t('noteTooBig')); return; }
  const id = crypto.randomUUID();
  const el = addBubble(true, (b) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob); img.alt = t('imgAltMine');
    b.append(img);
  });
  trackSent(id, el);
  if (!sessionKey) { resolveSent(id, false); return; }
  sendPayload(await encrypt('image', buf, mime, id), id);
});

$('#leave').addEventListener('click', () => { leaving = true; location.reload(); }); // reload = everything gone

// Warn before an accidental refresh/close throws the session away — but never
// when the user ends the session on purpose (that's the reload above).
window.addEventListener('beforeunload', (e) => {
  if (codeKey && !leaving) e.preventDefault();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
