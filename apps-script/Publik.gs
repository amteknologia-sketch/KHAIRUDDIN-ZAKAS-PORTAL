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
