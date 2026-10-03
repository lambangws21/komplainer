# Aktivasi akun dan workflow Komplainer

Versi ini membutuhkan aplikasi dan `docs/appscript.gs` yang diperbarui bersama. Jangan mengarahkan aplikasi baru ke skrip lama.

## 1. Siapkan Google Sheets dan Apps Script

1. Cadangkan spreadsheet sebelum migrasi.
2. Salin isi `docs/appscript.gs` ke proyek Apps Script yang terhubung dengan spreadsheet Anda.
3. Pada Project Settings → Script Properties, isi `APP_API_KEY` dengan kunci acak minimal 32 karakter. Untuk menghasilkan kunci di terminal:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Jika proyek skrip tidak terikat ke spreadsheet, tambahkan `SPREADSHEET_ID`. Jika terdapat beberapa sheet dengan delapan kolom komplain yang sama, isi `COMPLAINT_SHEET_NAME` dengan nama sheet data yang benar.
5. Jalankan `setupKomplainer` dari editor Apps Script dan berikan izin akses spreadsheet. Fungsi ini mempertahankan delapan kolom lama, menambahkan kolom workflow, serta membuat sheet `Pengguna`, `Sesi`, dan `Riwayat`. Header yang berbeda akan ditolak agar data tidak tertimpa.
6. Perbarui deployment Web App ke versi skrip terbaru. Jalankan sebagai pemilik spreadsheet dan izinkan akses endpoint tanpa login Google agar server aplikasi dapat memanggilnya. Setiap permintaan data tetap membutuhkan API key dan sesi yang valid. Simpan URL `/exec`.

Jangan bagikan spreadsheet kepada pengguna umum. Password hash dan sesi berada dalam sheet internal; hanya pengelola yang boleh mengakses spreadsheet langsung.

## 2. Konfigurasi aplikasi dan admin pertama

Isi `.env.local` (tidak masuk Git):

```dotenv
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_SCRIPT_API_KEY=KUNCI_YANG_SAMA_DENGAN_APP_API_KEY
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_NAME=Administrator
BOOTSTRAP_ADMIN_UNIT=Pusat
BOOTSTRAP_ADMIN_PASSWORD=PASSWORD_UNIK_MINIMAL_12_KARAKTER
```

Jalankan:

```bash
npm ci
npm run setup:admin
```

Setup hanya dapat membuat admin ketika sheet pengguna masih kosong. Setelah berhasil, hapus `BOOTSTRAP_ADMIN_PASSWORD` dari `.env.local`. Jangan masukkan variabel bootstrap ke Vercel. Masuk memakai akun yang baru dibuat, kemudian buat akun tim melalui menu **Pengguna**. Sampaikan password sementara secara pribadi; aplikasi belum mengirim email undangan. Akun baru wajib mengganti password sebelum mengakses laporan.

Pada Vercel → Settings → Environment Variables, isi `GOOGLE_SCRIPT_URL` dan `GOOGLE_SCRIPT_API_KEY`, lalu deploy ulang. API key tidak boleh memakai awalan `NEXT_PUBLIC_`. Perbarui Apps Script sebelum mengaktifkan deployment aplikasi baru. Uji login, tambah laporan, penugasan, dan penyelesaian dengan data uji sebelum digunakan tim.

## Hak akses dan alur kerja

| Peran | Akses |
| --- | --- |
| Pelapor | Membuat laporan, melihat laporan sendiri, mengedit ketika status Baru, membuka kembali laporan sendiri yang selesai |
| Petugas/PIC | Akses pelapor, ditambah melihat dan menindaklanjuti laporan yang ditugaskan kepadanya |
| Admin | Semua laporan, penugasan PIC dan tenggat, tindak lanjut, arsip, serta pengelolaan akun |

Status penanganan: **Baru → Diproses / Menunggu → Selesai**. Tingkat C1–C4 tetap terpisah dari status penanganan. Penyelesaian membutuhkan PIC, catatan tindak lanjut, dan solusi. Riwayat mencatat aktor dan waktu perubahan. Arsip menyembunyikan laporan tanpa menghapus baris atau riwayat. Nomor versi menolak perubahan bersamaan yang sudah kedaluwarsa; muat ulang data sebelum mencoba lagi.

Laporan lama tanpa ID pelapor terlihat oleh admin saja. Skrip tidak menebak pemilik dari nama dokter atau tim. Rekap UI mengikuti lingkup akses pengguna dan tanggal kejadian. `generateWeeklySummary` merekap minggu lengkap sebelumnya (Senin–Minggu), memakai zona waktu spreadsheet dan status laporan saat rekap dijalankan; bukan snapshot historis status pada akhir minggu.

Sesi berlaku 8 jam. Menonaktifkan akun, mengganti peran, atau reset password membatalkan sesi akun terkait. Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan perannya. Petugas dengan tugas belum selesai perlu dialihkan tugasnya sebelum dinonaktifkan atau berganti peran.

## Batas versi ini

Lampiran, email/push notification, pemulihan password mandiri, dan sinkronisasi laporan offline belum tersedia. Reset password dilakukan admin. Pemasangan PWA tetap tersedia, tetapi data laporan membutuhkan internet. Apps Script dan Sheets masih bergantung pada kuota layanan; evaluasi database khusus jika jumlah pengguna dan transaksi meningkat.

Tes otomatis menggunakan spreadsheet tiruan, tanpa mengubah spreadsheet operasional. Deployment Apps Script, pengisian secret Vercel, dan bootstrap akun asli harus dilakukan oleh pengelola sesuai langkah di atas.

Pemeriksaan lokal: `npm run lint`, `npm test`, `npx tsc --noEmit --incremental false`, dan `npm run build`. Setelah build, jalankan `node tests/api-integration.mjs` untuk menguji API melalui server Next production dan Apps Script tiruan pada port 3100/4100. Port tersebut harus kosong.
