# komplainer

Aplikasi laporan komplain lapangan berbasis Next.js, dengan pencatatan tingkat keparahan C1–C4, Data Master, rekap mingguan, dan dukungan pemasangan sebagai PWA.

## Fitur

- Tambah, tinjau, edit, dan hapus laporan melalui Google Sheets / Google Apps Script.
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
NEXT_PUBLIC_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Contoh skrip backend ada di [docs/appscript.gs](docs/appscript.gs). Sesuaikan deployment dan akses Google Sheets dengan kebutuhan tim.

```bash
npm run dev
```

Buka `http://localhost:3000`. Halaman root otomatis mengarah ke `/komplain`.

## Pemeriksaan

```bash
npx tsc --noEmit --incremental false
npx eslint src/app/komplain/*.jsx src/app/komplain/*.mjs src/app/manifest.ts src/app/layout.tsx next.config.ts tests/pwa.test.mjs
node --test tests/pwa.test.mjs src/app/komplain/weekly-summary.test.mjs
```

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

PIN Data Master saat ini merupakan pembatas tampilan di browser. Endpoint API belum memiliki autentikasi server. Sebelum penggunaan dengan data operasional sensitif, tambahkan login, sesi, dan otorisasi server sesuai peran.

Temuan audit: [docs/audit-komplain.md](docs/audit-komplain.md).

File `.env.local`, `node_modules`, dan hasil build diabaikan oleh Git.
