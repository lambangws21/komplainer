# Login Firebase untuk Komplainer

Firebase Authentication menyimpan password dan memvalidasi sesi login. Profil (nama, Team Pelapor, peran, status aktif, kewajiban mengganti password) tetap di sheet Pengguna; laporan, PIC, dan riwayat tetap di Google Sheets. Aplikasi membaca peran terbaru dari Sheet pada setiap permintaan, bukan dari input browser.

## Aktivasi

1. Update kode `docs/appscript.gs` pada proyek Apps Script, lalu perbarui deployment Web App. URL `/exec` dan APP_API_KEY tetap dipakai.
2. Aktifkan Email/Password pada Firebase Console → Authentication → Sign-in method. Project yang digunakan: `data-ok-b4091`.
3. Isi environment server berikut (jangan memakai awalan NEXT_PUBLIC untuk kredensial Admin):

   ```dotenv
   AUTH_PROVIDER=firebase
   FIREBASE_WEB_API_KEY=<firebaseConfig.apiKey dari project yang sama>
   FIREBASE_SERVICE_ACCOUNT_PATH=<path absolut file Admin SDK untuk lokal>
   ```

   Di Vercel gunakan `FIREBASE_SERVICE_ACCOUNT_JSON` berisi seluruh isi JSON Admin SDK, menggantikan path lokal. Jangan commit file JSON atau nilai environment. Konfigurasi lokal telah memakai file di proyek template yang diberikan.

4. Set `AUTH_PROVIDER=firebase` di Vercel **setelah deployment Apps Script diperbarui**, kemudian deploy ulang aplikasi. Tanpa flag ini, deployment tetap memakai alur lama agar aktivasi dapat dilakukan bertahap.

## Akun lama dan akun baru

- Login pertama akun lama memverifikasi password lama, membuat akun Firebase, memverifikasi hasil login Firebase, lalu mengganti hash di Sheet dengan penanda ID Firebase. ID pengguna Komplainer tetap sama, sehingga laporan dan delegasi PIC tetap terhubung.
- Pengguna Firebase diberi UID `komplainer:USR-...`. Aplikasi tidak mengambil alih akun Firebase milik aplikasi lain. Email yang sudah dipakai akun lain akan ditolak; admin perlu memilih email lain atau memakai project Firebase terpisah.
- Username awal `lambangws` tetap bisa dipakai di layar login. Firebase menggunakan alamat internal `lambangws@komplainer.invalid`; alamat ini bukan tujuan pengiriman email.
- Akun baru dan reset password dikelola melalui menu Pengguna. Password sementara wajib diganti. Setelah password diubah/reset, sesi Firebase lama dicabut.
- Jika sinkronisasi profil Firebase gagal sesudah Sheet diperbarui, pesan akan menyatakan profil sudah tersimpan; perbaiki bentrok email lalu simpan ulang. Jangan mengubah UID langsung di Firebase Console.
- Keluar menghapus cookie sesi pada perangkat saat ini. Cookie HttpOnly berlaku delapan jam; API memverifikasi tanda tangan Firebase dan pencabutan sesi. Tidak ada token yang disimpan di localStorage.
- Jika create akun mengalami timeout setelah akun Firebase dibuat, periksa menu Pengguna sebelum mengulang. Akun yatim yang belum memiliki profil tidak dapat mengakses data; admin dapat menghapus UID tersebut melalui Firebase Console.

## Data komplain

Label `Tim / unit` berubah menjadi **Team Pelapor**. Key API `team` dan header historis `Team` tetap digunakan untuk menjaga kompatibilitas data lama. Label profil akun `Unit` juga menjadi **Team Pelapor**; key internal tetap `unit`.

Firebase Admin SDK adalah kredensial server. Database Firestore tidak diperlukan untuk alur ini. Referensi: [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies), [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth).
