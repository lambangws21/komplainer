# PWA Komplain

## Implementasi

- Manifest `/manifest.webmanifest`: nama Komplain, start URL `/komplain`, scope `/`, mode standalone, warna tema dan ikon PNG 192/512 px. Ikon maskable memakai gambar dengan simbol di area tengah yang aman; ikon Apple 180 px tersedia.
- Metadata judul, bahasa Indonesia, apple-touch-icon, dan appleWebApp di layout.
- Banner instalasi mendeteksi `beforeinstallprompt`, `appinstalled`, standalone, serta iPhone/iPad. Jika prompt tersedia, pengguna dapat memanggilnya dari tombol. Jika tidak, panduan manual tersedia. Tidak membuka prompt otomatis saat halaman dimuat.
- Panduan Android Chrome dan iOS Safari, termasuk Add to Home Screen dan Open as Web App bila tersedia.
- Service worker hanya didaftarkan dalam production pada secure context. Development tidak mendaftarkan worker, agar cache tidak mengganggu perubahan kode.
- Worker menyimpan halaman fallback offline dan ikon umum saja. HTML aplikasi, API komplain, dan mutasi tidak dicache. Tidak ada pengiriman antrean offline. Halaman offline pertama membutuhkan worker yang pernah terpasang saat online.
- Worker baru mengikuti lifecycle pembaruan normal (tanpa memaksa reload atau aktivasi saat pengguna sedang mengisi form). Header `/sw.js` mencegah cache HTTP yang menahan pemeriksaan versi baru.

## Penggunaan di perangkat

1. Publikasikan build production pada alamat HTTPS yang dapat diakses perangkat.
2. Android: buka alamat itu di Chrome, gunakan tombol instal atau menu browser.
3. iOS: buka di Safari → Bagikan → Tambahkan ke Layar Utama → aktifkan Open as Web App bila tersedia → Tambah.
4. Buka ikon yang terpasang dan periksa standalone, akses API, formulir, serta rekap.

`localhost` mendukung pengujian lokal; alamat HTTP LAN komputer bukan pengganti deployment HTTPS untuk pemasangan perangkat lain. Fitur instalasi/prompt bergantung browser. User harus menyetujui pemasangan di perangkatnya.

## Verifikasi 3 Oktober 2026

- ESLint perubahan PWA: lolos. TypeScript `npx tsc --noEmit --incremental false`: lolos.
- Tujuh pengujian node (empat mingguan dan tiga worker): lolos. Worker diuji untuk network navigation, fallback ketika jaringan gagal, pengecualian API/mutasi, aset publik, dan penghapusan cache lama milik aplikasi.
- Manifest endpoint: HTTP 200, standalone, URL, dan ikon sesuai konfigurasi. PNG 180/192/512 diperiksa ukuran lokalnya.
- `/sw.js`: HTTP 200, tipe JavaScript, Cache-Control no-cache/no-store, Service-Worker-Allowed `/`. `/offline.html`: HTTP 200.
- Chrome desktop mengenali aplikasi: kontrol instal tersedia. Metadata manifest/Apple icon/theme/lang dan dialog instruksi iOS/Android diperiksa melalui browser.
- Belum dipublikasikan atau dipasang pada perangkat fisik iOS/Android. Worker production belum diuji end-to-end pada hosting HTTPS. Build produksi sebelumnya terkendala pengunduhan Google Fonts dari layout; perlu diverifikasi sebelum deployment.

## Prioritas fitur berikutnya

Pembaruan: poin 1–3 di bawah telah diterapkan pada versi akun/workflow, dengan status tambahan Menunggu. Build production terbaru juga telah berhasil. Aktivasi backend dan akun mengikuti [setup-akun.md](setup-akun.md); pengujian pemasangan pada perangkat fisik masih diperlukan.

1. Akun dan hak akses dengan autentikasi server: pelapor, petugas, admin. PIN klien bukan kontrol keamanan endpoint.
2. Status penanganan terpisah dari tingkat keparahan: Baru, Diproses, Selesai; penanggung jawab dan tenggat.
3. Riwayat tindak lanjut dan audit perubahan: siapa mengubah apa dan kapan.
4. Lampiran bukti dengan aturan akses/penyimpanan yang ditentukan.
5. Rekap ekspor dan filter per tim/dokter, bulanan, serta metrik penyelesaian setelah status tersedia.
6. Pengingat/notifikasi untuk laporan prioritas dan tenggat. Perlu backend dan izin pengguna; tidak diminta otomatis pada kunjungan pertama.

## Referensi

- MDN: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Apple: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
- Google web.dev: https://web.dev/learn/pwa/installation-prompt

## Pembaruan verifikasi deployment

Pada 3 Oktober 2026, build produksi berhasil setelah dependensi diselaraskan dan impor rekursif kalender dashboard diperbaiki. Pemasangan PWA pada perangkat fisik tetap perlu diuji setelah deployment HTTPS.
