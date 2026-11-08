// Bisik crypto — shared by the browser app (app.js) and the tests
// (test/e2e.mjs), so what gets tested is exactly what runs in the browser.
//
// One PBKDF2 run (250,000 iterations) from the shared code produces 64 bytes:
// the first 32 bytes are the AES-GCM key, the next 32 are the room id.
// The room id is deliberately expensive to guess too: the old version used a
// plain SHA-256 of the code, which can be tried billions of times per second.
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
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, material, 512));
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const room = [...bits.slice(32)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { key, room };
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
