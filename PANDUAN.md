# ALHUDA MOBILE — Panduan Pemasangan

Aplikasi manajemen administrasi & akademik YPI Dayah Al-Huda Malikussaleh.
Semua data tersimpan di **Google Sheets**. Aplikasi membaca dan menulis langsung ke sheet melalui **Google Apps Script**, jadi perubahan di sheet langsung tampil di aplikasi, dan sebaliknya.

```
alhuda/
├── apps-script/        ← kode server + tampilan aplikasi (ditempel ke Google Apps Script)
│   ├── Code.gs         ← backend: database Sheets, login, hak akses, PDF
│   ├── Seed.gs         ← data awal 292 santri + 4 guru
│   ├── Portal.gs       ← Live Portal + lampiran & balas chat (v2.3.0)
│   ├── Fitur.gs        ← Grup chat, Haris, Asrama, Kabilah, laporan PDF (v2.5.0)
│   ├── Index.html      ← tampilan aplikasi (login, 5 menu bawah, chat, tema)
│   └── appsscript.json ← pengaturan proyek
├── android/            ← proyek Android Studio (membungkus web app menjadi APK)
├── web/                ← versi web mandiri (Chrome, Safari, Firefox, Edge) — bisa dipasang seperti aplikasi
├── Daftar_Akun_Awal.csv← username & password awal semua pengguna
└── PANDUAN.md
```

---

## Langkah 1 — Buat Google Sheet + Apps Script

1. Buka **sheets.google.com**, lalu buat spreadsheet baru dengan nama `DATABASE ALHUDA MOBILE`.
2. Pilih menu **Ekstensi → Apps Script**.
3. Di editor Apps Script:
   - Ganti isi `Code.gs` dengan isi file **apps-script/Code.gs**.
   - Klik **＋ → Skrip**, beri nama `Seed`, lalu tempel isi **Seed.gs**.
   - Klik **＋ → HTML**, beri nama `Index` (tanpa .html), lalu tempel isi **Index.html**.
   - Klik **＋ → Skrip**, beri nama `Portal`, lalu tempel isi **Portal.gs**. File `Portal` harus berada di bawah `Code` pada daftar file.
   - Buka **Setelan proyek (ikon gerigi)**, centang *Tampilkan file manifes "appsscript.json"*, lalu ganti isinya dengan **appsscript.json**.
4. Pilih fungsi **`setupAwal`** di bilah atas, lalu klik **Jalankan**. Izinkan akses saat diminta (Lanjutan → Buka proyek).
   Langkah ini membuat 16 sheet, 17 kelas, 5 sesi, pengaturan, dan **296 akun**.

## Langkah 2 — Deploy sebagai Web App

1. Klik **Terapkan → Deployment baru → Jenis: Aplikasi web**.
2. Isi **Jalankan sebagai: Saya** dan **Yang memiliki akses: Siapa saja**.
3. Klik **Terapkan**, lalu salin **URL Web App** (berakhiran `/exec`).
4. Buka URL tersebut di HP. Aplikasi sudah bisa dipakai lewat browser.

> Setiap kali kode diubah: **Terapkan → Kelola deployment → Edit (pensil) → Versi: Versi baru → Terapkan**. URL tidak berubah.

## Langkah 3 — Buat APK Android

### Cara A — Tanpa Android Studio (lewat GitHub, gratis)
1. Buat akun di **github.com**, lalu buat repository baru (misalnya `alhuda-mobile`, boleh *Private*).
2. Buka file `android/app/src/main/res/values/strings.xml`, lalu ganti `GANTI_DENGAN_ID_DEPLOYMENT…` dengan URL Web App dari Langkah 2.

3. Unggah **seluruh isi folder `alhuda/`** ke repository. Folder tersembunyi `.github` harus ikut terunggah. Caranya: di halaman repo pilih **Add file → Upload files**, lalu seret semua isi folder.
4. Buka tab **Actions** di repo. Proses "Build APK ALHUDA MOBILE" berjalan otomatis selama ±5 menit.
5. Setelah selesai (tanda centang hijau), klik proses tersebut. Di bagian **Artifacts**, unduh **ALHUDA-MOBILE-APK**, lalu ekstrak zip-nya untuk mendapatkan `ALHUDA-MOBILE.apk`.
6. Kirim APK ke HP dan pasang. Izinkan *Instal dari sumber tidak dikenal* bila diminta.

Setiap kali ada perubahan pada folder `android/` yang diunggah ke repo, APK baru dibuat otomatis. Kode di `apps-script/` **tidak** memerlukan APK baru: cukup deploy versi baru di Apps Script.

### Cara B — Dengan Android Studio

1. Pasang **Android Studio**, lalu buka folder `android/`.
2. Buka `app/src/main/res/values/strings.xml`, lalu ganti `web_app_url` dengan URL dari Langkah 2.
3. (Opsional) Ganti ikon: **File → New → Image Asset**, lalu pilih logo dayah.
4. Pilih **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. File APK ada di `app/build/outputs/apk/`.
   Untuk dibagikan, sebaiknya pakai **Build → Generate Signed Bundle / APK**.

APK menambahkan fitur bawaan HP: notifikasi chat (juga saat aplikasi ditutup, diperiksa ±15 menit sekali), tombol kembali, unggah foto profil, serta membuka/membagikan PDF.

---

## Langkah 4 — Versi Web (Chrome, Safari, Firefox, Edge)

Folder `web/` adalah versi web mandiri. Versi ini tidak dibuka di dalam bingkai Google, sehingga tidak muncul error seperti
*"Maaf, file tidak dapat dibuka"*, gagal login saat beberapa akun Google masuk di browser, atau sesi hilang di Safari/iPhone.
Versi ini juga bisa **dipasang ke layar utama** (Android, iPhone, iPad, Windows, Mac) dan dibuka tanpa internet untuk data yang pernah dilihat.

1. Buka `web/config.js`, lalu pastikan `ALHUDA_API_URL` berisi URL Web App dari Langkah 2 (berakhiran `/exec`).
2. Unggah seluruh isi repo ke GitHub (seperti Langkah 3 Cara A).
3. Di repo, buka **Settings → Pages**. Pada **Source**, pilih **GitHub Actions**.
4. Buka tab **Actions**, lalu jalankan **Terbitkan Versi Web ALHUDA MOBILE** (otomatis berjalan setiap ada perubahan di `web/` atau `apps-script/Index.html`).
5. Setelah selesai, alamat aplikasi tampil di proses tersebut, misalnya `https://namaakun.github.io/alhuda-mobile/`. Bagikan alamat ini ke pengguna.

**Domain sendiri (misalnya www.damas.com):** di **Settings → Pages → Custom domain**, isi nama domain, lalu buat CNAME di pengelola domain yang mengarah ke `namaakun.github.io`. Centang **Enforce HTTPS**.

**Tanpa GitHub:** isi folder `web/` bisa diunggah ke hosting statis apa pun yang memakai **HTTPS** (Netlify, Cloudflare Pages, Firebase Hosting, atau cPanel). Tidak perlu PHP atau database.

Cara kerja:
- Tampilan diambil dari server Apps Script (`?app=html`), sama seperti APK. Jadi setiap kali Index.html dideploy ulang (Versi baru), versi web ikut diperbarui. Tampilan baru dipakai saat aplikasi dibuka berikutnya.
- Jika server belum bisa dihubungi saat pertama kali dibuka, versi web memakai salinan bawaan `web/app.html` (disalin otomatis dari `apps-script/Index.html` saat diterbitkan).
- Penyesuaian khusus browser ada di `web/compat.js`: tinggi layar iPhone, pilihan bulan di Safari Mac/Firefox, izin notifikasi, tombol Kembali, dan PDF di iPhone.

> Untuk mencoba di komputer sendiri: buka terminal di folder `web/`, jalankan `python -m http.server 8080`, lalu buka `http://localhost:8080`. Membuka `index.html` dengan klik dua kali (file://) tidak didukung.

---

## Logo pesantren
Unggah logo ke Google Drive, lalu buka **Bagikan → Siapa saja yang memiliki link**. Salin link atau ID file ke sheet **Pengaturan**:
- `logo_dayah`: logo di halaman login, kop raport Salafi, dan laporan keuangan
- `logo_wustha`, `logo_ulya`: logo pada kop raport PDF Wustha dan PDF Ulya

## Akun
- Username = nama depan (gelar seperti *Tgk.* dan inisial *M.* / *T.* dilewati), huruf kecil. Password = `namadepan123`.
- Jika ada nama depan yang sama, username diberi angka: `muhammad`, `muhammad2`, …. Password tetap `muhammad123`. Lihat **Daftar_Akun_Awal.csv**.
- Password yang diketik admin di sheet **Users** otomatis dienkripsi saat pengguna pertama kali login. Untuk mereset, ketik password baru di kolom `password`.
- Isi `Tidak` di kolom `aktif` untuk menonaktifkan akun.

## Hak akses
| Fitur | Yang boleh mengubah |
|---|---|
| Semua fitur, hapus data, nominal iuran/uang tahunan | Pengembang Aplikasi |
| Tambah/edit santri, guru, dan semua data | Admin |
| Roster pelajaran | Kabag Pendidikan, Kabag Administrasi |
| Absen santri | Guru yang mengajar di kelas & sesi tersebut (+ Kabag Pendidikan) |
| Absen jamaah | Kabag Jamaah |
| Absen guru, daftar mengulang malam | Kabag Pendidikan |
| Izin keluar sebentar | Kabag Humas |
| Perizinan pulang | Kabag Perizinan |
| Iuran, uang tahunan, saldo | Kabag Bendahara |
| Pengumuman | Kabag Media / Pendidikan / Humas |
| Nilai | Guru pengajar mapel di kelas itu, Kabag Pendidikan |
| Status naik kelas (semester 2) | Wali kelas, Kabag Pendidikan |

Santri hanya bisa melihat absensi, nilai, iuran, dan saldo miliknya sendiri. Isi Room Chat hanya bisa dilihat oleh pengirim dan penerima. Admin dan pengembang pun tidak bisa membacanya dari aplikasi.

**Wali kelas** ditentukan otomatis: guru yang mengajar sesi bertanda `wali_kelas = Ya` di sheet **Sesi** (19.30–22.00).

## Mengubah data langsung di Sheets
Semua sheet bisa diedit langsung, misalnya menambah kelas di sheet **Kelas** (kolom `jenjang`: Wustha / Ulya / Salafi) atau mengubah jam sesi di sheet **Sesi**. Jangan mengubah nama kolom pada baris pertama.
Tahun ajaran dan semester aktif diatur di sheet **Pengaturan** atau di menu **Pengaturan → Pengaturan Aplikasi**.


---

## Pembaruan v2.3.0 — Live Portal, Chat Lampiran, Roster Multi-Hari

Yang perlu dilakukan di Apps Script (**Code.gs tidak perlu diubah**):
1. Tambah file skrip baru bernama **`Portal`**, lalu tempel isi **apps-script/Portal.gs**. Pastikan letaknya di bawah `Code`.
2. Ganti isi **`Index`** dengan **apps-script/Index.html** yang baru.
3. **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan**.
4. APK tidak perlu dibuat ulang karena tampilan baru diunduh otomatis. Versi web diperbarui lewat GitHub Actions seperti biasa.

Isi pembaruan:
- **Live Portal di Beranda**: 5 aktivitas terbaru dan tombol *Lihat lainnya*. Aktivitas yang dicatat: top up saldo, iuran bulanan (bulan berturut-turut digabung menjadi "Januari s/d September"), absen, revisi absen, guru pengganti, izin pulang, kembali ke dayah, izin keluar, pelanggaran, input nilai, dan uang tahunan. Semua tersimpan di sheet baru **LogPortal**.
  Pada aktivitas keuangan dan pelanggaran, username disamarkan (`@u***`), kecuali bagi Admin, Pengembang Aplikasi, dan pemilik data itu sendiri.
- **Room Chat**: geser pesan ke kanan untuk membalas (di komputer: klik dua kali). Tombol 📎 untuk mengirim foto (maks. 5 MB), video (maks. 16 MB), dan dokumen (maks. 10 MB). File disimpan di Google Drive, folder *ALHUDA MOBILE - File / Chat*.
- **Roster**: pilihan hari bisa lebih dari satu. Mata pelajaran dipilih dari daftar mapel yang sudah ada, atau diketik bila belum ada.

---

## Pembaruan v2.4.0 — Story, Video Langsung Diputar, Emoji

Cara pasang sama seperti v2.3.0: ganti isi **`Portal`** dengan **Portal.gs** dan **`Index`** dengan **Index.html** yang baru, lalu **Terapkan → Kelola deployment → Versi baru**. Code.gs tetap tidak diubah.

- **Story (seperti status WhatsApp)** tampil di atas kolom pencarian Room Chat, diurutkan dari yang terbaru, dan hanya tampil selama 24 jam. Data tersimpan di sheet baru **Story**, sedangkan filenya ada di Drive folder *Story*. Story yang lewat 48 jam dihapus otomatis.
  - Story bisa berupa foto (tampil 5 detik) atau video (maks. 1 menit, langsung diputar). Satu pengguna boleh punya beberapa story.
  - Klik atau usap ke kanan untuk story berikutnya; setelah story terakhir, lanjut ke story pengguna lain. Usap ke kiri untuk story sebelumnya, tahan untuk menjeda, usap ke bawah untuk menutup.
  - Story bisa dibalas, dan balasannya masuk ke Room Chat pribadi pemilik story.
  - Privasi story: Semua pengguna, atau pilih Dewan Guru, kelas tertentu, dan/atau pengguna tertentu.
  - Story bisa dihapus oleh pemiliknya. Admin juga bisa menghapus story siapa pun.
- **Video di Room Chat** langsung diputar di dalam aplikasi. Kalau tautan Google Drive tidak bisa dibuka (misalnya diminta login), video dan foto diambil langsung dari server aplikasi tanpa meminta email.
- **Emoji** bisa dikirim di Room Chat dan di balasan story (tombol 😊).
- **Live Portal** sekarang menampilkan nama sebelum @username, misalnya *Tgk Guru Satu @guru1 mengabsen …*. Pada aktivitas yang disamarkan, hanya `@u***` yang tampil tanpa nama.

---

## Pembaruan v2.5.0 — Grup Chat, Daftar (Haris, Asrama, Kabilah), Laporan PDF

Cara pasang (**Code.gs tetap tidak diubah**):
1. Ganti isi file **`Portal`** dengan **Portal.gs** yang baru. Story sudah dihapus.
2. Tambah file skrip baru bernama **`Fitur`**, lalu tempel **Fitur.gs**. Urutan file harus `Code` → `Portal` → `Fitur`.
3. Ganti isi **`Index`** dengan **Index.html** yang baru.
4. Pilih **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan**.
5. Opsional: supaya pengingat Haris terkirim tepat pukul 18.00, buka ikon jam (**Pemicu**) → **Tambahkan Pemicu** → pilih fungsi `kirimPengingatHaris` → **Berbasis waktu** → **Timer harian** → **18.00 – 19.00**. Tanpa pemicu ini, pengingat tetap terkirim begitu ada pengguna yang membuka aplikasi setelah pukul 18.00.

Sheet baru dibuat otomatis: **Grup, GrupBaca, Haris, Asrama, AsramaDok, Kabilah**. Peran baru **Kabag Muzakir** juga ditambahkan.

- **Room Chat**
  - Story sudah dihapus.
  - Tombol **Buat Grup**: anggota bisa dipilih per pengguna, per kelas, atau semua Dewan Guru. Admin grup bisa mengganti nama, menambah anggota, dan mengeluarkan anggota.
  - Grup otomatis dibuat untuk setiap kelompok Haris, asrama, dan kabilah. Anggotanya mengikuti daftar masing-masing.
  - Tahan lama sebuah pesan untuk membuka menu: Balas, Teruskan, Salin, Unduh (foto/video/dokumen), Edit, dan Hapus. Pesan yang diteruskan diberi tanda "↪ Diteruskan". Penerima bisa dipilih lebih dari satu: pengguna, grup, kelas, atau semua Dewan Guru.
- **Menu "Daftar"** (dulu "Kelas & Guru") berisi tombol Daftar Kelas, Daftar Guru, Daftar Haris, Daftar Asrama, dan Daftar Kabilah.
- **Daftar Haris**
  - Diatur oleh Kabag Jamaah atau Kabag Algojo. Isinya hanya santri.
  - Tiap kelompok punya satu ketua, banyak anggota, dan hari jadwal. Masa tugas mulai pukul 18.00 sampai 18.00 esok harinya.
  - Saat masa tugas dimulai, sistem mengirim pengingat ke grup Haris kelompok tersebut, sehingga muncul notifikasi.
  - Haris yang sedang bertugas bisa mengabsen jamaah santri.
- **Daftar Asrama**
  - Asrama dibagi Santriwan dan Santriwati, dan ditambahkan oleh Kabag Asrama.
  - Nama, lokasi, keterangan, dan ketua bisa diubah oleh anggota asrama.
  - Daftar Piket, Grup Chat, dan Dokumentasi hanya bisa dibuka oleh anggota asrama.
- **Daftar Kabilah**: ditambahkan oleh Kabag Muzakir. Ketua dan anggota bisa guru maupun santri, dan setiap kabilah punya grup chat.
- **Absen Jamaah Santri**: bisa dilakukan oleh Kabag Jamaah atau Haris yang sedang bertugas. Statusnya Hadir, Izin/Sakit, atau Alpa, dan bisa dipilih per kelas atau per asrama.
- **Akademik → Iuran Bulanan / Uang Tahunan** (khusus Admin dan Bendahara): ada tombol cetak **PDF laporan semua santri**. Laporan dibagi per kelas dengan urutan Wustha, Ulya, lalu Salafi. Isinya Kelas, Wali Kelas, Nama, Bulan/Keterangan, Total, dan jumlah keseluruhan.
- **Pemberitahuan Hari Ini** di Beranda sekarang tampil untuk semua pengguna.

---

## Pembaruan v2.6.0 — Postingan, Catatan Haris, Notifikasi di HP

Cara pasang: ganti isi **`Fitur`** dengan **Fitur.gs** dan **`Index`** dengan **Index.html** yang baru, lalu pilih **Terapkan → Kelola deployment → Versi baru**. `Code` dan `Portal` tidak berubah. Sheet baru **Postingan, PostLike, PostKomentar, CatatanHaris** dibuat otomatis.

- **Notifikasi pesan baru** sekarang muncul di notifikasi HP, di bagian atas layar.
  - Di APK, pemberitahuan HP sudah aktif sejak awal.
  - Di versi web, aplikasi meminta izin notifikasi satu kali. Kalau izin belum diberikan, pemberitahuan tampil sebagai spanduk di bagian atas layar.
- **Pemberitahuan Hari Ini** dan **Live Portal** tidak lagi menampilkan bagian jamaah. Data jamaah sekarang ada di Catatan Haris.
- **Menu Daftar → Postingan**
  - Siapa saja bisa memposting teks, foto, video, atau dokumen. Postingan diurutkan dari yang terbaru.
  - Setiap postingan punya tombol Suka, Komentar, Bagikan (ke Room Chat atau WhatsApp), dan Chat.
  - Privasi bisa diatur: Dewan Guru, kelas tertentu, dan/atau santri tertentu.
  - Pemilik bisa mengedit dan menghapus postingannya. Admin juga bisa menghapus postingan siapa pun.
- **Menu Daftar → Haris Bertugas** sekarang menampilkan nama ketua dan anggota beserta kelasnya.
- **Catatan Haris**
  - Isinya daftar santri yang tidak berjamaah per masa tugas (18.00 – 18.00), dikelompokkan per waktu shalat: Nama – Kelas – Asrama, ditambah catatan yang diketik haris.
  - Catatan masa tugas yang sedang berjalan hanya terlihat oleh haris yang bertugas, Admin, Kabag Jamaah, dan Kabag Algojo.
  - Setelah haris berganti, catatan tampil untuk semua pengguna dan hanya bisa diubah oleh Admin, Kabag Jamaah, atau Kabag Algojo.
  - Di menu Daftar hanya tampil 3 masa tugas terakhir. Tombol *Lihat lainnya* menampilkan yang lebih lama.

---

## Pembaruan v2.6.1

Cukup ganti isi **`Index`** dengan **Index.html** yang baru, lalu pilih **Terapkan → Kelola deployment → Versi baru**. File `.gs` tidak berubah.
- Live Portal dipindah ke bagian paling bawah Beranda, di bawah *Jadwal Saya Hari Ini*.
- Absen Jamaah Santri langsung tampil tanpa memuat. Hak akses haris dan daftar santri per kelas dan per asrama disimpan di perangkat, lalu diperbarui sendiri di latar belakang. Status yang baru disimpan langsung tersimpan juga di perangkat.
- Data berikut juga disiapkan di perangkat sejak aplikasi dibuka, jadi langsung tampil: Daftar Haris, Catatan Haris, Asrama, Kabilah, Postingan, dan Live Portal.

## Pembaruan v2.7.0 — Pendaftaran Santri Baru, Verifikasi Data, Versi Komputer

**Cara memasang:**
1. Di Apps Script, tambahkan file skrip baru bernama **`Pendaftaran`** dan tempel isi `apps-script/Pendaftaran.gs`. Letakkan setelah `Fitur`. Urutannya: Code → Portal → Fitur → Pendaftaran.
2. Ganti isi `Index.html` dengan versi terbaru.
3. Pilih **Terapkan → Kelola penerapan → Edit → Versi baru → Terapkan**.
4. File Code, Portal, dan Fitur **tidak berubah**.
5. Sheet `Pendaftaran` dan `Verifikasi` dibuat otomatis.

**Fitur baru:**
- **Ikon unduh di header:** tampil hanya saat aplikasi sedang menyinkronkan data.
- **Sinkronisasi otomatis:** saat pertama dibuka, aplikasi mengunduh semua data sistem secara otomatis. Setelah itu data diperbarui di latar belakang setiap 2 menit, saat aplikasi dibuka kembali, dan saat koneksi kembali online.
- **Daftar Santri Baru:** tersedia di halaman login dan tidak memerlukan akun. Isian lembaga bersyarat:
  - PDF Wustha/Ulya → Asal Sekolah.
  - Salafi → pertanyaan kuliah; jika Ya → Kampus & Jurusan.
- **Pengajuan Santri Baru** (Admin, dari Beranda atau Pengaturan):
  - Admin dapat menerima atau menolak pengajuan.
  - Saat menerima, admin membuat username, password, dan kelas (untuk santri) atau kabag (untuk guru).
  - Setelah akun dibuat, tombol **Bagikan ke WhatsApp** mengirim username & password ke nomor WA pendaftar.
  - Template pesan bisa diubah Pengembang di Pengaturan Aplikasi → `template_wa_akun`.
- **Verifikasi Data Saya** (santri & guru; untuk guru cukup data diri + foto + KTP + KK):
  - Data yang sudah disimpan terkunci, kecuali nomor WA. Revisi dilakukan lewat admin.
  - Jika data lengkap, centang biru tampil di samping nama.
  - Dokumen bersifat privat: hanya pemilik dan Admin yang dapat melihatnya.
- **Kelola Daftar Kelas** (Admin, di Pengaturan): tambah, ubah, dan hapus kelas. Saat kelas diganti nama, santri dan roster ikut dipindahkan.
- **Versi komputer:** dibuka otomatis di browser PC dengan nama **ALHUDA WEB**. Di ponsel tetap **ALHUDA MOBILE**. Kedua nama bisa diubah Pengembang melalui `nama_web` dan `nama_mobile`.
- **Pasang di Layar Utama:** dipindah ke bagian atas Beranda dan disembunyikan jika aplikasi sudah terpasang.

### Revisi v2.7.0
- Nama bawaan aplikasi sekarang **ALHUDA MOBILE** (ponsel) dan **ALHUDA WEB** (komputer). Nama lama "MOBILE ALHUDA" / "WEB ALHUDA" otomatis diganti.
- Kartu pemberitahuan tunggakan Iuran Bulanan & Uang Tahunan di Beranda santri dihapus. Sebagai gantinya, santri menerima chat dari **Sistem Alhuda Mobile** di Room Chat.
  - Pesan baru hanya dikirim jika rincian tunggakan berubah.
  - Jika semua sudah lunas, sistem mengirim pesan terima kasih.
  - Chat sistem tidak dapat dibalas.
- **Admin** dan **Pengembang Aplikasi** otomatis mendapat centang biru.
- Centang biru tampil di semua tempat yang menampilkan nama: Beranda, Pengaturan, profil, Room Chat dan grup, Daftar santri/guru, Live Portal, Postingan & komentar, serta anggota Haris/Asrama/Kabilah.

## Pembaruan v2.7.1
- **Pasang / Instal aplikasi:** tombol tutup (✕) dihapus. Ajakan memasang tampil terus di halaman login dan di bagian atas Beranda sampai aplikasi terpasang, lalu hilang otomatis.
- **Unduh semua data cukup sekali:** unduhan berjalan saat aplikasi pertama dibuka di sebuah akun, atau setelah aplikasi diperbarui ke versi baru.
  - Ikon unduh di header menampilkan progres, misalnya `120/139`.
  - Semua data yang boleh dibuka pengguna ikut diunduh: Beranda, chat, pengumuman, roster semua kelas, daftar santri & guru, absen, rekap per kelas, nilai, raport, iuran, uang tahunan, saldo, profil setiap pengguna, Haris, Asrama, Kabilah, absen jamaah, postingan, Live Portal, pengajuan, verifikasi, dan pengaturan.
  - Jika koneksi terputus, unduhan otomatis dilanjutkan saat kembali online.
  - Setelah itu tidak ada lagi unduhan berkala. Setiap halaman tetap diperbarui diam-diam saat dibuka.
  - Data dikirim berkelompok (20 data per permintaan) melalui aksi baru `sync.batch`. Aksi ini hanya untuk membaca, dan hak akses tetap diperiksa.
- **Login ALHUDA WEB (komputer):** tampilan dua kolom ala website. Panel identitas dayah ada di kiri, formulir login atau pendaftaran di kanan.
- Cara memasang: ganti isi `Pendaftaran` dan `Index.html`, lalu terapkan versi baru.
- **Beranda:** tombol **Pengajuan Santri Baru** hanya tampil jika ada pengajuan yang menunggu. Tombol **Pemberitahuan Hari Ini** hanya tampil jika ada catatan hari ini. Riwayat pemberitahuan tetap bisa dibuka dari menu **Pengaturan → Pemberitahuan**.
- **Daftar Santri Baru (ponsel):** header dibuat ringkas satu baris (tombol kembali + judul), sehingga formulir tidak lagi tertutup.

## Pembaruan v2.8.0 — Halaman Depan Publik
**Cara memasang:**
1. Tambahkan file skrip baru bernama **`Publik`** dan tempel isi `apps-script/Publik.gs`. Urutan file: Code → Portal → Fitur → Pendaftaran → Publik.
2. Ganti isi `Index.html` dengan versi terbaru.
3. Pilih **Terapkan → Kelola penerapan → Edit → Versi baru → Terapkan**.
4. Sheet `PostPublik`, `Tamu`, dan `ProfilPublik` dibuat otomatis, dan kolom `status` ditambahkan ke `PostKomentar`.

**Fitur:**
- **Slide "Kabar Dayah" di halaman login.** Setiap slide tampil 5 detik dengan transisi fade.
  - Isi slide: nama, @username, hari dan tanggal, banner landscape 16:9, serta isi postingan maksimal 5 baris dengan tombol *Lihat selengkapnya*.
  - Jika ada beberapa banner, banner berganti dengan fade dan bilah progres ditampilkan di atasnya.
  - **Usap kanan:** banner berikutnya, lalu postingan sebelumnya. **Usap kiri:** banner sebelumnya, lalu postingan berikutnya.
- **Ajukan ke Layar Utama:** tersedia di menu ⋮ postingan.
  - Wajib ada banner landscape rasio 16:9, maksimal 5. Gambar dengan rasio lain otomatis ditolak.
  - Postingan Admin/Pengembang langsung tampil. Postingan pengguna lain menunggu persetujuan di **Pengaturan → Layar Utama Publik**. Hasilnya dikirim lewat chat Sistem Alhuda Mobile.
- **Suka, komentar & bagikan tanpa login.**
  - Pengunjung otomatis bernama Tamu1, Tamu2, dan seterusnya.
  - Komentar tamu langsung terlihat oleh tamu tersebut, tetapi baru tampil untuk publik setelah disetujui Admin.
  - Pilihan bagikan: WhatsApp, Status WA, Story Instagram, TikTok, Story TikTok, dan Salin Tautan. Untuk Story, gambar vertikal dibuat otomatis dari banner.
- **Pengguna publik.**
  - Pemilik akun dapat memilih **Akun Publik / Terbatas** lewat tombol di profilnya.
  - Akun publik tampil di menu **Pengguna** halaman depan, lengkap dengan profil, galeri (mengikuti privasi), dan postingan yang sudah disetujui.
- **Hubungi Admin:** chat tamu masuk ke Room Chat Admin/Pengembang dengan nama Tamu1, Tamu2, dan seterusnya, lalu dapat dibalas langsung.
- **Tentang Dayah & Lokasi:** teksnya dapat diubah di Pengaturan Aplikasi melalui `tentang_dayah`, `alamat_dayah`, `maps_dayah`, dan `link_aplikasi`.
- **APK:** kode Android sekarang punya fitur `shareImage` agar Story bisa langsung dibagikan ke Instagram, WhatsApp, atau TikTok (versionCode 14, versi 2.8.0). Fitur ini berlaku setelah APK dibangun ulang. Di versi web, Story dibagikan lewat menu Bagikan bawaan HP.

### Revisi v2.8.1
- Banner Layar Utama sekarang **landscape rasio 16:9** (contoh: 1920×1080 atau 1280×720). Gambar potret otomatis ditolak.
- Halaman depan dibuat lebih sederhana:
  - Ponsel: header ringkas berisi logo dan nama, slide Kabar Dayah 16:9, formulir login, empat menu cepat, dan tombol Daftar.
  - Komputer: panel kiri berisi identitas dayah dan Kabar Dayah, panel kanan berisi formulir login.
- **Paragraf postingan:** di Postingan, slide Kabar Dayah, dan halaman *Lihat selengkapnya*, setiap paragraf kini rata kiri-kanan (justify) dengan baris pertama menjorok ke dalam.
- **Hubungi Admin → WhatsApp:** tombol langsung membuka chat WhatsApp admin dengan pesan: *Assalamu'alaikum Tgk, saya mendapatkan nomor Tgk di aplikasi \*ALHUDA MOBILE\*, izin bertanya.*
- **Pengaturan → Tentang Dayah & Instagram** (Admin): ubah teks Tentang Dayah, alamat, tautan Google Maps, dan akun Instagram, lengkap dengan pratinjau. Perubahan langsung tampil di halaman depan.
- **Pengaturan → Instagram Dayah:** tersedia untuk semua pengguna dan langsung membuka profil Instagram dayah.
- **Pemberitahuan** dipindahkan dari Pengaturan ke **ikon lonceng di header**. Angka pada lonceng menunjukkan jumlah pemberitahuan hari ini.
- **Akun Publik / Terbatas** sekarang juga bisa diatur **Admin** untuk akun pengguna lain, lewat tombol di halaman profil pengguna tersebut.
- **Notifikasi untuk saya (lonceng):**
  - Muncul saat postingan Anda disukai, dikomentari, atau dibagikan (termasuk oleh tamu di halaman depan).
  - Untuk santri, muncul juga catatan tentang dirinya: tidak hadir ngaji (Alpa/Izin/Sakit), izin pulang, izin keluar, dan pelanggaran.
  - Notifikasi dikirim ke HP, dan angkanya ditambahkan ke ikon lonceng.
  - Halaman Pemberitahuan punya dua tab: **Untuk Saya** dan **Catatan Santri**. Isinya mencakup 30 hari terakhir.
  - Sheet `PostBagi` dan `NotifBaca` dibuat otomatis.
- **Beranda ⇄ Daftar:** tombol **Postingan** sekarang ada di Beranda (menggantikan Pengumuman), dan **Pengumuman** ada di menu Daftar (menggantikan Postingan). Keduanya menampilkan angka merah untuk postingan/pengumuman terbaru, dan angka hilang setelah halamannya dibuka.

## Hosting alternatif: Firebase Hosting (Google Cloud)
- File `firebase.json` di akar proyek sudah disiapkan; folder yang diterbitkan adalah `web/`.
- Pasang Node.js, lalu jalankan `npm i -g firebase-tools`, `firebase login`, dan `firebase deploy --only hosting --project <ID-PROYEK>`.
- Domain sendiri dipasang lewat Firebase Console → Hosting → Add custom domain.

## Domain sendiri (ditunda)
- Untuk sementara portal tetap memakai alamat GitHub Pages bawaan. Saat domain alhudamalikussaleh.web.id sudah siap, tambahkan file `web/CNAME`, isi Custom domain di Settings → Pages, lalu atur DNS.

## Pembaruan v2.8.5
- **Postingan dengan banyak foto (maks. 10):** foto berganti sendiri setiap 4 detik dengan transisi fade. Pengguna juga bisa mengusapnya, dan ketuk untuk memperbesar. Saat mengedit, foto tambahan bisa dihapus satu per satu. Kolom `galeri` ditambahkan otomatis ke sheet Postingan.
- **Membuka aplikasi yang sudah terpasang:**
  - `manifest.webmanifest` kini berisi `launch_handler`, `handle_links`, dan `related_applications`.
  - Chrome/Edge di komputer (versi 139 ke atas) otomatis membuka tautan situs di aplikasi yang sudah terpasang.
  - Jika situs dibuka di tab browser padahal aplikasi sudah terpasang, muncul bar **"Buka Aplikasi"**.
  - iPhone/Safari tidak mendukung pengalihan otomatis.
- File yang diganti: `Publik`, `Index.html`, dan `web/manifest.webmanifest`.
- **Tampilan postingan:** foto/video kini diletakkan di atas teks dan tampil sesuai rasio aslinya (9:16 tetap potret, 16:9 tetap landscape). @username tidak ditampilkan lagi; nama tetap bisa diketuk untuk membuka profil.

## Halaman Home (percobaan) — alhudamalikussaleh.web.id/home.html
- Isi folder khusus di GitHub: `home/home.html` dan `home/img/`. Folder `img/` berisi banner1–3, contoh foto berita, dan logo. CSS dan JavaScript sudah menyatu di dalam home.html.
- Saat situs diterbitkan, workflow menyalin isi folder itu ke situs. Hasilnya bisa dibuka di `/home.html` dan `/img/...`.
- **Banner utama:** 1–5 gambar JPG 16:9, berganti tiap 4 detik dengan fade, bisa diusap atau digeser lewat panah dan titik.
- **Berita:** nama, tanggal, banner (bisa lebih dari satu, bisa diusap), dan isi berita maksimal 5 baris (rata kiri-kanan, baris pertama menjorok) dengan tombol *Lihat selengkapnya*.
- **Konten dari aplikasi:** jika aplikasi sudah punya postingan yang disetujui tampil di Layar Utama, berita otomatis diganti dengan postingan tersebut. Teks Tentang Dayah dan akun IG juga diambil dari Pengaturan aplikasi.
- **Tombol Login** membuka aplikasi. Jika pengguna sudah login, tombolnya bertuliskan "Beranda" dan langsung membuka Beranda aplikasi.
- **Tombol Tentang** membuka jendela Tentang Dayah beserta lokasi dan tombol Instagram.

## Pembaruan v2.9.0 — Akses Khusus Admin (Tahap 1)
Menu **Pengaturan → Akses Khusus Admin** (terlihat oleh Admin dan Pengembang) berisi:
- **Keamanan Kata Sandi & Akun:**
  - Reset kata sandi pengguna (dibuat acak atau diketik sendiri), lalu kirim ke WhatsApp atau salin. Reset otomatis mengeluarkan akun dari semua perangkat.
  - Kunci atau buka akun.
  - Akun Pengembang hanya dapat diubah oleh Pengembang.
- **Kelola Data Pengguna:** tambah, ubah, dan hapus santri serta dewan guru (per kelas atau nonaktif).
- **Pengajuan Santri Baru**
- **Daftar Kelas & Nama Lembaga:** tambah, ubah, dan hapus kelas, serta ubah nama lembaga (mis. PDF Wustha → SMP). Nama ini dipakai di seluruh aplikasi, formulir pendaftaran, dan kop raport.
- **Tentang Dayah & Instagram**, **Logo Aplikasi & Kop Surat** (kini juga untuk Admin), **Layar Utama Publik**, dan **Pengaturan Aplikasi**.
- Pengaturan baru: `lembaga_wustha`, `lembaga_ulya`, `lembaga_salafi`, `sandi_min`.
- File yang diganti: `Publik` dan `Index.html`.

## Pembaruan v2.9.1 — Akses Khusus Admin (Tahap 2: Pengaturan Akademik)
- **Sesi & Jam Pelajaran:**
  - Tambah, ubah, dan hapus sesi lengkap dengan kode, jam mulai–selesai, berlaku untuk Salafi/PDF, dan hari (Setiap Hari atau hari tertentu).
  - Satu sesi bisa ditandai sebagai **sesi wali kelas otomatis**.
  - Mengganti kode sesi ikut memperbarui roster. Jika sesi yang masih dipakai roster dihapus, Admin diminta konfirmasi terlebih dahulu.
- **Wali Kelas:** pilih *Otomatis* (guru yang mengajar di sesi wali) atau tunjuk guru tertentu per kelas. Berlaku di daftar kelas, raport PDF, laporan iuran & tahunan, serta hak mengisi status naik kelas.
- **Istilah Kegiatan:** "Mengulang Malam" beserta jamnya bisa diganti (mis. *Bimbingan*), dan istilah baru tampil di Beranda, menu Absen & Izin, serta roster.
- **Kabag / Peran & Hak Akses:**
  - Tambah peran baru yang mewarisi hak akses dari peran bawaan.
  - Ganti nama peran (pengguna ikut dipindahkan), hapus atau sembunyikan peran, dan tampilkan kembali peran yang disembunyikan.
  - Peran Admin dan Pengembang Aplikasi tidak dapat diubah.
- Sheet baru `WaliKelas` dan `Peran` dibuat otomatis, dan kolom `hari` ditambahkan ke sheet Sesi.
- File yang diganti: `Publik` dan `Index.html`.

## Pembaruan v2.10.0 — Akses Pengembang (Tahap 3)
Menu **Pengaturan → Akses Pengembang** (hanya Pengembang Aplikasi):
- **Tema Aplikasi**: 10 pilihan tema + warna kustom (warna utama, aksen, latar) dengan pratinjau. Bisa **dikunci** agar semua pengguna memakai tema yang sama. Berlaku juga di halaman login.
- **Tentang Aplikasi**: nama aplikasi (ponsel/komputer), versi, deskripsi, pemilik, alamat, pembuat, penerbit, tanggal revisi, kontak.
- **Sebutan Lembaga**: kata "Dayah" diganti di seluruh tampilan, halaman login & PDF (mis. Pesantren). Email/tautan tidak ikut diganti.
- **Login Khusus Pengembang**: akun di Script Properties (DEV_USER, DEV_PASS, DEV_AKTIF), bukan di sheet Users. 5× salah sandi → dikunci 15 menit.
- **Alamat Server (URL Web App)**: diganti dari aplikasi tanpa membangun ulang APK. Di halaman login, **ketuk logo 5 kali** untuk membuka pengaturan server. Bila belum ada URL sama sekali, aplikasi langsung menampilkan halaman "Hubungkan ke Server".
- APK perlu dibangun ulang (versionCode 15 / 2.10.0) agar alamat server baru juga dipakai notifikasi & sinkron latar belakang.
