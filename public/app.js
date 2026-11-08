// Bisik — semua enkripsi terjadi di browser ini (WebCrypto).
// Kunci diturunkan dari kode bersama dan TIDAK PERNAH dikirim ke server.
// Server hanya menerima hash ruangan (untuk mempertemukan 2 orang) dan
// meneruskan ciphertext. Riwayat chat hanya ada di variabel halaman ini:
// refresh / tutup tab = hilang. Tidak ada localStorage/sessionStorage.
const $ = (s) => document.querySelector(s);
const enc = new TextEncoder();
const dec = new TextDecoder();

const WORDS = ['senja','kopi','bulan','hujan','angin','laut','buku','kunci','meja','lampu',
  'pagi','sore','malam','bintang','awan','sungai','gunung','pantai','taman','roti',
  'susu','gitar','piano','kursi','pintu','jendela','kertas','pensil','tas','sepatu',
  'kucing','burung','ikan','kuda','pohon','daun','bunga','tanah','api','air',
  'jalan','kota','desa','pasar','kereta','perahu','layang','cermin','jam','peta'];

let ws, key, peerOnline = false;
const pending = new Map(); // id -> elemen bubble (buat tanda gagal kalau penerima offline)

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha256Hex(text) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(code) {
  const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const salt = await crypto.subtle.digest('SHA-256', enc.encode('bisik-salt-v1:' + code));
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encrypt(kind, data, mime) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.stringify({ kind, mime, iv: b64(iv), ct: b64(ct) });
}

async function decrypt(envelope) {
  const m = JSON.parse(envelope);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, key, unb64(m.ct));
  return { ...m, data: pt };
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

function setStatus() {
  const s = $('#status');
  s.textContent = peerOnline ? 'Teman terhubung — pesan terenkripsi ujung-ke-ujung'
                             : 'Menunggu teman masuk… pesan yang dikirim sekarang akan hilang';
  s.classList.toggle('online', peerOnline);
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

// shortcut: kode acak 4 kata + 4 angka itu gampang dibagikan tapi entropinya
// terbatas. Buat pemakaian serius anjurkan kode custom yang panjang (lihat README).
$('#enter').addEventListener('click', async () => {
  const code = $('#code').value.trim().toLowerCase();
  if (code.length < 8) { $('#join-error').textContent = 'Kode minimal 8 karakter.'; return; }
  $('#join-error').textContent = 'Menyiapkan kunci enkripsi…';

  const room = await sha256Hex('bisik-room-v1:' + code);
  key = await deriveKey(code);

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room }));
  ws.onmessage = async (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') {
      $('#join-screen').hidden = true;
      $('#chat-screen').hidden = false;
      $('#fingerprint').textContent = '#' + room.slice(0, 6);
      peerOnline = m.peers > 1; setStatus();
      systemNote('Sesi mulai. Pesan di sesi ini tidak disimpan di mana pun.');
    } else if (m.type === 'full') {
      $('#join-error').textContent = 'Ruangan kode ini sudah berisi 2 orang.';
      ws.close();
    } else if (m.type === 'peer') {
      peerOnline = m.online; setStatus();
      systemNote(m.online ? 'Temanmu masuk.' : 'Temanmu keluar — pesan berikutnya akan hilang.');
    } else if (m.type === 'dropped') {
      // Server membuang pesan karena penerima tidak ada. Tandai, jangan kirim ulang.
      systemNote('Satu pesan tidak terkirim karena teman offline — pesan itu dihapus.');
      for (const el of pending.values()) {
        el.classList.add('failed');
        const meta = document.createElement('div');
        meta.className = 'meta'; meta.textContent = 'tidak terkirim — hilang';
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
          img.alt = 'Gambar terenkripsi dari teman';
          el.append(img);
        });
      } catch {
        systemNote('Ada pesan masuk yang tidak bisa dibuka dengan kodemu.');
      }
    }
  };
  ws.onclose = () => { if (!$('#chat-screen').hidden) systemNote('Koneksi putus. Sesi selesai.'); };
});

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text || !ws) return;
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
  if (file.size > 5 * 1024 * 1024) { systemNote('Gambar kegedean — maksimal 5 MB.'); return; }
  const buf = await file.arrayBuffer();
  const el = addBubble(true, (b) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file); img.alt = 'Gambar yang kamu kirim';
    b.append(img);
  });
  const id = await sendPayload(await encrypt('image', buf, file.type));
  pending.set(id, el);
  setTimeout(() => pending.delete(id), 1500);
});

$('#leave').addEventListener('click', () => location.reload()); // reload = semua hilang

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
