# Bisik

Chat berdua yang sengaja tidak menyimpan apa-apa.

Bisik adalah aplikasi web (bisa diinstal sebagai PWA) untuk mengobrol 1-on-1 secara terenkripsi. Tidak ada akun, tidak ada daftar kontak, tidak ada database. Dua orang memasukkan kode yang sama, lalu mengobrol. Selesai sesi, selesai juga pesannya — tidak ada riwayat yang tertinggal di mana pun.

**Coba langsung: https://bisik.ednasalam.com** (versi 0.3.0)

## Cara pakai

1. Buka Bisik, buat kode acak atau ketik kode sendiri (minimal 8 karakter).
2. Bagikan kode itu ke temanmu lewat jalur lain — tatap muka, telepon, kertas. Kode ini kunci enkripsinya, jadi jangan disebar sembarangan.
3. Temanmu membuka Bisik dan memasukkan kode yang persis sama — persis beneran, huruf besar dan kecil dianggap beda.
4. Mengobrol seperti biasa. Bisa teks dan gambar (maks 5 MB).

Ada sidik jari ruangan 6 karakter di bagian atas layar chat. Samakan dengan punya temanmu — kalau sama, kalian benar-benar memakai kode yang sama.

## Fitur

- **Teks + gambar** sampai 5 MB, semuanya terenkripsi di browser sebelum dikirim.
- **Sambung ulang otomatis** kalau koneksi putus di tengah jalan (bisa dimatikan), plus tombol "Sambungkan lagi" untuk menyambung manual ke ruangan yang sama tanpa memuat ulang halaman — riwayat di layar tidak hilang.
- **Halaman Privasi, Syarat, dan Cara kerja keamanan** di dalam aplikasi, ditulis apa adanya: apa yang disimpan (tidak ada), apa yang tetap terlihat oleh penyedia hosting (alamat IP), dan batas perlindungannya.
- **Batas pemakaian di server**: satu ruangan maksimal 2 orang, ada batas jumlah koneksi dan kecepatan kirim pesan, plus header keamanan standar dan penolakan koneksi dari situs lain.
- **Bisa diinstal sebagai PWA** dengan ikon generik bergaya catatan — memang sengaja tidak kelihatan seperti aplikasi chat.

## Kenapa bisa tanpa database

Begitu kode dimasukkan, browser menurunkan dua hal dari kode itu:

- **Penanda ruangan** — diturunkan dari proses PBKDF2 yang sama (bukan hash cepat), ini yang dikirim ke server sekadar untuk mempertemukan dua browser yang memakai kode yang sama. Isi ruangan maksimal 2 orang. Karena turunannya mahal untuk ditebak, penanda ini tidak bisa dipakai menggoreng kode secara offline.
- **Kunci enkripsi** (PBKDF2 + AES-GCM 256-bit) — diturunkan bersamaan dengan penanda ruangan dari satu proses PBKDF2, dan tidak pernah meninggalkan browser. Semua pesan dan gambar dienkripsi dulu di browser pengirim, dibuka lagi di browser penerima.

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
npm test         # tes ujung-ke-ujung (10 pemeriksaan)
```

Tesnya memakai modul kripto yang sama persis dengan yang dipakai browser, terhadap server beneran: kode sama bisa ngobrol, yang lewat server cuma teks terenkripsi, kode beda tidak nyasar, penerima offline pesannya dibuang, sambung ulang setelah putus kasar, gambar 1 MB terkirim utuh, banjir pesan dipotong di batasnya, dan koneksi dari situs lain ditolak.

Satu proses Node ini melayani file aplikasinya sekaligus relay WebSocket-nya, jadi deploy-nya cukup di satu tempat yang bisa menjalankan proses Node jangka panjang (misalnya VPS, Fly.io, atau Render). Versi yang berjalan di https://bisik.ednasalam.com di-hosting di Render; `render.yaml` di repo ini adalah konfigurasinya. Untuk produksi, jalankan di balik HTTPS — WebCrypto dan PWA memang hanya aktif di konteks aman (HTTPS atau localhost).

## Isi repo

- `server.js` — server statis + relay WebSocket. Sengaja kecil, silakan dibaca habis sebelum percaya.
- `public/` — aplikasi web-nya (HTML/CSS/JS polos, tanpa framework, tanpa build), termasuk `crypto.js` (semua urusan enkripsi, dipakai bersama oleh aplikasi dan tes) dan halaman `privacy.html`, `terms.html`, `security.html`.
- `test/e2e.mjs` — tes ujung-ke-ujung terhadap server beneran.

## Lisensi

MIT
