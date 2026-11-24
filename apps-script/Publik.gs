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
