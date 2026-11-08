// Kripto Bisik — dipakai bersama oleh aplikasi browser (app.js) dan tes
// (test/e2e.mjs), supaya yang dites persis yang jalan di browser.
//
// Satu kali PBKDF2 (250.000 putaran) dari kode bersama menghasilkan 64 byte:
// 32 byte pertama = kunci AES-GCM, 32 byte berikutnya = penanda ruangan.
// Penanda ruangan sengaja ikut mahal ditebak: versi lama memakainya dari
// SHA-256 polos yang bisa dicoba miliaran kali per detik.
const enc = new TextEncoder();

// Base64 per potongan 32KB — versi menumpuk-sekaligus (`...` spread) melempar
// RangeError untuk data di atas beberapa ratus KB (bug kirim gambar, v0.2).
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

export async function encryptWith(key, kind, data, mime) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.stringify({ kind, mime, iv: b64(iv), ct: b64(ct) });
}

export async function decryptWith(key, envelope) {
  const m = JSON.parse(envelope);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, key, unb64(m.ct));
  return { ...m, data };
}
