# Aktivasi akun dan workflow Komplainer

Konfigurasi aktif menggunakan [Firebase untuk semua akun](firebase-auth.md), sementara Apps Script hanya menyimpan laporan. Panduan di bawah adalah arsip mode lama dan membutuhkan `DATA_ONLY = false`; jangan menggunakannya untuk membuat akun produksi baru.

Versi ini membutuhkan aplikasi dan `docs/appscript.gs` yang diperbarui bersama. Jangan mengarahkan aplikasi baru ke skrip lama.

## 1. Siapkan Google Sheets dan Apps Script

1. Cadangkan spreadsheet sebelum migrasi.
2. Salin isi `docs/appscript.gs` ke proyek Apps Script yang terhubung dengan spreadsheet Anda.
3. `setupKomplainer` otomatis membuat `APP_API_KEY` di Script Properties jika belum ada atau kurang dari 32 karakter. Setelah setup, salin key tersebut dari Project Settings → Script Properties ke `GOOGLE_SCRIPT_API_KEY` di Next.js/Vercel. Jika sudah memiliki key aplikasi, isi `APP_API_KEY` dengan nilai yang sama sebelum setup; key valid tidak direset. Untuk menghasilkan kunci sendiri di terminal:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Jika proyek skrip tidak terikat ke spreadsheet, tambahkan `SPREADSHEET_ID`. Jika terdapat beberapa sheet dengan delapan kolom komplain yang sama, isi `COMPLAINT_SHEET_NAME` dengan nama sheet data yang benar.
5. Jalankan `setupKomplainer` dari editor Apps Script dan berikan izin akses spreadsheet. Fungsi ini mempertahankan delapan kolom lama, menambahkan kolom workflow, serta membuat sheet `Pengguna`, `Sesi`, `Riwayat`, dan `Rekapan Mingguan` beserta header. Jika belum ada pengguna, akun admin awal `lambangws` dibuat dengan password awal yang telah ditentukan, disimpan sebagai hash scrypt. Header yang berbeda akan ditolak agar data tidak tertimpa.
6. Perbarui deployment Web App ke versi skrip terbaru. Jalankan sebagai pemilik spreadsheet dan izinkan akses endpoint tanpa login Google agar server aplikasi dapat memanggilnya. Setiap permintaan data tetap membutuhkan API key dan sesi yang valid. Simpan URL `/exec`.

Jangan bagikan spreadsheet kepada pengguna umum. Password hash dan sesi berada dalam sheet internal; hanya pengelola yang boleh mengakses spreadsheet langsung.

## 2. Konfigurasi aplikasi dan admin pertama

Isi `.env.local` (tidak masuk Git):

```dotenv
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_SCRIPT_API_KEY=KUNCI_YANG_SAMA_DENGAN_APP_API_KEY
```

Jalankan `setupKomplainer` dari editor Apps Script satu kali, lalu masuk ke aplikasi menggunakan username **lambangws** dan password awal yang Anda tentukan. Akun ini wajib mengganti password sebelum membuka data. Setelah itu buat akun tim melalui menu **Pengguna**. Password baru dan password akun lain tetap harus 6–128 karakter. Sampaikan password sementara secara pribadi; aplikasi belum mengirim email undangan.

Setup aman dijalankan ulang: tidak mengganti password, mengaktifkan kembali akun, atau menambahkan admin awal jika pengguna sudah ada. Penanda `INITIAL_ADMIN_CREATED` mencegah akun awal dibuat ulang jika baris pengguna kemudian dihapus. Permintaan API yang sudah lolos pemeriksaan key juga membuat sheet/header yang belum ada, tetapi tidak membuat ulang akun awal. Header lama yang cocok dilengkapi; header/data yang berbeda ditolak agar tidak ditimpa. Rekap mingguan lama dengan enam kolom tetap dipertahankan.

Untuk instalasi khusus yang membutuhkan identitas admin berbeda, `npm run setup:admin` masih tersedia sebelum `setupKomplainer` membuat admin awal. Isi variabel `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD` (minimal 6 karakter), dan opsional `BOOTSTRAP_ADMIN_UNIT` di `.env.local`, lalu hapus password bootstrap setelah selesai. Jangan memasukkan variabel bootstrap ke Vercel.

Pada Vercel → Settings → Environment Variables, isi `GOOGLE_SCRIPT_URL` dan `GOOGLE_SCRIPT_API_KEY`, lalu deploy ulang. API key tidak boleh memakai awalan `NEXT_PUBLIC_`. Perbarui Apps Script sebelum mengaktifkan deployment aplikasi baru. Uji login, tambah laporan, penugasan, dan penyelesaian dengan data uji sebelum digunakan tim.

## Hak akses dan alur kerja

| Peran | Akses |
| --- | --- |
| Pelapor | Membuat dan melihat laporan sendiri, mengedit ketika status Baru, membuka kembali laporan sendiri yang selesai; melihat dan menindaklanjuti kasus yang didelegasikan admin kepadanya sebagai PIC |
| Petugas/PIC | Akses pelapor, ditambah melihat dan menindaklanjuti laporan yang ditugaskan kepadanya |
| Admin | Semua laporan, penugasan PIC dan tenggat, tindak lanjut, arsip, serta pengelolaan akun |

Kolom Tim / unit pada laporan dapat diisi atau diedit oleh pengguna yang berhak membuat/mengedit laporan. Nilai awal mengikuti unit akun, tetapi perubahan hanya berlaku pada laporan tersebut; tidak mengubah unit akun maupun hak akses data.

Status penanganan: **Baru → Diproses / Menunggu → Selesai**. Tingkat C1–C4 tetap terpisah dari status penanganan. Penyelesaian membutuhkan PIC, catatan tindak lanjut, dan solusi. Riwayat mencatat aktor dan waktu perubahan. Arsip menyembunyikan laporan tanpa menghapus baris atau riwayat. Nomor versi menolak perubahan bersamaan yang sudah kedaluwarsa; muat ulang data sebelum mencoba lagi.

Laporan lama tanpa ID pelapor terlihat oleh admin saja. Skrip tidak menebak pemilik dari nama dokter atau tim. Rekap UI mengikuti lingkup akses pengguna dan tanggal kejadian. `generateWeeklySummary` merekap minggu lengkap sebelumnya (Senin–Minggu), memakai zona waktu spreadsheet dan status laporan saat rekap dijalankan; bukan snapshot historis status pada akhir minggu.

Sesi berlaku 8 jam. Menonaktifkan akun, mengganti peran, atau reset password membatalkan sesi akun terkait. Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan perannya. Pengguna dengan tugas belum selesai perlu dialihkan tugasnya sebelum dinonaktifkan atau berganti peran. Admin dapat menunjuk Pelapor atau Petugas aktif sebagai PIC per kasus. Delegasi tidak mengubah peran akun dan tidak memberi akses ke seluruh laporan. Setelah penugasan dialihkan, akses PIC lama dicabut; akses sebagai pemilik laporan tetap berlaku.

## Batas versi ini

Lampiran, email/push notification, pemulihan password mandiri, dan sinkronisasi laporan offline belum tersedia. Reset password dilakukan admin. Pemasangan PWA tetap tersedia, tetapi data laporan membutuhkan internet. Apps Script dan Sheets masih bergantung pada kuota layanan; evaluasi database khusus jika jumlah pengguna dan transaksi meningkat.

Tes otomatis menggunakan spreadsheet tiruan, tanpa mengubah spreadsheet operasional. Deployment Apps Script, pengisian secret Vercel, dan bootstrap akun asli harus dilakukan oleh pengelola sesuai langkah di atas.

Pemeriksaan lokal: `npm run lint`, `npm test`, `npx tsc --noEmit --incremental false`, dan `npm run build`. Setelah build, jalankan `node tests/api-integration.mjs` untuk menguji API melalui server Next production dan Apps Script tiruan pada port 3100/4100. Port tersebut harus kosong.
