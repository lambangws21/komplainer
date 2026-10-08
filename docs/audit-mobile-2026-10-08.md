# Audit Komplainer — 8 Oktober 2026

Audit kode, pengujian otomatis, dan pengujian UI melalui Chrome dengan viewport mobile. Semua mutasi memakai fixture lokal di memori, bukan Google Sheet atau akun Firebase produksi.

## Temuan dan perbaikan

| Temuan | Perbaikan |
| --- | --- |
| Login melalui IP lokal ditolak karena URL internal Next.js berbeda dari host browser | Asal permintaan dibandingkan dengan Host aktual beserta port; origin asing, port berbeda, dan `cross-site` tetap ditolak. |
| Fokus galeri foto tidak berpindah ke preview dan tidak kembali ke thumbnail setelah ditutup | Autofocus modal digunakan dan fokus kembali ke thumbnail pembuka. |
| Admin/PIC membuka modal detail lama yang panjang, sementara Pelapor menggunakan modal baru | Tombol detail membuka modal Ringkasan / Isi laporan / Riwayat untuk semua peran. Dari footer, Admin dapat menentukan PIC dan PIC/Admin dapat langsung membuka formulir tindak lanjut. |
| Formulir dapat kehilangan tombol tinjau saat input fokus; referensi state lama berpotensi menimbulkan error saat membuka form | Footer tetap terlihat; referensi state yang sudah dihapus dibersihkan. ESLint `no-undef` diaktifkan pada JSX Komplainer. |
| Toggle Selesai memiliki input tersembunyi yang sulit diketuk | Input asli menutupi area sentuh setinggi 44 px, dengan nama aksesibel. Klik dan keyboard berhasil diuji. |
| Navigasi Admin dan banner instalasi menghabiskan banyak ruang | Navigasi tiga kolom satu baris dan banner instalasi ringkas di mobile. |
| Ukuran kontrol mengecil saat browser memakai font dasar kecil | Tombol/menu memiliki area sentuh minimal 44 px; input mobile 16 px dan teks kecil minimal 12 px. |
| Setelah simpan/penugasan, pengguna mendapat popup tambahan untuk perubahan yang baru dilakukan sendiri | Refresh setelah mutasi mengabaikan popup untuk laporan yang baru diubah; laporan lain tetap dapat memicu notifikasi. |
| Proxy foto hanya memeriksa bentuk cookie/sesi, belum persetujuan akun | Sesi diverifikasi; akun pending/rejected dan akun wajib mengganti password ditolak. Respons foto memakai `private, no-store`. |
| Perubahan profil akun pending dapat menyalin `active: false` hasil proyeksi ke metadata dan mengunci login berikutnya | Status pending/rejected dipertahankan tanpa menonaktifkan metadata akun. Akses laporan tetap diblokir sampai disetujui. |
| Memori gambar/preview tertahan setelah dihapus, disimpan, atau logout | Bitmap ditutup setelah proses canvas, URL sementara dibersihkan, preview dihapus saat sesi berakhir. |
| Panduan menyiratkan data dapat dipakai offline dan implant masih rencana | Panduan menjelaskan kebutuhan internet, persetujuan pendaftaran, dan identifikasi implant yang sudah tersedia. |

Perbaikan tabel dan riwayat dalam rangkaian ini juga mencakup klasifikasi kondisi/keparahan yang terpisah, kartu mobile satu laporan per halaman, menu aksi, dan pencatatan nilai sebelum–sesudah di `docs/appscript.gs`.

## Verifikasi

- `npm test`: 59 pengujian lulus, termasuk Apps Script, otorisasi/peran, versi laporan, idempotensi, batas foto, metadata/login Firebase, persetujuan Pelapor, password enam karakter, CSV, rekap, kompresi foto, dan PWA.
- `npm run build`: berhasil.
- `npm run lint`: tanpa error; empat warning `<img>` pada komponen foto masih ada.
- `npm run test:api`: Next.js produksi + Apps Script fixture lokal. Menguji login salah/benar, same-origin, cookie HttpOnly/SameSite/Secure, sesi, login melalui IP lokal, create/update/detail/riwayat, konflik versi, assign, PIC follow-up/Selesai, solusi wajib, reopen/arsip, akses antarperan, tambah/edit/reset akun, password sementara dan pergantian password enam karakter, otorisasi foto termasuk cookie palsu, serta logout.
- Browser: login Admin/Pelapor/PIC, eye password, create → tinjau → gangguan simpan → retry, edit dan nilai sebelum–sesudah, penugasan PIC, selesai, buka kembali, arsip, menu aksi, filter/empty state/reset, pencarian, pagination, rekap mingguan/bulanan, halaman Pengguna, pengambilan kasus oleh PIC, panduan fitur, pemilihan/kompresi/hapus foto, dua foto sekaligus, preview galeri dan navigasi foto, serta penyimpanan laporan dengan foto ke fixture.
- Viewport: 390×844, 375×812, 320×568, 844×390 landscape, serta 1280×800 desktop. Tidak ditemukan overflow horizontal halaman pada viewport mobile yang diuji. Pada 320×568, isi modal lebih panjang daripada viewport dan berhasil digulir; tombol tutup tetap di dalam layar. Form memiliki teks input 16 px dan tombol tinjau tetap terlihat saat input fokus.

## Batas pengujian

- Firebase live tidak dibuat/diubah demi pengujian. Login/profil/persetujuan Firebase diperiksa melalui kode dan unit test; rangkaian HTTP/browser memakai mode akun fixture lokal. Pendaftaran dan approval melalui layanan Firebase produksi belum diuji end-to-end dalam audit ini.
- Pemilihan file sempat ditolak oleh izin ekstensi Chrome; setelah koneksi diperbarui, pemilihan berkas, kompresi JPEG, preview/hapus, dua foto sekaligus, galeri, dan penyimpanan ke fixture berhasil diuji. Kamera/picker perangkat fisik dan penyimpanan/pembacaan Google Drive produksi belum diverifikasi.
- Viewport Chrome bukan perangkat iOS/Android asli. Instalasi PWA dan keyboard Safari/Chrome pada perangkat fisik masih perlu smoke test. Service worker/offline fallback diperiksa melalui pengujian otomatis.
- Konten panjang tetap membutuhkan scroll atau membuka bagian yang relevan; tidak semua isi laporan dapat dijamin muat dalam satu layar.
- Nilai sebelum–sesudah untuk edit baru di Google Sheet memerlukan deployment `docs/appscript.gs` terbaru. Riwayat lama tanpa snapshot tidak dapat direkonstruksi oleh UI.

## Menjalankan ulang

```sh
npm run build
npm test
npm run test:api
npm run test:ui:local
```

Harness UI membuka layanan di `http://localhost:3105/komplain`. Akun fixture: `admin@example.test`, `reporter@example.test`, dan `pic@example.test`; password semuanya `Local-test-only-2026!`. Ini bukan akun produksi. Hentikan harness dengan Ctrl+C setelah selesai.
