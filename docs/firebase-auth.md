# Firebase untuk akun; Apps Script untuk data komplain

Login, password, sesi, nama, email, peran, Team Pelapor, status aktif, dan kewajiban mengganti password dikelola di Firebase Authentication. Metadata khusus aplikasi disimpan pada custom claims `komplainer`; klaim aplikasi lain dipertahankan. Firestore tidak diperlukan. Server membaca profil Firebase terbaru setiap permintaan agar perubahan peran/status langsung berlaku.

Admin yang dipilih: **zakzav@trial.com**, ditetapkan melalui `FIREBASE_ADMIN_UID`. Password akun Firebase yang sudah ada tidak diubah. Akun Firebase baru yang belum memiliki profil Komplainer mendapat peran Pelapor dengan status menunggu persetujuan Admin. Akun yang sudah aktif sebelumnya tetap aktif. Profil mendapat ID Komplainer yang stabil berdasarkan UID; UID hasil migrasi `komplainer:USR-...` mempertahankan ID lama.

## Environment server

```dotenv
AUTH_PROVIDER=firebase
FIREBASE_WEB_API_KEY=<firebaseConfig.apiKey project data-ok-b4091>
FIREBASE_ADMIN_UID=<UID akun Admin yang dipilih>
FIREBASE_SERVICE_ACCOUNT_PATH=<path absolut Admin SDK untuk lokal>
```

Di Vercel gunakan `FIREBASE_SERVICE_ACCOUNT_JSON` berisi JSON Admin SDK sebagai pengganti path lokal. Kredensial dan UID Admin sudah disiapkan sebagai secret Production/Preview. Jangan memakai NEXT_PUBLIC untuk kredensial Admin dan jangan commit JSON tersebut. Untuk menyiapkan profil Admin secara idempotent:

```bash
node scripts/setup-firebase-admin.mjs
```

## Apps Script hanya untuk laporan

1. Update `docs/appscript.gs` di editor proyek yang terhubung ke spreadsheet.
2. Pilih fungsi `setupKomplainer` lalu Run. Mode `DATA_ONLY = true` membuat header laporan, sheet Riwayat, dan Rekapan Mingguan. Tidak membuat akun Admin, sheet Pengguna, atau sheet Sesi. Sheet akun lama tidak dihapus, tetapi tidak digunakan dalam mode ini.
3. Perbarui deployment Web App ke versi baru. URL `/exec` dan API key tetap digunakan.
4. Server Next.js memverifikasi sesi Firebase dan mengirim profil/direktori peran terverifikasi pada POST data ke Apps Script. Input role dari browser tidak diteruskan sebagai sumber hak akses. APP_API_KEY tetap diperlukan untuk memastikan hanya server aplikasi yang bisa menggunakan endpoint.

Login dan menu Pengguna tidak bergantung pada Apps Script. Jika Apps Script belum diperbarui, pengguna tetap dapat login, tetapi pemuatan/penyimpanan laporan akan gagal sampai versi data-only dideploy.

## Pengguna dan password

- Gunakan email dan password akun Firebase yang sudah ada, termasuk `zakzav@trial.com`. Tidak perlu akun login dalam Google Sheet.
- Menu Pengguna membuat akun baru di Firebase. Password sementara wajib diganti sebelum mengakses laporan.
- Reset password memperbarui password akun Firebase yang sama, mencabut sesi lama, dan mengaktifkan kewajiban ganti password.
- Nama/email dikelola lewat Firebase Auth; peran dan Team Pelapor lewat klaim `komplainer`. Admin utama dan admin aktif terakhir dilindungi. Sebelum perubahan peran atau nonaktif, Apps Script memeriksa apakah PIC masih memiliki kasus aktif.
- Batas custom claims Firebase adalah 1.000 byte. Jika Team Pelapor terlalu panjang atau klaim aplikasi lain sudah besar, aplikasi meminta nama team dipersingkat.
- Cookie HttpOnly berlaku delapan jam, memakai Secure pada produksi dan SameSite=Lax. Tidak ada token disimpan di localStorage. Logout menghapus sesi pada perangkat saat ini.
- Laporan lama tetap di Sheet. Akun Firebase dengan UID baru memiliki ID baru; admin dapat menugaskan ulang PIC laporan lama ke profil Firebase yang sesuai.

Label Team/Unit menjadi **Team Pelapor**. Key API `team` dan header historis `Team` dipertahankan agar data lama tidak bergeser.

Referensi: [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies).

## Pendaftaran mandiri dan persetujuan

- Pada layar masuk, pilih **Belum punya akun? Daftar Pelapor**. Isi nama, email, Team Pelapor, password minimal 6 karakter, dan konfirmasi password.
- Akun disimpan di Firebase Authentication dengan custom claims `approval: pending` dan peran `pelapor`. Role/approval dari request browser tidak dipercaya.
- Pelapor dapat masuk untuk melihat status pendaftaran, tetapi API data dan menu pengguna diblokir sampai status `approved`.
- Admin membuka **Pengguna → Menunggu persetujuan**, lalu memilih **Setujui sebagai Pelapor** atau **Tolak pendaftaran**. Akun yang ditolak tetap tidak dapat mengakses data dan dapat ditinjau ulang Admin.
- Pelapor menekan **Periksa status persetujuan** untuk membuka laporan setelah persetujuan. Status dibaca dari profil Firebase terbaru; token lama tidak dapat melewati aturan persetujuan.
- Akun yang dibuat langsung oleh Admin mendapat persetujuan otomatis dan tetap wajib mengganti password sementara.
- Signup menggunakan Firebase Auth REST API sehingga pembatasan pendaftaran Firebase tetap berlaku. Aplikasi tidak mengirim email persetujuan secara otomatis.
