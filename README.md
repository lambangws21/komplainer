# komplainer

Aplikasi laporan komplain lapangan berbasis Next.js, dengan pencatatan tingkat keparahan C1–C4, Data Master, rekap mingguan, dan dukungan pemasangan sebagai PWA.

## Fitur

- Login dengan peran admin, petugas/PIC, dan pelapor; akses data diperiksa di server.
- Penugasan PIC, tenggat, status penanganan, riwayat tindak lanjut, dan arsip laporan.
- Pengelolaan akun serta penggantian password sementara pada login pertama.
- Tabel desktop dan kartu pada ponsel, pencarian, filter, urutan tanggal, dan pagination.
- Rekap Senin–Minggu: total, perbandingan minggu sebelumnya, distribusi harian, tingkat keparahan, dan tim terkait.
- Manifest, ikon aplikasi, panduan pemasangan iOS/Android, dan halaman fallback offline.

## Menjalankan lokal

Gunakan Node.js 20 atau lebih baru.

```bash
npm ci
```

Buat `.env.local` di root proyek, lalu isi URL deployment Web App Google Apps Script:

```dotenv
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_SCRIPT_API_KEY=KUNCI_ACAK_MINIMAL_32_KARAKTER
```

Nama lama `NEXT_PUBLIC_GOOGLE_SCRIPT_URL` tetap didukung sebagai fallback; gunakan `GOOGLE_SCRIPT_URL` untuk konfigurasi baru.

Ikuti [panduan aktivasi akun dan Apps Script](docs/setup-akun.md) sebelum menjalankan versi ini. Backend lama perlu diperbarui bersama aplikasi.

```bash
npm run dev
```

Buka `http://localhost:3000`. Halaman root otomatis mengarah ke `/komplain`.

Output development disimpan di `.next-dev`, sedangkan build/start production memakai `.next`, melalui konfigurasi [distDir Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/distDir). Pemisahan ini mencegah build production menimpa chunk development ketika kedua proses berjalan.

## Pemeriksaan

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test
```

## Environment di Vercel

File `.env.local` tidak dikirim ke GitHub dan tidak otomatis tersedia pada Vercel.

1. Buka proyek Vercel → Settings → Environment Variables.
2. Tambahkan `GOOGLE_SCRIPT_URL` dengan nilai URL Web App Google Apps Script yang berakhir `/exec`.
3. Tambahkan `GOOGLE_SCRIPT_API_KEY` yang sama dengan Script Property `APP_API_KEY`. Pilih Production dan Preview bila digunakan, lalu simpan.
4. Deploy commit terbaru atau redeploy setelah menambahkan/mengubah variabel.

Nilai URL diisikan tanpa tanda kutip. API mendukung nama lama `NEXT_PUBLIC_GOOGLE_SCRIPT_URL` juga. Jika keduanya tersedia, `GOOGLE_SCRIPT_URL` diprioritaskan.

## Build dan PWA

```bash
npm run build
npm run start
```

Build membutuhkan akses Google Fonts untuk Geist/Geist Mono pada layout. Publikasikan aplikasi menggunakan HTTPS agar dapat dipasang di perangkat pengguna. Service worker hanya didaftarkan pada mode production.

- Android: buka di Chrome, gunakan tombol Instal aplikasi atau menu browser.
- iOS: buka di Safari → Bagikan → Tambahkan ke Layar Utama.
- Membaca dan menyimpan laporan tetap membutuhkan internet. Cache hanya memuat aset umum dan halaman fallback offline.

Detail implementasi dan batas verifikasi: [docs/pwa-komplain.md](docs/pwa-komplain.md).

## Catatan akses data

PIN telah diganti dengan sesi cookie HttpOnly selama 8 jam. Password disimpan sebagai hash scrypt. Pelapor dan petugas melihat laporan sendiri serta kasus yang ditugaskan kepadanya sebagai PIC; admin melihat seluruh laporan. Delegasi PIC tidak mengubah peran akun. Data lama tanpa pemilik hanya terlihat oleh admin. API key hanya digunakan di server; jangan gunakan nama `NEXT_PUBLIC_` untuk key tersebut.

Temuan audit: [docs/audit-komplain.md](docs/audit-komplain.md).

File `.env.local`, `node_modules`, dan hasil build diabaikan oleh Git.
