/**
 * ALHUDA MOBILE — Publik.gs (v2.8.0)
 * Pasang: editor Apps Script → ＋ → Skrip → beri nama  Publik  → tempel isi file ini.
 * Urutan file: Code → Portal → Fitur → Pendaftaran → Publik.  (Code.gs tidak diubah)
 *
 * Halaman depan (tanpa login) untuk masyarakat umum:
 *   1. Slide "Kabar Dayah" (5 detik, transisi fade) dari postingan yang disetujui tampil di layar utama.
 *      Syarat: ada banner landscape rasio 16:9 (1–5 banner). Postingan Admin/Pengembang langsung tampil, pengguna lain menunggu persetujuan Admin.
 *   2. Suka & komentar oleh tamu (Tamu1, Tamu2, …). Komentar tamu tampil untuk dirinya, publik setelah disetujui Admin.
 *   3. Pengguna publik: profil + postingan yang disetujui (hanya akun yang memilih "Publik").
 *   4. Hubungi Admin: chat tamu → masuk ke Room Chat Admin.
 *   5. Tentang Dayah, lokasi & tautan aplikasi (dapat diubah di Pengaturan Aplikasi).
 */

/* ---------- pengaturan & sheet ---------- */
[
  ['tentang_dayah', 'Dayah Al-Huda Malikussaleh adalah dayah salafiyah yang terletak di Jalan Unimal, Gampong Reuleut Timu, Kecamatan Muara Batu, Kabupaten Aceh Utara, Aceh, berdekatan dengan kampus Universitas Malikussaleh (Unimal).\n\n' +
    'Dayah Al-Huda Malikussaleh memiliki 3 jenjang pendidikan, yaitu:\n' +
    '• PDF Wustha — Pendidikan Diniyah Formal tingkat menengah pertama (setara SMP/MTs)\n' +
    '• PDF Ulya — Pendidikan Diniyah Formal tingkat menengah atas (setara SMA/MA)\n' +
    '• Salafi — pengajian kitab kuning bagi tamatan SMA/sederajat, termasuk santri yang sedang kuliah\n\n' +
    'Pendidikan Diniyah Formal (PDF) adalah satuan pendidikan resmi Kementerian Agama di lingkungan pesantren/dayah, sehingga ijazahnya diakui setara dengan sekolah umum. Selain kitab kuning (fikih, tauhid, tasawuf, nahwu, sharaf, dan lainnya), santri juga mempelajari mata pelajaran umum.\n\n' +
    'Kehidupan santri dibina dengan shalat berjamaah, pengajian rutin, mengulang pelajaran malam (muthala\'ah), kegiatan haris (piket keamanan), asrama, dan kabilah. Dayah juga aktif bekerja sama dengan Universitas Malikussaleh, antara lain dalam pemeriksaan kesehatan santri dan pelatihan budidaya hidroponik.\n\n' +
    'Pendaftaran santri baru dapat dilakukan secara online melalui tombol "Daftar Santri Baru" di halaman ini.', 'Teks "Tentang Dayah" di halaman depan'],
  ['alamat_dayah', 'Jalan Unimal, Gampong Reuleut Timu, Kec. Muara Batu, Kab. Aceh Utara, Aceh', 'Alamat dayah di halaman depan'],
  ['maps_dayah', 'https://www.google.com/maps/search/?api=1&query=Dayah+Al+Huda+Malikussaleh+Reuleut+Timu+Muara+Batu+Aceh+Utara', 'Tautan Google Maps lokasi dayah'],
  ['link_aplikasi', '', 'Tautan aplikasi untuk dibagikan (kosongkan = otomatis)'],
  ['ig_dayah', 'damas.mediacentre', 'Akun Instagram dayah (tanpa @) di halaman depan']
].forEach(r => { if (!DEFAULT_SETTINGS.some(x => x[0] === r[0])) DEFAULT_SETTINGS.push(r); });
SHEETS.PostPublik = ['post', 'status', 'banner', 'diajukan', 'oleh', 'diputuskan', 'admin', 'catatan'];
SHEETS.Tamu = ['id', 'nomor', 'nama', 'waktu', 'terakhir'];
SHEETS.ProfilPublik = ['username', 'publik', 'waktu'];
if (SHEETS.PostKomentar.indexOf('status') < 0) SHEETS.PostKomentar.push('status');
const TAMU_INBOX = '_admin';

/* ---------- bantuan ---------- */
function pbAdmin_(u) { const r = roles_(u || {}); return r.indexOf('Admin') >= 0 || r.indexOf('Pengembang Aplikasi') >= 0; }
function pbBatas_(kunci, maks, detik) {
  const c = CacheService.getScriptCache(), n = +(c.get(kunci) || 0);
  if (n >= maks) throw new Error('Terlalu sering. Coba lagi beberapa saat lagi.');
  c.put(kunci, String(n + 1), detik || 3600);
}
function pbTamuId_(p) { const id = String(p && p.tamu || ''); if (!/^[a-z0-9]{16,40}$/i.test(id)) throw new Error('Perangkat tidak dikenali. Muat ulang halaman.'); return id.toLowerCase(); }
function pbTamu_(id, buat) {
  let t = readAll_('Tamu').find(x => x.id === id);
  if (t || !buat) return t || null;
  return lock_(() => {
    const semua = readAll_('Tamu'); t = semua.find(x => x.id === id); if (t) return t;
    pbBatas_('tamu_baru_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHH'), 300);
    const nomor = semua.reduce((m, x) => Math.max(m, num_(x.nomor)), 0) + 1;
    t = { id: id, nomor: nomor, nama: 'Tamu' + nomor, waktu: now_(), terakhir: now_() };
    append_('Tamu', t);
    return t;
  });
}
function pbNamaTamuMap_() { const m = {}; readAll_('Tamu').forEach(t => m['tamu:' + t.id] = t.nama); return m; }
function pbHariTgl_(w) {
  const m = String(w || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return HARI_JS[d.getDay()] + ', ' + (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1];
}
function pbFolder_() { const r = folder_(), it = r.getFoldersByName('Layar Utama'); return it.hasNext() ? it.next() : r.createFolder('Layar Utama'); }
function pbBanner_(r) { try { return JSON.parse(r.banner || '[]'); } catch (e) { return []; } }
function pbPublikSet_() { const m = {}; readAll_('ProfilPublik').forEach(r => { if (r.publik === 'Ya') m[lc_(r.username)] = 1; }); return m; }
function pbLabel_(x) { return x.tipe === 'Santri' ? 'Santri' + (x.kelas ? ' • ' + x.kelas : '') : (roles_(x).filter(k => k !== 'Pengembang Aplikasi').join(', ') || 'Dewan Guru'); }
function pbIG_(g) { g = String(g || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').trim(); return !g || lc_(g) === 'damas.media_centre' ? 'damas.mediacentre' : g; }
function pbKomStatusOk_(k) { return !k.status || k.status === 'Disetujui'; }

/* ---------- slide postingan publik ---------- */
function pbSlides_(tamu, hanyaUser) {
  const posts = {}; readAll_('Postingan').forEach(r => { if (r.id) posts[r.id] = r; });
  const likes = {}, liked = {}, kom = {};
  readAll_('PostLike').forEach(l => { likes[l.post] = (likes[l.post] || 0) + 1; if (tamu && l.username === 'tamu:' + tamu) liked[l.post] = 1; });
  readAll_('PostKomentar').forEach(k => { if (k.id && pbKomStatusOk_(k)) kom[k.post] = (kom[k.post] || 0) + 1; });
  const v = verifSet_();
  return readAll_('PostPublik').filter(r => r.status === 'Disetujui' && posts[r.post] && (!hanyaUser || lc_(posts[r.post].username) === lc_(hanyaUser)))
    .sort((a, b) => String(b.diputuskan || b.diajukan).localeCompare(String(a.diputuskan || a.diajukan))).slice(0, 30).map(r => {
      const p = posts[r.post], x = findUser_(p.username) || {};
      return { id: p.id, username: x.username || p.username, nama: x.nama || p.username, foto: x.foto || '', v: v[lc_(p.username)] ? 1 : 0, label: pbLabel_(x),
        waktu: p.waktu, tanggal: pbHariTgl_(p.waktu), teks: p.teks || '', banner: pbBanner_(r).map(b => b.id), likes: likes[p.id] || 0, liked: !!liked[p.id], komentar: kom[p.id] || 0 };
    });
}
function pbPostPublik_(id) {
  const r = readAll_('PostPublik').find(x => x.post === id && x.status === 'Disetujui');
  const p = r && readAll_('Postingan').find(x => x.id === id);
  if (!p) throw new Error('Postingan tidak ditemukan.');
  return p;
}
function pbKomentarList_(postId, tamu, adminLihat) {
  const nmT = pbNamaTamuMap_(), v = verifSet_();
  return readAll_('PostKomentar').filter(k => k.id && k.post === postId && (pbKomStatusOk_(k) || adminLihat || (tamu && k.username === 'tamu:' + tamu && k.status === 'Menunggu')))
    .sort((a, b) => String(a.waktu).localeCompare(String(b.waktu))).map(k => {
      const t = String(k.username).indexOf('tamu:') === 0, x = t ? null : findUser_(k.username) || {};
      return { id: k.id, nama: t ? (nmT[k.username] || 'Tamu') : (x.nama || k.username), username: t ? '' : (x.username || k.username), foto: t ? '' : (x.foto || ''),
        v: !t && v[lc_(k.username)] ? 1 : 0, tamu: t, teks: k.teks, waktu: k.waktu, menunggu: k.status === 'Menunggu', saya: !!(tamu && k.username === 'tamu:' + tamu) };
    });
}

/* ---------- chat tamu ⇄ admin ---------- */
/** Admin yang dapat dihubungi tamu (peran Admin; bila tidak ada, Pengembang Aplikasi). WA/IG hanya bila tidak diprivatkan. */
function pbAdminList_(tamu) {
  const semua = activeUsers_(), adm = semua.filter(x => roles_(x).indexOf('Admin') >= 0);
  const list = adm.length ? adm : semua.filter(x => roles_(x).indexOf('Pengembang Aplikasi') >= 0), v = verifSet_();
  const belum = {}; if (tamu) readAll_('Chat').forEach(c => { if (c.ke === 'tamu:' + tamu && c.dibaca !== 'Ya') belum[lc_(c.dari)] = (belum[lc_(c.dari)] || 0) + 1; });
  return list.map(x => { const pv = bersihPrivasi_(x.privasi);
    return { username: x.username, nama: x.nama, foto: x.foto || '', v: v[lc_(x.username)] ? 1 : 0, label: pbLabel_(x),
      wa: pv.wa !== 'privat' ? String(x.wa || '').trim() : '', ig: pv.ig !== 'privat' ? String(x.ig || '').replace(/^@/, '').trim() : '', belum: belum[lc_(x.username)] || 0 }; });
}
function pbAdminCek_(un) { const a = pbAdminList_().find(x => lc_(x.username) === lc_(un)); if (!a) throw new Error('Pilih admin yang ingin dihubungi.'); return a; }
/** Percakapan tamu dengan satu admin (pesan lama tanpa admin tujuan ikut tampil). */
function pbChatTamu_(tamuId, admin, since) {
  const k = 'tamu:' + tamuId, a = lc_(admin), s = sh_('Chat'), col = headers_('Chat').indexOf('dibaca') + 1, nm = nameMap_();
  const rows = readAll_('Chat').filter(c => (c.dari === k && (lc_(c.ke) === a || c.ke === TAMU_INBOX)) || (c.ke === k && lc_(c.dari) === a))
    .sort((x, y) => String(x.waktu).localeCompare(String(y.waktu)) || x._row - y._row);
  rows.filter(c => c.ke === k && c.dibaca !== 'Ya').forEach(c => { try { s.getRange(c._row, col).setValue('Ya'); } catch (e) {} c.dibaca = 'Ya'; });
  return rows.filter(c => !since || String(c.waktu) >= String(since)).slice(-200)
    .map(c => ({ id: c.id, dariSaya: c.dari === k, pesan: c.pesan, waktu: c.waktu, dibaca: c.dibaca === 'Ya', nama: c.dari === k ? '' : (nm[lc_(c.dari)] || c.dari) }));
}
function pbChatTamuBelum_(tamuId) { const k = 'tamu:' + tamuId; return readAll_('Chat').filter(c => c.ke === k && c.dibaca !== 'Ya').length; }
/** Baris chat tamu yang menjadi milik admin `me`. */
function pbMilikAdmin_(c, me) {
  if (String(c.dari).indexOf('tamu:') === 0) return lc_(c.ke) === me || c.ke === TAMU_INBOX;
  return String(c.ke).indexOf('tamu:') === 0 && lc_(c.dari) === me;
}

/* ============================================================
 *  AKSI PUBLIK (tanpa login) — lewat aksi "login" dengan _aksi = "publik.*"
 * ============================================================ */
function pbPublik_(p) {
  const a = String(p._aksi || '').slice(7), s = settingsMap_();
  const tamu = p.tamu ? pbTamuId_(p) : '';
  if (a === 'beranda') {
    const ps = pbPublikSet_(), v = verifSet_();
    const t = tamu ? pbTamu_(tamu, false) : null;
    return { slides: pbSlides_(tamu), tamu: t ? { nama: t.nama, nomor: t.nomor } : null, chatBelum: tamu ? pbChatTamuBelum_(tamu) : 0, admins: pbAdminList_(tamu),
      pengguna: activeUsers_().filter(x => ps[lc_(x.username)]).map(x => ({ username: x.username, nama: x.nama, foto: x.foto || '', v: v[lc_(x.username)] ? 1 : 0, label: pbLabel_(x) }))
        .sort((a2, b2) => String(a2.nama).localeCompare(String(b2.nama))),
      info: { ig: pbIG_(s.ig_dayah), tentang: s.tentang_dayah || '', alamat: s.alamat_dayah || '', maps: s.maps_dayah || '', link: s.link_aplikasi || '', yayasan: s.nama_yayasan || '', dayah: s.nama_dayah || '' } };
  }
  if (a === 'profil') {
    const x = findUser_(p.username);
    if (!x || lc_(x.aktif) === 'tidak' || !pbPublikSet_()[lc_(x.username)]) throw new Error('Profil ini tidak bersifat publik.');
    const pv = bersihPrivasi_(x.privasi), o = { username: x.username, nama: x.nama, foto: x.foto || '', v: verifSet_()[lc_(x.username)] ? 1 : 0, label: pbLabel_(x) };
    if (pv.bio !== 'privat') o.bio = x.bio || '';
    if (pv.galeri !== 'privat') o.galeri = galeriList_(x).map(id => ({ id: id, url: 'https://lh3.googleusercontent.com/d/' + id }));
    o.posts = pbSlides_(tamu, x.username);
    return o;
  }
  if (a === 'banner') {   // potongan file banner (untuk membuat gambar Story)
    const id = String(p.id || '');
    if (!/^[\w-]{10,}$/.test(id) || !readAll_('PostPublik').some(r => r.status === 'Disetujui' && pbBanner_(r).some(b => b.id === id))) throw new Error('File tidak ditemukan.');
    const blob = DriveApp.getFileById(id).getBlob(), b = blob.getBytes(), parts = Math.max(1, Math.ceil(b.length / MEDIA_POTONG)), i = Math.max(0, Math.min(parts - 1, num_(p.part)));
    return { mime: blob.getContentType(), parts: parts, part: i, data: Utilities.base64Encode(b.slice(i * MEDIA_POTONG, (i + 1) * MEDIA_POTONG)) };
  }
  if (!tamu) throw new Error('Perangkat tidak dikenali. Muat ulang halaman.');
  if (a === 'tamu') { const t = pbTamu_(tamu, true); return { nama: t.nama, nomor: t.nomor }; }
  if (a === 'komentar') { pbPostPublik_(p.post); return pbKomentarList_(p.post, tamu, false); }
  if (a === 'like') {
    pbPostPublik_(p.post); pbBatas_('tamu_like_' + tamu, 120);
    return lock_(() => {
      const all = readAll_('PostLike').filter(x => x.post === p.post), ada = all.find(x => x.username === 'tamu:' + tamu);
      if (ada) deleteRows_('PostLike', [ada._row]); else append_('PostLike', { post: p.post, username: 'tamu:' + tamu, waktu: now_() });
      return { likes: all.length + (ada ? -1 : 1), liked: !ada };
    });
  }
  if (a === 'komentarAdd') {
    pbPostPublik_(p.post);
    const teks = String(p.teks || '').trim().slice(0, 500); if (!teks) throw new Error('Tulis komentar.');
    pbBatas_('tamu_kom_' + tamu, 15); pbTamu_(tamu, true);
    append_('PostKomentar', { id: uid_(), post: p.post, username: 'tamu:' + tamu, teks: teks, waktu: now_(), status: 'Menunggu' });
    return pbKomentarList_(p.post, tamu, false);
  }
  if (a === 'chat') { pbTamu_(tamu, true); const ad = pbAdminCek_(p.admin); return { items: pbChatTamu_(tamu, ad.username, p.since) }; }
  if (a === 'chatKirim') {
    const pesan = String(p.pesan || '').trim().slice(0, 1000); if (!pesan) throw new Error('Pesan kosong.');
    pbBatas_('tamu_chat_' + tamu, 40); const t = pbTamu_(tamu, true), ad = pbAdminCek_(p.admin);
    const obj = { id: uid_(), dari: 'tamu:' + tamu, ke: ad.username, pesan: pesan, waktu: now_(), dibaca: 'Tidak' };
    append_('Chat', obj);
    try { update_('Tamu', t._row || readAll_('Tamu').find(x => x.id === tamu)._row, { terakhir: now_() }); } catch (e) {}
    return { id: obj.id, dariSaya: true, pesan: pesan, waktu: obj.waktu, dibaca: false };
  }
  throw new Error('Aksi tidak dikenal.');
}
(function () {
  const loginAsli = login_;
  login_ = function (p) { return p && String(p._aksi || '').indexOf('publik.') === 0 ? pbPublik_(p) : loginAsli(p); };
})();

/* ============================================================
 *  AKSI DALAM APLIKASI
 * ============================================================ */
/** Ajukan postingan ke layar utama publik. banners: [dataURL jpeg 16:9], pakaiFoto: pakai foto postingan (16:9) sebagai banner pertama. */
ACTIONS['publik.ajukan'] = function (u, p) {
  const r = readAll_('Postingan').find(x => x.id === p.post); if (!r) throw new Error('Postingan tidak ditemukan.');
  need_(lc_(r.username) === lc_(u.username) || pbAdmin_(u), 'Hanya pemilik postingan yang dapat mengajukan.');
  if (r.privasi === 'khusus') throw new Error('Ubah privasi postingan menjadi "Semua pengguna" sebelum diajukan ke layar utama.');
  const banner = [];
  if (p.pakaiFoto) { try { const l = JSON.parse(r.lampiran || 'null'); if (l && l.jenis === 'foto') banner.push({ id: l.id, mime: l.mime, dariPost: 1 }); } catch (e) {} }
  (Array.isArray(p.banners) ? p.banners : []).slice(0, 5).forEach((d, i) => {
    const bytes = Utilities.base64Decode(String(d).replace(/^data:[^,]*,/, ''));
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Ukuran banner maksimal 8 MB.');
    const f = pbFolder_().createFile(Utilities.newBlob(bytes, 'image/jpeg', Date.now() + '_' + i + '_banner.jpg'));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    banner.push({ id: f.getId(), mime: 'image/jpeg' });
  });
  if (!banner.length) throw new Error('Wajib ada minimal 1 banner landscape rasio 16:9.');
  if (banner.length > 5) banner.length = 5;
  const langsung = pbAdmin_(u);
  return lock_(() => {
    const lama = readAll_('PostPublik').find(x => x.post === r.id);
    const obj = { post: r.id, status: langsung ? 'Disetujui' : 'Menunggu', banner: JSON.stringify(banner), diajukan: now_(), oleh: u.username,
      diputuskan: langsung ? now_() : '', admin: langsung ? u.username : '', catatan: '' };
    if (lama) {
      pbBanner_(lama).filter(b => !b.dariPost && !banner.some(n => n.id === b.id)).forEach(b => { try { DriveApp.getFileById(b.id).setTrashed(true); } catch (e) {} });
      update_('PostPublik', lama._row, obj);
    } else append_('PostPublik', obj);
    return { status: obj.status };
  });
};
ACTIONS['publik.turunkan'] = function (u, p) {
  return lock_(() => {
    const r = readAll_('PostPublik').find(x => x.post === p.post); if (!r) return true;
    const post = readAll_('Postingan').find(x => x.id === p.post);
    need_(pbAdmin_(u) || (post && lc_(post.username) === lc_(u.username)), 'Anda tidak dapat menurunkan postingan ini.');
    pbBanner_(r).filter(b => !b.dariPost).forEach(b => { try { DriveApp.getFileById(b.id).setTrashed(true); } catch (e) {} });
    deleteRows_('PostPublik', [r._row]);
    return true;
  });
};
ACTIONS['publik.kelola'] = function (u) {
  need_(pbAdmin_(u), 'Hanya Admin yang dapat mengelola layar utama.');
  const posts = {}; readAll_('Postingan').forEach(r => { if (r.id) posts[r.id] = r; });
  const bentuk = r => { const p = posts[r.post], x = findUser_(p.username) || {};
    return { post: r.post, status: r.status, banner: pbBanner_(r).map(b => b.id), username: x.username || p.username, nama: x.nama || p.username, teks: p.teks || '',
      tanggal: pbHariTgl_(p.waktu), diajukan: r.diajukan, catatan: r.catatan || '' }; };
  const rows = readAll_('PostPublik').filter(r => posts[r.post]).sort((a, b) => String(b.diajukan).localeCompare(String(a.diajukan)));
  const nmT = pbNamaTamuMap_();
  return {
    pengajuan: rows.filter(r => r.status === 'Menunggu').map(bentuk),
    tampil: rows.filter(r => r.status === 'Disetujui').map(bentuk),
    komentar: readAll_('PostKomentar').filter(k => k.id && k.status === 'Menunggu' && posts[k.post]).sort((a, b) => String(b.waktu).localeCompare(String(a.waktu)))
      .map(k => ({ id: k.id, nama: nmT[k.username] || k.username, teks: k.teks, waktu: k.waktu, post: k.post, postTeks: String(posts[k.post].teks || '').slice(0, 80) }))
  };
};
ACTIONS['publik.putuskan'] = function (u, p) {
  need_(pbAdmin_(u), 'Hanya Admin yang dapat menyetujui.');
  return lock_(() => {
    const r = readAll_('PostPublik').find(x => x.post === p.post); if (!r) throw new Error('Pengajuan tidak ditemukan.');
    const setuju = !!p.setuju, catatan = String(p.catatan || '').trim().slice(0, 200);
    update_('PostPublik', r._row, { status: setuju ? 'Disetujui' : 'Ditolak', diputuskan: now_(), admin: u.username, catatan: catatan });
    try {
      const post = readAll_('Postingan').find(x => x.id === r.post);
      if (post && lc_(post.username) !== lc_(u.username)) append_('Chat', { id: 'pb-' + uid_(), dari: SISTEM, ke: post.username, waktu: now_(), dibaca: 'Tidak',
        pesan: setuju ? 'Alhamdulillah, postingan Anda "' + String(post.teks || '').slice(0, 60) + '" telah disetujui dan kini tampil di layar utama publik aplikasi.'
          : 'Mohon maaf, pengajuan tampil di layar utama untuk postingan "' + String(post.teks || '').slice(0, 60) + '" belum disetujui.' + (catatan ? ' Catatan admin: ' + catatan : '') });
    } catch (e) {}
    return true;
  });
};
ACTIONS['publik.komentarPutuskan'] = function (u, p) {
  need_(pbAdmin_(u), 'Hanya Admin yang dapat memverifikasi komentar.');
  return lock_(() => {
    const k = readAll_('PostKomentar').find(x => x.id === p.id); if (!k) return true;
    if (p.setuju) update_('PostKomentar', k._row, { status: 'Disetujui' }); else deleteRows_('PostKomentar', [k._row]);
    return true;
  });
};
/** Akun publik / terbatas (pemilik akun). */
ACTIONS['profil.publik'] = function (u, p) {
  let un = u.username;
  if (p.username && lc_(p.username) !== lc_(u.username)) {   // Admin / Pengembang dapat mengatur akun pengguna lain
    need_(pbAdmin_(u), 'Hanya Admin yang dapat mengubah visibilitas akun pengguna lain.');
    const x = findUser_(p.username); if (!x) throw new Error('Pengguna tidak ditemukan.'); un = x.username;
  }
  return lock_(() => {
    const r = readAll_('ProfilPublik').find(x => lc_(x.username) === lc_(un)), v = p.publik ? 'Ya' : 'Tidak';
    if (r) update_('ProfilPublik', r._row, { publik: v, waktu: now_() }); else append_('ProfilPublik', { username: un, publik: v, waktu: now_() });
    return { publik: !!p.publik };
  });
};

/* ---------- pembungkus aksi yang sudah ada ---------- */
(function () {
  const pl = ACTIONS['post.list'];
  ACTIONS['post.list'] = function (u, p) {
    const d = pl(u, p), pub = {}; readAll_('PostPublik').forEach(r => pub[r.post] = r);
    const tandai = x => { const r = pub[x.id]; if (r && (x.milik || pbAdmin_(u))) x.publik = { status: r.status, catatan: r.catatan || '', banner: pbBanner_(r).length }; else if (r && r.status === 'Disetujui') x.publik = { status: 'Disetujui' }; };
    if (d && d.items) d.items.forEach(tandai); else if (d && d.id) tandai(d);
    return d;
  };
  const pk = ACTIONS['post.komentar'];
  ACTIONS['post.komentar'] = function (u, p) {
    const list = pk(u, p), st = {}, nmT = pbNamaTamuMap_(), adm = pbAdmin_(u);
    readAll_('PostKomentar').forEach(k => st[k.id] = k);
    return list.filter(k => { const r = st[k.id]; return !r || pbKomStatusOk_(r) || adm; }).map(k => {
      const r = st[k.id];
      if (r && String(r.username).indexOf('tamu:') === 0) { k.nama = nmT[r.username] || 'Tamu'; k.username = ''; k.tamu = true; k.bolehHapus = k.bolehHapus || adm; }
      if (r && r.status === 'Menunggu') k.menunggu = true;
      return k;
    });
  };
  const ka = ACTIONS['post.komentarAdd'];
  ACTIONS['post.komentarAdd'] = function (u, p) { ka(u, p); return ACTIONS['post.komentar'](u, p); };
  const bt = ACTIONS.boot;
  ACTIONS.boot = function (u, p) { const b = bt(u, p); try { b.settings.ig_dayah = pbIG_(settingsMap_().ig_dayah); } catch (e) {} return b; };
  const pg = ACTIONS['profil.get'];
  ACTIONS['profil.get'] = function (u, p) {
    const d = pg(u, p);
    try { d.publik = !!pbPublikSet_()[lc_(d.username)]; } catch (e) {}
    return d;
  };
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) {
    const d = db(u, p);
    try { if (pbAdmin_(u)) d.publikMenunggu = readAll_('PostPublik').filter(r => r.status === 'Menunggu').length + readAll_('PostKomentar').filter(k => k.status === 'Menunggu').length; } catch (e) {}
    return d;
  };
  /* chat tamu di Room Chat Admin */
  const kontak = ACTIONS['chat.contacts'];
  ACTIONS['chat.contacts'] = function (u, p) {
    const list = kontak(u, p);
    if (!pbAdmin_(u)) return list;
    const nmT = pbNamaTamuMap_(), per = {}, me = lc_(u.username);
    readAll_('Chat').forEach(c => {
      if (!pbMilikAdmin_(c, me)) return;
      const t = String(c.dari).indexOf('tamu:') === 0 ? c.dari : c.ke;
      const o = per[t] = per[t] || { last: null, unread: 0 };
      if (!o.last || String(c.waktu) >= String(o.last.waktu)) o.last = c;
      if (c.dari === t && c.dibaca !== 'Ya') o.unread++;
    });
    const tamu = Object.keys(per).map(t => ({ username: t, nama: nmT[t] || 'Tamu', tipe: 'Tamu', tamu: true,
      last: { pesan: per[t].last.pesan, waktu: per[t].last.waktu, dariSaya: per[t].last.dari !== t }, unread: per[t].unread }))
      .sort((a, b) => String(b.last.waktu).localeCompare(String(a.last.waktu)));
    const gi = list.findIndex(c => !c.grup);
    list.splice(gi < 0 ? list.length : gi, 0, ...tamu);
    return list;
  };
  const thread = ACTIONS['chat.thread'];
  ACTIONS['chat.thread'] = function (u, p) {
    const w = String(p['with'] || '');
    if (w.indexOf('tamu:') !== 0) return thread(u, p);
    need_(pbAdmin_(u), 'Hanya Admin yang dapat membuka chat tamu.');
    const s = sh_('Chat'), col = headers_('Chat').indexOf('dibaca') + 1, nm = nameMap_(), me = lc_(u.username);
    const rows = readAll_('Chat').filter(c => (c.dari === w || c.ke === w) && pbMilikAdmin_(c, me)).sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)) || a._row - b._row);
    rows.filter(c => c.dari === w && c.dibaca !== 'Ya').forEach(c => { try { s.getRange(c._row, col).setValue('Ya'); } catch (e) {} c.dibaca = 'Ya'; });
    return rows.filter(c => !p.since || String(c.waktu) >= String(p.since)).slice(-200).map(c => {
      const m = { id: c.id, dariSaya: c.dari !== w && lc_(c.dari) === me, pesan: c.pesan, waktu: c.waktu, dibaca: c.dibaca === 'Ya' };
      if (c.dari !== w && lc_(c.dari) !== me) { m.dari = c.dari; m.nama = nm[lc_(c.dari)] || c.dari; }   // balasan admin lain
      return m;
    });
  };
  const kirim = ACTIONS['chat.send'];
  ACTIONS['chat.send'] = function (u, p) {
    const to = String(p.to || '');
    if (to.indexOf('tamu:') !== 0) return kirim(u, p);
    need_(pbAdmin_(u), 'Hanya Admin yang dapat membalas tamu.');
    const pesan = String(p.pesan || '').trim(); if (!pesan) throw new Error('Pesan kosong.');
    const cid = String(p._cid || '').replace(/[^\w-]/g, '').slice(0, 60);
    const obj = { id: cid || uid_(), dari: u.username, ke: to, pesan: pesan.slice(0, 2000), waktu: now_(), dibaca: 'Tidak' };
    append_('Chat', obj);
    return { id: obj.id, dariSaya: true, pesan: obj.pesan, waktu: obj.waktu, dibaca: false };
  };
  const unread = ACTIONS['chat.unread'];
  ACTIONS['chat.unread'] = function (u, p) {
    const r = unread(u, p);
    if (!pbAdmin_(u)) return r;
    try {
      const nmT = pbNamaTamuMap_();
      (r.latest || []).forEach(x => { if (String(x.dari).indexOf('tamu:') === 0) x.nama = nmT[x.dari] || 'Tamu'; });   // pesan tamu ke admin ini (dihitung Code.gs)
      const t = readAll_('Chat').filter(c => c.ke === TAMU_INBOX && String(c.dari).indexOf('tamu:') === 0 && c.dibaca !== 'Ya');
      r.count += t.length;
      r.latest = r.latest.concat(t.map(c => ({ id: c.id, dari: c.dari, nama: nmT[c.dari] || 'Tamu', pesan: c.pesan, waktu: c.waktu })))
        .sort((a, b) => String(b.waktu).localeCompare(String(a.waktu))).slice(0, 5);
    } catch (e) {}
    return r;
  };
})();
if (typeof SYNC_BACA !== 'undefined') SYNC_BACA.push('publik.kelola');

/* ============================================================
 *  NOTIFIKASI UNTUK SAYA (v2.8.3)
 *  Suka, komentar & bagikan pada postingan saya, serta catatan tentang diri saya
 *  (tidak hadir ngaji, izin pulang, izin keluar, pelanggaran). Tampil di ikon lonceng & notifikasi HP.
 * ============================================================ */
SHEETS.PostBagi = ['post', 'username', 'tujuan', 'jumlah', 'waktu'];
SHEETS.NotifBaca = ['username', 'terakhir'];
const NOTIF_HARI = 30;
function notifSaya_(u) {
  const me = lc_(u.username), batas = Utilities.formatDate(new Date(Date.now() - NOTIF_HARI * 864e5), TZ, 'yyyy-MM-dd'), nm = nameMap_(), nmT = pbNamaTamuMap_();
  const siapa = un => String(un).indexOf('tamu:') === 0 ? (nmT[un] || 'Tamu') : (nm[lc_(un)] || un);
  const out = [], add = (id, jenis, waktu, judul, isi, ref) => { if (String(waktu).slice(0, 10) >= batas) out.push({ id: id, jenis: jenis, waktu: String(waktu), judul: judul, isi: isi || '', ref: ref || '' }); };
  const postSaya = {}; readAll_('Postingan').forEach(r => { if (r.id && lc_(r.username) === me) postSaya[r.id] = r; });
  const cuplik = id => { const t = String((postSaya[id] || {}).teks || '').replace(/\s+/g, ' '); return t ? '"' + t.slice(0, 50) + (t.length > 50 ? '…' : '') + '"' : 'postingan Anda'; };
  readAll_('PostLike').forEach(l => { if (postSaya[l.post] && lc_(l.username) !== me) add('lk' + l.post + l.username, 'suka', l.waktu, siapa(l.username) + ' menyukai postingan Anda', cuplik(l.post), l.post); });
  readAll_('PostKomentar').forEach(k => { if (k.id && postSaya[k.post] && lc_(k.username) !== me && (!k.status || k.status === 'Disetujui'))
    add('km' + k.id, 'komentar', k.waktu, siapa(k.username) + ' mengomentari postingan Anda', String(k.teks || '').slice(0, 120), k.post); });
  readAll_('PostBagi').forEach(b => { if (postSaya[b.post] && lc_(b.username) !== me)
    add('bg' + b.post + b.username + b.waktu, 'bagikan', b.waktu, siapa(b.username) + ' membagikan postingan Anda' + (b.tujuan ? ' ke ' + b.tujuan : ''), cuplik(b.post), b.post); });
  if (u.tipe === 'Santri') {
    const L = { A: 'Alpa (tanpa keterangan)', I: 'Izin', S: 'Sakit' }, ses = {}; try { sesiAll_().forEach(x => ses[x.kode] = x.jam); } catch (e) {}
    readAll_('Absensi').forEach(a => { if (a.jenis === 'Santri' && lc_(a.username) === me && a.status && a.status !== 'H')
      add('ab' + a.id, 'ngaji', a.waktu || a.tanggal, 'Tidak hadir ngaji: ' + (L[a.status] || a.status), pbHariTgl_(a.tanggal) + (a.mapel ? ' • ' + a.mapel : '') + (ses[a.sesi] ? ' • ' + ses[a.sesi] : '') + (a.keterangan ? ' • ' + a.keterangan : '')); });
    readAll_('IzinPulang').forEach(r => { if (r.id && lc_(r.username) === me)
      add('ip' + r.id, 'pulang', r.waktu || r.tgl_pulang, 'Izin pulang tercatat', pbHariTgl_(r.tgl_pulang) + (r.tgl_kembali ? ' s.d. ' + pbHariTgl_(r.tgl_kembali) : '') + (r.alasan ? ' • ' + r.alasan : '') + (r.status ? ' • ' + r.status : '')); });
    readAll_('IzinKeluar').forEach(r => { if (r.id && lc_(r.username) === me)
      add('ik' + r.id, 'keluar', r.waktu || r.tanggal, 'Izin keluar tercatat', pbHariTgl_(r.tanggal) + (r.jam_keluar ? ' • ' + r.jam_keluar : '') + (r.keperluan ? ' • ' + r.keperluan : '') + (r.status ? ' • ' + r.status : '')); });
    readAll_('Pelanggaran').forEach(r => { if (r.id && lc_(r.username) === me)
      add('pl' + r.id, 'pelanggaran', r.waktu || r.tanggal, 'Catatan pelanggaran: ' + r.pelanggaran, pbHariTgl_(r.tanggal) + (r.sanksi ? ' • Sanksi: ' + r.sanksi : '') + ' • dicatat ' + (nm[lc_(r.oleh)] || r.oleh)); });
  }
  out.sort((a, b) => b.waktu.localeCompare(a.waktu));
  const baca = readAll_('NotifBaca').find(r => lc_(r.username) === me), terakhir = baca ? String(baca.terakhir) : '';
  out.forEach(x => x.baru = x.waktu > terakhir);
  return { items: out.slice(0, 150), belum: out.filter(x => x.baru).length, terakhir: terakhir };
}
function notifRingkasSaya_(u) {
  const c = CacheService.getScriptCache(), k = 'ns_' + lc_(u.username), hit = c.get(k);
  if (hit) return JSON.parse(hit);
  const d = notifSaya_(u), r = { belum: d.belum, latest: d.items.filter(x => x.baru).slice(0, 1).map(x => ({ id: x.id, judul: x.judul, isi: x.isi })) };
  try { c.put(k, JSON.stringify(r), 60); } catch (e) {}
  return r;
}
function notifSegar_(un) { try { CacheService.getScriptCache().remove('ns_' + lc_(un)); } catch (e) {} }
ACTIONS['notif.saya'] = function (u) { return notifSaya_(u); };
ACTIONS['notif.baca'] = function (u) {
  return lock_(() => {
    const r = readAll_('NotifBaca').find(x => lc_(x.username) === lc_(u.username)), w = now_();
    if (r) update_('NotifBaca', r._row, { terakhir: w }); else append_('NotifBaca', { username: u.username, terakhir: w });
    notifSegar_(u.username);
    return { terakhir: w };
  });
};
if (typeof SYNC_BACA !== 'undefined') SYNC_BACA.push('notif.saya');
/* catat bagikan & segarkan ringkasan pemilik postingan / santri terkait */
(function () {
  const pemilik = id => { const r = readAll_('Postingan').find(x => x.id === id); return r ? r.username : ''; };
  const bg = ACTIONS['post.bagikan'];
  ACTIONS['post.bagikan'] = function (u, p) {
    const r = bg(u, p);
    try { append_('PostBagi', { post: p.id, username: u.username, tujuan: 'Room Chat', jumlah: r.terkirim || 1, waktu: now_() }); notifSegar_(pemilik(p.id)); } catch (e) {}
    return r;
  };
  ['post.like', 'post.komentarAdd'].forEach(a => { const asli = ACTIONS[a]; if (!asli) return;
    ACTIONS[a] = function (u, p) { const r = asli(u, p); try { notifSegar_(pemilik(p.id)); } catch (e) {} return r; }; });
  ['pelanggaran.save', 'izinPulang.save', 'izinKeluar.save'].forEach(a => { const asli = ACTIONS[a]; if (!asli) return;
    ACTIONS[a] = function (u, p) { const r = asli(u, p); try { if (p.username) notifSegar_(p.username); } catch (e) {} return r; }; });
  const ab = ACTIONS['absen.save'];
  if (ab) ACTIONS['absen.save'] = function (u, p) { const r = ab(u, p); try { (p.items || []).forEach(i => i && i.username && notifSegar_(i.username)); } catch (e) {} return r; };
  const un = ACTIONS['chat.unread'];
  ACTIONS['chat.unread'] = function (u, p) { const r = un(u, p); try { r.notif = notifRingkasSaya_(u); } catch (e) {} return r; };
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) { const d = db(u, p); try { d.notifSaya = notifRingkasSaya_(u).belum; } catch (e) {} return d; };
})();
/* bagikan dari halaman depan (tamu) */
(function () {
  const lama = pbPublik_;
  pbPublik_ = function (p) {
    if (p && p._aksi === 'publik.bagi') {
      const tamu = pbTamuId_(p), post = pbPostPublik_(p.post), t = pbTamu_(tamu, true);
      pbBatas_('tamu_bagi_' + tamu, 60);
      append_('PostBagi', { post: post.id, username: 'tamu:' + tamu, tujuan: String(p.tujuan || '').slice(0, 30), jumlah: 1, waktu: now_() });
      notifSegar_(post.username);
      return true;
    }
    return lama(p);
  };
})();

/* ============================================================
 *  ANGKA POSTINGAN & PENGUMUMAN TERBARU (v2.8.4)
 *  Klien menyimpan id yang sudah dilihat; server hanya mengirim daftar id terbaru.
 * ============================================================ */
function baruRingkas_(u) {
  const c = CacheService.getScriptCache(), k = 'br_' + lc_(u.username), hit = c.get(k);
  if (hit) return JSON.parse(hit);
  const me = lc_(u.username), batas = Utilities.formatDate(new Date(Date.now() - 30 * 864e5), TZ, 'yyyy-MM-dd');
  const r = {
    post: readAll_('Postingan').filter(x => x.id && lc_(x.username) !== me && String(x.waktu).slice(0, 10) >= batas && postBoleh_(u, x))
      .sort((a, b) => String(b.waktu).localeCompare(String(a.waktu))).slice(0, 100).map(x => [x.id, String(x.waktu).slice(0, 10)]),
    pengumuman: readAll_('Pengumuman').filter(x => x.id && lc_(x.aktif) !== 'tidak' && lc_(x.oleh) !== me)
      .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))).slice(0, 100).map(x => [x.id, String(x.tanggal).slice(0, 10)])
  };
  try { c.put(k, JSON.stringify(r), 60); } catch (e) {}
  return r;
}
(function () {
  const un = ACTIONS['chat.unread'];
  ACTIONS['chat.unread'] = function (u, p) { const r = un(u, p); try { r.baru = baruRingkas_(u); } catch (e) {} return r; };
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) { const d = db(u, p); try { d.baru = baruRingkas_(u); } catch (e) {} return d; };
})();

/* ============================================================
 *  POSTINGAN BANYAK FOTO (v2.8.5)
 *  Foto pertama tetap di kolom "lampiran"; foto tambahan (maks. 10 total) di kolom "galeri".
 * ============================================================ */
if (SHEETS.Postingan.indexOf('galeri') < 0) SHEETS.Postingan.push('galeri');
const POST_FOTO_MAKS = 10;
function postGaleri_(r) { try { return JSON.parse(r.galeri || '[]'); } catch (e) { return []; } }
function postFotos_(r) {
  const out = []; try { const l = r.lampiran ? JSON.parse(r.lampiran) : null; if (l && l.jenis === 'foto') out.push(l.id); } catch (e) {}
  return out.concat(postGaleri_(r).map(g => g.id));
}
ACTIONS['post.fotoTambah'] = function (u, p) {
  const r0 = readAll_('Postingan').find(x => x.id === p.id); if (!r0) throw new Error('Postingan tidak ditemukan.');
  need_(lc_(r0.username) === lc_(u.username), 'Hanya pemilik yang dapat menambah foto.');
  if (postFotos_(r0).length >= POST_FOTO_MAKS) throw new Error('Maksimal ' + POST_FOTO_MAKS + ' foto per postingan.');
  const bytes = Utilities.base64Decode(String(p.data || '').replace(/^data:[^,]*,/, ''));
  if (!bytes.length) throw new Error('Foto kosong.');
  if (bytes.length > CHAT_MAKS.foto * 1024 * 1024) throw new Error('Ukuran foto maksimal ' + CHAT_MAKS.foto + ' MB.');
  const nama = String(p.nama || 'foto.jpg').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
  const f = postFolder_().createFile(Utilities.newBlob(bytes, 'image/jpeg', Date.now() + '_' + nama));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return lock_(() => {
    const r = readAll_('Postingan').find(x => x.id === p.id), g = postGaleri_(r);
    g.push({ id: f.getId(), mime: 'image/jpeg', nama: nama });
    update_('Postingan', r._row, { galeri: JSON.stringify(g) });
    return { id: f.getId(), jumlah: postFotos_(Object.assign({}, r, { galeri: JSON.stringify(g) })).length };
  });
};
(function () {
  const sv = ACTIONS['post.save'];
  ACTIONS['post.save'] = function (u, p) {
    const res = sv(u, p);
    if (p.id && (Array.isArray(p.hapusGaleri) && p.hapusGaleri.length || p.hapusLampiran)) {
      lock_(() => {
        const r = readAll_('Postingan').find(x => x.id === p.id); if (!r) return;
        let g = postGaleri_(r);
        const hapus = (p.hapusGaleri || []).map(String);
        g.filter(x => hapus.indexOf(x.id) >= 0).forEach(x => { try { DriveApp.getFileById(x.id).setTrashed(true); } catch (e) {} });
        g = g.filter(x => hapus.indexOf(x.id) < 0);
        const patch = { galeri: JSON.stringify(g) };
        if (!r.lampiran && g.length) { const a = g.shift(); patch.lampiran = JSON.stringify({ id: a.id, nama: a.nama, mime: a.mime, ukuran: 0, jenis: 'foto' }); patch.galeri = JSON.stringify(g); }   // foto utama dihapus → foto berikutnya naik
        update_('Postingan', r._row, patch);
      });
    }
    return res;
  };
  const del = ACTIONS['post.delete'];
  ACTIONS['post.delete'] = function (u, p) {
    const r = readAll_('Postingan').find(x => x.id === p.id);
    const g = r ? postGaleri_(r) : [];
    const res = del(u, p);
    g.forEach(x => { try { DriveApp.getFileById(x.id).setTrashed(true); } catch (e) {} });
    return res;
  };
  const pl = ACTIONS['post.list'];
  ACTIONS['post.list'] = function (u, p) {
    const d = pl(u, p), rows = {}; readAll_('Postingan').forEach(r => { if (r.id) rows[r.id] = r; });
    const isi = x => { const r = rows[x.id]; if (!r) return; x.fotos = postFotos_(r); x.galeri = postGaleri_(r).map(g => g.id); };
    if (d && d.items) d.items.forEach(isi); else if (d && d.id) isi(d);
    return d;
  };
  const lain = typeof mediaBolehLain_ === 'function' ? mediaBolehLain_ : null;
  mediaBolehLain_ = function (u, id) {
    if (lain && lain(u, id)) return true;
    return readAll_('Postingan').some(r => r.galeri && String(r.galeri).indexOf(id) >= 0 && postBoleh_(u, r));
  };
})();

/* ============================================================
 *  AKSES KHUSUS ADMIN — TAHAP 1 (v2.9.0)
 *  Keamanan kata sandi & akun, nama lembaga (mis. PDF Wustha → SMP), logo & kop untuk Admin.
 * ============================================================ */
[
  ['lembaga_wustha', 'PDF Wustha', 'Nama tampilan lembaga jenjang Wustha (mis. PDF Wustha / SMP / MTs)'],
  ['lembaga_ulya', 'PDF Ulya', 'Nama tampilan lembaga jenjang Ulya (mis. PDF Ulya / SMA / MA)'],
  ['lembaga_salafi', 'Salafi', 'Nama tampilan lembaga jenjang Salafi'],
  ['sandi_min', '6', 'Panjang minimal kata sandi saat Admin mereset / membuat akun']
].forEach(r => { if (!DEFAULT_SETTINGS.some(x => x[0] === r[0])) DEFAULT_SETTINGS.push(r); });
function lembagaLabel_() {
  const s = settingsMap_();
  return { Wustha: s.lembaga_wustha || 'PDF Wustha', Ulya: s.lembaga_ulya || 'PDF Ulya', Salafi: s.lembaga_salafi || 'Salafi' };
}
function sandiMin_() { return Math.max(4, num_(settingsMap_().sandi_min) || 6); }
function akunBoleh_(u, x) {
  need_(perms_(u).users, 'Hanya Admin yang dapat mengelola akun pengguna.');
  need_(!isDev_(x) || isDev_(u), 'Akun Pengembang Aplikasi hanya dapat diubah oleh Pengembang.');
}
function sandiAcak_() { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function waAkun_(x) {
  const v = readAll_('Verifikasi').find(r => lc_(r.username) === lc_(x.username));
  return String((v && v.wa) || x.wa || '').trim();
}
/** Daftar semua akun (termasuk nonaktif) untuk halaman Keamanan & Kelola Pengguna. */
ACTIONS['admin.akun'] = function (u) {
  need_(perms_(u).users, 'Hanya Admin yang dapat melihat daftar akun.');
  const v = verifSet_(), ver = {}; readAll_('Verifikasi').forEach(r => ver[lc_(r.username)] = r.wa);
  return readAll_('Users').filter(x => x.username).map(x => ({ username: x.username, nama: x.nama, tipe: x.tipe, kelas: x.kelas || '', kabag: x.kabag || '',
    nis_nip: x.nis_nip || '', jenis_nomor: x.jenis_nomor || '', asal: x.asal || '', foto: x.foto || '', aktif: lc_(x.aktif) === 'tidak' ? 'Tidak' : 'Ya',
    wa: String(ver[lc_(x.username)] || x.wa || ''), v: v[lc_(x.username)] ? 1 : 0, dev: isDev_(x) ? 1 : 0 }))
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
};
/** Reset kata sandi: otomatis mengeluarkan akun dari semua perangkat (token lama tidak berlaku). */
ACTIONS['admin.resetSandi'] = function (u, p) {
  const x = findUser_(p.username); if (!x) throw new Error('Pengguna tidak ditemukan.');
  akunBoleh_(u, x);
  const pw = String(p.password || '').trim() || sandiAcak_();
  if (pw.length < sandiMin_()) throw new Error('Kata sandi minimal ' + sandiMin_() + ' karakter.');
  if (/\s/.test(pw)) throw new Error('Kata sandi tidak boleh mengandung spasi.');
  lock_(() => update_('Users', x._row, { password: hashPw_(pw) }));
  const s = settingsMap_();
  const pesan = "Assalamu'alaikum " + x.nama + ",\n\nKata sandi akun *" + (s.nama_mobile || 'ALHUDA MOBILE') + "* Anda telah direset oleh Admin.\n\n" +
    "Username : *" + x.username + "*\nKata sandi baru : *" + pw + "*\n\nSilakan login kembali, lalu ganti kata sandi melalui menu Pengaturan → Biodata Pengguna. Jangan bagikan kata sandi kepada siapa pun.";
  return { username: x.username, nama: x.nama, password: pw, wa: waAkun_(x), pesan: pesan };
};
/** Kunci (nonaktifkan) / buka akun. Akun nonaktif tidak dapat login. */
ACTIONS['admin.aktif'] = function (u, p) {
  const x = findUser_(p.username); if (!x) throw new Error('Pengguna tidak ditemukan.');
  akunBoleh_(u, x);
  need_(lc_(x.username) !== lc_(u.username), 'Tidak dapat mengunci akun sendiri.');
  lock_(() => update_('Users', x._row, { aktif: p.aktif ? 'Ya' : 'Tidak' }));
  return { username: x.username, aktif: p.aktif ? 'Ya' : 'Tidak' };
};
/* Logo & Kop Surat juga dapat diubah Admin (sebelumnya khusus Pengembang). */
(function () {
  const sbgDev = u => (pbAdmin_(u) && !isDev_(u)) ? Object.assign({}, u, { kabag: (u.kabag ? u.kabag + ',' : '') + 'Pengembang Aplikasi' }) : u;
  ['logo.upload', 'logo.reset', 'logo.get'].forEach(a => { const asli = ACTIONS[a]; if (asli) ACTIONS[a] = (u, p) => asli(sbgDev(u), p); });
  /* Nama lembaga di kop raport PDF ikut pengaturan */
  const kopAsli = kop_;
  kop_ = function (judul, logoKey) {
    try {
      const L = lembagaLabel_();
      judul = String(judul).replace(/^PDF WUSTHA\b/, String(L.Wustha).toUpperCase()).replace(/^PDF ULYA\b/, String(L.Ulya).toUpperCase());
    } catch (e) {}
    return kopAsli(judul, logoKey);
  };
  /* label lembaga ke aplikasi (boot) & halaman login (publicInfo) */
  const bt = ACTIONS.boot;
  ACTIONS.boot = function (u, p) { const b = bt(u, p); try { b.settings.lembaga = lembagaLabel_(); b.settings.sandi_min = sandiMin_(); } catch (e) {} return b; };
  const pi = publicInfo_;
  publicInfo_ = function () { const o = pi(); try { o.lembaga = lembagaLabel_(); } catch (e) {} return o; };
})();
if (typeof SYNC_BACA !== 'undefined') SYNC_BACA.push('admin.akun');

/* ============================================================
 *  AKSES KHUSUS ADMIN — TAHAP 2: PENGATURAN AKADEMIK (v2.9.1)
 *  Sesi & jam pelajaran, wali kelas (manual / otomatis dari sesi), istilah, kabag/peran & hak akses.
 * ============================================================ */
[
  ['istilah_mengulang', 'Mengulang Malam', 'Istilah kegiatan mengulang malam (mis. Bimbingan / Muthala\'ah)'],
  ['jam_mengulang', '22.30 - 23.30', 'Jam kegiatan mengulang malam']
].forEach(r => { if (!DEFAULT_SETTINGS.some(x => x[0] === r[0])) DEFAULT_SETTINGS.push(r); });
if (SHEETS.Sesi.indexOf('hari') < 0) SHEETS.Sesi.push('hari');
SHEETS.WaliKelas = ['kelas', 'guru', 'diubah_oleh', 'diubah'];
SHEETS.Peran = ['nama', 'tipe', 'akses', 'keterangan', 'sembunyi', 'diubah'];
const PERAN_DILINDUNGI = ['Pengembang Aplikasi', 'Admin'];
const PERAN_INFO = {
  'Pengembang Aplikasi': 'Semua akses + pengaturan khusus pengembang',
  'Admin': 'Semua akses pengelolaan aplikasi',
  'Kabag Pendidikan': 'Roster, absen guru, nilai semua kelas, mengulang malam, pengumuman, naik kelas',
  'Kabag Administrasi': 'Roster pelajaran',
  'Kabag Bendahara': 'Iuran bulanan, uang tahunan & saldo santri',
  'Kabag Jamaah': 'Absen jamaah & catatan haris',
  'Kabag Algojo': 'Pelanggaran santri & catatan haris',
  'Kabag Kebersihan': 'Piket & kebersihan',
  'Kabag Media': 'Pengumuman',
  'Kabag Humas': 'Izin keluar sebentar & pengumuman',
  'Kabag Asrama': 'Asrama & pelanggaran',
  'Kabag Perizinan': 'Perizinan pulang',
  'Kabag Muzakir': 'Kabilah'
};
function peranRows_() { return readAll_('Peran').filter(r => r.nama); }
function peranKustom_() { return peranRows_().filter(r => r.tipe === 'kustom').map(r => ({ nama: r.nama, akses: String(r.akses || '').split(',').map(s => s.trim()).filter(Boolean), keterangan: r.keterangan || '' })); }
function peranSembunyi_() { return peranRows_().filter(r => r.tipe === 'bawaan' && r.sembunyi === 'Ya').map(r => r.nama); }
let PERAN_MEMO = null;
function peranMap_() { if (PERAN_MEMO) return PERAN_MEMO; const m = {}; peranKustom_().forEach(p => m[lc_(p.nama)] = p); return (PERAN_MEMO = m); }
/* Peran kustom mewarisi hak akses dari peran bawaan yang dipilih */
(function () {
  const asli = roles_;
  roles_ = function (u) {
    const r = asli(u); let m; try { m = peranMap_(); } catch (e) { return r; }
    if (!Object.keys(m).length) return r;
    const out = r.slice();
    r.forEach(n => { const p = m[lc_(n)]; if (p) p.akses.forEach(a => { if (a !== 'Pengembang Aplikasi' && out.indexOf(a) < 0) out.push(a); }); });
    return out;
  };
})();
function daftarPeran_() {
  const sembunyi = peranSembunyi_();
  return KABAG_LIST.filter(n => sembunyi.indexOf(n) < 0).concat(peranKustom_().map(k => k.nama).filter(n => KABAG_LIST.indexOf(n) < 0));
}
function gantiPeranUser_(lama, baru) {
  readAll_('Users').forEach(x => {
    const r = String(x.kabag || '').split(',').map(s => s.trim()).filter(Boolean);
    if (r.indexOf(lama) < 0) return;
    const n = r.map(s => s === lama ? baru : s).filter(Boolean).filter((s, i, arr) => arr.indexOf(s) === i);
    update_('Users', x._row, { kabag: n.join(', ') });
  });
}
ACTIONS['peran.list'] = function (u) {
  need_(perms_(u).users, 'Hanya Admin yang dapat mengelola peran.');
  const kustom = peranKustom_(), sembunyi = peranSembunyi_(), pakai = {};
  readAll_('Users').forEach(x => String(x.kabag || '').split(',').map(s => s.trim()).filter(Boolean).forEach(n => pakai[n] = (pakai[n] || 0) + 1));
  const bawaan = KABAG_LIST.filter(n => PERAN_INFO[n]);
  return {
    bawaan: bawaan.map(n => ({ nama: n, info: PERAN_INFO[n], sembunyi: sembunyi.indexOf(n) >= 0, dilindungi: PERAN_DILINDUNGI.indexOf(n) >= 0, jumlah: pakai[n] || 0 })),
    kustom: kustom.map(k => Object.assign({}, k, { jumlah: pakai[k.nama] || 0 })),
    aksesPilihan: bawaan.filter(n => n !== 'Pengembang Aplikasi').map(n => ({ nama: n, info: PERAN_INFO[n] }))
  };
};
/** Tambah / ubah peran. Mengganti nama peran bawaan = membuat peran baru yang mewarisi aksesnya, peran lama disembunyikan. */
ACTIONS['peran.save'] = function (u, p) {
  need_(perms_(u).users, 'Hanya Admin yang dapat mengelola peran.');
  const nama = String(p.nama || '').trim().replace(/,/g, ' ');
  if (!nama || nama.length > 40) throw new Error('Nama peran wajib diisi (maks. 40 karakter).');
  const akses = (Array.isArray(p.akses) ? p.akses : String(p.akses || '').split(',')).map(s => String(s).trim()).filter(s => s && s !== 'Pengembang Aplikasi' && PERAN_INFO[s]);
  if (akses.indexOf('Admin') >= 0) need_(isDev_(u) || pbAdmin_(u), 'Hanya Admin yang dapat memberi akses Admin.');
  const orig = String(p.original || '').trim();
  return lock_(() => {
    PERAN_MEMO = null;
    const rows = peranRows_(), adaNama = n => KABAG_LIST.indexOf(n) >= 0 || rows.some(r => r.nama === n && r.tipe === 'kustom');
    const rowOrig = rows.find(r => r.nama === orig && r.tipe === 'kustom');
    if (!orig || orig !== nama) need_(!adaNama(nama) || (orig && lc_(orig) === lc_(nama)), 'Nama peran "' + nama + '" sudah ada.');
    if (rowOrig) {   // ubah peran kustom
      if (!akses.length) throw new Error('Pilih minimal satu hak akses.');
      update_('Peran', rowOrig._row, { nama: nama, akses: akses.join(', '), keterangan: String(p.keterangan || ''), diubah: now_() });
      if (orig !== nama) gantiPeranUser_(orig, nama);
    } else if (orig && PERAN_INFO[orig]) {   // ganti nama peran bawaan
      need_(PERAN_DILINDUNGI.indexOf(orig) < 0, 'Peran ' + orig + ' tidak dapat diganti namanya.');
      if (orig === nama) return true;
      append_('Peran', { nama: nama, tipe: 'kustom', akses: orig, keterangan: 'Nama baru untuk ' + orig, sembunyi: '', diubah: now_() });
      const b = rows.find(r => r.nama === orig && r.tipe === 'bawaan');
      if (b) update_('Peran', b._row, { sembunyi: 'Ya', diubah: now_() }); else append_('Peran', { nama: orig, tipe: 'bawaan', akses: '', keterangan: '', sembunyi: 'Ya', diubah: now_() });
      gantiPeranUser_(orig, nama);
    } else {   // peran baru
      if (!akses.length) throw new Error('Pilih minimal satu hak akses.');
      append_('Peran', { nama: nama, tipe: 'kustom', akses: akses.join(', '), keterangan: String(p.keterangan || ''), sembunyi: '', diubah: now_() });
    }
    PERAN_MEMO = null;
    return true;
  });
};
/** Hapus peran (kustom dihapus; bawaan disembunyikan). Peran juga dilepas dari semua pengguna. */
ACTIONS['peran.delete'] = function (u, p) {
  need_(perms_(u).users, 'Hanya Admin yang dapat mengelola peran.');
  const nama = String(p.nama || '').trim();
  need_(PERAN_DILINDUNGI.indexOf(nama) < 0, 'Peran ' + nama + ' tidak dapat dihapus.');
  return lock_(() => {
    PERAN_MEMO = null;
    const rows = peranRows_(), k = rows.find(r => r.nama === nama && r.tipe === 'kustom');
    if (k) deleteRows_('Peran', [k._row]);
    else if (PERAN_INFO[nama]) { const b = rows.find(r => r.nama === nama && r.tipe === 'bawaan'); if (b) update_('Peran', b._row, { sembunyi: 'Ya' }); else append_('Peran', { nama: nama, tipe: 'bawaan', sembunyi: 'Ya', diubah: now_() }); }
    else throw new Error('Peran tidak ditemukan.');
    gantiPeranUser_(nama, '');
    PERAN_MEMO = null;
    return true;
  });
};
/** Tampilkan kembali peran bawaan yang disembunyikan. */
ACTIONS['peran.pulihkan'] = function (u, p) {
  need_(perms_(u).users, 'Hanya Admin yang dapat mengelola peran.');
  return lock_(() => { const b = peranRows_().find(r => r.nama === p.nama && r.tipe === 'bawaan'); if (b) update_('Peran', b._row, { sembunyi: '' }); return true; });
};

/* ---------- sesi & jam pelajaran ---------- */
(function () {
  sesiAll_ = function () {
    return readAll_('Sesi').filter(s => s.kode).map(s => ({ kode: s.kode, jam: s.jam, berlaku: s.berlaku, wali: lc_(s.wali_kelas) === 'ya', hari: s.hari || 'Setiap Hari' }));
  };
})();
ACTIONS['sesi.save'] = function (u, p) {
  need_(can_(u, 'Kabag Pendidikan'), 'Hanya Admin / Kabag Pendidikan yang dapat mengatur sesi.');
  const kode = String(p.kode || '').trim().toUpperCase(), orig = String(p.original || '').trim();
  if (!/^[A-Z0-9]{1,6}$/.test(kode)) throw new Error('Kode sesi 1–6 huruf/angka, mis. S1.');
  const jam = String(p.jam || '').trim();
  if (!/^\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}$/.test(jam)) throw new Error('Format jam: 07.30 - 09.00');
  const berlaku = (Array.isArray(p.berlaku) ? p.berlaku : String(p.berlaku || '').split(',')).map(s => String(s).trim()).filter(s => s === 'Salafi' || s === 'PDF');
  if (!berlaku.length) throw new Error('Pilih berlaku untuk Salafi dan/atau PDF.');
  let hari = (Array.isArray(p.hari) ? p.hari : String(p.hari || '').split(',')).map(s => String(s).trim()).filter(s => HARI.indexOf(s) >= 0);
  if (!hari.length || hari.indexOf('Setiap Hari') >= 0) hari = ['Setiap Hari'];
  return lock_(() => {
    const rows = readAll_('Sesi').filter(s => s.kode);
    const lama = orig ? rows.find(s => s.kode === orig) : null;
    if (orig && !lama) throw new Error('Sesi tidak ditemukan.');
    if ((!orig || orig !== kode) && rows.some(s => s.kode === kode)) throw new Error('Kode sesi ' + kode + ' sudah dipakai.');
    if (p.wali) rows.forEach(s => { if (s !== lama && lc_(s.wali_kelas) === 'ya') update_('Sesi', s._row, { wali_kelas: 'Tidak' }); });
    const obj = { kode: kode, jam: jam.replace(/\s*-\s*/, ' - ').replace(/:/g, '.'), berlaku: berlaku.join(', '), wali_kelas: p.wali ? 'Ya' : 'Tidak', hari: hari.join(', ') };
    if (lama) {
      update_('Sesi', lama._row, obj);
      if (orig !== kode) readAll_('Roster').forEach(r => { if (r.sesi === orig) update_('Roster', r._row, { sesi: kode }); });
    } else append_('Sesi', obj);
    return sesiAll_();
  });
};
ACTIONS['sesi.delete'] = function (u, p) {
  need_(can_(u, 'Kabag Pendidikan'), 'Hanya Admin / Kabag Pendidikan yang dapat mengatur sesi.');
  return lock_(() => {
    const s = readAll_('Sesi').find(x => x.kode === p.kode); if (!s) throw new Error('Sesi tidak ditemukan.');
    const r = readAll_('Roster').filter(x => x.sesi === p.kode);
    if (r.length && !p.paksa) throw new Error('PAKAI:' + r.length);
    if (r.length) deleteRows_('Roster', r.map(x => x._row));
    deleteRows_('Sesi', [s._row]);
    return sesiAll_();
  });
};

/* ---------- wali kelas: manual per kelas, atau otomatis dari sesi wali ---------- */
(function () {
  const otomatis = waliOf_;
  waliOf_ = function (kelas) {
    const m = readAll_('WaliKelas').find(r => r.kelas === kelas && r.guru);
    if (m) { const g = findUser_(m.guru); if (g) return { username: g.username, nama: g.nama, jenis: jenisNomor_(g.jenis_nomor), nomor: g.nis_nip || '', manual: true }; }
    return otomatis(kelas);
  };
  const kl = kelasList_;
  kelasList_ = function (u) { return kl(u).map(k => { const w = waliOf_(k.nama); k.wali = w ? w.nama : ''; return k; }); };
  /* nama kelas berubah / kelas dihapus → data wali ikut */
  const ks = ACTIONS['kelas.save'];
  if (ks) ACTIONS['kelas.save'] = function (u, p) {
    const r = ks(u, p);
    try { if (p.original && p.original !== p.nama) lock_(() => readAll_('WaliKelas').forEach(w => { if (w.kelas === p.original) update_('WaliKelas', w._row, { kelas: p.nama }); })); } catch (e) {}
    return r;
  };
  const kd = ACTIONS['kelas.delete'];
  if (kd) ACTIONS['kelas.delete'] = function (u, p) {
    const r = kd(u, p);
    try { lock_(() => { const rows = readAll_('WaliKelas').filter(w => w.kelas === p.nama).map(w => w._row); if (rows.length) deleteRows_('WaliKelas', rows); }); } catch (e) {}
    return r;
  };
})();
ACTIONS['wali.list'] = function (u) {
  need_(can_(u, 'Kabag Pendidikan'), 'Hanya Admin / Kabag Pendidikan yang dapat mengatur wali kelas.');
  const ws = sesiAll_().find(x => x.wali), r = rosterAll_(), man = {};
  readAll_('WaliKelas').forEach(w => { if (w.guru) man[w.kelas] = w.guru; });
  return { sesiWali: ws || null, kelas: kelasAll_().map(k => {
    const a = ws && r.find(x => x.kelas === k.nama && x.sesi === ws.kode), g = man[k.nama] ? findUser_(man[k.nama]) : null;
    return { kelas: k.nama, jenjang: k.jenjang, manual: g ? g.username : '', manualNama: g ? g.nama : '', otomatis: a ? a.guruNama : '' };
  }) };
};
ACTIONS['wali.save'] = function (u, p) {
  need_(can_(u, 'Kabag Pendidikan'), 'Hanya Admin / Kabag Pendidikan yang dapat mengatur wali kelas.');
  if (!kelasAll_().some(k => k.nama === p.kelas)) throw new Error('Kelas tidak ditemukan.');
  if (p.guru) { const g = findUser_(p.guru); if (!g || g.tipe !== 'Guru') throw new Error('Guru tidak ditemukan.'); }
  return lock_(() => {
    const r = readAll_('WaliKelas').find(w => w.kelas === p.kelas);
    const obj = { kelas: p.kelas, guru: p.guru || '', diubah_oleh: u.username, diubah: now_() };
    if (r) { if (p.guru) update_('WaliKelas', r._row, obj); else deleteRows_('WaliKelas', [r._row]); } else if (p.guru) append_('WaliKelas', obj);
    return ACTIONS['wali.list'](u);
  });
};

/* ---------- boot: peran, istilah ---------- */
(function () {
  const bt = ACTIONS.boot;
  ACTIONS.boot = function (u, p) {
    PERAN_MEMO = null;
    const b = bt(u, p);
    try {
      b.kabagList = daftarPeran_();
      const s = settingsMap_();
      b.settings.istilah = { mengulang: s.istilah_mengulang || 'Mengulang Malam', jamMengulang: s.jam_mengulang || '22.30 - 23.30' };
      b.perms = perms_(u);
    } catch (e) {}
    return b;
  };
})();
if (typeof SYNC_BACA !== 'undefined') SYNC_BACA.push('peran.list', 'wali.list');

/* ============================================================
 *  AKSES KHUSUS PENGEMBANG — TAHAP 3 (v2.10.0)
 *  Tema aplikasi, Tentang Aplikasi, istilah lembaga ("Dayah" → "Pesantren"),
 *  login khusus pengembang (tanpa akun di sheet Users), alamat server diatur di aplikasi.
 * ============================================================ */
[
  ['tema_app', '', 'Tema bawaan aplikasi (diatur dari menu Akses Pengembang)'],
  ['tema_kunci', 'Tidak', 'Kunci tema: pengguna tidak dapat memilih tema sendiri (Ya / Tidak)'],
  ['istilah_lembaga', 'Dayah', 'Sebutan lembaga di seluruh aplikasi (mis. Pesantren / Pondok / Sekolah)'],
  ['tentang_aplikasi', 'ALHUDA MOBILE adalah aplikasi sistem informasi akademik, administrasi dan komunikasi santri: absensi, nilai & raport digital, iuran, perizinan, asrama, pengumuman serta room chat dalam satu aplikasi.', 'Deskripsi di halaman Tentang Aplikasi'],
  ['tentang_kontak', '', 'Kontak pengembang (WhatsApp / email) di halaman Tentang Aplikasi']
].forEach(r => { if (!DEFAULT_SETTINGS.some(x => x[0] === r[0])) DEFAULT_SETTINGS.push(r); });
['tema_app', 'tema_kunci', 'istilah_lembaga', 'tentang_aplikasi', 'tentang_kontak', 'tentang_pemilik', 'tentang_alamat', 'tentang_pembuat', 'tanggal_revisi', 'penerbit', 'versi']
  .forEach(k => { if (SETTINGS_DEV_ONLY.indexOf(k) < 0) SETTINGS_DEV_ONLY.push(k); });

const HEX_ = /^#[0-9a-fA-F]{6}$/;
function temaApp_() {
  try {
    const t = JSON.parse(settingsMap_().tema_app || 'null');
    if (!t || !HEX_.test(t.pri) || !HEX_.test(t.pri2)) return null;
    return { nama: String(t.nama || 'Kustom').slice(0, 30), pri: t.pri, pri2: t.pri2, bg: HEX_.test(t.bg) ? t.bg : '' };
  } catch (e) { return null; }
}
function temaKunci_() { return lc_(settingsMap_().tema_kunci) === 'ya'; }
/** Sebutan lembaga; kata yang mengandung "dayah" (selain "Dayah" itu sendiri) ditolak agar tidak berulang. */
function istilahLembaga_() {
  const v = String(settingsMap_().istilah_lembaga || '').trim();
  return v && (lc_(v) === 'dayah' || !/dayah/i.test(v)) ? v : 'Dayah';
}
function gantiDayah_(teks, t) {
  t = t || istilahLembaga_(); if (lc_(t) === 'dayah') return String(teks);
  return String(teks).replace(/(^|[^A-Za-z0-9_@.\/-])(dayah)(?![A-Za-z0-9_@])/gi, (all, pre, m) =>
    pre + (m === 'DAYAH' ? t.toUpperCase() : m.charAt(0) === 'D' ? t.charAt(0).toUpperCase() + t.slice(1) : t.toLowerCase()));
}

/* ---------- login khusus pengembang (disimpan di Script Properties, bukan di Sheet) ---------- */
function devAkun_() {
  if (MEMO._devAkun !== undefined) return MEMO._devAkun;
  const pr = PropertiesService.getScriptProperties();
  let un = lc_(pr.getProperty('DEV_USER') || ''), pw = String(pr.getProperty('DEV_PASS') || '');
  const aktif = lc_(pr.getProperty('DEV_AKTIF') || 'ya') !== 'tidak';
  if (pw && pw.indexOf('h$') !== 0) { pw = hashPw_(pw); pr.setProperty('DEV_PASS', pw); } // sandi yang diisi manual langsung dienkripsi
  MEMO._devAkun = (un && pw) ? { username: un, password: pw, aktif: aktif } : null;
  return MEMO._devAkun;
}
function devVirtual_() {
  const d = devAkun_(); if (!d || !d.aktif) return null;
  return { username: d.username, password: d.password, nama: 'Pengembang Aplikasi', tipe: 'Guru', kabag: 'Pengembang Aplikasi', aktif: 'Ya', _row: 0, _virtual: true };
}
(function () {
  const cariAsli = findUser_;
  findUser_ = function (username) {
    const d = devVirtual_();
    if (d && lc_(username) === d.username) return d;
    return cariAsli(username);
  };
  /* Akun pengembang khusus tidak ada di sheet Users → tidak boleh ditulis ke baris mana pun. */
  const updAsli = update_;
  update_ = function (name, row, patch) {
    if (name === 'Users' && !(Number(row) >= 2)) throw new Error('Akun Pengembang Khusus tidak tersimpan di sheet Users, sehingga datanya tidak dapat diubah dari sini.');
    return updAsli(name, row, patch);
  };
  /* Batasi percobaan login akun pengembang: 5× salah → dikunci 15 menit. */
  const loginAsli = login_;
  login_ = function (p) {
    const d = devAkun_();
    if (!p || p._aksi || !d || lc_(p.username) !== d.username) return loginAsli(p);
    const c = CacheService.getScriptCache(), k = 'devgagal';
    const n = Number(c.get(k) || 0);
    if (n >= 5) throw new Error('Terlalu banyak percobaan login. Coba lagi 15 menit lagi.');
    try { const r = loginAsli(p); c.remove(k); return r; }
    catch (e) { c.put(k, String(n + 1), 900); throw e; }
  };
  /* Username akun pengembang khusus tidak boleh dipakai pengguna lain. */
  const usAsli = ACTIONS['users.save'];
  if (usAsli) ACTIONS['users.save'] = function (u, p) {
    const d = devAkun_();
    if (d && p && lc_(p.username) === d.username && lc_(p.original) !== d.username) throw new Error('Username "' + p.username + '" sudah dipakai.');
    return usAsli(u, p);
  };
})();
ACTIONS['dev.login.get'] = function (u) {
  need_(isDev_(u), 'Hanya Pengembang Aplikasi.');
  const d = devAkun_();
  return { username: d ? d.username : '', ada: !!d, aktif: d ? d.aktif : false, sedangDipakai: !!u._virtual };
};
ACTIONS['dev.login.save'] = function (u, p) {
  need_(isDev_(u), 'Hanya Pengembang Aplikasi.');
  const pr = PropertiesService.getScriptProperties(), d = devAkun_();
  const un = lc_(p.username || (d && d.username) || '');
  need_(/^[a-z0-9._]{3,30}$/.test(un), 'Username 3–30 karakter: huruf kecil, angka, titik atau garis bawah.');
  const lain = readAll_('Users').find(r => lc_(r.username) === un);
  need_(!lain, 'Username "' + un + '" sudah dipakai pengguna lain di sheet Users.');
  const aktif = p.aktif !== false;
  if (u._virtual && (!aktif || un !== u.username)) throw new Error('Anda sedang masuk memakai akun ini. Masuk dengan akun Pengembang lain untuk mengganti username atau menonaktifkannya.');
  if (p.password) need_(String(p.password).length >= 8 && !/\s/.test(p.password), 'Kata sandi minimal 8 karakter tanpa spasi.');
  else need_(d, 'Kata sandi wajib diisi untuk akun baru.');
  pr.setProperty('DEV_USER', un);
  if (p.password) pr.setProperty('DEV_PASS', hashPw_(String(p.password)));
  pr.setProperty('DEV_AKTIF', aktif ? 'Ya' : 'Tidak');
  delete MEMO._devAkun;
  const r = ACTIONS['dev.login.get'](u);
  if (u._virtual && p.password) { const v = devVirtual_(); if (v) r.token = makeToken_(v); } // sandi sendiri diganti → token baru
  return r;
};

/* ---------- tema aplikasi ---------- */
ACTIONS['dev.tema.save'] = function (u, p) {
  need_(isDev_(u), 'Hanya Pengembang Aplikasi.');
  const t = p.tema;
  let nilai = '';
  if (t) {
    need_(HEX_.test(t.pri) && HEX_.test(t.pri2), 'Warna tidak valid.');
    nilai = JSON.stringify({ nama: String(t.nama || 'Kustom').slice(0, 30), pri: t.pri, pri2: t.pri2, bg: HEX_.test(t.bg) ? t.bg : '' });
  }
  settingsSave_(u, { values: { tema_app: nilai, tema_kunci: p.kunci ? 'Ya' : 'Tidak' } });
  return { tema: temaApp_(), tema_kunci: temaKunci_() };
};

/* ---------- PDF: kata "dayah" ikut sebutan lembaga (hanya teks, bukan atribut/gambar) ---------- */
(function () {
  const pdfAsli = toPdf_;
  toPdf_ = function (html, name) {
    const t = istilahLembaga_();
    if (lc_(t) !== 'dayah') html = String(html).replace(/>([^<]+)</g, (a, x) => '>' + gantiDayah_(x, t) + '<');
    return pdfAsli(html, name);
  };
})();

/* ---------- boot & halaman login ---------- */
(function () {
  const bt = ACTIONS.boot;
  ACTIONS.boot = function (u, p) {
    const b = bt(u, p);
    try {
      const s = settingsMap_();
      b.settings.tema = temaApp_(); b.settings.tema_kunci = temaKunci_();
      b.settings.istilah_lembaga = istilahLembaga_();
      b.settings.tentang_aplikasi = s.tentang_aplikasi || ''; b.settings.tentang_kontak = s.tentang_kontak || '';
      b.settings.nama_web = s.nama_web; b.settings.nama_mobile = s.nama_mobile;
      b.devKhusus = !!u._virtual;
    } catch (e) {}
    return b;
  };
  const pi = publicInfo_;
  publicInfo_ = function () {
    const o = pi();
    try { o.tema = temaApp_(); o.tema_kunci = temaKunci_(); o.istilah_lembaga = istilahLembaga_(); } catch (e) {}
    return o;
  };
})();

/* ============================================================
 *  TAHAP 4 — HALAMAN HOME & BANNER DI GITHUB (v2.11.0)
 *  Admin & Pengembang mengelola file di folder home/ (dan banner situs) dari aplikasi.
 *  Token GitHub disimpan di Script Properties (GH_TOKEN) dan TIDAK PERNAH dikirim ke aplikasi.
 * ============================================================ */
const GH_EXT_TEKS = ['html', 'htm', 'css', 'js', 'json', 'txt', 'xml', 'md', 'svg', 'webmanifest'];
const GH_EXT = GH_EXT_TEKS.concat(['jpg', 'jpeg', 'png', 'webp', 'gif', 'ico', 'pdf', 'mp4', 'woff', 'woff2']);
const GH_MAKS = 5 * 1024 * 1024; // 5 MB per file
const GH_MAKS_BANNER = 8;
function ghBoleh_(u) { need_(pbAdmin_(u), 'Hanya Admin & Pengembang Aplikasi yang dapat mengelola halaman Home.'); }
function ghCfg_() {
  const pr = PropertiesService.getScriptProperties();
  return {
    token: pr.getProperty('GH_TOKEN') || '', repo: pr.getProperty('GH_REPO') || '', branch: pr.getProperty('GH_BRANCH') || 'main',
    folder: pr.getProperty('GH_FOLDER') || 'home', situs: pr.getProperty('GH_SITUS') || String(getSetting_('link_aplikasi') || '').trim()
  };
}
function ghSiap_() { const c = ghCfg_(); need_(c.token && c.repo, 'GitHub belum diatur. Buka tab "Pengaturan GitHub" lalu isi repositori & token.'); return c; }
function ghFetch_(c, method, path, body) {
  const o = { method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ALHUDA-MOBILE' } };
  if (body) o.payload = JSON.stringify(body);
  const r = UrlFetchApp.fetch('https://api.github.com' + path, o), code = r.getResponseCode();
  let j = null; try { j = JSON.parse(r.getContentText() || 'null'); } catch (e) {}
  return { code: code, data: j };
}
function ghErr_(r, apa) {
  const m = (r.data && r.data.message) || ('kode ' + r.code);
  if (r.code === 401) return new Error('Token GitHub tidak valid atau sudah kedaluwarsa. Perbarui token di Pengaturan GitHub.');
  if (r.code === 403) return new Error('Token GitHub tidak memiliki izin menulis (Contents: Read and write). ' + m);
  if (r.code === 404) return new Error((apa || 'File / repositori') + ' tidak ditemukan di GitHub, atau token tidak punya akses ke repositori ini.');
  if (r.code === 409) return new Error('File sedang diubah dari tempat lain. Muat ulang lalu coba lagi.');
  return new Error('GitHub: ' + m);
}
/** Jalur relatif di dalam folder home → jalur lengkap di repositori. Menolak "..", karakter aneh & ekstensi tak dikenal. */
function ghJalur_(c, rel, file) {
  rel = String(rel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const seg = rel ? rel.split('/') : [];
  seg.forEach(s => need_(/^[A-Za-z0-9][A-Za-z0-9._ -]{0,80}$/.test(s) && s !== '..', 'Nama file / folder tidak valid: ' + s));
  if (file) { const ext = (rel.split('.').pop() || '').toLowerCase(); need_(seg.length && GH_EXT.indexOf(ext) >= 0, 'Jenis file tidak diizinkan. Diizinkan: ' + GH_EXT.join(', ')); }
  return c.folder + (rel ? '/' + rel : '');
}
const ghUrl_ = (c, full) => '/repos/' + c.repo + '/contents/' + full.split('/').map(encodeURIComponent).join('/');
function ghSha_(c, full) { const r = ghFetch_(c, 'get', ghUrl_(c, full) + '?ref=' + encodeURIComponent(c.branch)); return r.code === 200 && r.data && r.data.sha ? r.data.sha : null; }
function ghTulis_(c, u, full, b64, pesan) {
  const body = { message: pesan + ' — oleh @' + u.username + ' dari ALHUDA MOBILE', content: b64, branch: c.branch };
  const sha = ghSha_(c, full); if (sha) body.sha = sha;
  const r = ghFetch_(c, 'put', ghUrl_(c, full), body);
  if (r.code !== 200 && r.code !== 201) throw ghErr_(r);
  return { path: full, baru: !sha };
}
function ghHapus_(c, u, full) {
  const sha = ghSha_(c, full); need_(sha, 'File tidak ditemukan di GitHub.');
  const r = ghFetch_(c, 'delete', ghUrl_(c, full), { message: 'Hapus ' + full + ' — oleh @' + u.username + ' dari ALHUDA MOBILE', sha: sha, branch: c.branch });
  if (r.code !== 200) throw ghErr_(r);
}
function ghB64_(p) {
  if (p.teks !== undefined) return Utilities.base64Encode(String(p.teks), Utilities.Charset.UTF_8);
  const d = String(p.data || '').replace(/^data:[^,]*,/, '');
  need_(d, 'File kosong.');
  need_(d.length * 0.75 <= GH_MAKS, 'Ukuran file maksimal 5 MB.');
  return d;
}
function ghSitus_(c, rel) { const b = String(c.situs || '').replace(/\/+$/, ''); return b && /^https:\/\//.test(b) ? b + '/' + rel.split('/').map(encodeURIComponent).join('/') : ''; }

ACTIONS['gh.config.get'] = function (u) {
  ghBoleh_(u);
  const c = ghCfg_();
  return { repo: c.repo, branch: c.branch, folder: c.folder, situs: c.situs, adaToken: !!c.token, tokenAkhir: c.token ? c.token.slice(-4) : '' };
};
ACTIONS['gh.config.save'] = function (u, p) {
  ghBoleh_(u);
  const pr = PropertiesService.getScriptProperties(), c = ghCfg_();
  const repo = String(p.repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  need_(/^[\w.-]+\/[\w.-]+$/.test(repo), 'Repositori harus berformat pemilik/nama-repo, mis. amteknologia-sketch/PORTAL-ALHUDA-MOBILE.');
  const branch = String(p.branch || 'main').trim(), folder = String(p.folder || 'home').trim().replace(/^\/+|\/+$/g, '');
  need_(/^[\w./-]{1,100}$/.test(branch), 'Nama branch tidak valid.');
  need_(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(folder) && folder.split('/').indexOf('..') < 0, 'Nama folder tidak valid.');
  const situs = String(p.situs || '').trim();
  need_(!situs || /^https:\/\/\S+$/.test(situs), 'Alamat situs harus diawali https://');
  let token = p.hapusToken ? '' : (String(p.token || '').trim() || c.token);
  if (p.token) need_(/^(github_pat_|ghp_|gho_|ghs_)[A-Za-z0-9_]{20,}$/.test(String(p.token).trim()), 'Format token GitHub tidak dikenali (biasanya diawali github_pat_ atau ghp_).');
  let info = null;
  if (token) { // uji token & izin tulis sebelum disimpan
    const t = Object.assign({}, c, { token: token, repo: repo });
    const r = ghFetch_(t, 'get', '/repos/' + repo);
    if (r.code !== 200) throw ghErr_(r, 'Repositori ' + repo);
    if (r.data.permissions && r.data.permissions.push === false) throw new Error('Token hanya bisa membaca. Beri izin "Contents: Read and write" pada token.');
    const b = ghFetch_(t, 'get', '/repos/' + repo + '/branches/' + encodeURIComponent(branch));
    if (b.code !== 200) throw new Error('Branch "' + branch + '" tidak ada di repositori ' + repo + '.');
    info = { pribadi: !!r.data.private, nama: r.data.full_name };
  }
  pr.setProperty('GH_REPO', repo); pr.setProperty('GH_BRANCH', branch); pr.setProperty('GH_FOLDER', folder); pr.setProperty('GH_SITUS', situs);
  pr.setProperty('GH_TOKEN', token);
  const o = ACTIONS['gh.config.get'](u); o.uji = info; return o;
};
ACTIONS['gh.list'] = function (u, p) {
  ghBoleh_(u); const c = ghSiap_();
  const full = ghJalur_(c, p.dir);
  const r = ghFetch_(c, 'get', ghUrl_(c, full) + '?ref=' + encodeURIComponent(c.branch));
  if (r.code === 404) return { dir: String(p.dir || ''), items: [], kosong: true };
  if (r.code !== 200) throw ghErr_(r, 'Folder ' + full);
  const items = (Array.isArray(r.data) ? r.data : []).filter(x => x.type === 'dir' || x.type === 'file').map(x => {
    const rel = x.path.slice(c.folder.length + 1);
    return { nama: x.name, rel: rel, tipe: x.type, ukuran: x.size || 0, situs: x.type === 'file' ? ghSitus_(c, rel) : '' };
  }).sort((a, b) => (a.tipe === b.tipe ? a.nama.localeCompare(b.nama) : a.tipe === 'dir' ? -1 : 1));
  return { dir: String(p.dir || ''), items: items, repo: c.repo, branch: c.branch, folder: c.folder };
};
ACTIONS['gh.read'] = function (u, p) {
  ghBoleh_(u); const c = ghSiap_();
  const full = ghJalur_(c, p.rel, true), ext = full.split('.').pop().toLowerCase();
  const r = ghFetch_(c, 'get', ghUrl_(c, full) + '?ref=' + encodeURIComponent(c.branch));
  if (r.code !== 200) throw ghErr_(r, 'File ' + full);
  need_(r.data.content, 'File terlalu besar untuk dibuka di aplikasi (maks. 1 MB). Unduh dari GitHub.');
  const b64 = String(r.data.content).replace(/\s/g, '');
  if (GH_EXT_TEKS.indexOf(ext) >= 0 && ext !== 'svg') return { rel: p.rel, teks: Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString('UTF-8'), ukuran: r.data.size };
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
  return { rel: p.rel, data: 'data:' + mime + ';base64,' + b64, ukuran: r.data.size };
};
ACTIONS['gh.save'] = function (u, p) {
  ghBoleh_(u); const c = ghSiap_();
  const full = ghJalur_(c, p.rel, true);
  return lock_(() => ghTulis_(c, u, full, ghB64_(p), (p.teks !== undefined ? 'Ubah ' : 'Unggah ') + full));
};
ACTIONS['gh.delete'] = function (u, p) {
  ghBoleh_(u); const c = ghSiap_();
  const full = ghJalur_(c, p.rel, true);
  need_(full !== c.folder + '/home.html' || p.paksa, 'HOME_UTAMA');
  lock_(() => ghHapus_(c, u, full));
  if (/^img\/banner/i.test(p.rel)) { try { ghBannerSimpan_(c, u, ghBannerBaca_(c).filter(b => 'img/' + b.file !== p.rel)); } catch (e) {} }
  return true;
};

/* ---------- banner: daftar di img/banner.json (dibaca home.html) ---------- */
function ghBannerBaca_(c) {
  const full = c.folder + '/img/banner.json';
  const r = ghFetch_(c, 'get', ghUrl_(c, full) + '?ref=' + encodeURIComponent(c.branch));
  if (r.code === 200 && r.data.content) {
    try { const j = JSON.parse(Utilities.newBlob(Utilities.base64Decode(String(r.data.content).replace(/\s/g, ''))).getDataAsString('UTF-8')); if (Array.isArray(j.banner)) return j.banner.filter(b => b && b.file); } catch (e) {}
  }
  // belum ada banner.json → ambil dari file img/banner*.jpg yang sudah ada
  const l = ghFetch_(c, 'get', ghUrl_(c, c.folder + '/img') + '?ref=' + encodeURIComponent(c.branch));
  return (l.code === 200 && Array.isArray(l.data) ? l.data : []).filter(x => x.type === 'file' && /^banner.*\.(jpe?g|png|webp)$/i.test(x.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(x => ({ file: x.name, judul: '' }));
}
function ghBannerSimpan_(c, u, list) {
  const isi = JSON.stringify({ v: Date.now(), banner: list.map(b => ({ file: String(b.file), judul: String(b.judul || '').slice(0, 120) })) }, null, 2);
  ghTulis_(c, u, c.folder + '/img/banner.json', Utilities.base64Encode(isi, Utilities.Charset.UTF_8), 'Perbarui daftar banner');
}
function ghBannerOut_(c, list) { return { banner: list.map(b => Object.assign({}, b, { rel: 'img/' + b.file, situs: ghSitus_(c, 'img/' + b.file) })), maks: GH_MAKS_BANNER }; }
ACTIONS['gh.banner.list'] = function (u) { ghBoleh_(u); const c = ghSiap_(); return ghBannerOut_(c, ghBannerBaca_(c)); };
ACTIONS['gh.banner.upload'] = function (u, p) {
  ghBoleh_(u); const c = ghSiap_();
  return lock_(() => {
    const list = ghBannerBaca_(c);
    let file = p.file && list.some(b => b.file === p.file) ? p.file : ''; // ganti gambar banner yang sudah ada
    if (!file) {
      need_(list.length < GH_MAKS_BANNER, 'Banner maksimal ' + GH_MAKS_BANNER + '. Hapus salah satu dulu.');
      let n = 1; while (list.some(b => b.file.toLowerCase() === 'banner' + n + '.jpg')) n++;
      file = 'banner' + n + '.jpg';
      list.push({ file: file, judul: String(p.judul || '').slice(0, 120) });
    } else if (p.judul !== undefined) list.forEach(b => { if (b.file === file) b.judul = String(p.judul).slice(0, 120); });
    ghTulis_(c, u, c.folder + '/img/' + file, ghB64_(p), 'Unggah banner img/' + file);
    ghBannerSimpan_(c, u, list);
    return ghBannerOut_(c, list);
  });
};
ACTIONS['gh.banner.save'] = function (u, p) { // urutan & judul
  ghBoleh_(u); const c = ghSiap_();
  return lock_(() => {
    const ada = ghBannerBaca_(c), m = {}; ada.forEach(b => m[b.file] = b);
    const list = (p.banner || []).filter(b => m[b.file]).map(b => ({ file: b.file, judul: String(b.judul || '') }));
    ada.forEach(b => { if (!list.some(x => x.file === b.file)) list.push(b); });
    ghBannerSimpan_(c, u, list);
    return ghBannerOut_(c, list);
  });
};
ACTIONS['gh.banner.hapus'] = function (u, p) {
  ghBoleh_(u); const c = ghSiap_();
  return lock_(() => {
    const list = ghBannerBaca_(c), sisa = list.filter(b => b.file !== p.file);
    need_(sisa.length < list.length, 'Banner tidak ditemukan.');
    need_(sisa.length >= 1, 'Minimal harus ada 1 banner.');
    ghBannerSimpan_(c, u, sisa);
    try { ghHapus_(c, u, c.folder + '/img/' + p.file); } catch (e) {}
    return ghBannerOut_(c, sisa);
  });
};

/* ============================================================
 *  v2.12.0
 *  1. Pemberitahuan: santri hanya melihat pemberitahuan miliknya (catatan semua santri hanya untuk guru).
 *  2. Room Chat: arsipkan, hapus chat (untuk diri sendiri), blokir pengguna.
 *  3. Santri Guru Khusus: Admin / Kabag Pendidikan menandai santri sebagai pengajar → bisa dipilih di roster,
 *     dan mendapat penanda "Guru Pelajaran …" di beranda & profil.
 * ============================================================ */
SHEETS.ChatAtur = ['username', 'lawan', 'arsip', 'hapus', 'blokir', 'diubah', 'riwayat_blokir'];
if (SHEETS.Users.indexOf('guru_khusus') < 0) SHEETS.Users.push('guru_khusus');

/* ---------- 1. pemberitahuan santri ---------- */
(function () {
  const pb = ACTIONS.pemberitahuan;
  ACTIONS.pemberitahuan = function (u, p) {
    const r = pb(u, p);
    if (isGuru_(u)) return r;
    const saya = x => lc_(x.username) === lc_(u.username);
    (r.days || []).forEach(d => ['ngaji', 'pulang', 'keluar', 'pelanggaran', 'jamaah'].forEach(k => { if (d[k]) d[k] = d[k].filter(saya); }));
    return r;
  };
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) {
    const d = db(u, p);
    if (!isGuru_(u)) d.notifHariIni = null;
    try { d.guruKhusus = guruKhususInfo_(u); } catch (e) {}
    return d;
  };
})();

/* ---------- 2. pengaturan chat per pengguna ---------- */
function chatAtur_(u) {
  const k = '_ca_' + lc_(u.username);
  if (MEMO[k]) return MEMO[k];
  const m = {};
  readAll_('ChatAtur').filter(r => lc_(r.username) === lc_(u.username)).forEach(r => m[lc_(r.lawan)] = r);
  return (MEMO[k] = m);
}
function chatAturSet_(u, lawan, patch) {
  return lock_(() => {
    const r = readAll_('ChatAtur').find(x => lc_(x.username) === lc_(u.username) && lc_(x.lawan) === lc_(lawan));
    const o = Object.assign({ diubah: now_() }, patch);
    if (r) update_('ChatAtur', r._row, o); else append_('ChatAtur', Object.assign({ username: u.username, lawan: lawan, arsip: '', hapus: '', blokir: '' }, o));
    delete MEMO['_ca_' + lc_(u.username)];
    return chatAturOut_(u, lawan);
  });
}
function chatAturOut_(u, lawan) {
  const a = chatAtur_(u)[lc_(lawan)] || {};
  const lain = lawan.indexOf(':') < 0 ? (chatAtur_({ username: lawan })[lc_(u.username)] || {}) : {};
  return { lawan: lawan, arsip: a.arsip === 'Ya', hapus: a.hapus || '', blokir: a.blokir || '', diblokir: !!lain.blokir };
}
/** Pesan disembunyikan bila: sebelum "hapus chat", atau dikirim pengguna yang saya blokir setelah waktu blokir. */
function chatTampil_(u, lawan, m) {
  const a = chatAtur_(u)[lc_(lawan)]; if (!a) return true;
  if (a.hapus && String(m.waktu) <= a.hapus) return false;
  if (!m.dariSaya) {
    if (a.blokir && String(m.waktu) >= a.blokir) return false;
    if (a.riwayat_blokir) { // pesan yang dikirim selama pernah diblokir tetap tidak ditampilkan
      let R = []; try { R = JSON.parse(a.riwayat_blokir); } catch (e) {}
      if (R.some(x => String(m.waktu) >= x[0] && String(m.waktu) <= x[1])) return false;
    }
  }
  return true;
}
(function () {
  const ct = ACTIONS['chat.contacts'];
  ACTIONS['chat.contacts'] = function (u, p) {
    const L = ct(u, p), A = chatAtur_(u);
    if (!Object.keys(A).length) return L;
    return L.map(c => {
      const a = A[lc_(c.username)]; if (!a) return c;
      c = Object.assign({}, c);
      if (a.arsip === 'Ya') c.arsip = true;
      if (a.blokir) { c.blokir = true; if (c.last && !c.last.dariSaya && String(c.last.waktu) >= a.blokir) { c.last = null; c.unread = 0; } }
      if (a.hapus && c.last && String(c.last.waktu) <= a.hapus) { c.last = null; c.unread = 0; }
      return c;
    });
  };
  const th = ACTIONS['chat.thread'];
  ACTIONS['chat.thread'] = function (u, p) {
    const r = th(u, p);
    if (!Array.isArray(r) || !chatAtur_(u)[lc_(p.with)]) return r;
    return r.filter(m => chatTampil_(u, p.with, m));
  };
  const un = ACTIONS['chat.unread'];
  ACTIONS['chat.unread'] = function (u, p) {
    const r = un(u, p), A = chatAtur_(u), blok = Object.keys(A).filter(k => A[k].blokir || A[k].riwayat_blokir);
    if (!blok.length || !r) return r;
    const me = lc_(u.username);
    const sembunyi = readAll_('Chat').filter(c => lc_(c.ke) === me && c.dibaca !== 'Ya' && A[lc_(c.dari)] && !chatTampil_(u, c.dari, { waktu: c.waktu, dariSaya: false }));
    const ids = {}; sembunyi.forEach(c => ids[c.id] = 1);
    r.count = Math.max(0, (r.count || 0) - sembunyi.length);
    if (r.latest) r.latest = r.latest.filter(x => !ids[x.id]);
    return r;
  };
  ['chat.send', 'chat.file'].forEach(k => {
    const asli = ACTIONS[k];
    ACTIONS[k] = function (u, p) {
      const to = String(p.to || '');
      if (to && to.indexOf(':') < 0) {
        const a = chatAtur_(u)[lc_(to)];
        need_(!(a && a.blokir), 'Anda memblokir pengguna ini. Buka blokir untuk mengirim pesan.');
      }
      return asli(u, p);
    };
  });
})();
ACTIONS['chat.atur.get'] = function (u, p) { need_(p.with, 'Percakapan tidak valid.'); return chatAturOut_(u, String(p.with)); };
ACTIONS['chat.arsip'] = function (u, p) {
  need_(p.with, 'Percakapan tidak valid.');
  return chatAturSet_(u, String(p.with), { arsip: p.arsip ? 'Ya' : '' });
};
ACTIONS['chat.bersihkan'] = function (u, p) {   // hapus chat: hanya dari tampilan saya, lawan bicara tetap melihatnya
  const w = String(p.with || ''); need_(w, 'Percakapan tidak valid.');
  const waktu = now_();
  if (w.indexOf(':') < 0) { // tandai pesan masuk yang belum dibaca sebagai dibaca
    const me = lc_(u.username);
    lock_(() => readAll_('Chat').filter(c => lc_(c.ke) === me && lc_(c.dari) === lc_(w) && c.dibaca !== 'Ya').forEach(c => update_('Chat', c._row, { dibaca: 'Ya' })));
  }
  return chatAturSet_(u, w, { hapus: waktu });
};
ACTIONS['chat.blokir'] = function (u, p) {
  const w = String(p.with || ''); need_(w && w.indexOf(':') < 0, 'Hanya pengguna yang dapat diblokir.');
  const t = findUser_(w); need_(t, 'Pengguna tidak ditemukan.');
  need_(lc_(t.username) !== lc_(u.username), 'Tidak dapat memblokir diri sendiri.');
  if (p.blokir) need_(!(t.kabag && /Admin|Pengembang Aplikasi/.test(t.kabag)) || isDev_(u), 'Admin dan Pengembang Aplikasi tidak dapat diblokir.');
  const a = chatAtur_(u)[lc_(t.username)] || {};
  const patch = { blokir: p.blokir ? (a.blokir || now_()) : '' };
  if (!p.blokir && a.blokir) {
    let R = []; try { R = JSON.parse(a.riwayat_blokir || '[]'); } catch (e) {}
    R.push([a.blokir, now_()]); patch.riwayat_blokir = JSON.stringify(R.slice(-20));
  }
  return chatAturSet_(u, t.username, patch);
};

/* ---------- 3. santri guru khusus ---------- */
function isGuruKhusus_(t) { return !!t && t.tipe === 'Santri' && lc_(t.guru_khusus) === 'ya'; }
function bolehGuruKhusus_(u) { return can_(u, 'Kabag Pendidikan'); } // Admin & Pengembang otomatis termasuk
function mengajarDari_(un) {
  const ses = {}; sesiAll_().forEach(s => ses[s.kode] = s.jam || s.kode);
  return rosterAll_().filter(r => lc_(r.guru) === lc_(un)).map(r => ({ mapel: r.mapel, kelas: r.kelas, sesi: r.sesi, jam: ses[r.sesi] || r.sesi, hari: r.hari }));
}
/** "Guru Pelajaran IPA (Kelas 1)" — per mapel, kelas digabung. */
function labelMengajar_(list) {
  const m = {}; list.forEach(r => { (m[r.mapel] = m[r.mapel] || []); if (m[r.mapel].indexOf(r.kelas) < 0) m[r.mapel].push(r.kelas); });
  return Object.keys(m).map(k => 'Guru Pelajaran ' + k + ' (' + m[k].join(', ') + ')');
}
function guruKhususInfo_(u) {
  const t = findUser_(u.username);
  if (!isGuruKhusus_(t)) return null;
  const L = mengajarDari_(t.username);
  return { aktif: true, mengajar: L, label: labelMengajar_(L) };
}
ACTIONS['guruKhusus.set'] = function (u, p) {
  need_(bolehGuruKhusus_(u), 'Hanya Admin / Kabag Pendidikan yang dapat menandai Guru Khusus.');
  const t = findUser_(p.username); need_(t && t._row >= 2, 'Pengguna tidak ditemukan.');
  need_(t.tipe === 'Santri', 'Hanya santri yang dapat ditandai sebagai Guru Khusus.');
  if (!p.aktif) {
    const n = rosterAll_().filter(r => lc_(r.guru) === lc_(t.username)).length;
    if (n && !p.paksa) throw new Error('PAKAI:' + n);
    if (n) lock_(() => { const rows = readAll_('Roster').filter(r => lc_(r.guru) === lc_(t.username)).map(r => r._row); deleteRows_('Roster', rows); });
  }
  lock_(() => update_('Users', t._row, { guru_khusus: p.aktif ? 'Ya' : '' }));
  return { username: t.username, guruKhusus: !!p.aktif };
};
ACTIONS['guruKhusus.list'] = function (u) {
  return activeUsers_().filter(isGuruKhusus_).map(t => ({ username: t.username, nama: t.nama, kelas: t.kelas || '' }));
};
(function () {
  /* Roster: santri Guru Khusus boleh dipilih sebagai pengajar */
  const rs = ACTIONS['roster.save'];
  ACTIONS['roster.save'] = function (u, p) {
    const g = p && p.guru ? findUser_(p.guru) : null;
    if (!isGuruKhusus_(g)) {
      if (g && g.tipe === 'Santri') throw new Error(g.nama + ' adalah santri. Tandai dulu sebagai Guru Khusus di profilnya agar dapat mengajar.');
      return rs(u, p);
    }
    const asli = findUser_;
    findUser_ = function (x) { const r = asli(x); return r && lc_(r.username) === lc_(g.username) ? Object.assign({}, r, { tipe: 'Guru' }) : r; };
    try { return rs(u, p); } finally { findUser_ = asli; }
  };
  /* Profil: penanda guru khusus & pelajaran yang diajar */
  const pg = ACTIONS['profil.get'];
  ACTIONS['profil.get'] = function (u, p) {
    const o = pg(u, p);
    try {
      const t = findUser_(o.username);
      if (t && t.tipe === 'Santri') {
        o.guruKhusus = isGuruKhusus_(t);
        o.bolehGuruKhusus = bolehGuruKhusus_(u);
        if (o.guruKhusus) { const L = mengajarDari_(t.username); o.mengajarLabel = labelMengajar_(L); o.mengajarJadwal = L; }
      }
    } catch (e) {}
    return o;
  };
  /* Boot: daftar santri guru khusus (untuk pilihan di roster) */
  const bt = ACTIONS.boot;
  ACTIONS.boot = function (u, p) {
    const b = bt(u, p);
    try { const set = {}; activeUsers_().filter(isGuruKhusus_).forEach(t => set[lc_(t.username)] = 1); (b.users || []).forEach(x => { if (set[lc_(x.username)]) x.guruKhusus = true; }); } catch (e) {}
    return b;
  };
})();

/* ============================================================
 *  v2.13.1 — Pilihan mata pelajaran di Input Nilai hanya yang terpilih di Roster kelas tersebut.
 *  Mapel yang tidak ada di roster (walau pernah punya nilai) disembunyikan otomatis.
 * ============================================================ */
nilaiMapel_ = function (u, p) {
  const m = {};
  rosterAll_().filter(r => r.kelas === p.kelas && r.mapel && (can_(u, 'Kabag Pendidikan') || lc_(r.guru) === lc_(u.username)))
    .forEach(r => { const v = String(r.mapel).trim(); if (v && !m[lc_(v)]) m[lc_(v)] = v; });
  return Object.keys(m).map(k => m[k]).sort((a, b) => a.localeCompare(b, 'id'));
};

/* ============================================================
 *  v2.14.0 — KELAS SAYA (santri)
 *  Roster kelas, kas kelas, piket harian, postingan kelas, chat kelas,
 *  pengurus kelas lewat voting (ketua, wakil, sekretaris, bendahara),
 *  petugas absen kelas (ditunjuk Admin / Kabag Pendidikan).
 * ============================================================ */
SHEETS.VotingKelas = ['kelas', 'periode', 'jabatan', 'pemilih', 'calon', 'waktu'];
SHEETS.KasKelas = ['id', 'kelas', 'tanggal', 'jenis', 'jumlah', 'keterangan', 'anggota', 'oleh', 'waktu'];
SHEETS.PiketKelas = ['kelas', 'hari', 'username', 'diubah'];
SHEETS.PetugasAbsen = ['kelas', 'username', 'oleh', 'diubah'];
['kelas_post', 'umum'].forEach(k => { if (SHEETS.Postingan.indexOf(k) < 0) SHEETS.Postingan.push(k); });
const JABATAN_KELAS = ['Ketua Kelas', 'Wakil Ketua', 'Sekretaris', 'Bendahara'];
const HARI_PIKET = ['Sabtu', 'Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

function periodeKelas_() { return String(settingsMap_().tahun_ajaran || 'umum'); }
function anggotaKelas_(kelas) { return santriAll_().filter(s => s.kelas === kelas).sort((a, b) => String(a.nama).localeCompare(String(b.nama))); }
function isWaliKelas_(u, kelas) { const w = waliOf_(kelas); return !!w && lc_(w.username) === lc_(u.username); }
function pengelolaKelas_(u, kelas) { return can_(u, 'Kabag Pendidikan') || isWaliKelas_(u, kelas); }
/** Kelas yang boleh dibuka: santri → kelasnya sendiri; Admin / Kabag Pendidikan / wali → kelas yang dipilih. */
function kelasAkses_(u, kelas) {
  if (u.tipe === 'Santri') { need_(u.kelas, 'Anda belum terdaftar di kelas mana pun.'); need_(!kelas || kelas === u.kelas, 'Anda hanya dapat membuka kelas Anda sendiri.'); return u.kelas; }
  need_(kelas && kelasAll_().some(k => k.nama === kelas), 'Pilih kelas.');
  need_(pengelolaKelas_(u, kelas), 'Hanya wali kelas, Kabag Pendidikan & Admin yang dapat membuka halaman kelas ini.');
  return kelas;
}
/** Hasil voting: suara terbanyak menang; seri → yang lebih dulu mencapai jumlah itu. Satu orang satu jabatan (urut ketua → bendahara). */
function pengurusKelas_(kelas) {
  const k = '_pk_' + kelas; if (MEMO[k]) return MEMO[k];
  const per = periodeKelas_(), ang = {}; anggotaKelas_(kelas).forEach(s => ang[lc_(s.username)] = s);
  const suara = {}; JABATAN_KELAS.forEach(j => suara[j] = {});
  readAll_('VotingKelas').filter(v => v.kelas === kelas && String(v.periode) === per && suara[v.jabatan] && ang[lc_(v.pemilih)] && ang[lc_(v.calon)])
    .sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)))
    .forEach(v => { const c = suara[v.jabatan][lc_(v.calon)] = suara[v.jabatan][lc_(v.calon)] || { n: 0, w: '' }; c.n++; c.w = v.waktu; });
  const dipakai = {}, hasil = {};
  JABATAN_KELAS.forEach(j => {
    const L = Object.keys(suara[j]).map(un => ({ un: un, n: suara[j][un].n, w: suara[j][un].w })).sort((a, b) => b.n - a.n || String(a.w).localeCompare(String(b.w)));
    const pilih = L.find(x => !dipakai[x.un]);
    if (pilih) { dipakai[pilih.un] = 1; const s = ang[pilih.un]; hasil[j] = { username: s.username, nama: s.nama, foto: s.foto || '', suara: pilih.n }; }
  });
  return (MEMO[k] = { hasil: hasil, suara: suara, periode: per });
}
function jabatanSaya_(u) {
  if (u.tipe !== 'Santri' || !u.kelas) return '';
  const h = pengurusKelas_(u.kelas).hasil;
  return JABATAN_KELAS.find(j => h[j] && lc_(h[j].username) === lc_(u.username)) || '';
}
function isPetugasAbsen_(u, kelas) { return u.tipe === 'Santri' && u.kelas === kelas && readAll_('PetugasAbsen').some(r => r.kelas === kelas && lc_(r.username) === lc_(u.username)); }
function bolehKas_(u, kelas) { const j = jabatanSaya_(u); return pengelolaKelas_(u, kelas) || (u.kelas === kelas && (j === 'Bendahara' || j === 'Ketua Kelas')); }
function bolehPiket_(u, kelas) { const j = jabatanSaya_(u); return pengelolaKelas_(u, kelas) || (u.kelas === kelas && ['Ketua Kelas', 'Wakil Ketua', 'Sekretaris'].indexOf(j) >= 0); }
const idGrupKelas_ = kelas => 'g:kelas-' + String(kelas).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

ACTIONS['kelasSaya.info'] = function (u, p) {
  const kelas = kelasAkses_(u, p.kelas), pk = pengurusKelas_(kelas), me = lc_(u.username);
  const pilihanSaya = {};
  readAll_('VotingKelas').filter(v => v.kelas === kelas && String(v.periode) === pk.periode && lc_(v.pemilih) === me).forEach(v => pilihanSaya[v.jabatan] = v.calon);
  const ses = {}; sesiAll_().forEach(s => ses[s.kode] = s);
  const roster = rosterAll_().filter(r => r.kelas === kelas).map(r => { const g = findUser_(r.guru) || {}; const s = ses[r.sesi] || {}; return { id: r.id, kelas: r.kelas, sesi: r.sesi, jam: s.jam || r.sesi, hari: r.hari, mapel: r.mapel, guru: r.guru, guruNama: g.nama || r.guru }; });
  const petugas = readAll_('PetugasAbsen').filter(r => r.kelas === kelas).map(r => { const s = findUser_(r.username); return s ? { username: s.username, nama: s.nama } : null; }).filter(Boolean);
  const w = waliOf_(kelas);
  return {
    kelas: kelas, periode: pk.periode, wali: w ? { username: w.username, nama: w.nama } : null,
    anggota: anggotaKelas_(kelas).map(s => ({ username: s.username, nama: s.nama, foto: s.foto || '' })),
    jabatan: JABATAN_KELAS, pengurus: pk.hasil, suara: pk.suara, pilihanSaya: pilihanSaya, bolehVote: u.tipe === 'Santri' && u.kelas === kelas,
    roster: roster, hariIni: hariIni_(), petugasAbsen: petugas, sayaPetugas: isPetugasAbsen_(u, kelas),
    bolehKelola: pengelolaKelas_(u, kelas), bolehKas: bolehKas_(u, kelas), bolehPiket: bolehPiket_(u, kelas),
    grupChat: idGrupKelas_(kelas)
  };
};
ACTIONS['kelasSaya.vote'] = function (u, p) {
  need_(u.tipe === 'Santri' && u.kelas, 'Hanya anggota kelas yang dapat memilih.');
  need_(JABATAN_KELAS.indexOf(p.jabatan) >= 0, 'Jabatan tidak valid.');
  const kelas = u.kelas, per = periodeKelas_();
  const calon = p.calon ? findUser_(p.calon) : null;
  if (p.calon) need_(calon && calon.tipe === 'Santri' && calon.kelas === kelas, 'Calon harus anggota kelas ' + kelas + '.');
  lock_(() => {
    const ada = readAll_('VotingKelas').find(v => v.kelas === kelas && String(v.periode) === per && v.jabatan === p.jabatan && lc_(v.pemilih) === lc_(u.username));
    if (!calon) { if (ada) deleteRows_('VotingKelas', [ada._row]); }
    else if (ada) update_('VotingKelas', ada._row, { calon: calon.username, waktu: now_() });
    else append_('VotingKelas', { kelas: kelas, periode: per, jabatan: p.jabatan, pemilih: u.username, calon: calon.username, waktu: now_() });
  });
  delete MEMO['_pk_' + kelas];
  return ACTIONS['kelasSaya.info'](u, {});
};
ACTIONS['kelasSaya.voteReset'] = function (u, p) {
  const kelas = kelasAkses_(u, p.kelas); need_(pengelolaKelas_(u, kelas), 'Hanya wali kelas / Kabag Pendidikan / Admin.');
  const per = periodeKelas_();
  lock_(() => deleteRows_('VotingKelas', readAll_('VotingKelas').filter(v => v.kelas === kelas && String(v.periode) === per && (!p.jabatan || v.jabatan === p.jabatan)).map(v => v._row)));
  delete MEMO['_pk_' + kelas];
  return true;
};

/* ---------- kas kelas ---------- */
ACTIONS['kelasSaya.kas'] = function (u, p) {
  const kelas = kelasAkses_(u, p.kelas), ang = anggotaKelas_(kelas);
  const rows = readAll_('KasKelas').filter(r => r.id && r.kelas === kelas).sort((a, b) => String(b.tanggal + b.waktu).localeCompare(String(a.tanggal + a.waktu)));
  let masuk = 0, keluar = 0; const per = {};
  rows.forEach(r => { const n = num_(r.jumlah); if (r.jenis === 'Keluar') keluar += n; else { masuk += n; if (r.anggota) per[lc_(r.anggota)] = (per[lc_(r.anggota)] || 0) + n; } });
  const nm = {}; ang.forEach(s => nm[lc_(s.username)] = s.nama);
  return {
    kelas: kelas, masuk: masuk, keluar: keluar, saldo: masuk - keluar, bolehUbah: bolehKas_(u, kelas),
    anggota: ang.map(s => ({ username: s.username, nama: s.nama, total: per[lc_(s.username)] || 0 })),
    riwayat: rows.slice(0, 300).map(r => ({ id: r.id, tanggal: r.tanggal, jenis: r.jenis === 'Keluar' ? 'Keluar' : 'Masuk', jumlah: num_(r.jumlah), keterangan: r.keterangan,
      anggota: r.anggota, anggotaNama: r.anggota ? (nm[lc_(r.anggota)] || r.anggota) : '', oleh: r.oleh, olehNama: (findUser_(r.oleh) || {}).nama || r.oleh }))
  };
};
ACTIONS['kelasSaya.kasSave'] = function (u, p) {
  const kelas = kelasAkses_(u, p.kelas); need_(bolehKas_(u, kelas), 'Hanya bendahara / ketua kelas, wali kelas, Kabag Pendidikan & Admin yang dapat mencatat kas.');
  const jumlah = num_(p.jumlah); need_(jumlah > 0, 'Jumlah harus lebih dari 0.');
  const jenis = p.jenis === 'Keluar' ? 'Keluar' : 'Masuk';
  if (p.anggota) need_(anggotaKelas_(kelas).some(s => lc_(s.username) === lc_(p.anggota)), 'Anggota tidak ditemukan di kelas ini.');
  need_(jenis === 'Masuk' || String(p.keterangan || '').trim(), 'Isi keterangan pengeluaran.');
  const obj = { kelas: kelas, tanggal: p.tanggal || today_(), jenis: jenis, jumlah: jumlah, keterangan: String(p.keterangan || '').slice(0, 200), anggota: jenis === 'Masuk' ? (p.anggota || '') : '', oleh: u.username, waktu: now_() };
  return lock_(() => {
    if (p.id) { const r = readAll_('KasKelas').find(x => x.id === p.id && x.kelas === kelas); need_(r, 'Catatan kas tidak ditemukan.'); update_('KasKelas', r._row, obj); return { id: p.id }; }
    obj.id = uid_(); append_('KasKelas', obj); return { id: obj.id };
  });
};
ACTIONS['kelasSaya.kasDelete'] = function (u, p) {
  const r = readAll_('KasKelas').find(x => x.id === p.id); need_(r, 'Catatan kas tidak ditemukan.');
  const kelas = kelasAkses_(u, r.kelas); need_(bolehKas_(u, kelas), 'Anda tidak dapat menghapus catatan kas.');
  lock_(() => deleteRows_('KasKelas', [r._row])); return true;
};

/* ---------- piket harian ---------- */
ACTIONS['kelasSaya.piket'] = function (u, p) {
  const kelas = kelasAkses_(u, p.kelas), nm = {}; anggotaKelas_(kelas).forEach(s => nm[lc_(s.username)] = s);
  const hari = {}; HARI_PIKET.forEach(h => hari[h] = []);
  readAll_('PiketKelas').filter(r => r.kelas === kelas && hari[r.hari] && nm[lc_(r.username)]).forEach(r => { const s = nm[lc_(r.username)]; hari[r.hari].push({ username: s.username, nama: s.nama }); });
  return { kelas: kelas, urutan: HARI_PIKET, hari: hari, hariIni: hariIni_(), bolehUbah: bolehPiket_(u, kelas) };
};
ACTIONS['kelasSaya.piketSave'] = function (u, p) {
  const kelas = kelasAkses_(u, p.kelas); need_(bolehPiket_(u, kelas), 'Hanya ketua, wakil, sekretaris, wali kelas, Kabag Pendidikan & Admin yang dapat mengatur piket.');
  need_(HARI_PIKET.indexOf(p.hari) >= 0, 'Hari tidak valid.');
  const ang = {}; anggotaKelas_(kelas).forEach(s => ang[lc_(s.username)] = s.username);
  const L = fxArr_(p.users).map(x => ang[lc_(x)]).filter(Boolean);
  lock_(() => {
    deleteRows_('PiketKelas', readAll_('PiketKelas').filter(r => r.kelas === kelas && r.hari === p.hari).map(r => r._row));
    appendMany_('PiketKelas', L.map(x => ({ kelas: kelas, hari: p.hari, username: x, diubah: now_() })));
  });
  return ACTIONS['kelasSaya.piket'](u, { kelas: kelas });
};

/* ---------- petugas absen kelas ---------- */
ACTIONS['kelasSaya.petugasAbsen'] = function (u, p) {
  need_(can_(u, 'Kabag Pendidikan'), 'Hanya Admin / Kabag Pendidikan yang dapat menunjuk petugas absen.');
  const s = findUser_(p.username); need_(s && s.tipe === 'Santri' && s.kelas, 'Santri tidak ditemukan atau belum memiliki kelas.');
  lock_(() => {
    const ada = readAll_('PetugasAbsen').filter(r => lc_(r.username) === lc_(s.username));
    if (ada.length) deleteRows_('PetugasAbsen', ada.map(r => r._row));
    if (p.aktif) append_('PetugasAbsen', { kelas: s.kelas, username: s.username, oleh: u.username, diubah: now_() });
  });
  return { username: s.username, kelas: s.kelas, petugasAbsen: !!p.aktif };
};
(function () {
  /* Petugas absen boleh mengabsen santri kelasnya sendiri pada semua sesi kelas itu */
  const ba = bolehAbsen_;
  bolehAbsen_ = function (u, jenis, kelas, sesi) {
    if (ba(u, jenis, kelas, sesi)) return true;
    return (jenis || 'Santri') === 'Santri' && isPetugasAbsen_(u, kelas);
  };
  /* Grup chat otomatis per kelas: semua santri kelas + wali kelas */
  const gs = grupSemua_;
  grupSemua_ = function () {
    if (FX_GRUP) return FX_GRUP;
    const g = gs();
    try {
      const per = {}; santriAll_().forEach(s => { if (s.kelas) (per[s.kelas] = per[s.kelas] || []).push(s.username); });
      kelasAll_().forEach(k => {
        const ang = (per[k.nama] || []).slice(); if (!ang.length) return;
        const w = waliOf_(k.nama); if (w && ang.indexOf(w.username) < 0) ang.push(w.username);
        const x = { id: idGrupKelas_(k.nama), nama: 'Chat ' + (/^kelas/i.test(k.nama) ? '' : 'Kelas ') + k.nama, jenis: 'kelas', anggota: ang, admin: [], lc: {} };
        ang.forEach(a => x.lc[lc_(a)] = 1); g.push(x);
      });
    } catch (e) {}
    return g;
  };
  const gsv = ACTIONS['grup.save'];
  ACTIONS['grup.save'] = function (u, p) { need_(!(p && p.id && String(p.id).indexOf('g:kelas-') === 0), 'Anggota Chat Kelas diatur otomatis dari data kelas.'); return gsv(u, p); };
  const gk = ACTIONS['grup.keluar'];
  if (gk) ACTIONS['grup.keluar'] = function (u, p) { need_(!(p && String(p.id || '').indexOf('g:kelas-') === 0), 'Anda tidak dapat keluar dari Chat Kelas.'); return gk(u, p); };

  /* Postingan kelas: hanya anggota kelas yang melihat, kecuali ditampilkan untuk umum */
  let FEED = undefined; // undefined = bukan daftar; '' = postingan utama; 'Kelas …' = postingan kelas
  const lihatKelas = (u, kelas) => (u.tipe === 'Santri' && u.kelas === kelas) || pengelolaKelas_(u, kelas);
  const pb = postBoleh_;
  postBoleh_ = function (u, r) {
    if (FEED) return r.kelas_post === FEED && (lc_(r.username) === lc_(u.username) || lihatKelas(u, r.kelas_post));
    if (r.kelas_post) {
      if (r.umum === 'Ya') return true;
      if (FEED === '') return false;              // belum ditampilkan untuk umum → tidak masuk postingan utama
      return lc_(r.username) === lc_(u.username) || lihatKelas(u, r.kelas_post);   // suka / komentar / media
    }
    return pb(u, r);
  };
  const pl = ACTIONS['post.list'];
  ACTIONS['post.list'] = function (u, p) {
    if (p.kelasPost) kelasAkses_(u, p.kelasPost);
    FEED = p.kelasPost ? String(p.kelasPost) : '';
    let d; try { d = pl(u, p); } finally { FEED = undefined; }
    const rows = {}; readAll_('Postingan').forEach(r => { if (r.id && r.kelas_post) rows[r.id] = r; });
    const isi = x => { const r = rows[x.id]; if (!r) return; x.kelasPost = r.kelas_post; x.umum = r.umum === 'Ya'; x.bolehUmum = lc_(r.username) === lc_(u.username) || pengelolaKelas_(u, r.kelas_post) || (u.kelas === r.kelas_post && jabatanSaya_(u) === 'Ketua Kelas'); };
    if (d && d.items) d.items.forEach(isi); else if (d && d.id) isi(d);
    return d;
  };
  const ps = ACTIONS['post.save'];
  ACTIONS['post.save'] = function (u, p) {
    if (!p.kelasPost) return ps(u, p);
    const kelas = kelasAkses_(u, p.kelasPost);
    const umum = !!p.umum;
    const q = Object.assign({}, p, umum ? { privasi: 'semua' } : { privasi: 'khusus', target: { guru: false, kelas: [kelas], users: [] } });
    const r = ps(u, q);
    const id = (r && r.id) || p.id;
    lock_(() => { const row = readAll_('Postingan').find(x => x.id === id); if (row) update_('Postingan', row._row, { kelas_post: kelas, umum: umum ? 'Ya' : '' }); });
    return r;
  };
  ACTIONS['kelasPost.umum'] = function (u, p) {
    const row = readAll_('Postingan').find(x => x.id === p.id && x.kelas_post); need_(row, 'Postingan kelas tidak ditemukan.');
    const boleh = lc_(row.username) === lc_(u.username) || pengelolaKelas_(u, row.kelas_post) || (u.kelas === row.kelas_post && jabatanSaya_(u) === 'Ketua Kelas');
    need_(boleh, 'Hanya pembuat postingan, ketua kelas, wali kelas atau Admin.');
    lock_(() => update_('Postingan', row._row, p.umum ? { umum: 'Ya', privasi: 'semua', target: '' } : { umum: '', privasi: 'khusus', target: JSON.stringify({ guru: false, kelas: [row.kelas_post], users: [] }) }));
    return { id: row.id, umum: !!p.umum };
  };

  /* Penanda jabatan kelas & petugas absen di profil / beranda; kelas yang dikelola guru */
  const pg = ACTIONS['profil.get'];
  ACTIONS['profil.get'] = function (u, p) {
    const o = pg(u, p);
    try {
      const t = findUser_(o.username);
      if (t && t.tipe === 'Santri' && t.kelas) {
        const j = jabatanSaya_(t); if (j) o.jabatanKelas = j + ' ' + t.kelas;
        o.petugasAbsen = isPetugasAbsen_(t, t.kelas); o.bolehPetugasAbsen = can_(u, 'Kabag Pendidikan');
      }
    } catch (e) {}
    return o;
  };
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) {
    const d = db(u, p);
    try { if (u.tipe === 'Santri' && u.kelas) { const j = jabatanSaya_(u); d.jabatanKelas = j ? j + ' ' + u.kelas : ''; d.petugasAbsen = isPetugasAbsen_(u, u.kelas); } } catch (e) {}
    return d;
  };
  const bt = ACTIONS.boot;
  ACTIONS.boot = function (u, p) {
    const b = bt(u, p);
    try { b.kelasKelola = u.tipe === 'Santri' ? [] : kelasAll_().map(k => k.nama).filter(k => pengelolaKelas_(u, k)); } catch (e) {}
    return b;
  };
})();

/* ============================================================
 *  v2.14.1 — Santri sebagai Admin: hanya dapat ditunjuk / dicabut oleh Pengembang Aplikasi.
 *  Admin tidak dapat menjadikan santri sebagai admin (dan tidak dapat mencabutnya lewat edit data).
 * ============================================================ */
function isSantriAdmin_(t) { return !!t && t.tipe === 'Santri' && roles_(t).indexOf('Admin') >= 0; }
ACTIONS['dev.santriAdmin.list'] = function (u) {
  need_(isDev_(u), 'Hanya Pengembang Aplikasi.');
  return activeUsers_().filter(isSantriAdmin_).map(t => ({ username: t.username, nama: t.nama, kelas: t.kelas || '', foto: t.foto || '' }));
};
ACTIONS['dev.santriAdmin.set'] = function (u, p) {
  need_(isDev_(u), 'Hanya Pengembang Aplikasi yang dapat menjadikan santri sebagai Admin.');
  const t = findUser_(p.username); need_(t && t._row >= 2, 'Pengguna tidak ditemukan.');
  need_(t.tipe === 'Santri', 'Fitur ini khusus untuk santri. Peran guru diatur dari data pengguna.');
  lock_(() => update_('Users', t._row, { kabag: p.aktif ? 'Admin' : '' }));
  return ACTIONS['dev.santriAdmin.list'](u);
};
(function () {
  /* Edit data santri oleh Admin: peran Admin santri tetap dipertahankan, tidak bisa ditambah/dicabut dari sini */
  const us = ACTIONS['users.save'];
  ACTIONS['users.save'] = function (u, p) {
    const lama = p && (p.original || p.username) ? findUser_(p.original || p.username) : null;
    const tetapAdmin = isSantriAdmin_(lama) && (p.tipe || lama.tipe) === 'Santri';
    const r = us(u, p);
    if (tetapAdmin) { const t = findUser_(p.username || p.original); if (t && t._row >= 2 && t.tipe === 'Santri') lock_(() => update_('Users', t._row, { kabag: 'Admin' })); }
    return r;
  };
  /* Santri yang menjadi Admin tetap melihat catatan semua santri (pemberitahuan) seperti admin lain */
  const pb = ACTIONS.pemberitahuan, pbAsli = pb;
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) {
    if (!isSantriAdmin_(u)) return db(u, p);
    const asli = isGuru_; isGuru_ = x => x === u || asli(x);
    try { return db(u, p); } finally { isGuru_ = asli; }
  };
  ACTIONS.pemberitahuan = function (u, p) {
    if (!isSantriAdmin_(u)) return pbAsli(u, p);
    const asli = isGuru_; isGuru_ = x => x === u || asli(x);
    try { return pbAsli(u, p); } finally { isGuru_ = asli; }
  };
  const pg = ACTIONS['profil.get'];
  ACTIONS['profil.get'] = function (u, p) {
    const o = pg(u, p);
    try { const t = findUser_(o.username); if (t && t.tipe === 'Santri') { o.santriAdmin = isSantriAdmin_(t); o.bolehSantriAdmin = isDev_(u); } } catch (e) {}
    return o;
  };
})();

/* ============================================================
 *  v2.14.2 — KOP SURAT BERGAMBAR per lembaga
 *  Salafi / Yayasan (raport Salafi & semua laporan), Wustha (raport Wustha), Ulya (raport Ulya).
 *  Gambar disimpan di Google Drive; ID-nya di Pengaturan (kop_salafi, kop_wustha, kop_ulya).
 *  Bila gambar belum diunggah, PDF memakai kop teks seperti sebelumnya.
 * ============================================================ */
const KOP_JENIS = { salafi: 'kop_salafi', wustha: 'kop_wustha', ulya: 'kop_ulya' };
[['kop_salafi', '', 'Gambar kop surat Yayasan / Salafi (diatur dari menu Kop Surat)'],
 ['kop_wustha', '', 'Gambar kop surat PDF Wustha (diatur dari menu Kop Surat)'],
 ['kop_ulya', '', 'Gambar kop surat PDF Ulya (diatur dari menu Kop Surat)']]
  .forEach(r => { if (!DEFAULT_SETTINGS.some(x => x[0] === r[0])) DEFAULT_SETTINGS.push(r); });
function kopKey_(logoKey) { return logoKey === 'logo_wustha' ? 'kop_wustha' : logoKey === 'logo_ulya' ? 'kop_ulya' : 'kop_salafi'; }
(function () {
  const kopTeks = kop_;
  kop_ = function (judul, logoKey) {
    let img = '';
    try { const id = getSetting_(kopKey_(logoKey)); img = id ? fileData_(id) : ''; } catch (e) { img = ''; }
    if (!img) return kopTeks(judul, logoKey);
    // kop selebar halaman; garis bawah sudah ada di dalam gambar kop, jadi tidak ditambah garis lagi
    return '<div class="kopimg" style="width:100%;margin-bottom:12px">' +
      '<img src="' + img + '" width="100%" style="width:100%;height:auto;display:block"></div>';
  };
})();
ACTIONS['kop.get'] = function (u) {
  need_(can_(u), 'Hanya Admin & Pengembang Aplikasi.');
  const o = {};
  Object.keys(KOP_JENIS).forEach(j => { const id = getSetting_(KOP_JENIS[j]); o[j] = id ? { ada: true, data: fileData_(id) } : { ada: false }; });
  return o;
};
ACTIONS['kop.upload'] = function (u, p) {
  need_(can_(u), 'Hanya Admin & Pengembang Aplikasi yang dapat mengganti kop surat.');
  const key = KOP_JENIS[p.jenis]; need_(key, 'Jenis kop tidak dikenal.');
  const m = String(p.data || '').match(/^data:(image\/(png|jpeg|jpg|webp));base64,/); need_(m, 'File harus berupa gambar (PNG / JPG).');
  const bytes = Utilities.base64Decode(String(p.data).replace(/^data:[^,]+,/, ''));
  need_(bytes.length <= 4 * 1024 * 1024, 'Ukuran gambar kop maksimal 4 MB.');
  const file = folder_().createFile(Utilities.newBlob(bytes, m[1], 'kop_' + p.jenis + '_' + Date.now() + (m[1] === 'image/png' ? '.png' : '.jpg')));
  const lama = driveId_(getSetting_(key));
  lock_(() => setSettingVal_(key, file.getId()));
  if (lama) { try { DriveApp.getFileById(lama).setTrashed(true); } catch (e) {} try { CacheService.getScriptCache().remove('img_' + lama); } catch (e) {} }
  return ACTIONS['kop.get'](u);
};
ACTIONS['kop.reset'] = function (u, p) {
  need_(can_(u), 'Hanya Admin & Pengembang Aplikasi.');
  const key = KOP_JENIS[p.jenis]; need_(key, 'Jenis kop tidak dikenal.');
  const lama = driveId_(getSetting_(key));
  lock_(() => setSettingVal_(key, ''));
  if (lama) { try { DriveApp.getFileById(lama).setTrashed(true); } catch (e) {} }
  return ACTIONS['kop.get'](u);
};
/* Contoh PDF untuk memeriksa tampilan kop */
ACTIONS['kop.contoh'] = function (u, p) {
  need_(can_(u), 'Hanya Admin & Pengembang Aplikasi.');
  const lk = p.jenis === 'wustha' ? 'logo_wustha' : p.jenis === 'ulya' ? 'logo_ulya' : 'logo_dayah';
  const s = settingsMap_();
  const judul = p.jenis === 'wustha' ? 'PDF WUSTHA ALHUDA MALIKUSSALEH' : p.jenis === 'ulya' ? 'PDF ULYA ALHUDA MALIKUSSALEH' : (s.nama_dayah || 'DAYAH AL-HUDA MALIKUSSALEH');
  return toPdf_(kop_(judul, lk) + '<h3>CONTOH TAMPILAN KOP SURAT</h3><div class="sub">' + esc_(judul) + '</div><p>Isi surat / laporan tampil di sini.</p>', 'Contoh_Kop_' + (p.jenis || 'salafi'));
};

/* ============================================================
 *  v2.15.0 — Roster: satu sesi boleh berisi lebih dari satu pelajaran (guru sama atau berbeda).
 *  Yang ditolak hanya mata pelajaran yang sama dua kali pada kelas, sesi & hari yang sama.
 * ============================================================ */
rosterSave_ = function (u, p) {
  need_(perms_(u).roster, 'Hanya Kabag Pendidikan / Kabag Administrasi / Admin yang dapat mengubah roster.');
  if (!p.kelas || !p.sesi || !p.mapel || !p.guru) throw new Error('Kelas, sesi, mata pelajaran, dan guru wajib diisi.');
  const g = findUser_(p.guru);
  need_(g && g.tipe === 'Guru', 'Guru belum terdaftar sebagai pengguna. Daftarkan akun guru terlebih dahulu.');
  need_(sesiBolehUntuk_(p.sesi, p.kelas), 'Sesi ini tidak berlaku untuk kelas ' + p.kelas + '.');
  const hari = p.hari || 'Setiap Hari', mapel = String(p.mapel).trim();
  return lock_(() => {
    const rows = readAll_('Roster');
    const dup = rows.find(r => r.id !== p.id && r.kelas === p.kelas && r.sesi === p.sesi && (r.hari || 'Setiap Hari') === hari && lc_(String(r.mapel).trim()) === lc_(mapel));
    if (dup) throw new Error('Pelajaran ' + mapel + ' sudah ada di sesi & hari ini untuk kelas ' + p.kelas + '.');
    const obj = { kelas: p.kelas, sesi: p.sesi, hari: hari, mapel: mapel, guru: g.username, diubah_oleh: u.username, diubah: now_() };
    if (p.id) {
      const r = rows.find(x => x.id === p.id); if (!r) throw new Error('Data roster tidak ditemukan.');
      update_('Roster', r._row, obj);
    } else { obj.id = uid_(); append_('Roster', obj); }
    return true;
  });
};
/** Semua pelajaran pada kelas & sesi di hari tertentu (bila guru biasa: hanya pelajaran yang ia ajar). */
function mapelSesi_(u, kelas, sesi, tanggal) {
  let hari = hariIni_(); try { if (tanggal) hari = lgHariDari_(tanggal) || hari; } catch (e) {}
  let rows = rosterAll_().filter(r => r.kelas === kelas && r.sesi === sesi && (r.hari === 'Setiap Hari' || r.hari === hari));
  if (!rows.length) rows = rosterAll_().filter(r => r.kelas === kelas && r.sesi === sesi);
  const milik = rows.filter(r => lc_(r.guru) === lc_(u.username));
  if (milik.length && !can_(u, 'Kabag Pendidikan')) rows = milik;
  const m = {}; rows.forEach(r => { const v = String(r.mapel).trim(); if (v && !m[lc_(v)]) m[lc_(v)] = v; });
  return Object.keys(m).map(k => m[k]).join(', ');
}
(function () {
  const af = ACTIONS['absen.form'];
  ACTIONS['absen.form'] = function (u, p) {
    const r = af(u, p);
    try { if ((p.jenis || 'Santri') === 'Santri' && r) r.mapel = mapelSesi_(u, p.kelas, p.sesi, p.tanggal) || r.mapel; } catch (e) {}
    return r;
  };
})();

/* ============================================================
 *  v2.16.0 — PENGAJUAN ROSTER oleh pengurus kelas
 *  Ketua, wakil, sekretaris & bendahara kelas mengajukan tambah / ubah / hapus pelajaran di roster kelasnya.
 *  Kabag Pendidikan / Admin menerima (langsung masuk roster) atau menolak (dengan alasan).
 *  Pengaju diberi tahu lewat chat dari "Sistem Alhuda Mobile".
 * ============================================================ */
SHEETS.PengajuanRoster = ['id', 'kelas', 'aksi', 'roster_id', 'sesi', 'hari', 'mapel', 'guru', 'catatan', 'oleh', 'waktu', 'status', 'diputus_oleh', 'diputus', 'alasan'];
function pengurusKelasSaya_(u) { return u.tipe === 'Santri' && u.kelas && JABATAN_KELAS.indexOf(jabatanSaya_(u)) >= 0; }
function bolehPutusRoster_(u) { return can_(u, 'Kabag Pendidikan'); }
function ajuBentuk_(r) {
  const ses = {}; sesiAll_().forEach(s => ses[s.kode] = s.jam || s.kode);
  const g = findUser_(r.guru) || {}, o = findUser_(r.oleh) || {}, d = r.diputus_oleh ? (findUser_(r.diputus_oleh) || {}) : {};
  return { id: r.id, kelas: r.kelas, aksi: r.aksi, roster_id: r.roster_id, sesi: r.sesi, jam: ses[r.sesi] || r.sesi, hari: String(r.hari || '').split(',').map(x => x.trim()).filter(Boolean),
    mapel: r.mapel, guru: r.guru, guruNama: g.nama || r.guru, catatan: r.catatan, oleh: r.oleh, olehNama: o.nama || r.oleh, jabatan: o.username ? jabatanSaya_(o) : '',
    waktu: r.waktu, status: r.status || 'Menunggu', diputusNama: d.nama || r.diputus_oleh || '', diputus: r.diputus, alasan: r.alasan };
}
function sistemKe_(un, pesan) { try { append_('Chat', { id: 'ra-' + uid_(), dari: SISTEM, ke: un, pesan: pesan, waktu: now_(), dibaca: 'Tidak' }); } catch (e) {} }

ACTIONS['rosterAju.save'] = function (u, p) {
  need_(pengurusKelasSaya_(u), 'Hanya ketua, wakil, sekretaris & bendahara kelas yang dapat mengajukan roster.');
  const kelas = u.kelas, aksi = ['tambah', 'ubah', 'hapus'].indexOf(p.aksi) >= 0 ? p.aksi : 'tambah';
  let lama = null;
  if (aksi !== 'tambah') { lama = rosterAll_().find(r => r.id === p.roster_id && r.kelas === kelas); need_(lama, 'Pelajaran di roster tidak ditemukan.'); }
  const sesi = aksi === 'hapus' ? lama.sesi : p.sesi;
  const hari = aksi === 'hapus' ? [lama.hari] : fxArr_(p.hari).filter(h => h === 'Setiap Hari' || HARI_PIKET.indexOf(h) >= 0);
  const mapel = aksi === 'hapus' ? lama.mapel : String(p.mapel || '').trim();
  const guru = aksi === 'hapus' ? lama.guru : String(p.guru || '');
  need_(sesi && sesiBolehUntuk_(sesi, kelas), 'Sesi tidak berlaku untuk kelas ' + kelas + '.');
  need_(hari.length, 'Pilih minimal satu hari.');
  need_(mapel, 'Isi mata pelajaran.');
  const g = findUser_(guru); need_(g && (g.tipe === 'Guru' || isGuruKhusus_(g)), 'Pilih guru yang terdaftar.');
  const ada = readAll_('PengajuanRoster').some(r => r.kelas === kelas && (r.status || 'Menunggu') === 'Menunggu' && r.aksi === aksi && r.sesi === sesi && lc_(r.mapel) === lc_(mapel) && String(r.hari) === hari.join(', '));
  need_(!ada, 'Pengajuan yang sama masih menunggu keputusan.');
  const obj = { id: uid_(), kelas: kelas, aksi: aksi, roster_id: lama ? lama.id : '', sesi: sesi, hari: hari.join(', '), mapel: mapel, guru: g.username,
    catatan: String(p.catatan || '').slice(0, 300), oleh: u.username, waktu: now_(), status: 'Menunggu' };
  lock_(() => append_('PengajuanRoster', obj));
  return ajuBentuk_(obj);
};
ACTIONS['rosterAju.list'] = function (u, p) {
  const putus = bolehPutusRoster_(u);
  let rows = readAll_('PengajuanRoster').filter(r => r.id);
  if (!putus) { need_(u.tipe === 'Santri' && u.kelas, 'Tidak ada akses.'); rows = rows.filter(r => r.kelas === u.kelas); }
  else if (p.kelas) rows = rows.filter(r => r.kelas === p.kelas);
  rows.sort((a, b) => ((a.status || 'Menunggu') === 'Menunggu' ? 0 : 1) - ((b.status || 'Menunggu') === 'Menunggu' ? 0 : 1) || String(b.waktu).localeCompare(String(a.waktu)));
  return { bolehPutus: putus, bolehAju: pengurusKelasSaya_(u), items: rows.slice(0, 200).map(ajuBentuk_) };
};
ACTIONS['rosterAju.putuskan'] = function (u, p) {
  need_(bolehPutusRoster_(u), 'Hanya Kabag Pendidikan & Admin yang dapat memutuskan pengajuan roster.');
  const r = readAll_('PengajuanRoster').find(x => x.id === p.id); need_(r, 'Pengajuan tidak ditemukan.');
  need_((r.status || 'Menunggu') === 'Menunggu', 'Pengajuan ini sudah diputuskan.');
  const hari = String(r.hari || '').split(',').map(x => x.trim()).filter(Boolean);
  if (p.terima) {
    if (r.aksi === 'hapus') ACTIONS['roster.delete'](u, { id: r.roster_id });
    else if (r.aksi === 'ubah') {
      hari.forEach((h, i) => ACTIONS['roster.save'](u, { id: i === 0 ? r.roster_id : undefined, kelas: r.kelas, sesi: r.sesi, hari: h, mapel: r.mapel, guru: r.guru }));
    } else hari.forEach(h => ACTIONS['roster.save'](u, { kelas: r.kelas, sesi: r.sesi, hari: h, mapel: r.mapel, guru: r.guru }));
  } else need_(String(p.alasan || '').trim(), 'Isi alasan penolakan.');
  lock_(() => { const x = readAll_('PengajuanRoster').find(y => y.id === p.id); update_('PengajuanRoster', x._row, { status: p.terima ? 'Diterima' : 'Ditolak', diputus_oleh: u.username, diputus: now_(), alasan: String(p.alasan || '').slice(0, 300) }); });
  const ses = {}; sesiAll_().forEach(s => ses[s.kode] = s.jam || s.kode);
  const apa = { tambah: 'penambahan', ubah: 'perubahan', hapus: 'penghapusan' }[r.aksi] || 'pengajuan';
  sistemKe_(r.oleh, 'Pengajuan ' + apa + ' roster ' + r.kelas + ' — ' + r.mapel + ' (' + r.hari + ', ' + (ses[r.sesi] || r.sesi) + ') ' +
    (p.terima ? 'DITERIMA oleh ' + u.nama + (r.aksi === 'hapus' ? ' dan pelajaran sudah dihapus dari Roster Pelajaran.' : ' dan sudah masuk Roster Pelajaran.') : 'DITOLAK oleh ' + u.nama + '. Alasan: ' + String(p.alasan).trim()));
  return ajuBentuk_(readAll_('PengajuanRoster').find(x => x.id === p.id));
};
ACTIONS['rosterAju.batal'] = function (u, p) {
  const r = readAll_('PengajuanRoster').find(x => x.id === p.id); need_(r, 'Pengajuan tidak ditemukan.');
  need_(lc_(r.oleh) === lc_(u.username), 'Hanya pengaju yang dapat membatalkan.');
  need_((r.status || 'Menunggu') === 'Menunggu', 'Pengajuan sudah diputuskan.');
  lock_(() => deleteRows_('PengajuanRoster', [r._row])); return true;
};
(function () {
  const db = ACTIONS.dashboard;
  ACTIONS.dashboard = function (u, p) {
    const d = db(u, p);
    try { if (bolehPutusRoster_(u)) d.rosterAju = readAll_('PengajuanRoster').filter(r => r.id && (r.status || 'Menunggu') === 'Menunggu').length; } catch (e) {}
    return d;
  };
  const ki = ACTIONS['kelasSaya.info'];
  ACTIONS['kelasSaya.info'] = function (u, p) {
    const d = ki(u, p);
    try { d.bolehAjuRoster = pengurusKelasSaya_(u) && u.kelas === d.kelas; d.ajuMenunggu = readAll_('PengajuanRoster').filter(r => r.kelas === d.kelas && (r.status || 'Menunggu') === 'Menunggu').length; } catch (e) {}
    return d;
  };
})();
