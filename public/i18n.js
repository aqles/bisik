// Bisik i18n — English + Bahasa Indonesia, nothing else (for now).
// The language follows the visitor's device/browser language. A manual
// switch lasts for this page session only: NOTHING is stored — no
// localStorage, no cookie — in line with the rest of the app. Internal
// links carry ?lang= so the choice survives moving between pages within
// the session without any storage.
(function () {
  const STRINGS = {
    en: {
      // Join screen (index.html)
      'tagline': "A two-person chat — encrypted, traceless.<br>No accounts. No database. Messages only live while you're both online.",
      'codeLabel': 'Shared code',
      'copy': 'Copy',
      'copied': 'Copied ✓',
      'gen': 'Make a random code',
      'join': 'Join',
      'autoReconnect': 'Reconnect automatically if the connection drops',
      'joinNote': "Share the <b>exact same</b> code with your friend through another channel (in person / a phone call). The code is the encryption key: without it nobody can read along, and a different code means a different room. Short codes are guessable — use a random code or a long custom one.",
      'linkPrivacy': 'Privacy',
      'linkTerms': 'Terms',
      'linkSecurity': 'Security',
      // Chat screen (index.html)
      'fingerprintTitle': "Compare this with your friend's — if they match, you're using the same code",
      'reconnect': 'Reconnect',
      'leave': 'End session',
      'attach': '+ Image',
      'attachAria': 'Send an image',
      'textPh': 'Type a message…',
      'textAria': 'Type a message',
      'send': 'Send',
      'statusWaitingShort': 'Waiting for your friend to join…',
      // App dynamics (app.js)
      'sent': '✓ sent',
      'sentUnconfirmed': '✓ sent — unconfirmed',
      'delivered': '✓✓ delivered',
      'notDelivered': '✕ not delivered — gone',
      'statusOwnTab': "That's your own other tab in this room — not a friend yet",
      'statusSecuring': 'Friend connected — securing the connection…',
      'statusConnected': 'Friend connected — messages are end-to-end encrypted',
      'statusWaiting': 'Waiting for your friend to join… anything sent now will be lost',
      'noteOwnTab': 'The other seat in this room is your own other tab.',
      'noteWaking': 'The server is waking up (free hosting naps when idle) — hang on, still trying…',
      'statusDisconnected': 'Disconnected',
      'noteReconnecting': 'Connection lost. Reconnecting automatically in {n} seconds… (or tap "Reconnect")',
      'noteLost': 'Connection lost. Tap "Reconnect" to rejoin the same room — the history on this screen stays put.',
      'noteSessionStarted': 'Session started. Nothing in this session is stored anywhere.',
      'noteReconnected': 'Reconnected.',
      'errFull': 'That code already has 2 people in its room.',
      'noteFriendJoined': 'Your friend joined.',
      'noteFriendLeft': 'Your friend left — the next message will be lost.',
      'flashJoined': '• Your friend joined — Bisik',
      'flashLeft': '• Your friend left — Bisik',
      'noteUnopenable': "A message arrived that can't be opened with your code.",
      'imgAltFriend': 'Encrypted image from your friend',
      'imgAltMine': 'Image you sent',
      'errEnterCode': 'Enter a code first — or make a random one.',
      'warnShortCode': 'That code is short enough to guess — 12+ characters, or the random code, is much safer.',
      'errShortCode': 'The code needs at least 8 characters.',
      'notePreparing': 'Preparing the encryption key…',
      'noteNotConnectedMsg': "Not connected — message wasn't sent.",
      'noteNotConnectedImg': "Not connected — image wasn't sent.",
      'noteTooBig': 'That image is too big — 5 MB max.',
      // Static pages (shared)
      'back': '← Back to Bisik',
      'updated': 'Last updated: November 8, 2026',
      // Privacy page
      'priv.title': 'Privacy — Bisik',
      'priv.h1': 'Privacy Policy',
      'priv.intro': "Bisik is built on one principle: we can't hand over, sell, or leak the contents of your conversations because <b>we never have them</b>.",
      'priv.h2a': "What we don't collect",
      'priv.pa': 'There are no accounts and no sign-up, so there is no name, email address, phone number, or password to store. There is no database. No analytics, no ads, no third-party trackers.',
      'priv.h2b': 'Message and image contents',
      'priv.pb': "Messages and images are encrypted in your browser before they are sent. The relay server only forwards that encrypted output from memory (RAM) to the person you're talking to — it never writes it to disk, never logs it, and never queues it. If the other person is offline, your message is discarded on the spot. Chat history exists only in the open tab; closing or refreshing the page erases it.",
      'priv.h2c': 'Your code',
      'priv.pc': 'Your shared code is never sent to the server. What is sent is only the room id — a slow derivation (PBKDF2) of the code, so the server can pair up two people using the same code without the id being practical to reverse into the code itself. The encryption key is derived and used only inside your browsers.',
      'priv.h2d': 'What is stored on your device',
      'priv.pd': "If you install Bisik as a PWA, your browser caches the app's files (pages, styles, icons) so it opens quickly. Conversation contents are never part of that. Bisik does not use localStorage, sessionStorage, IndexedDB, or cookies to store chat data.",
      'priv.h2e': 'The honest limits',
      'priv.pe': "For a connection to happen at all, your IP address is necessarily visible to the network and to the hosting provider the relay runs on (currently Render), just like any website. The hosting provider may keep standard network logs on their side, which are outside this app's control. What we can guarantee from the app's side: message contents are never logged or stored anywhere.",
      'priv.h2f': 'Contact',
      'priv.pf': 'Privacy questions can be sent via the contact page at <a href="https://www.ednasalam.com">ednasalam.com</a>.',
      // Terms page
      'terms.title': 'Terms — Bisik',
      'terms.h1': 'Terms of Use',
      'terms.h2a': 'The service',
      'terms.pa': 'Bisik is a two-person conversation tool that is temporary by design: no accounts, no history, no session recovery. By using Bisik you accept that nature — including that a message sent while the other person is offline will be lost, and that a finished conversation can never be reopened in any way.',
      'terms.h2b': 'Your responsibility',
      'terms.pb': "You are responsible for the code you create and share, and for who you share it with. Anyone holding the same code can enter the same room. Don't use Bisik for anything unlawful. We cannot moderate conversation contents — technically cannot, because they are encrypted and never reach us in readable form.",
      'terms.h2c': 'Availability',
      'terms.pc': "Bisik is provided as-is, without any warranty. It runs on free hosting that can sleep while unused (the first load can take a few dozen seconds to wake it) and may be unavailable at times. Don't rely on Bisik as your only channel for emergency communication.",
      'terms.h2d': 'Changes',
      'terms.pd': 'These terms may change; the latest version always lives on this page.',
      // Security page
      'sec.title': 'Security — Bisik',
      'sec.h1': "How Bisik's Security Works",
      'sec.h2a': 'From a code to a key',
      'sec.pa': "When you type a code, your browser derives two things from it. One PBKDF2 process (600,000 iterations) produces both at once: the room id — the only thing ever sent to the server, just to pair up two browsers using the same code (a room holds at most two people) — and a code key, which never leaves your browser. The room id is deliberately derived the expensive way as well, so it can't be used to guess your code offline.",
      'sec.h2b': 'Forward secrecy: a fresh key for every session',
      'sec.pb': "The code key never encrypts your messages directly. When both people are in the room, their browsers exchange ephemeral ECDH public keys — each one encrypted under the code key, so only someone holding the code can take part — and independently derive the same session key from them. That session key, and only it, encrypts your messages. The ephemeral private keys exist only in the page's memory: end the session (or reconnect) and a completely new pair is negotiated. This is forward secrecy — even if someone recorded your encrypted traffic <i>and</i> later learned your code, the recording stays sealed, because the keys that could open it no longer exist anywhere.",
      'sec.h2c': 'The journey of a message',
      'sec.pc': "Messages and images are encrypted in the sender's browser with the session key and a fresh random IV for every message, relayed by the server in encrypted form from memory only, then opened in the recipient's browser. The server has no key, so if its traffic were intercepted or the server itself breached, all anyone would get is random-looking text. Images are re-encoded in your browser before sending, which strips the EXIF metadata (GPS location, device details) that camera photos carry. The six characters at the top of the chat screen are your room fingerprint — compare them with your friend's to be sure you're both using the same code.",
      'sec.h2d': 'What it protects',
      'sec.pd': 'Your conversation\'s contents from network snoopers, from the hosting provider, and from anyone who doesn\'t hold the code. There is no history that could be demanded, stolen, or leaked from the server, because nothing is ever stored.',
      'sec.h2e': 'What it cannot protect',
      'sec.pe': 'Bisik can\'t help if your own device is already compromised, if the person you\'re talking to photographs the screen or forwards the contents, or if your code is weak and gets guessed — codes like a birthday or "secret123" can be tried by anyone. Your IP address also remains visible to the network and the hosting provider, like any website.',
      'sec.pf': "The code still decides who gets in: anyone who learns it while a session is live could try to join (a room holds at most two people, and you'd see them arrive). Forward secrecy protects the past, not the present — so still treat the code itself as a secret, and use a fresh one for each conversation.",
      'sec.h2f': 'Tips for staying safe',
      'sec.pg': "Use the built-in random code, or a long custom code with no personal meaning. Share the code through a different channel than the conversation itself. Compare room fingerprints before discussing anything sensitive. End the session when you're done.",
    },
    id: {
      // Layar gabung (index.html)
      'tagline': 'Chat berdua — terenkripsi, tanpa jejak.<br>Tanpa akun. Tanpa database. Pesan hanya hidup selama kalian berdua online.',
      'codeLabel': 'Kode bersama',
      'copy': 'Salin',
      'copied': 'Tersalin ✓',
      'gen': 'Buat kode acak',
      'join': 'Gabung',
      'autoReconnect': 'Sambung ulang otomatis kalau koneksi putus',
      'joinNote': 'Bagikan kode yang <b>persis sama</b> ke temanmu lewat jalur lain (ketemu langsung / telepon). Kode itu kunci enkripsinya: tanpa kode itu tidak ada yang bisa ikut membaca, dan kode yang berbeda berarti ruangan yang berbeda. Kode pendek gampang ditebak — pakai kode acak atau kode buatan sendiri yang panjang.',
      'linkPrivacy': 'Privasi',
      'linkTerms': 'Ketentuan',
      'linkSecurity': 'Keamanan',
      // Layar chat (index.html)
      'fingerprintTitle': 'Bandingkan dengan punya temanmu — kalau sama, kalian memakai kode yang sama',
      'reconnect': 'Sambung ulang',
      'leave': 'Akhiri sesi',
      'attach': '+ Gambar',
      'attachAria': 'Kirim gambar',
      'textPh': 'Ketik pesan…',
      'textAria': 'Ketik pesan',
      'send': 'Kirim',
      'statusWaitingShort': 'Menunggu temanmu bergabung…',
      // Dinamika aplikasi (app.js)
      'sent': '✓ terkirim',
      'sentUnconfirmed': '✓ terkirim — belum terkonfirmasi',
      'delivered': '✓✓ sampai',
      'notDelivered': '✕ tidak sampai — hilang',
      'statusOwnTab': 'Itu tab lain milikmu sendiri di ruangan ini — bukan teman',
      'statusSecuring': 'Teman terhubung — mengamankan koneksi…',
      'statusConnected': 'Teman terhubung — pesan terenkripsi end-to-end',
      'statusWaiting': 'Menunggu temanmu bergabung… pesan yang dikirim sekarang akan hilang',
      'noteOwnTab': 'Kursi satunya di ruangan ini adalah tab lain milikmu sendiri.',
      'noteWaking': 'Server sedang bangun (hosting gratis tidur saat sepi) — tunggu, masih mencoba…',
      'statusDisconnected': 'Terputus',
      'noteReconnecting': 'Koneksi putus. Menyambung ulang otomatis dalam {n} detik… (atau ketuk "Sambung ulang")',
      'noteLost': 'Koneksi putus. Ketuk "Sambung ulang" untuk masuk lagi ke ruangan yang sama — riwayat di layar ini tetap ada.',
      'noteSessionStarted': 'Sesi dimulai. Tidak ada apa pun dari sesi ini yang disimpan di mana pun.',
      'noteReconnected': 'Tersambung lagi.',
      'errFull': 'Kode itu ruangannya sudah berisi 2 orang.',
      'noteFriendJoined': 'Temanmu bergabung.',
      'noteFriendLeft': 'Temanmu pergi — pesan berikutnya akan hilang.',
      'flashJoined': '• Temanmu bergabung — Bisik',
      'flashLeft': '• Temanmu pergi — Bisik',
      'noteUnopenable': 'Ada pesan masuk yang tidak bisa dibuka dengan kodemu.',
      'imgAltFriend': 'Gambar terenkripsi dari temanmu',
      'imgAltMine': 'Gambar yang kamu kirim',
      'errEnterCode': 'Isi dulu kodenya — atau buat kode acak.',
      'warnShortCode': 'Kode itu terlalu pendek, gampang ditebak — 12+ karakter, atau kode acak, jauh lebih aman.',
      'errShortCode': 'Kode minimal 8 karakter.',
      'notePreparing': 'Menyiapkan kunci enkripsi…',
      'noteNotConnectedMsg': 'Tidak terhubung — pesan tidak terkirim.',
      'noteNotConnectedImg': 'Tidak terhubung — gambar tidak terkirim.',
      'noteTooBig': 'Gambar itu terlalu besar — maks 5 MB.',
      // Halaman statis (bersama)
      'back': '← Kembali ke Bisik',
      'updated': 'Terakhir diperbarui: 8 November 2026',
      // Halaman Privasi
      'priv.title': 'Privasi — Bisik',
      'priv.h1': 'Kebijakan Privasi',
      'priv.intro': 'Bisik dibangun di atas satu prinsip: kami tidak bisa menyerahkan, menjual, atau membocorkan isi percakapanmu karena <b>kami memang tidak pernah memilikinya</b>.',
      'priv.h2a': 'Yang tidak kami kumpulkan',
      'priv.pa': 'Tidak ada akun dan tidak ada pendaftaran, jadi tidak ada nama, alamat email, nomor telepon, atau kata sandi yang bisa disimpan. Tidak ada database. Tanpa analitik, tanpa iklan, tanpa pelacak pihak ketiga.',
      'priv.h2b': 'Isi pesan dan gambar',
      'priv.pb': 'Pesan dan gambar dienkripsi di browsermu sebelum dikirim. Server perantara hanya meneruskan hasil terenkripsi itu dari memori (RAM) ke orang yang sedang bicara denganmu — tidak pernah menuliskannya ke disk, tidak pernah mencatatnya, tidak pernah mengantrekannya. Kalau orangnya sedang offline, pesanmu langsung dibuang saat itu juga. Riwayat chat hanya ada di tab yang terbuka; menutup atau me-refresh halaman akan menghapusnya.',
      'priv.h2c': 'Kodemu',
      'priv.pc': 'Kode bersamamu tidak pernah dikirim ke server. Yang dikirim hanya id ruangan — hasil derivasi lambat (PBKDF2) dari kode itu, supaya server bisa mempertemukan dua orang yang memakai kode yang sama tanpa id-nya praktis bisa dibalik menjadi kode aslinya. Kunci enkripsi diturunkan dan dipakai hanya di dalam browser kalian.',
      'priv.h2d': 'Yang tersimpan di perangkatmu',
      'priv.pd': 'Kalau kamu memasang Bisik sebagai PWA, browsermu menyimpan file-file aplikasinya (halaman, gaya, ikon) di cache supaya cepat dibuka. Isi percakapan tidak pernah termasuk di dalamnya. Bisik tidak memakai localStorage, sessionStorage, IndexedDB, atau cookie untuk menyimpan data chat.',
      'priv.h2e': 'Batasan yang jujur',
      'priv.pe': 'Supaya koneksi bisa terjadi, alamat IP-mu memang harus terlihat oleh jaringan dan oleh penyedia hosting tempat perantara ini berjalan (saat ini Render), sama seperti situs mana pun. Penyedia hosting bisa saja menyimpan log jaringan standar di sisi mereka, yang berada di luar kendali aplikasi ini. Yang bisa kami jamin dari sisi aplikasi: isi pesan tidak pernah dicatat atau disimpan di mana pun.',
      'priv.h2f': 'Kontak',
      'priv.pf': 'Pertanyaan soal privasi bisa dikirim lewat halaman kontak di <a href="https://www.ednasalam.com">ednasalam.com</a>.',
      // Halaman Ketentuan
      'terms.title': 'Ketentuan — Bisik',
      'terms.h1': 'Ketentuan Penggunaan',
      'terms.h2a': 'Layanannya',
      'terms.pa': 'Bisik adalah alat percakapan berdua yang memang dirancang sementara: tanpa akun, tanpa riwayat, tanpa pemulihan sesi. Dengan memakai Bisik kamu menerima sifat itu — termasuk bahwa pesan yang dikirim saat orangnya offline akan hilang, dan percakapan yang sudah selesai tidak bisa dibuka lagi dengan cara apa pun.',
      'terms.h2b': 'Tanggung jawabmu',
      'terms.pb': 'Kamu bertanggung jawab atas kode yang kamu buat dan bagikan, dan kepada siapa kamu membagikannya. Siapa pun yang memegang kode yang sama bisa masuk ke ruangan yang sama. Jangan pakai Bisik untuk hal-hal yang melanggar hukum. Kami tidak bisa memoderasi isi percakapan — secara teknis memang tidak bisa, karena isinya terenkripsi dan tidak pernah sampai ke kami dalam bentuk yang bisa dibaca.',
      'terms.h2c': 'Ketersediaan',
      'terms.pc': 'Bisik disediakan apa adanya, tanpa jaminan apa pun. Ia berjalan di hosting gratis yang bisa tidur saat tidak dipakai (muat pertama bisa butuh beberapa puluh detik untuk membangunkannya) dan bisa saja tidak tersedia sewaktu-waktu. Jangan andalkan Bisik sebagai satu-satunya jalur untuk komunikasi darurat.',
      'terms.h2d': 'Perubahan',
      'terms.pd': 'Ketentuan ini bisa berubah; versi terbarunya selalu ada di halaman ini.',
      // Halaman Keamanan
      'sec.title': 'Keamanan — Bisik',
      'sec.h1': 'Cara Kerja Keamanan Bisik',
      'sec.h2a': 'Dari kode menjadi kunci',
      'sec.pa': 'Saat kamu mengetik kode, browsermu menurunkan dua hal darinya. Satu proses PBKDF2 (600.000 iterasi) menghasilkan keduanya sekaligus: id ruangan — satu-satunya yang pernah dikirim ke server, hanya untuk mempertemukan dua browser yang memakai kode yang sama (satu ruangan maksimal dua orang) — dan kunci kode, yang tidak pernah meninggalkan browsermu. Id ruangan pun sengaja diturunkan dengan cara yang mahal, supaya tidak bisa dipakai untuk menebak kodemu secara offline.',
      'sec.h2b': 'Forward secrecy: kunci baru untuk setiap sesi',
      'sec.pb': 'Kunci kode tidak pernah mengenkripsi pesanmu secara langsung. Saat kedua orang sudah berada di ruangan, browser mereka bertukar kunci publik ECDH ephemeral — masing-masing dienkripsi dengan kunci kode, jadi hanya pemegang kode yang bisa ikut — lalu secara terpisah menurunkan kunci sesi yang sama dari pertukaran itu. Kunci sesi itulah, dan hanya dia, yang mengenkripsi pesanmu. Kunci privat ephemeral hanya ada di memori halaman: akhiri sesi (atau sambung ulang) dan pasangan kunci yang benar-benar baru dinegosiasikan. Inilah forward secrecy — bahkan kalau seseorang merekam lalu lintas terenkripsimu <i>dan</i> belakangan mengetahui kodemu, rekaman itu tetap terkunci, karena kunci yang bisa membukanya sudah tidak ada di mana pun.',
      'sec.h2c': 'Perjalanan sebuah pesan',
      'sec.pc': 'Pesan dan gambar dienkripsi di browser pengirim dengan kunci sesi dan IV acak baru untuk setiap pesan, diteruskan oleh server dalam bentuk terenkripsi hanya dari memori, lalu dibuka di browser penerima. Server tidak punya kunci, jadi kalau lalu lintasnya disadap atau servernya sendiri dibobol, yang didapat siapa pun hanya teks yang tampak acak. Gambar di-encode ulang di browsermu sebelum dikirim, yang membuang metadata EXIF (lokasi GPS, detail perangkat) yang biasa dibawa foto kamera. Enam karakter di bagian atas layar chat adalah sidik jari ruanganmu — bandingkan dengan punya temanmu untuk memastikan kalian memakai kode yang sama.',
      'sec.h2d': 'Yang dilindungi',
      'sec.pd': 'Isi percakapanmu dari pengintip jaringan, dari penyedia hosting, dan dari siapa pun yang tidak memegang kodenya. Tidak ada riwayat yang bisa diminta, dicuri, atau dibocorkan dari server, karena memang tidak ada apa pun yang pernah disimpan.',
      'sec.h2e': 'Yang tidak bisa dilindungi',
      'sec.pe': 'Bisik tidak bisa membantu kalau perangkatmu sendiri sudah dikompromikan, kalau orang yang bicara denganmu memotret layar atau meneruskan isinya, atau kalau kodemu lemah dan ketebak — kode seperti tanggal lahir atau "secret123" bisa dicoba siapa saja. Alamat IP-mu juga tetap terlihat oleh jaringan dan penyedia hosting, seperti situs mana pun.',
      'sec.pf': 'Kode tetap menentukan siapa yang bisa masuk: siapa pun yang mengetahuinya selagi sebuah sesi berjalan bisa mencoba bergabung (satu ruangan maksimal dua orang, dan kamu akan melihat kedatangan mereka). Forward secrecy melindungi masa lalu, bukan masa sekarang — jadi tetap perlakukan kode itu sendiri sebagai rahasia, dan pakai kode baru untuk setiap percakapan.',
      'sec.h2f': 'Tips supaya tetap aman',
      'sec.pg': 'Pakai kode acak bawaan, atau kode buatan sendiri yang panjang dan tidak punya arti pribadi. Bagikan kode lewat jalur yang berbeda dari percakapannya sendiri. Bandingkan sidik jari ruangan sebelum membahas hal yang sensitif. Akhiri sesi kalau sudah selesai.',
    },
  };

  const SUPPORTED = ['en', 'id'];

  // Language resolution: ?lang= in the URL wins (it is how a manual choice
  // travels between pages without storage), then the device language.
  function detectLang(navLang, search) {
    try {
      const p = new URLSearchParams(search || '').get('lang');
      if (p && SUPPORTED.includes(p)) return p;
    } catch { /* no URL context (tests) */ }
    const primary = String(navLang || '').toLowerCase().split('-')[0];
    if (primary === 'id' || primary === 'in') return 'id'; // 'in' = legacy code for Indonesian
    return 'en';
  }

  let current = 'en';
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    current = detectLang(navigator.language, window.location.search);
  }

  function t(key, vars) {
    let s = (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  function apply() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = current;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    // Carry the language across internal pages via the URL — no storage.
    document.querySelectorAll('a[href^="/"]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href.startsWith('//')) return;
      const [path, query] = href.split('?');
      const params = new URLSearchParams(query || '');
      params.set('lang', current);
      a.setAttribute('href', path + '?' + params.toString());
    });
    document.querySelectorAll('[data-lang-set]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.langSet === current));
    });
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    current = lang; // memory only — gone on the next fresh visit
    apply();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('bisik:lang'));
  }

  const api = {
    STRINGS, SUPPORTED, detectLang, t, apply, setLang,
    get lang() { return current; },
  };

  if (typeof window !== 'undefined') {
    window.BisikI18n = api;
    const init = () => {
      document.querySelectorAll('[data-lang-set]').forEach((b) => {
        b.addEventListener('click', () => setLang(b.dataset.langSet));
      });
      apply();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
