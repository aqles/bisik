// Bisik — semua enkripsi terjadi di browser ini (WebCrypto).
// Kunci diturunkan dari kode bersama dan TIDAK PERNAH dikirim ke server.
// Server hanya menerima hash ruangan (untuk mempertemukan 2 orang) dan
// meneruskan ciphertext. Riwayat chat hanya ada di variabel halaman ini:
// refresh / tutup tab = hilang. Tidak ada localStorage/sessionStorage.
import { deriveSession, encryptWith, decryptWith } from './crypto.js';

const $ = (s) => document.querySelector(s);
const enc = new TextEncoder();
const dec = new TextDecoder();

const WORDS = ['senja','kopi','bulan','hujan','angin','laut','buku','kunci','meja','lampu',
  'pagi','sore','malam','bintang','awan','sungai','gunung','pantai','taman','roti',
  'susu','gitar','piano','kursi','pintu','jendela','kertas','pensil','tas','sepatu',
  'kucing','burung','ikan','kuda','pohon','daun','bunga','tanah','api','air',
  'jalan','kota','desa','pasar','kereta','perahu','layang','cermin','jam','peta'];

let ws, key, roomHash, peerOnline = false;
let leaving = false;          // true kalau user sendiri yang mengakhiri sesi
let reconnectTimer = null, reconnectAttempts = 0, slowTimer = null;
const pending = new Map(); // id -> elemen bubble (buat tanda gagal kalau penerima offline)

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
  setStatus(peerOnline ? 'Teman terhubung — pesan terenkripsi ujung-ke-ujung'
                       : 'Menunggu teman masuk… pesan yang dikirim sekarang akan hilang', peerOnline);
}

function connect() {
  clearTimeout(reconnectTimer);
  $('#reconnect').hidden = true;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  // Hosting gratis tertidur saat sepi; bangunnya bisa ±30 detik. Beri tahu
  // user supaya tidak mengira aplikasinya rusak.
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    if (ws.readyState !== 1) {
      const msg = 'Server lagi bangun (hosting gratis sempat tidur) — tunggu sebentar, masih dicoba…';
      if ($('#chat-screen').hidden) $('#join-error').textContent = msg;
      else systemNote(msg);
    }
  }, 10000);
  ws.onopen = () => { clearTimeout(slowTimer); ws.send(JSON.stringify({ type: 'join', room: roomHash })); };
  ws.onmessage = onMessage;
  ws.onclose = onClose;
}

function onClose() {
  if (leaving) return;
  peerOnline = false;
  setStatus('Koneksi putus', false);
  $('#reconnect').hidden = false;
  if ($('#auto-reconnect').checked && reconnectAttempts < 10) {
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
    reconnectAttempts++;
    systemNote(`Koneksi putus. Menyambung ulang otomatis dalam ${Math.round(delay / 1000)} detik… (atau klik "Sambungkan lagi")`);
    reconnectTimer = setTimeout(connect, delay);
  } else {
    systemNote('Koneksi putus. Klik "Sambungkan lagi" untuk masuk ke ruangan yang sama — riwayat di layar ini tidak hilang.');
  }
}

async function onMessage(ev) {
  const m = JSON.parse(ev.data);
  if (m.type === 'joined') {
    reconnectAttempts = 0;
    $('#reconnect').hidden = true;
    if ($('#chat-screen').hidden) {
      $('#join-screen').hidden = true;
      $('#chat-screen').hidden = false;
      $('#fingerprint').textContent = '#' + roomHash.slice(0, 6);
      systemNote('Sesi mulai. Pesan di sesi ini tidak disimpan di mana pun.');
    } else {
      systemNote('Berhasil menyambung ulang.');
    }
    peerOnline = m.peers > 1; peerStatus();
  } else if (m.type === 'full') {
    leaving = true; // jangan reconnect — memang ditolak server
    $('#join-error').textContent = 'Ruangan kode ini sudah berisi 2 orang.';
    $('#join-screen').hidden = false;
    $('#chat-screen').hidden = true;
    ws.close();
  } else if (m.type === 'peer') {
    peerOnline = m.online; peerStatus();
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
  // Kode dipakai persis seperti diketik (huruf besar/kecil beda) — memaksa
  // huruf kecil diam-diam memotong kekuatan kode custom.
  const code = $('#code').value.trim();
  if (code.length < 8) { $('#join-error').textContent = 'Kode minimal 8 karakter.'; return; }
  $('#join-error').textContent = 'Menyiapkan kunci enkripsi…';
  ({ key, room: roomHash } = await deriveSession(code));
  leaving = false;
  connect();
});

$('#reconnect').addEventListener('click', () => { reconnectAttempts = 0; connect(); });

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (!text || !ws || ws.readyState !== 1) {
    if (text) systemNote('Belum tersambung — pesan tidak dikirim.');
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
  if (!ws || ws.readyState !== 1) { systemNote('Belum tersambung — gambar tidak dikirim.'); return; }
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

$('#leave').addEventListener('click', () => { leaving = true; location.reload(); }); // reload = semua hilang

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
