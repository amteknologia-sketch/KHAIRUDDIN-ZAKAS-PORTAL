/**
 * ============================================================
 *  ALHUDA MOBILE — FITUR TAMBAHAN v2.5.0
 * ============================================================
 *  File TAMBAHAN (Code.gs & Portal.gs tidak perlu diubah).
 *  Pasang: editor Apps Script → ＋ → Skrip → beri nama  Fitur  → tempel isi file ini.
 *  Urutan file harus:  Code  →  Portal  →  Fitur  (file baru otomatis di paling bawah).
 *
 *  Isi:
 *   1. Grup Room Chat (buat grup: pengguna, kelas, dewan guru) + grup otomatis Haris, Asrama, Kabilah
 *   2. Pesan: teruskan (ke pengguna/grup/kelas/guru), edit, hapus
 *   3. Daftar Haris (kelompok jaga 18.00 – 18.00) + pengingat otomatis di grup
 *   4. Daftar Asrama (Santriwan / Santriwati) + piket, grup chat, dokumentasi
 *   5. Daftar Kabilah (Kabag Muzakir)
 *   6. Absen jamaah santri oleh Haris yang bertugas (per kelas / per asrama)
 *   7. Laporan PDF iuran bulanan & uang tahunan semua santri (Admin & Bendahara)
 *   8. Pemberitahuan Hari Ini dapat dilihat semua pengguna (tanpa bagian jamaah)
 *   9. Postingan (v2.6.0) — teks/foto/video/dokumen, suka, komentar, bagikan, privasi
 *  10. Catatan Haris (v2.6.0) — santri tidak berjamaah per masa tugas + catatan haris
 *
 *  Opsional: agar pengingat Haris terkirim tepat pukul 18.00 walau belum ada yang membuka
 *  aplikasi, buat pemicu: ikon jam (Pemicu) → Tambahkan Pemicu → fungsi  kirimPengingatHaris
 *  → Berbasis waktu → Timer harian → 18.00 – 19.00.
 * ============================================================ */

if (KABAG_LIST.indexOf('Kabag Muzakir') < 0) KABAG_LIST.push('Kabag Muzakir');
['diteruskan', 'diedit', 'dihapus', 'diubah'].forEach(k => { if (SHEETS.Chat.indexOf(k) < 0) SHEETS.Chat.push(k); });
SHEETS.Grup = ['id', 'nama', 'anggota', 'admin', 'dibuat_oleh', 'waktu'];
SHEETS.GrupBaca = ['grup', 'username', 'terakhir'];
SHEETS.Haris = ['id', 'kelompok', 'hari', 'ketua', 'anggota', 'diubah_oleh', 'diubah'];
SHEETS.Asrama = ['id', 'jenis', 'nomor', 'nama', 'lokasi', 'keterangan', 'ketua', 'anggota', 'piket', 'diubah_oleh', 'diubah'];
SHEETS.AsramaDok = ['id', 'asrama', 'jenis', 'file', 'nama', 'mime', 'ukuran', 'keterangan', 'oleh', 'waktu'];
SHEETS.Kabilah = ['id', 'nama', 'lokasi', 'ketua', 'anggota', 'diubah_oleh', 'diubah'];

const SISTEM = '_sistem';
const PESAN_DIHAPUS = '🚫 Pesan ini telah dihapus';
const HARI_PEKAN = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const JAM_HARIS = 18;   // pergantian petugas haris pukul 18.00

/* ---------- pembantu umum ---------- */
function fxArr_(s) {
  if (Array.isArray(s)) return s;
  try { const a = JSON.parse(s || '[]'); if (Array.isArray(a)) return a; } catch (e) {}
  return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
}
/** Ubah daftar username menjadi username resmi yang aktif (tanpa duplikat). */
function fxUsers_(list, filter) {
  const out = [], seen = {};
  fxArr_(list).forEach(x => {
    const r = findUser_(x);
    if (!r || lc_(r.aktif) === 'tidak' || seen[lc_(r.username)]) return;
    if (filter && !filter(r)) return;
    seen[lc_(r.username)] = 1; out.push(r.username);
  });
  return out;
}
function fxKelasUrut_() { const o = {}; kelasAll_().forEach((k, i) => o[k.nama] = i); return o; }
/** Info anggota untuk ditampilkan: foto profil, nama, username, kelas, asal. */
function fxInfo_(un) {
  const r = findUser_(un) || {};
  return { username: r.username || un, nama: r.nama || un, kelas: r.kelas || '', asal: r.asal || '', foto: r.foto || '', tipe: r.tipe || '', kabag: r.kabag || '' };
}
function fxUrutKelas_(list) {
  const ko = fxKelasUrut_();
  const k = x => x.tipe === 'Guru' ? -1 : (ko[x.kelas] === undefined ? 999 : ko[x.kelas]);
  return list.sort((a, b) => k(a) - k(b) || String(a.nama).localeCompare(String(b.nama)));
}
function fxTgl_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function fxHariDari_(tgl) { const m = String(tgl).match(/^(\d{4})-(\d{2})-(\d{2})/); return HARI_PEKAN[new Date(+m[1], +m[2] - 1, +m[3]).getDay()]; }
function fxGeserTgl_(tgl, n) { const m = String(tgl).match(/^(\d{4})-(\d{2})-(\d{2})/); const d = new Date(+m[1], +m[2] - 1, +m[3] + n, 12); return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function fxPasang_(nama, fn) {   // bungkus aksi yang sudah ada
  const asli = ACTIONS[nama];
  if (typeof asli !== 'function' || asli.__fitur) return;
  const baru = function (u, p) { return fn(asli, u, p || {}); };
  baru.__fitur = true;
  ACTIONS[nama] = baru;
}

/* ============================================================
 *  DAFTAR HARIS
 * ============================================================ */
function harisAll_() {
  return readAll_('Haris').filter(r => r.id).map(r => ({
    id: r.id, kelompok: num_(r.kelompok), hari: fxArr_(r.hari), ketua: r.ketua, anggota: fxArr_(r.anggota), _row: r._row
  })).sort((a, b) => a.kelompok - b.kelompok);
}
function harisAnggota_(k) { return [k.ketua].concat(k.anggota).filter(Boolean); }
/** Periode jaga: mulai pukul 18.00 hari ini (atau kemarin bila belum pukul 18.00) sampai 18.00 besoknya. */
function harisPeriode_() {
  const jam = +Utilities.formatDate(new Date(), TZ, 'H');
  const mulai = jam >= JAM_HARIS ? today_() : fxGeserTgl_(today_(), -1);
  return { mulai: mulai, selesai: fxGeserTgl_(mulai, 1), hari: fxHariDari_(mulai), hariSelesai: fxHariDari_(fxGeserTgl_(mulai, 1)) };
}
function harisBertugas_() { const p = harisPeriode_(); return harisAll_().filter(k => k.hari.indexOf(p.hari) >= 0); }
function harisSaya_(u) {
  const me = lc_(u.username);
  return harisBertugas_().find(k => harisAnggota_(k).some(x => lc_(x) === me)) || null;
}
function bolehKelolaHaris_(u) { return can_(u, 'Kabag Jamaah', 'Kabag Algojo'); }
function harisList_(u) {
  const p = harisPeriode_();
  return {
    kelompok: harisAll_().map(k => ({ id: k.id, kelompok: k.kelompok, hari: k.hari, ketua: k.ketua ? fxInfo_(k.ketua) : null,
      anggota: fxUrutKelas_(k.anggota.map(fxInfo_)), bertugas: k.hari.indexOf(p.hari) >= 0, grup: 'g:haris-' + k.id })),
    periode: p, bolehKelola: bolehKelolaHaris_(u)
  };
}
function harisSave_(u, p) {
  need_(bolehKelolaHaris_(u), 'Daftar Haris hanya dapat diatur oleh Kabag Jamaah / Kabag Algojo.');
  const santri = r => r.tipe === 'Santri';
  const kelompok = num_(p.kelompok); if (kelompok < 1) throw new Error('Nomor kelompok tidak valid.');
  const ketua = fxUsers_([p.ketua], santri)[0]; if (!ketua) throw new Error('Pilih ketua (santri).');
  const anggota = fxUsers_(p.anggota, santri).filter(x => lc_(x) !== lc_(ketua));
  const hari = fxArr_(p.hari).filter(h => HARI_PEKAN.indexOf(h) >= 0);
  if (!hari.length) throw new Error('Pilih hari jadwal kelompok.');
  return lock_(() => {
    const all = harisAll_();
    if (all.some(k => k.kelompok === kelompok && k.id !== p.id)) throw new Error('Kelompok ' + kelompok + ' sudah ada.');
    const dobel = [];
    all.filter(k => k.id !== p.id).forEach(k => harisAnggota_(k).forEach(x => { if ([ketua].concat(anggota).some(y => lc_(y) === lc_(x))) dobel.push((findUser_(x) || {}).nama + ' (Kelompok ' + k.kelompok + ')'); }));
    if (dobel.length) throw new Error('Sudah terdaftar di kelompok lain: ' + dobel.join(', '));
    const obj = { kelompok: kelompok, hari: hari.join(', '), ketua: ketua, anggota: JSON.stringify(anggota), diubah_oleh: u.username, diubah: now_() };
    const r = p.id && all.find(x => x.id === p.id);
    if (r) update_('Haris', r._row, obj); else { obj.id = uid_(); append_('Haris', obj); }
    return true;
  });
}
function harisDelete_(u, p) {
  need_(bolehKelolaHaris_(u));
  return lock_(() => { const r = harisAll_().find(x => x.id === p.id); if (r) deleteRows_('Haris', [r._row]); return true; });
}
/** Kirim pengingat ke grup kelompok yang bertugas (sekali per periode). */
function harisCek_() {
  try {
    const p = harisPeriode_(), props = PropertiesService.getScriptProperties();
    const kunci = k => 'haris_ingat_' + p.mulai + '_' + k.id;
    const belum = () => harisBertugas_().filter(k => !props.getProperty(kunci(k)));
    if (!belum().length) return;
    lock_(() => {
      const tugas = belum(); if (!tugas.length) return;
      const rows = tugas.map(k => ({
        id: uid_() + k.kelompok, dari: SISTEM, ke: 'g:haris-' + k.id, waktu: now_(), dibaca: '',
        pesan: '📢 PENGINGAT HARIS\nKelompok ' + k.kelompok + ' bertugas sebagai Haris mulai ' + p.hari + ', ' + lgTgl_(p.mulai) + ' pukul 18.00 sampai ' +
          p.hariSelesai + ', ' + lgTgl_(p.selesai) + ' pukul 18.00.\nKetua: ' + ((findUser_(k.ketua) || {}).nama || k.ketua) +
          (k.anggota.length ? '\nAnggota: ' + k.anggota.map(x => (findUser_(x) || {}).nama || x).join(', ') : '') +
          '\nJangan lupa mengabsen jamaah santri (menu Absen & Izin → Absen Jamaah Santri). Selamat bertugas.'
      }));
      appendMany_('Chat', rows);
      tugas.forEach(k => props.setProperty(kunci(k), now_()));
    });
  } catch (e) { console.warn('Pengingat haris: ' + e); }
}
/** Untuk pemicu berbasis waktu (opsional). */
function kirimPengingatHaris() { harisCek_(); }

/* ============================================================
 *  DAFTAR ASRAMA
 * ============================================================ */
function asramaAll_() {
  return readAll_('Asrama').filter(r => r.id).map(r => ({
    id: r.id, jenis: r.jenis || 'Santriwan', nomor: num_(r.nomor), nama: r.nama, lokasi: r.lokasi, keterangan: r.keterangan,
    ketua: r.ketua, anggota: fxArr_(r.anggota), piket: (function () { try { return JSON.parse(r.piket || '{}'); } catch (e) { return {}; } })(), _row: r._row
  })).sort((a, b) => a.nomor - b.nomor);
}
function asramaAnggota_(a) { return [a.ketua].concat(a.anggota).filter(Boolean); }
function asramaMember_(u, a) { const me = lc_(u.username); return asramaAnggota_(a).some(x => lc_(x) === me); }
function asramaJudul_(a) { return 'Asrama ' + a.nomor + (a.nama ? ' – ' + a.nama : ''); }
function bolehKelolaAsrama_(u) { return can_(u, 'Kabag Asrama'); }
function asramaCari_(u, id, harusAnggota) {
  const a = asramaAll_().find(x => x.id === id); if (!a) throw new Error('Asrama tidak ditemukan.');
  if (harusAnggota) need_(asramaMember_(u, a), 'Hanya anggota ' + asramaJudul_(a) + ' yang dapat membuka bagian ini.');
  return a;
}
function asramaList_(u, p) {
  const kelola = bolehKelolaAsrama_(u);
  return {
    bolehKelola: kelola,
    asrama: asramaAll_().filter(a => !p.jenis || a.jenis === p.jenis).map(a => {
      const saya = asramaMember_(u, a);
      return { id: a.id, jenis: a.jenis, nomor: a.nomor, nama: a.nama, lokasi: a.lokasi, keterangan: a.keterangan,
        ketua: a.ketua ? fxInfo_(a.ketua) : null, anggota: fxUrutKelas_(a.anggota.map(fxInfo_)), saya: saya, grup: 'g:asrama-' + a.id,
        bolehUbah: saya || kelola };
    })
  };
}
function asramaSave_(u, p) {
  const kelola = bolehKelolaAsrama_(u);
  return lock_(() => {
    const all = asramaAll_();
    const a = p.id ? all.find(x => x.id === p.id) : null;
    if (p.id && !a) throw new Error('Asrama tidak ditemukan.');
    if (!a) need_(kelola, 'Asrama baru hanya dapat ditambahkan oleh Kabag Asrama.');
    else need_(kelola || asramaMember_(u, a), 'Hanya anggota asrama atau Kabag Asrama yang dapat mengubah asrama ini.');
    const obj = { diubah_oleh: u.username, diubah: now_() };
    // semua anggota & Kabag Asrama: nama, lokasi, keterangan, ketua
    if (p.nama !== undefined) obj.nama = String(p.nama).trim().slice(0, 80);
    if (p.lokasi !== undefined) obj.lokasi = String(p.lokasi).trim().slice(0, 120);
    if (p.keterangan !== undefined) obj.keterangan = String(p.keterangan).trim().slice(0, 1000);
    let anggota = a ? asramaAnggota_(a) : [];
    if (kelola && p.anggota !== undefined) anggota = fxUsers_(p.anggota);
    let ketua = a ? a.ketua : '';
    if (p.ketua !== undefined) {
      ketua = fxUsers_([p.ketua])[0];
      if (!ketua) throw new Error('Pilih ketua asrama.');
      if (!kelola && !anggota.some(x => lc_(x) === lc_(ketua))) throw new Error('Ketua harus dipilih dari anggota asrama.');
    }
    if (!ketua) throw new Error('Pilih ketua asrama.');
    const sisa = fxUsers_(anggota.filter(x => lc_(x) !== lc_(ketua)));
    obj.ketua = ketua; obj.anggota = JSON.stringify(sisa);
    // khusus Kabag Asrama: jenis, nomor, susunan anggota
    if (kelola) {
      const jenis = p.jenis !== undefined ? (p.jenis === 'Santriwati' ? 'Santriwati' : 'Santriwan') : (a ? a.jenis : 'Santriwan');
      const n = p.nomor !== undefined ? num_(p.nomor) : (a ? a.nomor : 0);
      if (n < 1 || n > 500) throw new Error('Nomor asrama harus 1 – 500.');
      if (all.some(x => x.nomor === n && x.jenis === jenis && x.id !== p.id)) throw new Error('Asrama ' + n + ' (' + jenis + ') sudah ada.');
      obj.jenis = jenis; obj.nomor = n;
      const dobel = [];
      all.filter(x => x.id !== p.id).forEach(x => asramaAnggota_(x).forEach(y => { if ([ketua].concat(sisa).some(z => lc_(z) === lc_(y))) dobel.push((findUser_(y) || {}).nama + ' (' + asramaJudul_(x) + ')'); }));
      if (dobel.length) throw new Error('Sudah menjadi anggota asrama lain: ' + dobel.join(', '));
    }
    if (!a) { obj.id = uid_(); obj.piket = '{}'; append_('Asrama', obj); return { id: obj.id }; }
    update_('Asrama', a._row, obj);
    return { id: a.id };
  });
}
function asramaDelete_(u, p) {
  need_(bolehKelolaAsrama_(u), 'Asrama hanya dapat dihapus oleh Kabag Asrama.');
  return lock_(() => { const a = asramaAll_().find(x => x.id === p.id); if (a) deleteRows_('Asrama', [a._row]); return true; });
}
/** Piket: { Sabtu: { anggota: [..], tugas: '..' }, ... } — hanya anggota asrama. */
function asramaPiket_(u, p) {
  const a = asramaCari_(u, p.id, true);
  if (p.piket) {
    const bersih = {};
    HARI_PEKAN.forEach(h => {
      const x = p.piket[h] || {};
      const ang = fxUsers_(x.anggota).filter(y => asramaAnggota_(a).some(z => lc_(z) === lc_(y)));
      if (ang.length || x.tugas) bersih[h] = { anggota: ang, tugas: String(x.tugas || '').slice(0, 200) };
    });
    lock_(() => update_('Asrama', a._row, { piket: JSON.stringify(bersih), diubah_oleh: u.username, diubah: now_() }));
    a.piket = bersih;
  }
  const out = {};
  HARI_PEKAN.forEach(h => { const x = a.piket[h] || {}; out[h] = { anggota: fxArr_(x.anggota).map(fxInfo_), tugas: x.tugas || '' }; });
  return { piket: out, anggota: fxUrutKelas_(asramaAnggota_(a).map(fxInfo_)) };
}
function asramaFolder_() { const r = folder_(), it = r.getFoldersByName('Asrama'); return it.hasNext() ? it.next() : r.createFolder('Asrama'); }
function asramaDokList_(u, p) {
  const a = asramaCari_(u, p.id, true);
  return readAll_('AsramaDok').filter(d => d.asrama === a.id).sort((x, y) => String(y.waktu).localeCompare(String(x.waktu)))
    .map(d => ({ id: d.id, jenis: d.jenis, file: d.file, nama: d.nama, mime: d.mime, ukuran: num_(d.ukuran), keterangan: d.keterangan, oleh: (findUser_(d.oleh) || {}).nama || d.oleh, waktu: d.waktu, milik: lc_(d.oleh) === lc_(u.username) }));
}
function asramaDokAdd_(u, p) {
  const a = asramaCari_(u, p.id, true);
  if (!p.data) throw new Error('Pilih file.');
  const m = String(p.data).match(/^data:([^;,]+)[;,]/);
  const mime = String(p.mime || (m ? m[1] : '') || 'application/octet-stream').toLowerCase();
  const jenis = mime.indexOf('image/') === 0 ? 'foto' : mime.indexOf('video/') === 0 ? 'video' : 'dokumen';
  const nama = String(p.nama || jenis).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
  if (CHAT_DILARANG.test(nama)) throw new Error('Jenis file ini tidak diizinkan.');
  const bytes = Utilities.base64Decode(String(p.data).replace(/^data:[^,]*,/, ''));
  if (bytes.length > CHAT_MAKS[jenis] * 1024 * 1024) throw new Error('Ukuran ' + jenis + ' maksimal ' + CHAT_MAKS[jenis] + ' MB.');
  const f = asramaFolder_().createFile(Utilities.newBlob(bytes, mime, Date.now() + '_' + nama));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  append_('AsramaDok', { id: uid_(), asrama: a.id, jenis: jenis, file: f.getId(), nama: nama, mime: mime, ukuran: bytes.length, keterangan: String(p.keterangan || '').slice(0, 300), oleh: u.username, waktu: now_() });
  return true;
}
function asramaDokDelete_(u, p) {
  return lock_(() => {
    const d = readAll_('AsramaDok').find(x => x.id === p.id); if (!d) return true;
    asramaCari_(u, d.asrama, true);
    try { DriveApp.getFileById(d.file).setTrashed(true); } catch (e) {}
    deleteRows_('AsramaDok', [d._row]);
    return true;
  });
}
/** media.get: dokumentasi asrama boleh dibuka anggota asrama tersebut. */
function mediaBolehLain_(u, id) {
  if (readAll_('Postingan').some(r => r.lampiran && String(r.lampiran).indexOf(id) >= 0 && postBoleh_(u, r))) return true;
  const d = readAll_('AsramaDok').find(x => x.file === id); if (!d) return false;
  const a = asramaAll_().find(x => x.id === d.asrama);
  return !!a && asramaMember_(u, a);
}

/* ============================================================
 *  DAFTAR KABILAH (Kabag Muzakir)
 * ============================================================ */
function kabilahAll_() {
  return readAll_('Kabilah').filter(r => r.id).map(r => ({ id: r.id, nama: r.nama, lokasi: r.lokasi, ketua: r.ketua, anggota: fxArr_(r.anggota), _row: r._row }))
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
}
function kabilahAnggota_(k) { return [k.ketua].concat(k.anggota).filter(Boolean); }
function bolehKelolaKabilah_(u) { return can_(u, 'Kabag Muzakir'); }
function kabilahList_(u) {
  const me = lc_(u.username);
  return { bolehKelola: bolehKelolaKabilah_(u), kabilah: kabilahAll_().map(k => ({ id: k.id, nama: k.nama, lokasi: k.lokasi,
    ketua: k.ketua ? fxInfo_(k.ketua) : null, anggota: fxUrutKelas_(k.anggota.map(fxInfo_)), grup: 'g:kabilah-' + k.id,
    saya: kabilahAnggota_(k).some(x => lc_(x) === me) })) };
}
function kabilahSave_(u, p) {
  need_(bolehKelolaKabilah_(u), 'Daftar Kabilah hanya dapat diatur oleh Kabag Muzakir.');
  const nama = String(p.nama || '').trim(); if (!nama) throw new Error('Isi nama kabilah.');
  const ketua = fxUsers_([p.ketua])[0]; if (!ketua) throw new Error('Pilih ketua kabilah.');
  const anggota = fxUsers_(p.anggota).filter(x => lc_(x) !== lc_(ketua));
  return lock_(() => {
    const all = kabilahAll_();
    const obj = { nama: nama.slice(0, 80), lokasi: String(p.lokasi || '').trim().slice(0, 120), ketua: ketua, anggota: JSON.stringify(anggota), diubah_oleh: u.username, diubah: now_() };
    const r = p.id && all.find(x => x.id === p.id);
    if (r) update_('Kabilah', r._row, obj); else { obj.id = uid_(); append_('Kabilah', obj); }
    return true;
  });
}
function kabilahDelete_(u, p) {
  need_(bolehKelolaKabilah_(u));
  return lock_(() => { const r = kabilahAll_().find(x => x.id === p.id); if (r) deleteRows_('Kabilah', [r._row]); return true; });
}

/* ============================================================
 *  GRUP ROOM CHAT
 *  id grup = "g:<id>" (grup buatan pengguna), "g:haris-<id>", "g:asrama-<id>", "g:kabilah-<id>" (otomatis)
 * ============================================================ */
let FX_GRUP = null;
function grupSemua_() {
  if (FX_GRUP) return FX_GRUP;
  const g = [];
  readAll_('Grup').filter(r => r.id).forEach(r => g.push({ id: 'g:' + r.id, nama: r.nama, jenis: 'grup', anggota: fxArr_(r.anggota), admin: fxArr_(r.admin), _row: r._row, _id: r.id }));
  harisAll_().forEach(k => g.push({ id: 'g:haris-' + k.id, nama: 'Haris Kelompok ' + k.kelompok, jenis: 'haris', anggota: harisAnggota_(k), admin: [] }));
  asramaAll_().forEach(a => g.push({ id: 'g:asrama-' + a.id, nama: asramaJudul_(a), jenis: 'asrama', anggota: asramaAnggota_(a), admin: [] }));
  kabilahAll_().forEach(k => g.push({ id: 'g:kabilah-' + k.id, nama: 'Kabilah ' + k.nama, jenis: 'kabilah', anggota: kabilahAnggota_(k), admin: [] }));
  g.forEach(x => { x.lc = {}; x.anggota.forEach(a => x.lc[lc_(a)] = 1); });
  FX_GRUP = g;
  return g;
}
function grupReset_() { FX_GRUP = null; }
/** Peta grup yang diikuti pengguna: { 'g:..': grup } */
function grupSaya_(u) { const me = lc_(u.username), m = {}; grupSemua_().forEach(g => { if (g.lc[me]) m[g.id] = g; }); return m; }
function grupCek_(u, gid) {
  const g = grupSemua_().find(x => x.id === gid);
  if (!g) throw new Error('Grup tidak ditemukan.');
  if (!g.lc[lc_(u.username)]) throw new Error('Anda bukan anggota grup ini.');
  return g;
}
function grupBacaMap_(u) { const me = lc_(u.username), m = {}; readAll_('GrupBaca').forEach(r => { if (lc_(r.username) === me) m[r.grup] = r; }); return m; }
function grupTandaiBaca_(u, gid) {
  const r = grupBacaMap_(u)[gid], w = now_();
  if (r) update_('GrupBaca', r._row, { terakhir: w }); else append_('GrupBaca', { grup: gid, username: u.username, terakhir: w });
}
function fxPesan_(c, me, nm) {   // bentuk pesan untuk klien (+ balasan, lampiran, penanda)
  const m = { id: c.id, dariSaya: lc_(c.dari) === me, pesan: c.pesan, waktu: c.waktu, dibaca: c.dibaca === 'Ya' };
  if (c.dari === SISTEM) m.sistem = true;
  if (String(c.ke).indexOf('g:') === 0 && !m.dariSaya && !m.sistem) { m.dari = c.dari; m.nama = nm[lc_(c.dari)] || c.dari; }
  if (c.diteruskan === 'Ya') m.diteruskan = true;
  if (c.diedit) m.diedit = true;
  if (c.dihapus === 'Ya') m.dihapus = true;
  return m;
}
function grupThread_(u, p) {
  const g = grupCek_(u, p['with']), me = lc_(u.username), nm = nameMap_();
  let rows = readAll_('Chat').filter(c => c.ke === g.id).sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)) || a._row - b._row);
  if (p.since) rows = rows.filter(c => String(c.waktu) >= String(p.since) || String(c.diubah || '') >= String(p.since));
  try { grupTandaiBaca_(u, g.id); } catch (e) {}
  const peta = chatPeta_();
  return rows.slice(-200).map(c => chatPerkaya_(fxPesan_(c, me, nm), c, peta, me));
}
function grupInfo_(u, p) {
  const g = grupCek_(u, p.id);
  const admin = g.admin.map(lc_);
  return { id: g.id, nama: g.nama, jenis: g.jenis, anggota: fxUrutKelas_(g.anggota.map(fxInfo_)).map(x => Object.assign(x, { admin: admin.indexOf(lc_(x.username)) >= 0 })),
    bolehKelola: g.jenis === 'grup' && admin.indexOf(lc_(u.username)) >= 0 };
}
/** Pengguna dari pilihan: users[], kelas[] (semua santri di kelas), guru (semua dewan guru). */
function fxPenerima_(p) {
  let list = fxUsers_(p.users);
  if ((p.kelas || []).length) list = list.concat(santriAll_().filter(s => p.kelas.indexOf(s.kelas) >= 0).map(s => s.username));
  if (p.guru) list = list.concat(guruAll_().map(g => g.username));
  return fxUsers_(list);
}
function grupSave_(u, p) {
  const nama = String(p.nama || '').trim().slice(0, 60);
  return lock_(() => {
    grupReset_();
    if (!p.id) {
      if (!nama) throw new Error('Isi nama grup.');
      const anggota = fxUsers_([u.username].concat(fxPenerima_(p)));
      if (anggota.length < 2) throw new Error('Pilih minimal satu anggota.');
      const id = uid_();
      append_('Grup', { id: id, nama: nama, anggota: JSON.stringify(anggota), admin: JSON.stringify([u.username]), dibuat_oleh: u.username, waktu: now_() });
      append_('Chat', { id: uid_(), dari: SISTEM, ke: 'g:' + id, pesan: (u.nama || u.username) + ' membuat grup "' + nama + '"', waktu: now_(), dibaca: '' });
      grupReset_();
      return { id: 'g:' + id, nama: nama };
    }
    const g = grupCek_(u, p.id);
    need_(g.jenis === 'grup', 'Anggota grup ini diatur otomatis dari Daftar ' + (g.jenis === 'haris' ? 'Haris' : g.jenis === 'asrama' ? 'Asrama' : 'Kabilah') + '.');
    need_(g.admin.some(x => lc_(x) === lc_(u.username)), 'Hanya admin grup yang dapat mengubah grup.');
    const hapus = fxArr_(p.hapus).map(lc_);
    let anggota = g.anggota.filter(x => hapus.indexOf(lc_(x)) < 0).concat(fxPenerima_(p));
    anggota = fxUsers_(anggota);
    const obj = { anggota: JSON.stringify(anggota) };
    if (nama) obj.nama = nama;
    update_('Grup', g._row, obj);
    grupReset_();
    return { id: g.id, nama: nama || g.nama };
  });
}
function grupKeluar_(u, p) {
  return lock_(() => {
    grupReset_();
    const g = grupCek_(u, p.id);
    need_(g.jenis === 'grup', 'Keanggotaan grup ini mengikuti Daftar ' + (g.jenis === 'haris' ? 'Haris' : g.jenis === 'asrama' ? 'Asrama' : 'Kabilah') + '.');
    const anggota = g.anggota.filter(x => lc_(x) !== lc_(u.username));
    if (!anggota.length) { deleteRows_('Grup', [g._row]); return true; }
    let admin = g.admin.filter(x => lc_(x) !== lc_(u.username));
    if (!admin.length) admin = [anggota[0]];
    update_('Grup', g._row, { anggota: JSON.stringify(anggota), admin: JSON.stringify(admin) });
    append_('Chat', { id: uid_(), dari: SISTEM, ke: g.id, pesan: (u.nama || u.username) + ' keluar dari grup', waktu: now_(), dibaca: '' });
    return true;
  });
}
/** Ringkasan grup untuk daftar Room Chat. */
function grupKontak_(u) {
  const me = lc_(u.username), saya = grupSaya_(u), baca = grupBacaMap_(u), nm = nameMap_();
  const last = {}, unread = {};
  readAll_('Chat').forEach(c => {
    if (!saya[c.ke]) return;
    if (!last[c.ke] || String(c.waktu) >= String(last[c.ke].waktu)) last[c.ke] = c;
    const t = (baca[c.ke] || {}).terakhir || '';
    if (lc_(c.dari) !== me && String(c.waktu) > String(t)) unread[c.ke] = (unread[c.ke] || 0) + 1;
  });
  return Object.keys(saya).map(id => {
    const g = saya[id], l = last[id];
    return { username: id, grup: true, jenis: g.jenis, nama: g.nama, anggota: g.anggota.length, unread: unread[id] || 0,
      last: l ? { pesan: (l.dari === SISTEM ? '' : (lc_(l.dari) === me ? '' : String(nm[lc_(l.dari)] || l.dari).split(' ')[0] + ': ')) + l.pesan, waktu: l.waktu, dariSaya: lc_(l.dari) === me } : null };
  }).sort((a, b) => (b.last ? b.last.waktu : '').localeCompare(a.last ? a.last.waktu : '') || String(a.nama).localeCompare(String(b.nama)));
}

/* ---------- pasang ke aksi Room Chat yang sudah ada ---------- */
fxPasang_('chat.contacts', (asli, u, p) => { harisCek_(); return grupKontak_(u).concat(asli(u, p)); });
fxPasang_('chat.unread', (asli, u, p) => {
  harisCek_();
  const r = asli(u, p);
  try {
    const me = lc_(u.username), saya = grupSaya_(u), baca = grupBacaMap_(u), nm = nameMap_();
    const g = readAll_('Chat').filter(c => saya[c.ke] && lc_(c.dari) !== me && String(c.waktu) > String((baca[c.ke] || {}).terakhir || ''));
    r.count += g.length;
    r.latest = r.latest.concat(g.map(c => ({ id: c.id, dari: c.ke, nama: saya[c.ke].nama, pesan: (c.dari === SISTEM ? '' : (nm[lc_(c.dari)] || c.dari) + ': ') + c.pesan, waktu: c.waktu })))
      .sort((a, b) => String(b.waktu).localeCompare(String(a.waktu))).slice(0, 5);
  } catch (e) {}
  return r;
});
fxPasang_('chat.thread', (asli, u, p) => {
  if (String(p['with'] || '').indexOf('g:') === 0) return grupThread_(u, p);
  const list = asli(u, p);
  try {
    const me = lc_(u.username), other = lc_(p['with']), peta = chatPeta_(), nm = nameMap_(), ada = {};
    list.forEach(m => { ada[m.id] = 1; const c = peta[m.id]; if (c) Object.assign(m, fxPesan_(c, me, nm), { lampiran: m.lampiran, balas: m.balas, story: m.story }); });
    if (p.since) {   // pesan lama yang baru diedit / dihapus
      readAll_('Chat').filter(c => !ada[c.id] && String(c.diubah || '') >= String(p.since) &&
        ((lc_(c.dari) === me && lc_(c.ke) === other) || (lc_(c.dari) === other && lc_(c.ke) === me)))
        .forEach(c => list.push(chatPerkaya_(fxPesan_(c, me, nm), c, peta, me)));
    }
  } catch (e) {}
  return list;
});
fxPasang_('chat.send', (asli, u, p) => {
  if (String(p.to || '').indexOf('g:') !== 0) return asli(u, p);
  const g = grupCek_(u, p.to);
  const pesan = String(p.pesan || '').trim(); if (!pesan) throw new Error('Pesan kosong.');
  if (pesan.length > 2000) throw new Error('Pesan terlalu panjang (maks. 2000 karakter).');
  const cid = String(p._cid || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (cid && readAll_('Chat').some(c => c.id === cid)) return { id: cid, dariSaya: true, pesan: pesan, waktu: now_(), dibaca: false };
  const balas = chatBalasValid_(u, g.id, p.balas);
  const obj = { id: cid || uid_(), dari: u.username, ke: g.id, pesan: pesan, waktu: now_(), dibaca: '', balas: balas };
  append_('Chat', obj);
  const res = { id: obj.id, dariSaya: true, pesan: pesan, waktu: obj.waktu, dibaca: false };
  if (balas) res.balas = chatKutip_(chatPeta_()[balas], lc_(u.username));
  return res;
});

/* ---------- teruskan, edit, hapus pesan ---------- */
function fxPesanSaya_(u, id, milik) {
  const c = readAll_('Chat').find(x => x.id === id); if (!c) throw new Error('Pesan tidak ditemukan.');
  const me = lc_(u.username);
  const boleh = lc_(c.dari) === me || lc_(c.ke) === me || (String(c.ke).indexOf('g:') === 0 && grupSaya_(u)[c.ke]);
  need_(boleh, 'Pesan tidak ditemukan.');
  if (milik) need_(lc_(c.dari) === me, 'Anda hanya dapat mengubah pesan milik sendiri.');
  return c;
}
function chatForward_(u, p) {
  const c = fxPesanSaya_(u, p.id, false);
  if (c.dihapus === 'Ya') throw new Error('Pesan yang dihapus tidak dapat diteruskan.');
  const me = lc_(u.username), saya = grupSaya_(u);
  const users = fxPenerima_(p).filter(x => lc_(x) !== me);
  const grup = fxArr_(p.grup).filter(g => saya[g]);
  if (!users.length && !grup.length) throw new Error('Pilih penerima pesan.');
  if (users.length + grup.length > 600) throw new Error('Penerima terlalu banyak (maks. 600).');
  const w = now_(), dasar = uid_();
  const rows = users.map((x, i) => ({ id: dasar + 'u' + i, dari: u.username, ke: x, pesan: c.pesan, waktu: w, dibaca: 'Tidak', lampiran: c.lampiran || '', diteruskan: 'Ya' }))
    .concat(grup.map((g, i) => ({ id: dasar + 'g' + i, dari: u.username, ke: g, pesan: c.pesan, waktu: w, dibaca: '', lampiran: c.lampiran || '', diteruskan: 'Ya' })));
  lock_(() => appendMany_('Chat', rows));
  return { terkirim: rows.length, pengguna: users.length, grup: grup.length };
}
function chatEdit_(u, p) {
  const pesan = String(p.pesan || '').trim(); if (!pesan) throw new Error('Pesan kosong.');
  if (pesan.length > 2000) throw new Error('Pesan terlalu panjang (maks. 2000 karakter).');
  return lock_(() => {
    const c = fxPesanSaya_(u, p.id, true);
    if (c.dihapus === 'Ya') throw new Error('Pesan sudah dihapus.');
    const patch = { pesan: pesan, diedit: now_(), diubah: now_() };
    if (c.lampiran) { try { const l = JSON.parse(c.lampiran); l.auto = false; patch.lampiran = JSON.stringify(l); } catch (e) {} }
    update_('Chat', c._row, patch);
    return { id: c.id, pesan: pesan, diedit: true };
  });
}
function chatHapus_(u, p) {
  return lock_(() => {
    const c = fxPesanSaya_(u, p.id, true);
    update_('Chat', c._row, { pesan: PESAN_DIHAPUS, lampiran: '', balas: '', dihapus: 'Ya', diubah: now_() });
    return { id: c.id, dihapus: true, pesan: PESAN_DIHAPUS };
  });
}

/* ============================================================
 *  ABSEN JAMAAH SANTRI — Kabag Jamaah / Haris yang bertugas
 *  Status: H = Hadir, I = Izin/Sakit, A = Alpa.  Pilih per kelas atau per asrama.
 * ============================================================ */
function jamaahAkses_(u) {
  const kabag = can_(u, 'Kabag Jamaah'), h = harisSaya_(u), p = harisPeriode_();
  return { kabag: kabag, haris: !!h, kelompok: h ? h.kelompok : null, periode: p, tanggal: kabag ? null : [p.mulai, p.selesai] };
}
function jamaahBoleh_(u, tgl) {
  const a = jamaahAkses_(u);
  if (a.kabag) return true;
  need_(a.haris, 'Absen jamaah hanya dapat dilakukan oleh Kabag Jamaah atau Haris yang sedang bertugas.');
  need_(a.tanggal.indexOf(tgl) >= 0, 'Haris hanya dapat mengabsen selama masa tugas (' + lgTgl_(a.periode.mulai) + ' 18.00 – ' + lgTgl_(a.periode.selesai) + ' 18.00).');
  return true;
}
function jamaahForm_(u, p) {
  const tgl = tglValid_(p.tanggal) || today_();
  jamaahBoleh_(u, tgl);
  let santri;
  if (p.mode === 'asrama') {
    const a = asramaAll_().find(x => x.id === p.asrama); if (!a) throw new Error('Pilih asrama.');
    const set = {}; asramaAnggota_(a).forEach(x => set[lc_(x)] = 1);
    santri = santriAll_().filter(s => set[lc_(s.username)]);
  } else santri = santriAll_().filter(s => s.kelas === p.kelas);
  const ada = {};
  readAll_('Absensi').forEach(r => { if (r.jenis === 'Jamaah' && r.tanggal === tgl && r.sesi === String(p.sesi || '')) ada[lc_(r.username)] = r.status; });
  const ko = fxKelasUrut_();
  return { tanggal: tgl, items: santri.sort((a, b) => (ko[a.kelas] || 0) - (ko[b.kelas] || 0) || String(a.nama).localeCompare(String(b.nama)))
    .map(s => ({ username: s.username, nama: s.nama, kelas: s.kelas, status: ({ H: 'H', I: 'I', S: 'I', A: 'A' })[ada[lc_(s.username)]] || '' })) };
}
function jamaahSave_(u, p) {
  const tgl = tglValid_(p.tanggal) || today_();
  jamaahBoleh_(u, tgl);
  if (['Subuh', 'Zuhur', 'Ashar', 'Maghrib', 'Isya'].indexOf(p.sesi) < 0) throw new Error('Pilih waktu shalat.');
  const items = (p.items || []).filter(i => ['H', 'I', 'A'].indexOf(i.status) >= 0);
  return lock_(() => {
    const ada = {};
    readAll_('Absensi').forEach(r => { if (r.jenis === 'Jamaah' && r.tanggal === tgl && r.sesi === p.sesi) ada[lc_(r.username)] = r; });
    const baru = [];
    items.forEach(i => {
      const s = findUser_(i.username); if (!s || s.tipe !== 'Santri') return;
      const obj = { tanggal: tgl, jenis: 'Jamaah', sesi: p.sesi, kelas: s.kelas || '', mapel: '', username: s.username, status: i.status,
        keterangan: i.status === 'I' ? 'Izin/Sakit' : '', oleh: u.username, waktu: now_() };
      const ex = ada[lc_(s.username)];
      if (ex) { if (ex.status !== i.status) update_('Absensi', ex._row, obj); }
      else { obj.id = uid_() + baru.length; baru.push(obj); }
    });
    appendMany_('Absensi', baru);
    return { tersimpan: items.length };
  });
}

/* ============================================================
 *  LAPORAN PDF IURAN BULANAN & UANG TAHUNAN SEMUA SANTRI
 *  Urut: Wustha → Ulya → Salafi, per kelas (Kelas, Wali Kelas, Nama, Bulan, Total)
 * ============================================================ */
function fxKelasLaporan_() {
  const urut = { Wustha: 0, Ulya: 1, Salafi: 2 };
  return kelasAll_().map((k, i) => ({ nama: k.nama, jenjang: k.jenjang, i: i }))
    .sort((a, b) => (urut[a.jenjang] === undefined ? 3 : urut[a.jenjang]) - (urut[b.jenjang] === undefined ? 3 : urut[b.jenjang]) || a.i - b.i);
}
function fxBulanTeks_(lunas, kurang, tahun) {
  const t = [];
  if (lunas.length) {
    const b = lunas.slice().sort((x, y) => x - y), grp = [];
    b.forEach(x => { const g = grp[grp.length - 1]; if (g && x === g[1] + 1) g[1] = x; else grp.push([x, x]); });
    t.push(grp.map(g => g[0] === g[1] ? BULAN[g[0] - 1] : BULAN[g[0] - 1] + ' s/d ' + BULAN[g[1] - 1]).join(', '));
  }
  kurang.forEach(k => t.push(BULAN[k.bulan - 1] + ' (kurang ' + rp_(k.kurang) + ')'));
  return t.length ? t.join('; ') : '-';
}
function fxLaporan_(judul, sub, kolom, blok, totalSemua, nama) {
  const s = settingsMap_();
  let h = kop_(s.nama_dayah || 'DAYAH AL-HUDA MALIKUSSALEH', 'logo_dayah');
  h += '<h3>' + esc_(judul) + '</h3><div class="sub">' + esc_(sub) + '</div>';
  blok.filter(b => b.rows.length).forEach(b => {
    h += '<table class="info" style="margin-top:14px"><tr><td>Kelas</td><td>: <b>' + esc_(b.kelas) + '</b> (' + esc_(b.jenjang) + ')</td></tr><tr><td>Wali Kelas</td><td>: ' + esc_(b.wali || '-') + '</td></tr></table>';
    h += '<table class="tbl"><tr><th style="width:28px">No</th><th style="width:34%">Nama</th><th>' + esc_(kolom) + '</th><th style="width:100px">Total</th></tr>';
    if (!b.rows.length) h += '<tr><td colspan="4" class="c">Belum ada santri</td></tr>';
    b.rows.forEach((r, i) => { h += '<tr><td class="c">' + (i + 1) + '</td><td>' + esc_(r.nama) + '</td><td>' + esc_(r.bulan) + '</td><td class="r">' + rp_(r.total) + '</td></tr>'; });
    h += '<tr class="tot"><td colspan="3">Jumlah ' + esc_(b.kelas) + '</td><td class="r">' + rp_(b.total) + '</td></tr></table>';
  });
  h += '<table class="tbl" style="margin-top:16px"><tr class="tot"><td>TOTAL KESELURUHAN</td><td class="r" style="width:120px">' + rp_(totalSemua) + '</td></tr></table>';
  h += ttdBendahara_();
  return toPdf_(h, nama);
}
function iuranLaporan_(u, p) {
  need_(perms_(u).keuangan, 'Laporan ini khusus Admin & Kabag Bendahara.');
  const tahun = String(p.tahun || Utilities.formatDate(new Date(), TZ, 'yyyy'));
  const bayar = {};
  readAll_('Iuran').filter(r => String(r.tahun) === tahun).forEach(r => { const k = lc_(r.username); (bayar[k] = bayar[k] || {})[num_(r.bulan)] = ((bayar[k] || {})[num_(r.bulan)] || 0) + num_(r.jumlah); });
  const santri = santriAll_();
  let semua = 0;
  const blok = fxKelasLaporan_().map(k => {
    const nominal = nominalIuran_(k.nama), w = waliOf_(k.nama);
    const rows = santri.filter(s => s.kelas === k.nama).sort((a, b) => String(a.nama).localeCompare(String(b.nama))).map(s => {
      const b = bayar[lc_(s.username)] || {}, lunas = [], kurang = [];
      let total = 0;
      Object.keys(b).forEach(m => { total += b[m]; if (nominal > 0 && b[m] < nominal) kurang.push({ bulan: +m, kurang: nominal - b[m] }); else lunas.push(+m); });
      kurang.sort((x, y) => x.bulan - y.bulan);
      return { nama: s.nama, bulan: fxBulanTeks_(lunas, kurang, tahun), total: total };
    });
    const total = rows.reduce((a, r) => a + r.total, 0); semua += total;
    return { kelas: k.nama, jenjang: k.jenjang, wali: w ? w.nama : '', rows: rows, total: total };
  });
  return fxLaporan_('LAPORAN IURAN BULANAN SANTRI', 'Tahun ' + tahun, 'Bulan Dibayar (' + tahun + ')', blok, semua, 'Laporan_Iuran_Santri_' + tahun);
}
function tahunanLaporan_(u, p) {
  need_(perms_(u).keuangan, 'Laporan ini khusus Admin & Kabag Bendahara.');
  const ta = String(p.tahun_ajaran || getSetting_('tahun_ajaran'));
  const bayar = {};
  readAll_('UangTahunan').filter(r => r.tahun_ajaran === ta).forEach(r => { const k = lc_(r.username); bayar[k] = (bayar[k] || 0) + num_(r.jumlah); });
  const santri = santriAll_();
  let semua = 0;
  const blok = fxKelasLaporan_().map(k => {
    const nominal = nominalTahunan_(k.nama), w = waliOf_(k.nama);
    const rows = santri.filter(s => s.kelas === k.nama).sort((a, b) => String(a.nama).localeCompare(String(b.nama))).map(s => {
      const t = bayar[lc_(s.username)] || 0;
      return { nama: s.nama, total: t, bulan: !t ? 'Belum bayar (' + rp_(nominal) + ')' : t >= nominal ? 'Lunas' : 'Kurang ' + rp_(nominal - t) };
    });
    const total = rows.reduce((a, r) => a + r.total, 0); semua += total;
    return { kelas: k.nama, jenjang: k.jenjang, wali: w ? w.nama : '', rows: rows, total: total };
  });
  return fxLaporan_('LAPORAN UANG TAHUNAN SANTRI', 'Tahun Ajaran ' + ta, 'Keterangan', blok, semua, 'Laporan_Uang_Tahunan_' + ta.replace('/', '-'));
}

/* ============================================================
 *  PEMBERITAHUAN HARI INI — untuk semua pengguna
 * ============================================================ */
function fxSebagaiGuru_(u) { return Object.assign({}, u, { tipe: 'Guru' }); }
/* Bagian jamaah tidak ditampilkan di Pemberitahuan (sudah ada di Catatan Haris) */
function fxTanpaJamaah_(r) { (r.days || []).forEach(d => d.jamaah = []); return r; }
fxPasang_('pemberitahuan', (asli, u, p) => fxTanpaJamaah_(asli(isGuru_(u) ? u : fxSebagaiGuru_(u), p)));
fxPasang_('dashboard', (asli, u, p) => {
  harisCek_();
  const d = asli(u, p);
  try { d.notifHariIni = notifRingkas_(fxTanpaJamaah_(pemberitahuan_(fxSebagaiGuru_(u), { hari: 1 })).days[0]); } catch (e) {}
  try {
    const h = harisSaya_(u), per = harisPeriode_();
    const tugas = harisBertugas_();
    d.haris = { periode: per, kelompok: tugas.map(k => k.kelompok), saya: h ? { kelompok: h.kelompok, grup: 'g:haris-' + h.id } : null };
  } catch (e) {}
  return d;
});

/* ============================================================
 *  POSTINGAN (v2.6.0)
 *  privasi: "semua" | "khusus" + target { guru, kelas[], users[] }
 * ============================================================ */
SHEETS.Postingan = ['id', 'username', 'teks', 'lampiran', 'privasi', 'target', 'waktu', 'diedit'];
SHEETS.PostLike = ['post', 'username', 'waktu'];
SHEETS.PostKomentar = ['id', 'post', 'username', 'teks', 'waktu'];

function postTarget_(r) { try { const t = JSON.parse(r.target || '{}'); return { guru: !!t.guru, kelas: t.kelas || [], users: (t.users || []).map(lc_) }; } catch (e) { return { guru: false, kelas: [], users: [] }; } }
function postBoleh_(u, r) {
  if (lc_(r.username) === lc_(u.username) || r.privasi !== 'khusus') return true;
  const t = postTarget_(r);
  if (t.guru && u.tipe === 'Guru') return true;
  if (u.tipe === 'Santri' && u.kelas && t.kelas.indexOf(u.kelas) >= 0) return true;
  return t.users.indexOf(lc_(u.username)) >= 0;
}
function postPrivasiLabel_(r) {
  if (r.privasi !== 'khusus') return 'Semua pengguna';
  const t = postTarget_(r), b = [];
  if (t.guru) b.push('Dewan Guru'); if (t.kelas.length) b.push(t.kelas.join(', ')); if (t.users.length) b.push(t.users.length + ' santri/pengguna');
  return b.join(' • ');
}
function postCari_(u, id) {
  const r = readAll_('Postingan').find(x => x.id === id);
  if (!r || !postBoleh_(u, r)) throw new Error('Postingan tidak ditemukan.');
  return r;
}
function postBentuk_(u, r, likes, kom) {
  const x = findUser_(r.username) || {}, me = lc_(u.username), milik = lc_(r.username) === me;
  let lmp = null; try { lmp = r.lampiran ? JSON.parse(r.lampiran) : null; } catch (e) {}
  const lk = likes[r.id] || [];
  return { id: r.id, username: x.username || r.username, nama: x.nama || r.username, foto: x.foto || '', tipe: x.tipe || '', kelas: x.kelas || '',
    teks: r.teks, lampiran: lmp, waktu: r.waktu, diedit: !!r.diedit, likes: lk.length, liked: lk.indexOf(me) >= 0, komentar: kom[r.id] || 0,
    milik: milik, bolehHapus: milik || can_(u), privasi: milik ? r.privasi || 'semua' : undefined, target: milik ? postTarget_(r) : undefined,
    privasiLabel: milik ? postPrivasiLabel_(r) : undefined };
}
function postList_(u, p) {
  const likes = {}, kom = {};
  readAll_('PostLike').forEach(l => (likes[l.post] = likes[l.post] || []).push(lc_(l.username)));
  readAll_('PostKomentar').forEach(k => { if (k.id) kom[k.post] = (kom[k.post] || 0) + 1; });
  const all = readAll_('Postingan').filter(r => r.id && postBoleh_(u, r)).sort((a, b) => String(b.waktu).localeCompare(String(a.waktu)));
  const off = Math.max(0, num_(p.offset)), lim = Math.min(30, Math.max(1, num_(p.limit) || 15));
  if (p.id) return postBentuk_(u, postCari_(u, p.id), likes, kom);
  return { items: all.slice(off, off + lim).map(r => postBentuk_(u, r, likes, kom)), more: off + lim < all.length };
}
function postFolder_() { const r = folder_(), it = r.getFoldersByName('Postingan'); return it.hasNext() ? it.next() : r.createFolder('Postingan'); }
function postSave_(u, p) {
  const teks = String(p.teks || '').trim().slice(0, 5000);
  let target = '';
  const privasi = p.privasi === 'khusus' ? 'khusus' : 'semua';
  if (privasi === 'khusus') {
    const t = p.target || {};
    const kelas = (t.kelas || []).filter(k => kelasAll_().some(x => x.nama === k));
    const users = fxUsers_(t.users);
    if (!t.guru && !kelas.length && !users.length) throw new Error('Pilih siapa saja yang boleh melihat postingan ini.');
    target = JSON.stringify({ guru: !!t.guru, kelas: kelas, users: users });
  }
  let lampiran;
  if (p.data) {
    const m = String(p.data).match(/^data:([^;,]+)[;,]/);
    const mime = String(p.mime || (m ? m[1] : '') || 'application/octet-stream').toLowerCase();
    const jenis = mime.indexOf('image/') === 0 ? 'foto' : mime.indexOf('video/') === 0 ? 'video' : 'dokumen';
    const nama = String(p.nama || jenis).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
    if (CHAT_DILARANG.test(nama)) throw new Error('Jenis file ini tidak diizinkan.');
    const bytes = Utilities.base64Decode(String(p.data).replace(/^data:[^,]*,/, ''));
    if (bytes.length > CHAT_MAKS[jenis] * 1024 * 1024) throw new Error('Ukuran ' + jenis + ' maksimal ' + CHAT_MAKS[jenis] + ' MB.');
    const f = postFolder_().createFile(Utilities.newBlob(bytes, mime, Date.now() + '_' + nama));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    lampiran = JSON.stringify({ id: f.getId(), nama: nama, mime: mime, ukuran: bytes.length, jenis: jenis });
  }
  return lock_(() => {
    if (!p.id) {
      if (!teks && !lampiran) throw new Error('Tulis sesuatu atau lampirkan foto, video, atau dokumen.');
      const obj = { id: uid_(), username: u.username, teks: teks, lampiran: lampiran || '', privasi: privasi, target: target, waktu: now_(), diedit: '' };
      append_('Postingan', obj);
      return { id: obj.id };
    }
    const r = readAll_('Postingan').find(x => x.id === p.id); if (!r) throw new Error('Postingan tidak ditemukan.');
    need_(lc_(r.username) === lc_(u.username), 'Hanya pemilik yang dapat mengedit postingan.');
    const patch = { teks: teks, privasi: privasi, target: target, diedit: now_() };
    if (lampiran !== undefined || p.hapusLampiran) {
      if (r.lampiran) { try { DriveApp.getFileById(JSON.parse(r.lampiran).id).setTrashed(true); } catch (e) {} }
      patch.lampiran = lampiran || '';
    }
    if (!teks && !(patch.lampiran !== undefined ? patch.lampiran : r.lampiran)) throw new Error('Postingan tidak boleh kosong.');
    update_('Postingan', r._row, patch);
    return { id: r.id };
  });
}
function postDelete_(u, p) {
  return lock_(() => {
    const r = readAll_('Postingan').find(x => x.id === p.id); if (!r) return true;
    need_(lc_(r.username) === lc_(u.username) || can_(u), 'Hanya pemilik yang dapat menghapus postingan.');
    if (r.lampiran) { try { DriveApp.getFileById(JSON.parse(r.lampiran).id).setTrashed(true); } catch (e) {} }
    deleteRows_('Postingan', [r._row]);
    deleteRows_('PostLike', readAll_('PostLike').filter(x => x.post === r.id).map(x => x._row));
    deleteRows_('PostKomentar', readAll_('PostKomentar').filter(x => x.post === r.id).map(x => x._row));
    return true;
  });
}
function postLike_(u, p) {
  const r = postCari_(u, p.id), me = lc_(u.username);
  return lock_(() => {
    const all = readAll_('PostLike').filter(x => x.post === r.id), ada = all.find(x => lc_(x.username) === me);
    if (ada) deleteRows_('PostLike', [ada._row]); else append_('PostLike', { post: r.id, username: u.username, waktu: now_() });
    return { likes: all.length + (ada ? -1 : 1), liked: !ada };
  });
}
function postKomentar_(u, p) {
  const r = postCari_(u, p.id), me = lc_(u.username), pemilik = lc_(r.username) === me || can_(u);
  return readAll_('PostKomentar').filter(k => k.id && k.post === r.id).sort((a, b) => String(a.waktu).localeCompare(String(b.waktu))).map(k => {
    const x = findUser_(k.username) || {};
    return { id: k.id, username: x.username || k.username, nama: x.nama || k.username, foto: x.foto || '', teks: k.teks, waktu: k.waktu, bolehHapus: pemilik || lc_(k.username) === me };
  });
}
function postKomentarAdd_(u, p) {
  const r = postCari_(u, p.id), teks = String(p.teks || '').trim();
  if (!teks) throw new Error('Tulis komentar.');
  append_('PostKomentar', { id: uid_(), post: r.id, username: u.username, teks: teks.slice(0, 1000), waktu: now_() });
  return postKomentar_(u, p);
}
function postKomentarDelete_(u, p) {
  return lock_(() => {
    const k = readAll_('PostKomentar').find(x => x.id === p.id); if (!k) return true;
    const r = readAll_('Postingan').find(x => x.id === k.post);
    need_(lc_(k.username) === lc_(u.username) || (r && lc_(r.username) === lc_(u.username)) || can_(u), 'Anda tidak dapat menghapus komentar ini.');
    deleteRows_('PostKomentar', [k._row]);
    return true;
  });
}
/** Bagikan postingan ke Room Chat (pengguna, grup, kelas, dewan guru). */
function postBagikan_(u, p) {
  const r = postCari_(u, p.id), x = findUser_(r.username) || {};
  const me = lc_(u.username), saya = grupSaya_(u);
  const users = fxPenerima_(p).filter(y => lc_(y) !== me), grup = fxArr_(p.grup).filter(g => saya[g]);
  if (!users.length && !grup.length) throw new Error('Pilih penerima.');
  const pesan = '📢 Postingan ' + (x.nama || r.username) + ' (@' + r.username + ') • ' + lgTgl_(r.waktu) + '\n\n' + (r.teks || '');
  const w = now_(), dasar = uid_();
  const rows = users.map((y, i) => ({ id: dasar + 'u' + i, dari: u.username, ke: y, pesan: pesan.trim(), waktu: w, dibaca: 'Tidak', lampiran: r.lampiran || '', diteruskan: 'Ya' }))
    .concat(grup.map((g, i) => ({ id: dasar + 'g' + i, dari: u.username, ke: g, pesan: pesan.trim(), waktu: w, dibaca: '', lampiran: r.lampiran || '', diteruskan: 'Ya' })));
  lock_(() => appendMany_('Chat', rows));
  return { terkirim: rows.length };
}

/* ============================================================
 *  CATATAN HARIS (v2.6.0)
 *  Per masa tugas (18.00 – 18.00): santri tidak berjamaah tiap waktu shalat + catatan yang diketik haris.
 *  Masa tugas yang sedang berjalan hanya terlihat oleh haris yang bertugas (dan Admin / Kabag Jamaah / Kabag Algojo).
 *  Setelah berganti haris, catatan tampil untuk semua dan hanya bisa diubah Admin / Kabag Jamaah / Kabag Algojo.
 * ============================================================ */
SHEETS.CatatanHaris = ['id', 'periode', 'sesi', 'catatan', 'oleh', 'waktu'];
const SESI_HARIS = [['Maghrib', 0], ['Isya', 0], ['Subuh', 1], ['Zuhur', 1], ['Ashar', 1]];
function harisPeriodeDari_(tgl, sesi) { const s = SESI_HARIS.find(x => x[0] === sesi); return s && s[1] ? fxGeserTgl_(tgl, -1) : tgl; }
function harisCatatanEdit_(u, periode) {
  const cur = harisPeriode_().mulai, kabag = can_(u, 'Kabag Jamaah', 'Kabag Algojo');
  if (periode === cur) return kabag || !!harisSaya_(u);
  return periode < cur && kabag;
}
function harisCatatan_(u, p) {
  const per = harisPeriode_(), cur = per.mulai, kabag = can_(u, 'Kabag Jamaah', 'Kabag Algojo');
  const lihatSekarang = kabag || !!harisSaya_(u);
  const set = {};
  const absen = {};   // periode|sesi → daftar
  readAll_('Absensi').forEach(a => {
    if (a.jenis !== 'Jamaah' || !a.status || a.status === 'H' || !SESI_HARIS.some(x => x[0] === a.sesi)) return;
    const pr = harisPeriodeDari_(a.tanggal, a.sesi);
    set[pr] = 1; (absen[pr + '|' + a.sesi] = absen[pr + '|' + a.sesi] || []).push(a);
  });
  const cat = {};
  readAll_('CatatanHaris').forEach(c => { if (c.id) { set[c.periode] = 1; cat[c.periode + '|' + c.sesi] = c; } });
  if (lihatSekarang) set[cur] = 1;
  let daftar = Object.keys(set).filter(x => x < cur || (x === cur && lihatSekarang)).sort().reverse();
  const off = Math.max(0, num_(p.offset)), lim = Math.min(10, Math.max(1, num_(p.limit) || 3));
  const more = off + lim < daftar.length;
  daftar = daftar.slice(off, off + lim);
  const asr = {}; asramaAll_().forEach(a => asramaAnggota_(a).forEach(x => asr[lc_(x)] = 'Asrama ' + a.nomor + (a.nama ? ' – ' + a.nama : '')));
  const kemarin = fxGeserTgl_(cur, -1);
  const L = { I: 'Izin/Sakit', S: 'Izin/Sakit', A: 'Alpa' };
  return {
    more: more,
    periode: daftar.map(pr => {
      const edit = harisCatatanEdit_(u, pr);
      const sesi = SESI_HARIS.map(s => {
        const tgl = s[1] ? fxGeserTgl_(pr, 1) : pr, c = cat[pr + '|' + s[0]];
        const tidak = (absen[pr + '|' + s[0]] || []).map(a => { const x = findUser_(a.username) || {}; return { username: a.username, nama: x.nama || a.username, kelas: x.kelas || a.kelas || '', asrama: asr[lc_(a.username)] || '', status: L[a.status] || a.status }; })
          .sort((a, b) => String(a.kelas).localeCompare(String(b.kelas)) || String(a.nama).localeCompare(String(b.nama)));
        return { sesi: s[0], tanggal: tgl, tidak: tidak, catatan: c ? c.catatan : '', oleh: c ? ((findUser_(c.oleh) || {}).nama || c.oleh) : '' };
      }).filter(s => s.tidak.length || s.catatan || (edit && pr === cur));
      return { periode: pr, selesai: fxGeserTgl_(pr, 1), hari: fxHariDari_(pr), label: pr === cur ? 'Hari ini' : pr === kemarin ? 'Kemarin' : fxHariDari_(pr),
        berjalan: pr === cur, bolehEdit: edit, sesi: sesi };
    })
  };
}
function harisCatatanSave_(u, p) {
  const pr = tglValid_(p.periode);
  if (!pr || !SESI_HARIS.some(x => x[0] === p.sesi)) throw new Error('Data catatan tidak valid.');
  need_(harisCatatanEdit_(u, pr), pr === harisPeriode_().mulai ? 'Catatan hanya dapat ditulis oleh Haris yang sedang bertugas.'
    : 'Masa tugas sudah berganti. Catatan hanya dapat diubah oleh Admin, Kabag Jamaah, atau Kabag Algojo.');
  const teks = String(p.catatan || '').trim().slice(0, 1000);
  return lock_(() => {
    const c = readAll_('CatatanHaris').find(x => x.periode === pr && x.sesi === p.sesi);
    if (!teks) { if (c) deleteRows_('CatatanHaris', [c._row]); return true; }
    const obj = { periode: pr, sesi: p.sesi, catatan: teks, oleh: u.username, waktu: now_() };
    if (c) update_('CatatanHaris', c._row, obj); else { obj.id = uid_(); append_('CatatanHaris', obj); }
    return true;
  });
}

/* ---------- daftarkan aksi baru ---------- */
Object.assign(ACTIONS, {
  'haris.list': (u) => harisList_(u),
  'haris.save': (u, p) => harisSave_(u, p),
  'haris.delete': (u, p) => harisDelete_(u, p),
  'asrama.list': (u, p) => asramaList_(u, p),
  'asrama.save': (u, p) => asramaSave_(u, p),
  'asrama.delete': (u, p) => asramaDelete_(u, p),
  'asrama.piket': (u, p) => asramaPiket_(u, p),
  'asrama.dok': (u, p) => asramaDokList_(u, p),
  'asrama.dokAdd': (u, p) => asramaDokAdd_(u, p),
  'asrama.dokDelete': (u, p) => asramaDokDelete_(u, p),
  'kabilah.list': (u) => kabilahList_(u),
  'kabilah.save': (u, p) => kabilahSave_(u, p),
  'kabilah.delete': (u, p) => kabilahDelete_(u, p),
  'grup.info': (u, p) => grupInfo_(u, p),
  'grup.save': (u, p) => grupSave_(u, p),
  'grup.keluar': (u, p) => grupKeluar_(u, p),
  'chat.forward': (u, p) => chatForward_(u, p),
  'chat.edit': (u, p) => chatEdit_(u, p),
  'chat.hapus': (u, p) => chatHapus_(u, p),
  'jamaah.akses': (u) => jamaahAkses_(u),
  'jamaah.form': (u, p) => jamaahForm_(u, p),
  'jamaah.save': (u, p) => jamaahSave_(u, p),
  'iuran.laporan': (u, p) => iuranLaporan_(u, p),
  'post.list': (u, p) => postList_(u, p),
  'post.save': (u, p) => postSave_(u, p),
  'post.delete': (u, p) => postDelete_(u, p),
  'post.like': (u, p) => postLike_(u, p),
  'post.komentar': (u, p) => postKomentar_(u, p),
  'post.komentarAdd': (u, p) => postKomentarAdd_(u, p),
  'post.komentarDelete': (u, p) => postKomentarDelete_(u, p),
  'post.bagikan': (u, p) => postBagikan_(u, p),
  'haris.catatan': (u, p) => harisCatatan_(u, p),
  'haris.catatanSave': (u, p) => harisCatatanSave_(u, p),
  'tahunan.laporan': (u, p) => tahunanLaporan_(u, p)
});
