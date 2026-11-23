/**
 * ============================================================
 *  ALHUDA MOBILE — PENDAFTARAN, VERIFIKASI DATA, KELOLA KELAS  (v2.7.0)
 * ============================================================
 *  File TAMBAHAN. Pasang: editor Apps Script → ＋ → Skrip → beri nama  Pendaftaran
 *  → tempel isi file ini. Urutan file:  Code → Portal → Fitur → Pendaftaran.
 *
 *  Isi:
 *   1. Daftar Santri Baru dari halaman login (tanpa akun) → sheet "Pendaftaran"
 *   2. Admin: terima / tolak pengajuan → buat akun → bagikan akun ke WhatsApp
 *      (teks pesan dapat diubah Pengembang Aplikasi: Pengaturan → template_wa_akun)
 *   3. Verifikasi Data Saya (sheet "Verifikasi") + centang biru bila lengkap
 *   4. Kelola Daftar Kelas (tambah / ubah / hapus) oleh Admin
 *   5. Nama aplikasi versi web (komputer) & versi ponsel
 * ============================================================ */

/* ---------- pengaturan baru (diubah oleh Pengembang Aplikasi) ---------- */
[
  ['nama_web', 'ALHUDA WEB', 'Nama aplikasi saat dibuka di komputer / laptop'],
  ['nama_mobile', 'ALHUDA MOBILE', 'Nama aplikasi saat dibuka di ponsel'],
  ['template_wa_akun',
    'Assalamu\'alaikum warahmatullahi wabarakatuh.\n\n' +
    'Terima kasih telah mendaftar di *{yayasan}*. Alhamdulillah, pendaftaran Ananda *{nama}* ({asal}) telah *DITERIMA*.\n\n' +
    'Berikut akun untuk masuk ke aplikasi *{aplikasi}*:\n' +
    '👤 Username : *{username}*\n🔑 Password : *{password}*\n\n' +
    'Setelah masuk, mohon segera:\n1. Lengkapi data di menu *Pengaturan → Verifikasi Data Saya*.\n2. Ganti kata sandi di menu *Pengaturan → Keamanan & Kata Sandi*.\n\n' +
    'Jagalah kerahasiaan akun ini. Terima kasih.\nWassalamu\'alaikum warahmatullahi wabarakatuh.',
    'Teks WhatsApp saat membagikan akun santri baru. Kode: {nama} {asal} {username} {password} {aplikasi} {yayasan} {dayah}']
].forEach(r => { if (!DEFAULT_SETTINGS.some(x => x[0] === r[0])) DEFAULT_SETTINGS.push(r); });
/* Nama lama bawaan v2.7 awal ("MOBILE ALHUDA" / "WEB ALHUDA") otomatis dibaca sebagai nama baru. */
(function () {
  const asli = settingsMap_, LAMA = { nama_mobile: ['MOBILE ALHUDA', 'ALHUDA MOBILE'], nama_web: ['WEB ALHUDA', 'ALHUDA WEB'] };
  settingsMap_ = function () {
    const m = asli();
    Object.keys(LAMA).forEach(k => { if (String(m[k] || '').trim().toUpperCase() === LAMA[k][0]) m[k] = LAMA[k][1]; });
    return m;
  };
})();
['nama_web', 'nama_mobile', 'template_wa_akun'].forEach(k => { if (SETTINGS_DEV_ONLY.indexOf(k) < 0) SETTINGS_DEV_ONLY.push(k); });

SHEETS.Pendaftaran = ['id', 'waktu', 'nama', 'nisn', 'wa', 'alamat', 'lembaga', 'asal_sekolah', 'kuliah', 'kampus', 'jurusan',
  'ayah', 'ibu', 'kerja_ayah', 'kerja_ibu', 'status', 'akun', 'diproses_oleh', 'diproses', 'catatan'];
SHEETS.Verifikasi = ['username', 'nama_ktp', 'nisn', 'no_ktp', 'no_kk', 'alamat_ktp', 'lembaga', 'asal_sekolah', 'kuliah', 'kampus', 'jurusan', 'wa',
  'ayah', 'ibu', 'alamat_ayah', 'alamat_ibu', 'kerja_ayah', 'kerja_ibu', 'wali', 'alamat_wali', 'kerja_wali', 'foto', 'dok_ktp', 'dok_kk', 'dok_lain', 'diubah'];

const LEMBAGA = ['PDF Wustha', 'PDF Ulya', 'Salafi'];
const VERIF_TEKS = ['nama_ktp', 'nisn', 'no_ktp', 'no_kk', 'alamat_ktp', 'lembaga', 'asal_sekolah', 'kuliah', 'kampus', 'jurusan', 'wa',
  'ayah', 'ibu', 'alamat_ayah', 'alamat_ibu', 'kerja_ayah', 'kerja_ibu', 'wali', 'alamat_wali', 'kerja_wali'];
const VERIF_FILE = ['foto', 'dok_ktp', 'dok_kk'];

function pdBersih_(v, n) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 200); }
function pdWa_(v) { let d = String(v || '').replace(/\D/g, ''); if (d.indexOf('62') === 0) d = '0' + d.slice(2); return d; }
/** Wajib isi sesuai lembaga: PDF → asal sekolah; Salafi → kuliah (Ya/Tidak), bila Ya → kampus & jurusan. */
function pdLembagaWajib_(o) {
  const w = [];
  if (o.lembaga === 'PDF Wustha' || o.lembaga === 'PDF Ulya') w.push('asal_sekolah');
  if (o.lembaga === 'Salafi') { w.push('kuliah'); if (o.kuliah === 'Ya') w.push('kampus', 'jurusan'); }
  return w;
}

/* ============================================================
 *  1. PENDAFTARAN (tanpa login) — lewat aksi publik "login" dengan _aksi = "daftar"
 * ============================================================ */
const LABEL_DAFTAR = { nama: 'Nama', nisn: 'NISN', wa: 'Nomor WhatsApp', alamat: 'Alamat', lembaga: 'Lembaga', asal_sekolah: 'Asal Sekolah', kuliah: 'Status kuliah',
  kampus: 'Instansi Kampus', jurusan: 'Jurusan', ayah: 'Nama Ayah', ibu: 'Nama Ibu', kerja_ayah: 'Pekerjaan Ayah', kerja_ibu: 'Pekerjaan Ibu' };
function daftarAjukan_(p) {
  const c = CacheService.getScriptCache(), kunci = 'daftar_jam_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHH');
  const n = +(c.get(kunci) || 0); if (n > 60) throw new Error('Terlalu banyak pendaftaran saat ini. Coba lagi beberapa saat lagi.');
  const d = p.data || {};
  const o = {};
  Object.keys(LABEL_DAFTAR).forEach(k => o[k] = pdBersih_(d[k], k === 'alamat' ? 300 : 120));
  o.wa = pdWa_(o.wa);
  if (LEMBAGA.indexOf(o.lembaga) < 0) throw new Error('Pilih lembaga.');
  if (o.lembaga !== 'Salafi') { o.kuliah = ''; o.kampus = ''; o.jurusan = ''; }
  else { o.asal_sekolah = ''; if (o.kuliah !== 'Ya') { o.kuliah = 'Tidak'; o.kampus = ''; o.jurusan = ''; } }
  const wajib = ['nama', 'nisn', 'wa', 'alamat', 'lembaga', 'ayah', 'ibu', 'kerja_ayah', 'kerja_ibu'].concat(pdLembagaWajib_(o));
  const kosong = wajib.filter(k => !o[k]);
  if (kosong.length) throw new Error('Wajib diisi: ' + kosong.map(k => LABEL_DAFTAR[k]).join(', ') + '.');
  if (!/^\d{6,12}$/.test(o.nisn)) throw new Error('NISN harus berupa angka (6–12 digit).');
  if (!/^0\d{8,13}$/.test(o.wa)) throw new Error('Nomor WhatsApp tidak valid. Contoh: 081234567890.');
  return lock_(() => {
    if (readAll_('Pendaftaran').some(r => r.nisn === o.nisn && r.status === 'Menunggu')) throw new Error('Pendaftaran dengan NISN ini sedang menunggu persetujuan admin.');
    o.id = uid_(); o.waktu = now_(); o.status = 'Menunggu';
    append_('Pendaftaran', o);
    c.put(kunci, String(n + 1), 3600);
    return { ok: true, pesan: 'Pendaftaran berhasil dikirim. Admin akan menghubungi Anda melalui WhatsApp ' + o.wa + ' setelah pendaftaran diperiksa.' };
  });
}
/* aksi publik: login (+ pendaftaran) & publicInfo (+ nama web / ponsel) */
(function () {
  const loginAsli = login_, infoAsli = publicInfo_;
  login_ = function (p) { return p && p._aksi === 'daftar' ? daftarAjukan_(p) : loginAsli(p); };
  publicInfo_ = function () { const r = infoAsli(), s = settingsMap_(); r.nama_web = s.nama_web; r.nama_mobile = s.nama_mobile; return r; };
})();

/* ============================================================
 *  2. PENGAJUAN SANTRI BARU (Admin)
 * ============================================================ */
function bolehPengajuan_(u) { return perms_(u).users; }
function pengajuanList_(u, p) {
  need_(bolehPengajuan_(u), 'Khusus Admin.');
  const st = p.status || 'Menunggu';
  return readAll_('Pendaftaran').filter(r => r.id && (st === 'Semua' || r.status === st)).sort((a, b) => String(b.waktu).localeCompare(String(a.waktu)))
    .slice(0, 200).map(r => { const o = {}; SHEETS.Pendaftaran.forEach(k => o[k] = r[k]); return o; });
}
function pdTemplate_(r, akun) {
  const s = settingsMap_();
  const t = s.template_wa_akun || DEFAULT_SETTINGS.find(x => x[0] === 'template_wa_akun')[1];
  const ganti = { nama: r.nama, asal: r.alamat, username: akun.username, password: akun.password, aplikasi: s.nama_mobile || s.nama_aplikasi,
    yayasan: s.nama_yayasan, dayah: s.nama_dayah };
  return String(t).replace(/\\n/g, '\n').replace(/\{(\w+)\}/g, (m, k) => ganti[k] !== undefined ? ganti[k] : m);
}
function pengajuanTerima_(u, p) {
  need_(bolehPengajuan_(u), 'Khusus Admin.');
  const r = readAll_('Pendaftaran').find(x => x.id === p.id); if (!r) throw new Error('Pengajuan tidak ditemukan.');
  if (r.status !== 'Menunggu') throw new Error('Pengajuan ini sudah diproses (' + r.status + ').');
  const username = lc_(p.username), password = String(p.password || '');
  if (password.length < 6) throw new Error('Password minimal 6 karakter.');
  // buat akun memakai fungsi pengguna yang sudah ada (validasi username, kelas, kabag)
  usersSave_(u, { username: username, nama: r.nama, tipe: p.tipe === 'Guru' ? 'Guru' : 'Santri', kelas: p.kelas, kabag: p.kabag,
    nis_nip: p.tipe === 'Guru' ? '' : r.nisn, asal: r.alamat, password: password, aktif: 'Ya' });
  lock_(() => {
    update_('Pendaftaran', r._row, { status: 'Diterima', akun: username, diproses_oleh: u.username, diproses: now_() });
    // isi awal Verifikasi Data dari formulir pendaftaran
    if (!readAll_('Verifikasi').some(v => lc_(v.username) === username)) {
      append_('Verifikasi', { username: username, nama_ktp: r.nama, nisn: r.nisn, wa: r.wa, alamat_ktp: r.alamat, lembaga: r.lembaga, asal_sekolah: r.asal_sekolah,
        kuliah: r.kuliah, kampus: r.kampus, jurusan: r.jurusan, ayah: r.ayah, ibu: r.ibu, kerja_ayah: r.kerja_ayah, kerja_ibu: r.kerja_ibu, dok_lain: '[]', diubah: now_() });
    }
  });
  return { username: username, wa: r.wa, nama: r.nama, pesan: pdTemplate_(r, { username: username, password: password }) };
}
function pengajuanTolak_(u, p) {
  need_(bolehPengajuan_(u), 'Khusus Admin.');
  return lock_(() => {
    const r = readAll_('Pendaftaran').find(x => x.id === p.id); if (!r) throw new Error('Pengajuan tidak ditemukan.');
    update_('Pendaftaran', r._row, { status: 'Ditolak', diproses_oleh: u.username, diproses: now_(), catatan: pdBersih_(p.catatan, 300) });
    return true;
  });
}

/* ============================================================
 *  3. VERIFIKASI DATA SAYA
 *  Data yang sudah diisi tidak dapat diubah / dihapus pemiliknya (kecuali nomor WhatsApp).
 *  Admin dapat merevisi. Lengkap → centang biru.
 * ============================================================ */
function verifRow_(un) { return readAll_('Verifikasi').find(v => lc_(v.username) === lc_(un)) || null; }
/** Kolom wajib: santri (data diri + lembaga + orang tua + wali), guru (data diri saja). */
const VERIF_WAJIB_GURU = ['nama_ktp', 'no_ktp', 'no_kk', 'alamat_ktp', 'wa'];
function verifTipe_(v, tipe) { if (tipe) return tipe; const x = v && v.username ? findUser_(v.username) : null; return x ? x.tipe : 'Santri'; }
function verifWajib_(v, tipe) {
  if (verifTipe_(v, tipe) === 'Guru') return VERIF_WAJIB_GURU.concat(VERIF_FILE);
  return ['nama_ktp', 'nisn', 'no_ktp', 'no_kk', 'alamat_ktp', 'lembaga', 'wa', 'ayah', 'ibu', 'alamat_ayah', 'alamat_ibu', 'kerja_ayah', 'kerja_ibu',
    'wali', 'alamat_wali', 'kerja_wali'].concat(pdLembagaWajib_(v)).concat(VERIF_FILE);
}
function verifLengkap_(v, tipe) { return !!v && verifWajib_(v, tipe).every(k => String(v[k] || '').trim() !== ''); }
let FX_VERIF = null;
/** Admin & Pengembang Aplikasi otomatis bercentang biru. */
function verifOtomatis_(u) { const r = roles_(u || {}); return r.indexOf('Admin') >= 0 || r.indexOf('Pengembang Aplikasi') >= 0; }
function verifSet_() {
  if (FX_VERIF) return FX_VERIF;
  const m = {};
  readAll_('Verifikasi').forEach(v => { if (verifLengkap_(v)) m[lc_(v.username)] = 1; });
  activeUsers_().forEach(x => { if (verifOtomatis_(x)) m[lc_(x.username)] = 1; });
  return (FX_VERIF = m);
}
function verifTarget_(u, p) {
  const un = p.username && lc_(p.username) !== lc_(u.username) ? p.username : u.username;
  const admin = bolehPengajuan_(u);
  if (lc_(un) !== lc_(u.username)) need_(admin, 'Hanya Admin yang dapat membuka data verifikasi pengguna lain.');
  const x = findUser_(un); if (!x) throw new Error('Pengguna tidak ditemukan.');
  return { user: x, admin: admin };
}
function verifGet_(u, p) {
  const t = verifTarget_(u, p), v = verifRow_(t.user.username) || {};
  const data = {};
  VERIF_TEKS.forEach(k => data[k] = v[k] || '');
  if (!data.nama_ktp) data.nama_ktp = '';
  const file = k => { try { return v[k] ? JSON.parse(v[k]) : null; } catch (e) { return null; } };
  const lain = (function () { try { return JSON.parse(v.dok_lain || '[]'); } catch (e) { return []; } })();
  const isi = {}; VERIF_TEKS.concat(VERIF_FILE).forEach(k => { if (String(v[k] || '').trim()) isi[k] = 1; });
  const wajib = verifWajib_(Object.assign({}, v), t.user.tipe);
  return { username: t.user.username, nama: t.user.nama, tipe: t.user.tipe, data: data, foto: file('foto'), dok_ktp: file('dok_ktp'), dok_kk: file('dok_kk'), dok_lain: lain,
    terkunci: t.admin ? [] : Object.keys(isi).filter(k => k !== 'wa'), admin: t.admin, otomatis: verifOtomatis_(t.user), lengkap: verifLengkap_(v, t.user.tipe),
    kurang: wajib.filter(k => !String(v[k] || '').trim()) };
}
function verifSave_(u, p) {
  const t = verifTarget_(u, p), vals = p.values || {};
  return lock_(() => {
    const v = verifRow_(t.user.username);
    const patch = {};
    VERIF_TEKS.forEach(k => {
      if (vals[k] === undefined) return;
      let nilai = pdBersih_(vals[k], /alamat/.test(k) ? 300 : 120);
      if (k === 'wa') nilai = pdWa_(nilai);
      if (k === 'lembaga' && nilai && LEMBAGA.indexOf(nilai) < 0) return;
      if (k === 'kuliah' && nilai && ['Ya', 'Tidak'].indexOf(nilai) < 0) return;
      const lama = v ? String(v[k] || '').trim() : '';
      if (!t.admin && k !== 'wa' && lama) return;          // sudah terisi → terkunci
      if (!t.admin && k !== 'wa' && !nilai) return;
      patch[k] = nilai;
    });
    if (patch.nisn && !/^\d{6,12}$/.test(patch.nisn)) throw new Error('NISN harus berupa angka (6–12 digit).');
    if (patch.wa && !/^0\d{8,13}$/.test(patch.wa)) throw new Error('Nomor WhatsApp tidak valid.');
    ['no_ktp', 'no_kk'].forEach(k => { if (patch[k] && !/^\d{16}$/.test(patch[k])) throw new Error((k === 'no_ktp' ? 'No. KTP (NIK)' : 'No. KK') + ' harus 16 digit angka.'); });
    patch.diubah = now_();
    if (v) update_('Verifikasi', v._row, patch);
    else append_('Verifikasi', Object.assign({ username: t.user.username, dok_lain: '[]' }, patch));
    FX_VERIF = null;
    return verifGet_(u, p);
  });
}
function verifFolder_() { const r = folder_(), it = r.getFoldersByName('Verifikasi'); return it.hasNext() ? it.next() : r.createFolder('Verifikasi'); }
function verifUpload_(u, p) {
  const t = verifTarget_(u, p), slot = p.slot;
  if (VERIF_FILE.indexOf(slot) < 0 && slot !== 'dok_lain') throw new Error('Jenis dokumen tidak valid.');
  if (!p.data) throw new Error('Pilih file.');
  const m = String(p.data).match(/^data:([^;,]+)[;,]/);
  const mime = String(p.mime || (m ? m[1] : '')).toLowerCase();
  if (slot === 'foto' ? mime.indexOf('image/') !== 0 : !/^image\/(jpeg|jpg|png)$|^application\/pdf$/.test(mime)) throw new Error(slot === 'foto' ? 'Foto harus berupa gambar.' : 'Dokumen harus JPG, JPEG, PNG, atau PDF.');
  const bytes = Utilities.base64Decode(String(p.data).replace(/^data:[^,]*,/, ''));
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10 MB.');
  return lock_(() => {
    let v = verifRow_(t.user.username);
    if (!v) { append_('Verifikasi', { username: t.user.username, dok_lain: '[]', diubah: now_() }); v = verifRow_(t.user.username); }
    if (slot !== 'dok_lain' && v[slot] && !t.admin) throw new Error('Dokumen ini sudah diunggah. Hubungi admin untuk merevisi.');
    const nama = pdBersih_(p.nama || slot, 100).replace(/[\\/:*?"<>|]+/g, '_');
    const f = verifFolder_().createFile(Utilities.newBlob(bytes, mime, t.user.username + '_' + slot + '_' + Date.now() + '_' + nama));
    // file verifikasi TIDAK dibagikan ke publik — dibuka lewat server aplikasi (media.get)
    const info = { id: f.getId(), nama: nama, mime: mime, ukuran: bytes.length, waktu: now_() };
    const patch = { diubah: now_() };
    if (slot === 'dok_lain') { let l = []; try { l = JSON.parse(v.dok_lain || '[]'); } catch (e) {} l.push(info); patch.dok_lain = JSON.stringify(l); }
    else { if (v[slot]) { try { DriveApp.getFileById(JSON.parse(v[slot]).id).setTrashed(true); } catch (e) {} } patch[slot] = JSON.stringify(info); }
    update_('Verifikasi', v._row, patch);
    FX_VERIF = null;
    return verifGet_(u, p);
  });
}
function verifHapusFile_(u, p) {
  const t = verifTarget_(u, p);
  need_(t.admin, 'Dokumen yang sudah diunggah hanya dapat dihapus oleh Admin.');
  return lock_(() => {
    const v = verifRow_(t.user.username); if (!v) return verifGet_(u, p);
    const patch = { diubah: now_() };
    if (p.slot === 'dok_lain') { let l = []; try { l = JSON.parse(v.dok_lain || '[]'); } catch (e) {} patch.dok_lain = JSON.stringify(l.filter(x => x.id !== p.id)); }
    else if (VERIF_FILE.indexOf(p.slot) >= 0) patch[p.slot] = '';
    try { DriveApp.getFileById(p.id).setTrashed(true); } catch (e) {}
    update_('Verifikasi', v._row, patch);
    FX_VERIF = null;
    return verifGet_(u, p);
  });
}
/* media.get: file verifikasi hanya untuk pemiliknya & Admin */
(function () {
  const lain = typeof mediaBolehLain_ === 'function' ? mediaBolehLain_ : null;
  mediaBolehLain_ = function (u, id) {
    if (lain && lain(u, id)) return true;
    const v = readAll_('Verifikasi').find(r => VERIF_FILE.concat(['dok_lain']).some(k => String(r[k] || '').indexOf(id) >= 0));
    return !!v && (lc_(v.username) === lc_(u.username) || bolehPengajuan_(u));
  };
})();

/* ============================================================
 *  4. KELOLA DAFTAR KELAS (Admin)
 * ============================================================ */
function kelasSave_(u, p) {
  need_(perms_(u).users, 'Daftar kelas hanya dapat diatur oleh Admin.');
  const nama = pdBersih_(p.nama, 60), jenjang = ['Salafi', 'Wustha', 'Ulya'].indexOf(p.jenjang) >= 0 ? p.jenjang : '';
  if (!nama) throw new Error('Isi nama kelas.');
  if (!jenjang) throw new Error('Pilih jenjang (Salafi / Wustha / Ulya).');
  return lock_(() => {
    const rows = readAll_('Kelas').filter(k => k.nama);
    const lama = p.original ? rows.find(k => k.nama === p.original) : null;
    if (p.original && !lama) throw new Error('Kelas tidak ditemukan.');
    if (rows.some(k => lc_(k.nama) === lc_(nama) && k !== lama)) throw new Error('Kelas "' + nama + '" sudah ada.');
    const urutan = num_(p.urutan) || (lama ? num_(lama.urutan) : rows.reduce((a, k) => Math.max(a, num_(k.urutan)), 0) + 1);
    if (lama) {
      update_('Kelas', lama._row, { nama: nama, jenjang: jenjang, urutan: urutan });
      if (lama.nama !== nama) {   // ganti nama → ikut perbarui data santri & roster
        readAll_('Users').filter(x => x.kelas === lama.nama).forEach(x => update_('Users', x._row, { kelas: nama }));
        readAll_('Roster').filter(x => x.kelas === lama.nama).forEach(x => update_('Roster', x._row, { kelas: nama }));
      }
    } else append_('Kelas', { nama: nama, jenjang: jenjang, urutan: urutan });
    return kelasAll_();
  });
}
function kelasDelete_(u, p) {
  need_(perms_(u).users, 'Daftar kelas hanya dapat diatur oleh Admin.');
  return lock_(() => {
    const k = readAll_('Kelas').find(x => x.nama === p.nama); if (!k) return kelasAll_();
    const n = santriAll_().filter(s => s.kelas === k.nama).length;
    if (n) throw new Error('Kelas ' + k.nama + ' masih memiliki ' + n + ' santri. Pindahkan santri ke kelas lain terlebih dahulu.');
    deleteRows_('Roster', readAll_('Roster').filter(x => x.kelas === k.nama).map(x => x._row));
    deleteRows_('Kelas', [k._row]);
    return kelasAll_();
  });
}

/* ---------- boot / dashboard / profil: nama aplikasi, centang biru, jumlah pengajuan ---------- */
fxPasang_('boot', (asli, u, p) => {
  const b = asli(u, p), s = settingsMap_(), v = verifSet_();
  b.settings.nama_web = s.nama_web; b.settings.nama_mobile = s.nama_mobile;
  (b.users || []).forEach(x => { if (v[lc_(x.username)]) x.v = 1; });
  if (b.user && v[lc_(b.user.username)]) b.user.v = 1;
  return b;
});
(function () {   // dashboard sudah dibungkus Fitur.gs → bungkus lagi tanpa penanda
  const asli = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) {
    const d = asli(u, p);
    try { if (bolehPengajuan_(u)) d.pengajuan = readAll_('Pendaftaran').filter(r => r.status === 'Menunggu').length; } catch (e) {}
    try { d.verifSaya = verifOtomatis_(u) || verifLengkap_(verifRow_(u.username), u.tipe); } catch (e) {}
    try { if (u.tipe === 'Santri') { sistemTunggakan_(u); delete d.tunggakan; } } catch (e) {}
    return d;
  };
})();
(function () {
  const asli = ACTIONS['profil.get'];
  if (typeof asli !== 'function') return;
  ACTIONS['profil.get'] = function (u, p) { const d = asli(u, p); try { d.verif = !!verifSet_()[lc_(p.username || u.username)]; } catch (e) {} return d; };
})();

Object.assign(ACTIONS, {
  'pengajuan.list': (u, p) => pengajuanList_(u, p),
  'pengajuan.terima': (u, p) => pengajuanTerima_(u, p),
  'pengajuan.tolak': (u, p) => pengajuanTolak_(u, p),
  'verif.get': (u, p) => verifGet_(u, p),
  'verif.save': (u, p) => verifSave_(u, p),
  'verif.upload': (u, p) => verifUpload_(u, p),
  'verif.hapusFile': (u, p) => verifHapusFile_(u, p),
  'kelas.save': (u, p) => kelasSave_(u, p),
  'kelas.delete': (u, p) => kelasDelete_(u, p)
});


/* ============================================================
 *  6. PESAN SISTEM ALHUDA MOBILE (Room Chat)
 *  Pemberitahuan tunggakan Iuran Bulanan & Uang Tahunan tidak lagi tampil di Beranda,
 *  melainkan dikirim sebagai chat dari "Sistem Alhuda Mobile" ke santri yang bersangkutan.
 *  Pesan baru hanya dikirim bila isi tunggakannya berubah (bulan bertambah / ada pembayaran).
 * ============================================================ */
const NAMA_SISTEM = 'Sistem Alhuda Mobile';
const TERBILANG_ = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'dua belas'];
function daftarKata_(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ', dan ' + a[a.length - 1]; }
function teksTunggakan_(u, t) {
  const i = t.iuran, y = t.tahunan, baris = [];
  baris.push("Assalamu'alaikum " + (u.nama || u.username) + ',');
  baris.push('');
  baris.push('Pemberitahuan Administrasi Keuangan');
  if (i && i.jumlahBulan) {
    const per = {}; i.bulan.forEach(b => { (per[b.tahun] = per[b.tahun] || []).push(b.nama); });
    const bln = Object.keys(per).map(th => daftarKata_(per[th]) + ' ' + th).join('; ');
    const n = i.jumlahBulan;
    baris.push('');
    baris.push('• Iuran Bulanan: belum lunas ' + n + (TERBILANG_[n] ? ' (' + TERBILANG_[n] + ')' : '') + ' bulan, yaitu ' + bln + '. Total ' + rp_(i.total) + '.');
  }
  if (y && y.sisa > 0) {
    if (!(i && i.jumlahBulan)) baris.push('');
    baris.push('• Uang Tahunan ' + y.tahun_ajaran + ': sisa ' + rp_(y.sisa) + (y.dibayar ? ' (sudah dibayar ' + rp_(y.dibayar) + ' dari ' + rp_(y.nominal) + ')' : '') + '.');
  }
  baris.push('');
  baris.push('Total kewajiban: ' + rp_((i ? i.total : 0) + (y ? y.sisa : 0)));
  baris.push('');
  baris.push('Mohon segera melakukan pelunasan kepada Bendahara Dayah. Rincian dapat dilihat di menu Akademik → Iuran Bulanan / Uang Tahunan. Terima kasih.');
  return baris.join('\n');
}
function sistemTunggakan_(u) {
  const me = lc_(u.username);
  const lama = readAll_('Chat').filter(c => c.dari === SISTEM && lc_(c.ke) === me && String(c.id).indexOf('tg-') === 0)
    .sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)) || a._row - b._row).pop();
  const t = tunggakan_(u.username);
  let pesan = '';
  if (t) pesan = teksTunggakan_(u, t);
  else if (lama && String(lama.id).indexOf('tg-lunas') !== 0)
    pesan = "Alhamdulillah, " + (u.nama || u.username) + ", seluruh Iuran Bulanan dan Uang Tahunan Anda sudah lunas. Jazakumullahu khairan atas kerja samanya.";
  if (!pesan || (lama && lama.pesan === pesan)) return false;
  append_('Chat', { id: (t ? 'tg-' : 'tg-lunas-') + uid_(), dari: SISTEM, ke: u.username, pesan: pesan, waktu: now_(), dibaca: 'Tidak' });
  return true;
}
/* Kontak "Sistem Alhuda Mobile" di Room Chat (hanya bila pernah mengirim pesan ke pengguna). */
(function () {
  const kontak = ACTIONS['chat.contacts'];
  ACTIONS['chat.contacts'] = function (u, p) {
    try { if (u.tipe === 'Santri') sistemTunggakan_(u); } catch (e) {}
    const list = kontak(u, p), me = lc_(u.username);
    const rows = readAll_('Chat').filter(c => c.dari === SISTEM && lc_(c.ke) === me);
    if (rows.length) {
      const l = rows.sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)) || a._row - b._row)[rows.length - 1];
      const item = { username: SISTEM, nama: NAMA_SISTEM, tipe: 'Sistem', sistem: true, v: 1, last: { pesan: l.pesan, waktu: l.waktu, dariSaya: false },
        unread: rows.filter(c => c.dibaca !== 'Ya').length };
      const gi = list.findIndex(c => !c.grup);
      list.splice(gi < 0 ? list.length : gi, 0, item);
    }
    return list;
  };
  const unread = ACTIONS['chat.unread'];
  ACTIONS['chat.unread'] = function (u, p) {
    const r = unread(u, p);
    (r.latest || []).forEach(x => { if (x.dari === SISTEM) x.nama = NAMA_SISTEM; });
    return r;
  };
  const thread = ACTIONS['chat.thread'];
  ACTIONS['chat.thread'] = function (u, p) {
    const list = thread(u, p);
    if (p['with'] === SISTEM) list.forEach(m => { delete m.sistem; m.dariSaya = false; });
    return list;
  };
  const kirim = ACTIONS['chat.send'];
  ACTIONS['chat.send'] = function (u, p) {
    if (lc_(p.to) === SISTEM) throw new Error('Pesan dari ' + NAMA_SISTEM + ' tidak dapat dibalas. Silakan hubungi Bendahara atau Admin.');
    return kirim(u, p);
  };
})();

/* ============================================================
 *  7. UNDUH SEMUA DATA SEKALIGUS (sync.batch)
 *  Dipakai aplikasi saat pertama dipasang / setelah aplikasi diperbarui:
 *  banyak permintaan baca dikirim dalam satu panggilan agar cepat & hemat kuota.
 *  Hanya aksi BACA yang diizinkan; hak akses tiap aksi tetap diperiksa seperti biasa.
 * ============================================================ */
const SYNC_BACA = ['absen.form', 'absen.rekap', 'absen.rekapKelas', 'asrama.dok', 'asrama.list', 'asrama.piket', 'boot', 'chat.contacts', 'chat.thread',
  'dashboard', 'grup.info', 'haris.catatan', 'haris.list', 'iuran.get', 'izinKeluar.list', 'izinPulang.list', 'jamaah.akses', 'jamaah.form', 'kabilah.list',
  'kelas.list', 'logo.get', 'mengulang.list', 'nilai.grid', 'nilai.mapel', 'pelanggaran.list', 'pemberitahuan', 'pengajuan.list', 'pengumuman.list',
  'portal.list', 'post.list', 'profil.get', 'raport.data', 'raport.periods', 'roster.list', 'saldo.get', 'saldo.summary', 'settings.get', 'tahunan.get',
  'users.list', 'verif.get'];
ACTIONS['sync.batch'] = function (u, p) {
  const items = Array.isArray(p.items) ? p.items.slice(0, 40) : [];
  return items.map(it => {
    const a = String(it && it[0] || ''), prm = (it && it[1]) || {};
    if (SYNC_BACA.indexOf(a) < 0 || typeof ACTIONS[a] !== 'function') return { ok: false, error: 'Aksi tidak diizinkan: ' + a };
    try { return { ok: true, data: ACTIONS[a](u, prm) }; } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
};
