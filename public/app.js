// Bisik — all encryption happens in this browser (WebCrypto).
// The key is derived from the shared code and is NEVER sent to the server.
// The server only receives the room id (to pair two people up) and relays
// ciphertext. Chat history lives only in this page's variables:
// refresh / close the tab = gone. No localStorage/sessionStorage anywhere.
import { deriveSession, encryptWith, decryptWith } from './crypto.js';

const $ = (s) => document.querySelector(s);
const enc = new TextEncoder();
const dec = new TextDecoder();

const WORDS = ['amber','anchor','apple','arrow','atlas','autumn','bamboo','banana','beacon','berry',
  'birch','breeze','bridge','brook','candle','canyon','cedar','cherry','cinder','cliff',
  'cloud','clover','coast','comet','copper','coral','cosmos','cricket','delta','desert',
  'ember','falcon','fern','fjord','flint','forest','garnet','glacier','harbor','hazel',
  'heron','ivory','jasmine','juniper','lagoon','lantern','laurel','linden','meadow','mercury'];

let ws, key, roomHash, peerOnline = false;
// A random seat id for this page load, kept only in memory and sent with
// every join: when this tab reconnects, the server replaces our lingering
// old socket instead of counting it as a second person.
const seat = crypto.randomUUID();
let ownTabPeer = false;       // the other seat is this browser's own other tab
let leaving = false;          // true when the user ends the session themselves
let reconnectTimer = null, reconnectAttempts = 0, slowTimer = null;
const pending = new Map(); // id -> bubble element (to flag failures when the peer is offline)

const encrypt = (kind, data, mime) => encryptWith(key, kind, data, mime);
const decrypt = (envelope) => decryptWith(key, envelope);

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
  if (peerOnline && ownTabPeer) setStatus("That's your own other tab in this room — not a friend yet", true);
  else setStatus(peerOnline ? 'Friend connected — messages are end-to-end encrypted'
                            : 'Waiting for your friend to join… anything sent now will be lost', peerOnline);
}

// Tabs of the same browser can hear each other over a BroadcastChannel that
// never leaves this device. When the "other person" in the room turns out
// to be your own other tab, say so — and undo any friend-joined title flash.
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('bisik-tabs') : null;
if (bc) bc.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.room !== roomHash || !key || ownTabPeer) return;
  ownTabPeer = true;
  peerStatus();
  systemNote('The other seat in this room is your own other tab.');
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
      const msg = 'The server is waking up (free hosting naps when idle) — hang on, still trying…';
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
  setStatus('Disconnected', false);
  $('#reconnect').hidden = false;
  if ($('#auto-reconnect').checked && reconnectAttempts < 10) {
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
    reconnectAttempts++;
    systemNote(`Connection lost. Reconnecting automatically in ${Math.round(delay / 1000)} seconds… (or tap "Reconnect")`);
    reconnectTimer = setTimeout(connect, delay);
  } else {
    systemNote('Connection lost. Tap "Reconnect" to rejoin the same room — the history on this screen stays put.');
  }
}

async function onMessage(ev) {
  const m = JSON.parse(ev.data);
  if (m.type === 'joined') {
    reconnectAttempts = 0;
    $('#reconnect').hidden = true;
    if (bc) bc.postMessage({ room: roomHash, from: seat }); // ask: is the other seat my own tab?
    if ($('#chat-screen').hidden) {
      $('#join-screen').hidden = true;
      $('#chat-screen').hidden = false;
      $('#fingerprint').textContent = '#' + roomHash.slice(0, 6);
      systemNote('Session started. Nothing in this session is stored anywhere.');
    } else {
      systemNote('Reconnected.');
    }
    peerOnline = m.peers > 1; peerStatus();
  } else if (m.type === 'full') {
    leaving = true; // don't reconnect — the server refused us on purpose
    $('#join-error').textContent = 'That code already has 2 people in its room.';
    $('#join-screen').hidden = false;
    $('#chat-screen').hidden = true;
    ws.close();
  } else if (m.type === 'peer') {
    peerOnline = m.online;
    if (!m.online) ownTabPeer = false; // whoever held the other seat is gone
    peerStatus();
    systemNote(m.online ? 'Your friend joined.' : 'Your friend left — the next message will be lost.');
    flashTitle(m.online ? '• Your friend joined — Bisik' : '• Your friend left — Bisik');
  } else if (m.type === 'dropped') {
    // The server discarded a message because the recipient isn't there. Flag it, never resend.
    systemNote("One message wasn't delivered because your friend is offline — it has been discarded.");
    for (const el of pending.values()) {
      el.classList.add('failed');
      const meta = document.createElement('div');
      meta.className = 'meta'; meta.textContent = 'not delivered — gone';
      el.append(meta);
    }
    pending.clear();
  } else if (m.type === 'msg') {
    try {
      const m2 = await decrypt(m.data);
      if (m2.kind === 'text') addBubble(false, (el) => { el.textContent = dec.decode(m2.data); });
      else addBubble(false, (el) => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(new Blob([m2.data], { type: m2.mime }));
        img.alt = 'Encrypted image from your friend';
        el.append(img);
      });
    } catch {
      systemNote("A message arrived that can't be opened with your code.");
    }
  }
}

async function sendPayload(envelope) {
  const id = crypto.randomUUID();
  ws.send(JSON.stringify({ type: 'msg', id, data: envelope }));
  return id;
}

$('#gen').addEventListener('click', () => {
  const pick = () => WORDS[crypto.getRandomValues(new Uint8Array(1))[0] % WORDS.length];
  const num = String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, '0');
  $('#code').value = `${pick()}-${pick()}-${pick()}-${pick()}-${num}`;
  $('#join-error').textContent = '';
});

// shortcut: a random code of 4 words + 4 digits is easy to share but has
// limited entropy. For serious use, recommend a long custom code (see README).
$('#enter').addEventListener('click', async () => {
  // The code is used exactly as typed (capitals are different characters) —
  // forcing lowercase would silently weaken custom codes.
  const code = $('#code').value.trim();
  if (code.length < 8) { $('#join-error').textContent = 'The code needs at least 8 characters.'; return; }
  $('#join-error').textContent = 'Preparing the encryption key…';
  ({ key, room: roomHash } = await deriveSession(code));
  leaving = false;
  connect();
});

$('#reconnect').addEventListener('click', () => { reconnectAttempts = 0; connect(); });

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text || !ws || ws.readyState !== 1) {
    if (text) systemNote("Not connected — message wasn't sent.");
    return;
  }
  $('#text').value = '';
  const el = addBubble(true, (b) => { b.textContent = text; });
  const id = await sendPayload(await encrypt('text', enc.encode(text)));
  pending.set(id, el);
  setTimeout(() => pending.delete(id), 1500);
});

$('#attach').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async () => {
  const file = $('#file').files[0];
  $('#file').value = '';
  if (!file) return;
  if (!ws || ws.readyState !== 1) { systemNote("Not connected — image wasn't sent."); return; }
  if (file.size > 5 * 1024 * 1024) { systemNote('That image is too big — 5 MB max.'); return; }
  const buf = await file.arrayBuffer();
  const el = addBubble(true, (b) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file); img.alt = 'Image you sent';
    b.append(img);
  });
  const id = await sendPayload(await encrypt('image', buf, file.type));
  pending.set(id, el);
  setTimeout(() => pending.delete(id), 1500);
});

$('#leave').addEventListener('click', () => { leaving = true; location.reload(); }); // reload = everything gone

// Warn before an accidental refresh/close throws the session away — but never
// when the user ends the session on purpose (that's the reload above).
window.addEventListener('beforeunload', (e) => {
  if (key && !leaving) e.preventDefault();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
