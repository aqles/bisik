# Bisik

Chat berdua yang sengaja tidak menyimpan apa-apa.

Bisik adalah aplikasi web (bisa diinstal sebagai PWA) untuk mengobrol 1-on-1 secara terenkripsi. Tidak ada akun, tidak ada daftar kontak, tidak ada database. Dua orang memasukkan kode yang sama, lalu mengobrol. Selesai sesi, selesai juga pesannya — tidak ada riwayat yang tertinggal di mana pun.

## Cara pakai

1. Buka Bisik, buat kode acak atau ketik kode sendiri (minimal 8 karakter).
2. Bagikan kode itu ke temanmu lewat jalur lain — tatap muka, telepon, kertas. Kode ini kunci enkripsinya, jadi jangan disebar sembarangan.
3. Temanmu membuka Bisik dan memasukkan kode yang persis sama.
4. Mengobrol seperti biasa. Bisa teks dan gambar (maks 5 MB).

Ada sidik jari ruangan 6 karakter di bagian atas layar chat. Samakan dengan punya temanmu — kalau sama, kalian benar-benar memakai kode yang sama.

## Kenapa bisa tanpa database

Begitu kode dimasukkan, browser menurunkan dua hal dari kode itu:

- **Hash ruangan** (SHA-256) — ini yang dikirim ke server, sekadar untuk mempertemukan dua browser yang memakai kode yang sama. Isi ruangan maksimal 2 orang.
- **Kunci enkripsi** (PBKDF2 + AES-GCM 256-bit) — ini tidak pernah meninggalkan browser. Semua pesan dan gambar dienkripsi dulu di browser pengirim, dibuka lagi di browser penerima.

Server relay di tengah hanya meneruskan teks acak hasil enkripsi dari RAM. Ia tidak menulis apa pun ke disk, tidak mencatat isi pesan, dan tidak mengantrekan pesan: kalau temanmu sedang offline, pesanmu langsung dibuang dan kamu diberi tahu. Riwayat chat hanya ada di memori halaman yang sedang terbuka — refresh halaman, riwayat ikut hilang.

## Batasannya, biar jelas

- **Kalau temanmu offline, pesan hilang.** Ini konsekuensi yang memang dipilih, bukan bug. Tidak ada "pesan akan terkirim saat dia online".
- **Sekali sesi selesai, tidak bisa dibuka lagi.** Tidak ada cadangan, tidak ada pemulihan.
- **Keamanan Bisik sekuat kodenya.** Kode pendek atau gampang ditebak (tanggal lahir, "rahasia123") bisa dicoba-coba orang. Pakai kode acak bawaan atau kode custom yang panjang.
- Bisik melindungi pesan selama perjalanan dan di server. Ia tidak bisa melindungi kalau perangkatmu sendiri sudah disusupi, atau kalau lawan bicaramu memotret layar.

## Jalanin sendiri

Butuh Node.js 18+.

```bash
npm install
npm start        # http://localhost:3000
npm test         # tes ujung-ke-ujung: kode sama, kode beda, penerima offline
```

Satu proses Node ini melayani file aplikasinya sekaligus relay WebSocket-nya, jadi deploy-nya cukup di satu tempat yang bisa menjalankan proses Node jangka panjang (misalnya VPS, Fly.io, atau Render) di domain `bisik.ednasalam.com`. Untuk produksi, jalankan di balik HTTPS — WebCrypto dan PWA memang hanya aktif di konteks aman (HTTPS atau localhost).

## Isi repo

- `server.js` — server statis + relay WebSocket. Sengaja kecil, silakan dibaca habis sebelum percaya.
- `public/` — aplikasi web-nya (HTML/CSS/JS polos, tanpa framework, tanpa build).
- `test/e2e.mjs` — tes yang meniru persis perilaku browser terhadap server beneran.

## Lisensi

MIT
