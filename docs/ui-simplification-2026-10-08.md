# Penyederhanaan UI Komplainer

Perubahan hanya pada UI dan penyimpanan draft lokal. Endpoint, payload laporan, Firebase, Apps Script, dan struktur Google Sheet tetap sama.

- Beranda sesuai peran, satu ringkasan, maksimal tiga laporan per bagian; laporan yang tampil pada bagian tindakan tidak diulang pada laporan terbaru.
- Kolom wajib tampil dahulu. Solusi awal, rencana tindak lanjut, dan foto berada dalam bagian informasi opsional. Bagian otomatis terbuka jika memiliki isi saat form dibuka.
- Aksi utama mengikuti kasus dan hak akses: Tentukan PIC, Catat perkembangan, Lihat detail, atau Lihat penyelesaian. Detail/riwayat tetap tersedia di menu aksi.
- Filter cepat Semua, Tugas saya (tugas belum selesai), dan Lewat tenggat. Filter lengkap tetap tersedia.
- Simpan menutup form dan menampilkan pesan inline dengan tombol Lihat laporan, tanpa modal sukses tambahan.
- Latar kartu biasa netral; kasus lewat tenggat tetap ditandai. Label status dan peran tetap berwarna.
- Draft laporan baru disimpan per ID akun melalui localStorage; requestId tetap dipakai saat mencoba kirim ulang. Draft dipulihkan setelah menutup form atau memuat ulang halaman, dibersihkan setelah kirim berhasil atau sesi berakhir, dan dapat dihapus untuk memulai baru. Foto dan draft edit/tindak lanjut tidak disimpan lintas reload. Penyimpanan browser yang ditolak tidak menghalangi form.

Validasi: 61 tes otomatis lulus, build berhasil, lint tanpa error dengan empat warning komponen foto yang sudah ada. Pengujian Chrome viewport mobile memakai fixture lokal: form wajib/opsional, pemulihan teks termasuk rumah sakit setelah reload, kirim laporan, pesan berhasil tanpa modal, penghapusan draft setelah kirim, dan filter Tugas saya. Tidak ada mutasi akun atau laporan produksi.

## Pratinjau dan Rumah Sakit

Rumah Sakit sekarang wajib di form dan divalidasi bersama kolom wajib lain sebelum pratinjau. Tidak ada perubahan validasi server atau kontrak API. Pratinjau selalu menampilkan tiga pertanyaan pendukung untuk solusi awal, rencana tindak lanjut, dan foto, dengan status kelengkapan serta tombol Tambah/Ubah yang membuka informasi opsional dan memfokuskan kolom terkait. Ketiganya tetap opsional. Posisi scroll pratinjau kembali ke atas agar pertanyaan terlihat sejak awal. Uji browser memastikan kolom Rumah Sakit kosong ditolak, tombol Tambah solusi awal memfokuskan textarea, dan status berubah setelah diisi.

## Editor visual

Form laporan, catatan penugasan/buka kembali, solusi PIC, RTL, dan catatan tindak lanjut sekarang memakai editor visual Tiptap. Tombol Tebal, Miring, Garis bawah, dan Daftar bertitik menerapkan format langsung pada pilihan teks atau ketikan berikutnya. Status aktif terlihat; Urungkan/Ulangi tersedia. Format tersimpan sebagai marker teks yang sudah dipakai aplikasi, sehingga payload, API, dan Sheet tetap sama. Pembaca teks mendukung kombinasi bold/italic/underline. Konten editor berupa JSON dengan skema terbatas, tidak merender HTML mentah dari data laporan.

Validasi lanjutan: 64 tes lulus, build berhasil, lint tanpa error (empat warning foto). Uji Chrome mobile: kolom kosong wajib ditolak dan difokuskan dengan pesan; kombinasi tebal/miring/garis bawah; daftar; undo/redo; tombol tebal sebelum mengetik; format kembali ketika Ubah lagi dan memulihkan draft; kirim dan buka laporan dari fixture lokal. Perangkat fisik iOS/Android belum diuji langsung. Batas panjang mencakup marker format agar sesuai batas payload lama.
