# Firebase utama + Apps Script sebagai cadangan

## Audit 9 Oktober 2026

Endpoint backup produksi kini merespons `komplainer-backup-v1` dan write lock sumber lama aktif. Konfigurasi lokal menggunakan `DATA_PROVIDER=firestore` dan backup aktif. Pemeriksaan langsung menemukan 17 laporan Firestore, sementara sumber lama berisi 16 laporan dan 51 entri riwayat: tidak ada ID laporan/riwayat sumber yang hilang, marker migrasi tertunda, atau perbedaan versi sumber. Semua 52 pekerjaan backup berstatus done, tanpa pending/processing/failed. API produksi untuk sesi/laporan/backup/cron menolak permintaan tanpa otorisasi dengan HTTP 401. Pemeriksaan ini belum membuktikan seluruh alur produksi setelah login atau eksekusi cron terjadwal.

Pemeriksaan mirror: semua 17 laporan Firestore ditemukan pada Firebase Backup, versi dan ID riwayat cocok; 8 foto laporan tersedia di Storage. Backup berisi 18 laporan: satu entri tambahan ID-00d4d4ba-99b5-43d7-b9f9-f8f1cd4ecb55 (versi 1, bukan arsip, 1 riwayat) tidak ditemukan di koleksi utama saat audit. Penyebab belum diketahui; tidak dihapus atau dipulihkan otomatis.

76 unit test dan integrasi API fixture lulus. Fixture API kini mengatur DATA_PROVIDER secara eksplisit agar tidak terpengaruh konfigurasi lokal Firestore. Catatan status awal di bawah dipertahankan sebagai riwayat sebelum aktivasi.

## Status implementasi awal

Backend Firestore, penyimpanan foto Firebase Storage, transaksi riwayat/antrean backup, retry, panel Admin, cron, endpoint Apps Script, serta alat migrasi tersedia. Mode produksi belum dialihkan: default `DATA_PROVIDER=apps-script`. Endpoint Apps Script yang aktif pada 8 Oktober 2026 belum menerima `backupHealth` (403), sehingga migrasi produksi belum dijalankan.

Akses editor proyek `1pE02u3LivV-6htZIWY8F55-CNaNQZtszHXROW2STtXgNl648o6yLtxad` telah diperoleh melalui Sheet Komplain dan feedback. Deployment ID cocok dengan endpoint aplikasi. Isi Code.gs sebelum perubahan dibandingkan dengan file lokal; perubahan hanya endpoint backup dan maintenance lock. Kode baru sudah tersimpan dan salinannya diverifikasi sama dengan `docs/appscript.gs`. Pembaruan deployment tertahan pada otorisasi Google (peringatan aplikasi belum diverifikasi); pengguna perlu menyelesaikan izin di Chrome. Deployment versi 27 masih menjadi versi aktif sampai proses itu berhasil.

Firebase project `data-ok-b4091` sudah memiliki Firestore Native di `asia-southeast2` dan bucket `data-ok-b4091.firebasestorage.app` di `US-CENTRAL1`. Lokasi yang sudah ada dipertahankan. Akun/password/peran/persetujuan tetap dikelola Firebase Authentication dan custom claims; password tidak diekspor ke Sheet.

## Alur

API yang sekarang dipertahankan. `DATA_PROVIDER=firestore` mengalihkan laporan ke koleksi `komplainer_reports`. Setiap mutasi menyimpan laporan, subkoleksi `history`, dan pekerjaan `komplainer_backup_jobs` dalam satu transaksi. Versi lama ditolak (409); create retry menggunakan ID dari requestId. Foto diunggah sebelum transaksi; unggahan yang gagal dipakai dibersihkan. Ada batas foto dan pembatasan create per pengguna di `komplainer_limits`.

Foto Firebase disajikan lewat `/api/photo?report=…&path=…`, setelah pemeriksaan sesi, approval, kewajiban ganti password, dan akses ke laporan/foto terkait. Tidak dibuat URL download publik atau token permanen. Akun Pelapor yang ditugaskan sebagai PIC hanya memiliki hak PIC pada kasus itu.

Pengiriman backup memakai Next.js `after()` setelah respons, dengan antrean persisten sebagai sumber pekerjaan. Cron Vercel pukul 00:00 UTC / 08:00 WITA setiap hari menangani retry jika percobaan pertama gagal. Jadwal harian kompatibel dengan batas Hobby; ini bukan jaminan retry setiap menit. Admin dapat menjalankan pengiriman ulang; `npm run backup:sync -- --force` dapat menghabiskan antrean sebelum cutover. Jika jumlah laporan besar, gunakan worker terjadwal lebih sering pada paket yang mendukungnya.

Worker menggunakan lease/token sehingga dua proses tidak menyelesaikan pekerjaan yang sama secara tidak konsisten. Timeout meninggalkan pekerjaan yang dapat diambil ulang setelah lease habis. Retry memiliki jeda bertambah. Apps Script menolak versi lama untuk mirror, tetapi tetap menyimpan snapshot versi tersebut. Event/riwayat dan foto dideduplikasi.

Sheet cadangan terpisah dari data lama:

- `Firebase Backup`: kondisi terbaru, termasuk arsip.
- `Firebase Riwayat`: audit perubahan.
- `Firebase Snapshots`: snapshot per peristiwa/versi, tanpa menimpa salinan lama.
- `Firebase Foto`: pemetaan Storage path ke berkas Drive. Foto baru dicopy ke Drive; tidak dibuat publik oleh kode backup. Foto lama yang diimpor mempertahankan Drive ID sumber sebagai cadangan.

Ini tidak melakukan failover otomatis ke Sheet dan tidak menyinkronkan edit manual Sheet ke Firestore. Penghapusan permanen data/pekerjaan melalui Console dapat merusak cadangan yang belum dikirim; backup Firebase terjadwal/PITR terpisah dapat dipertimbangkan untuk perlindungan tambahan.

## Konfigurasi

Environment server (bukan NEXT_PUBLIC):

```dotenv
AUTH_PROVIDER=firebase
DATA_PROVIDER=apps-script
FIREBASE_STORAGE_BUCKET=data-ok-b4091.firebasestorage.app
FIREBASE_BACKUP_ENABLED=false
CRON_SECRET=<rahasia-acak-minimal-32-karakter>
```

Kredensial Admin SDK, Firebase Web API Key, admin UID, GOOGLE_SCRIPT_URL, dan GOOGLE_SCRIPT_API_KEY tetap memakai konfigurasi yang sekarang. Bucket dan CRON_SECRET telah disiapkan di `.env.local`; mode lama tetap aktif. Rahasia tidak dimasukkan ke git. Env Vercel belum diubah dalam pekerjaan ini.

Gunakan snippet aturan dalam `docs/firebase/` untuk digabung ke rules project yang sudah ada. Jangan mengganti rules seluruh project karena project juga dipakai aplikasi lain. Admin SDK melewati rules; semua akses UI melewati API yang memeriksa hak akses. Pastikan wildcard permisif tidak membuka koleksi Komplainer atau objek `/komplainer/`, dan bucket IAM tidak memberi `allUsers`/`allAuthenticatedUsers` akses publik. Rules/IAM produksi belum diubah atau diverifikasi menyeluruh dalam audit ini; lakukan sebelum aktivasi.

## Migrasi dan cutover

1. Perbarui Code.gs proyek yang **deployment ID-nya cocok** dengan GOOGLE_SCRIPT_URL menggunakan `docs/appscript.gs`. Deploy versi baru pada deployment yang sama. APP_API_KEY, SPREADSHEET_ID, COMPLAINT_SHEET_NAME, dan DRIVE_FOLDER_ID dipertahankan. Jangan mengganti skrip proyek lain yang kebetulan bernama serupa.
2. Jalankan `npm run migrate:firestore` (dry-run). Endpoint ekspor mencakup laporan aktif, arsip, dan audit mentah dengan pagination. Mode ini tidak menulis data.
3. Siapkan konfigurasi/rules, waktu maintenance, dan deployment aplikasi untuk cutover. Jalankan `npm run migrate:firestore -- --apply --keep-write-lock`. Skrip mengunci mutasi lama pada Apps Script, menyimpan snapshot sumber privat di `.local-backups/`, lalu menyalin laporan/riwayat dan foto. Snapshot lokal gitignored.
4. Import dilakukan bertahap dengan marker `migrationPending` agar data sebagian tidak tampil. Restart migrasi dapat melanjutkan sumber yang sama. Data Firestore yang berbeda dari sumber tidak ditimpa. Verifikasi jumlah/isi riwayat serta ekspor ulang sumber wajib berhasil. Kegagalan melepaskan lock yang baru dipasang; lock yang sudah ada dipertahankan. Jika tidak memakai `--keep-write-lock`, source akan dibuka kembali dan perlu rekonsiliasi sebelum cutover.
5. Jalankan `npm run backup:sync -- --force`, lalu pastikan antrean awal selesai dan salinan Google Sheet/Drive benar.
6. Atur `DATA_PROVIDER=firestore`, `FIREBASE_BACKUP_ENABLED=true`, FIREBASE_STORAGE_BUCKET, dan CRON_SECRET pada Vercel/lokal, lalu deploy/restart. Pertahankan `FIRESTORE_WRITE_LOCK=true` pada sumber lama untuk mencegah penulisan dari deployment lama. Cron hanya berjalan setelah deployment produksi Vercel dengan vercel.json dan CRON_SECRET.
7. Uji login per peran, approval, buat/edit/assign/follow-up/reopen/archive, foto, riwayat, serta status backup. Google Sheet asli tidak dihapus.

Rollback tidak cukup mengganti DATA_PROVIDER setelah Firestore menerima perubahan baru: rekonsiliasi dulu perubahan terbaru dari `Firebase Backup`/snapshot dan foto. `npm run migrate:firestore -- --source-backup` menyediakan dry-run sumber backup untuk rencana pemulihan. Tidak ada restore otomatis yang menimpa data aktif.

## Verifikasi yang telah dijalankan

### Pemisahan solusi awal dan hasil penanganan

Laporan baru menyimpan `solusiAwal` pelapor terpisah dari `jalanKeluar` hasil penanganan PIC. Form tindak lanjut tidak menyalin solusi awal menjadi hasil penyelesaian. Untuk data lama berstatus Baru, solusi awal masih dapat dibaca dari kolom lama; hasil laporan lama yang sudah diproses tidak dianggap sebagai solusi awal.

Versi lokal `docs/appscript.gs` menambahkan kolom ke-24 **Solusi Awal** secara otomatis tanpa menggeser 23 kolom sebelumnya. Publikasikan versi skrip ini pada deployment Apps Script yang aktif agar kolom mirror backup ikut menyimpan field baru. Perubahan file lokal tidak memperbarui deployment Apps Script secara otomatis.

- Unit test domain/otorisasi, idempotensi, konflik versi, kelengkapan solusi, delegasi Pelapor, batas foto, transaksi laporan/riwayat/outbox, retry, cron secret, snapshot/mirror, deduplikasi foto/audit, ekspor arsip, maintenance lock, dan dry-run migrasi.
- Live smoke test dengan koleksi `audit_<uuid>_*` sementara di project yang sama: CRUD, create retry, konflik transaksi bersamaan, foto Storage, pemeriksaan foto per laporan, delegasi Pelapor sebagai PIC, completion, dan archive. Koleksi/objek sementara dibersihkan. Tidak membuat/mengubah akun Auth atau laporan produksi.
- Uji integrasi HTTP Next.js mode Apps Script fixture untuk regresi API lama.
- Build dan lint. Pengiriman backup ke Apps Script produksi, migrasi semua data lama, aturan produksi, dan login/browser mode Firestore produksi masih menunggu aktivasi.

```sh
npm test
npm run build
npm run test:api
# Menulis/menghapus data disposable di project Firebase yang dikonfigurasi:
npm run test:firestore:live
```
