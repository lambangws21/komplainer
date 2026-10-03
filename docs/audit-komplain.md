# Audit halaman komplain

Tanggal: 3 Oktober 2026. Cakupan: `src/app/komplain/page.jsx`, konfigurasi styling/lint terkait, dan pemeriksaan statis `src/app/api/komplain/route.js`.

## Temuan yang diperbaiki

| Prioritas | Temuan | Perbaikan |
| --- | --- | --- |
| Tinggi | Tailwind tidak memindai JSX sehingga banyak styling halaman tidak dihasilkan | Tambahkan ekstensi JS/JSX ke pola content tanpa menghapus konfigurasi lama |
| Tinggi | Error API diam-diam terlihat seperti nol laporan | Periksa status HTTP, status respons, dan format array; tampilkan error, retry, dan keterangan data terakhir |
| Tinggi | Konfirmasi hilang saat pengiriman; pengguna kehilangan feedback dan alur retry | Pertahankan dialog saat proses/gagal, tampilkan status, nonaktifkan kontrol saat proses, cegah pemanggilan mutasi bersamaan |
| Sedang | Modal tanpa fokus terkelola, label input, atau dukungan keyboard | Gunakan Radix Dialog, title/description, focus trap, Escape, pemulihan fokus, dan label input terhubung |
| Sedang | Teks 10–12 px, tombol aksi kecil, layout desktop dibatasi max-w-md | Perbesar tipografi/kontrol, layout max-w-5xl, kolom responsif, dan modal scroll pada tinggi layar terbatas |
| Sedang | Filter dapat berhimpitan, daftar tidak punya pencarian/tanggal/empty state | Filter membungkus, pencarian lintas kolom, tanggal berformat Indonesia, empty state dan reset |
| Sedang | Tanggal awal memakai UTC dan textarea memakai rows pecahan | Gunakan tanggal lokal browser dan rows integer |
| Sedang | Null status bisa menyebabkan crash; klasifikasi tak dikenal ditampilkan sebagai C3 | Badge aman dengan fallback klasifikasi; filter level eksplisit |
| Sedang | Isian spasi lolos required, perubahan menggunakan uji truthy pada ID | Trim sebelum tinjauan, tolak isian kosong, tangani ID nol |
| Rendah | PIN dibocorkan lewat placeholder dan akses tidak bisa dikunci kembali | Hilangkan PIN dari placeholder, tambah tombol kunci dan pesan validasi aksesibel |
| Rendah | ESLint mengabaikan page.jsx | Tambahkan cakupan JS/JSX secara eksplisit |

## Temuan yang masih memerlukan pekerjaan lanjutan

1. **Tinggi — autentikasi server belum tersedia.** PIN `1234` tersimpan di kode klien. GET dan POST `/api/komplain` tidak memeriksa sesi/otorisasi. Menutup tab Data Master atau menghapus placeholder PIN tidak melindungi data; pengunjung dapat membaca endpoint atau memanggil update/delete langsung. Implementasikan sesi server dan otorisasi untuk baca/ubah/hapus sesuai peran. Keputusan akun/peran belum ditentukan dalam proyek ini.
2. **Sedang — validasi server terbatas.** Route POST hanya memeriksa keberadaan `action`, belum whitelist action, skema field, format tanggal, klasifikasi, dan ID. Validasi UI dapat dilewati. Tidak mengubah kontrak Google Apps Script pada audit UI ini.
3. **Sedang — penanganan retry mutasi.** Jika server menyimpan tetapi respons hilang, retry create dapat membuat duplikat. Kunci UI hanya mencegah klik bersamaan dalam halaman, bukan menjamin idempotensi server. Tambahkan request ID dan deduplikasi di backend.
4. **Rendah — draft belum persisten.** Menutup dialog lalu memulai laporan baru atau me-reload menghapus draft. Untuk formulir panjang, pertimbangkan penyimpanan draft dengan kebijakan retensi yang sesuai sensitivitas data.

## Verifikasi

- ESLint `src/app/komplain/page.jsx`: lolos, tanpa warning/error setelah cakupan JSX diperbaiki.
- Preview `/komplain`: berhasil dikompilasi pada dev server dan tampil di browser; data GET berhasil dimuat.
- Visual desktop dan viewport ponsel 375 × 812: styling, modal, dan tinjauan diperiksa. Override viewport dikembalikan setelah pemeriksaan.
- Isi form simulasi → tinjau → ubah lagi: seluruh isian tetap tersedia. Escape menutup dialog dan fokus kembali ke tombol pembuka.
- Tidak menjalankan create/update/delete terhadap Google Sheets; mutasi dan error jaringan belum diverifikasi end-to-end.
- `npm run build`: gagal karena `next/font` di `src/app/layout.tsx` tidak dapat mengunduh Geist/Geist Mono (`ENOTFOUND fonts.googleapis.com`). Build produksi belum dinyatakan lolos.

## Pembaruan tabel dan rekap mingguan

- Data Master kini memiliki tabel desktop, kartu pada layar di bawah breakpoint md, pengurutan tanggal, pagination 10 laporan, filter periode/keparahan, pencarian, dan dialog detail lengkap. Tombol edit/hapus tetap memakai alur sebelumnya.
- Rekap mingguan menggunakan Senin–Minggu berdasarkan tanggal kejadian sebagai tanggal kalender, tanpa menggeser timestamp ke zona waktu lain. Pemilih tanggal otomatis memilih minggu yang memuat tanggal tersebut.
- Ringkasan: total, selisih jumlah dibanding minggu sebelumnya (bukan persentase), jumlah C1/C2, jumlah tim/unit, distribusi tujuh hari, dan komposisi tingkat keparahan. Rekap menghitung seluruh laporan periode dan tidak dipengaruhi pencarian/filter tabel. Laporan dengan tanggal invalid tetap tersedia di tabel semua tanggal, tetapi dikecualikan dari rekap dengan pemberitahuan.
- Tombol lihat laporan membuka tabel dengan periode rekap yang sama dan mengembalikan fokus ke kontrol Data tabel.
- `node --test src/app/komplain/weekly-summary.test.mjs`: empat pengujian lolos, mencakup batas Senin/Minggu, pergantian tahun, leap day/tanggal invalid, timestamp, pengelompokan periode sebelumnya, dan minggu kosong.
- ESLint untuk halaman, komponen data, helper, serta pengujian: lolos.
- Browser desktop: data tabel, jumlah rekap, perpindahan minggu/empty state, tautan ke tabel periode, detail dan pemulihan fokus Escape diverifikasi. Tampilan rekap juga diperiksa pada viewport 390 × 844; override dikembalikan setelah pemeriksaan.
- Pemeriksaan ini hanya membaca data backend. Tidak menjalankan mutasi Google Sheets. Batas build produksi yang dicatat sebelumnya masih berlaku.

## Perbaikan deployment Vercel (3 Oktober 2026)

- ERESOLVE diperbaiki dengan `cmdk` 1.1.1 (mendukung React 19), `react-day-picker` 8.10.2 (mendukung React 19 tanpa migrasi API kalender), serta `date-fns` 3.6.0 yang memenuhi peer dependency DayPicker v8. Package-lock diperbarui dengan npm biasa, tanpa --force atau --legacy-peer-deps.
- Next.js dan eslint-config-next diselaraskan ke 15.5.27; React/react-dom ke 19.0.4.
- Komponen kalender dashboard sebelumnya mengimpor dan merender dirinya sendiri sehingga prerender kehabisan memori. Kini menggunakan komponen Calendar UI.
- Error lint pada konstanta toast dan import plugin Tailwind diperbaiki. `npm run lint` kini menjalankan ESLint langsung dan mengabaikan direktori hasil build.
- Verifikasi: npm ci tanpa bypass peer dependencies berhasil; npm run lint dan tujuh pengujian berhasil; npm run build produksi berhasil untuk semua rute. Hambatan build Google Fonts yang dicatat pada pemeriksaan sebelumnya tidak terjadi pada build dengan akses jaringan ini.
