// Bisik crypto — shared by the browser app (app.js) and the tests
// (test/e2e.mjs), so what gets tested is exactly what runs in the browser.
//
// One PBKDF2 run (600,000 iterations — the current OWASP recommendation for
// PBKDF2-HMAC-SHA256) from the shared code produces 64 bytes: the first 32
// bytes are the code key, the next 32 are the room id. The code key never
// encrypts messages directly (v0.5+): it authenticates the session key
// exchange below, and that's all. The room id is deliberately expensive to
// guess too: the old version used a plain SHA-256 of the code, which can be
// tried billions of times per second.
const enc = new TextEncoder();

// Chunked base64 (32 KB at a time) — the all-at-once version (`...` spread)
// throws RangeError on data above a few hundred KB (the v0.2 image bug).
export function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveSession(code) {
  const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
  const salt = await crypto.subtle.digest('SHA-256', enc.encode('bisik-salt-v1:' + code));
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, material, 512));
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const room = [...bits.slice(32)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { key, room };
}

// --- Forward secrecy (v0.5+) ------------------------------------------------
// Each side generates an EPHEMERAL ECDH key pair per connection and sends the
// public half to the peer, encrypted under the code key — so only someone
// holding the code can take part in the exchange, while the relay and any
// eavesdropper see nothing usable. The shared secret is stretched with HKDF
// (salted with the room id) into the session key that actually encrypts
// messages. The private halves live only in page memory and are gone when
// the session ends, so recorded traffic stays sealed even if the code leaks
// later. A new connection always means a new pair and a new session key.
export async function makeKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}
export async function exportPub(pair) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
}
export async function deriveShared(pair, peerPubRaw, room) {
  const peerPub = await crypto.subtle.importKey('raw', peerPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPub }, pair.privateKey, 256);
  const hkdf = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const roomBytes = new Uint8Array(room.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: roomBytes, info: enc.encode('bisik-session-v1') }, hkdf, 256);
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Anti-replay: the receiver remembers message ids it has already shown
// (bounded, oldest evicted first) and drops repeats. add() returns true the
// first time an id is seen, false for any repeat.
export function makeSeenCache(limit = 500) {
  const seen = new Set();
  return {
    add(id) {
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > limit) seen.delete(seen.values().next().value);
      return true;
    },
  };
}

export async function encryptWith(key, kind, data, mime, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  // `id` is a random per-message receipt id (not content): the receiver
  // echoes it back in an ack so the sender can mark the message delivered.
  return JSON.stringify({ kind, mime, id, iv: b64(iv), ct: b64(ct) });
}

export async function decryptWith(key, envelope) {
  const m = JSON.parse(envelope);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, key, unb64(m.ct));
  return { ...m, data };
}
