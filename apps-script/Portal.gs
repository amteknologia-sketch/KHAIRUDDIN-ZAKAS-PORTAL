/**
 * ============================================================
 *  ALHUDA MOBILE — LIVE PORTAL & LAMPIRAN CHAT  (tambahan v2.3.0)
 * ============================================================
 *  File ini TAMBAHAN untuk Code.gs — Code.gs tidak perlu diubah.
 *  Cara pasang: di editor Apps Script klik  ＋ → Skrip, beri nama  Portal,
 *  tempel seluruh isi file ini, lalu Terapkan → Kelola deployment → Versi baru.
 *  PENTING: file Portal harus berada DI BAWAH Code.gs pada daftar file (bawaan
 *  saat file baru ditambahkan).
 *
 *  Isi:
 *   1. Live Portal — catatan aktivitas pengguna (sheet "LogPortal"), tampil di Beranda.
 *      Aktivitas keuangan & pelanggaran: @username disamarkan (@u***) untuk semua
 *      pengguna, kecuali Admin / Pengembang Aplikasi dan pemilik data itu sendiri.
 *   2. Room Chat — balas pesan tertentu (kolom "balas") serta kirim foto, video, dan
 *      dokumen (kolom "lampiran", file disimpan di Google Drive folder aplikasi / Chat).
 *   3. media.get — memutar foto/video langsung dari server bila tautan Drive tidak bisa dibuka.
 * ============================================================ */

SHEETS.LogPortal = ['id', 'waktu', 'jenis', 'pelaku', 'target', 'teks', 'data'];
['balas', 'lampiran', 'story'].forEach(k => { if (SHEETS.Chat.indexOf(k) < 0) SHEETS.Chat.push(k); });

/** Aktivitas yang @username-nya disamarkan untuk pengguna biasa. */
const LOG_PRIVAT = { topup: 1, iuran: 1, pelanggaran: 1, tahunan: 1 };
const LOG_GABUNG_MENIT = 60;   // pembayaran iuran / input nilai beruntun digabung menjadi satu baris
const HARI_JS = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/* ---------- pembantu ---------- */
function lgRp_(n) { return 'Rp ' + Math.round(num_(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function lgTgl_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1] : String(s || '');
}
function lgSesi_(kode) {
  const s = sesiAll_().find(x => x.kode === kode);
  return (s ? String(s.jam).replace(/\s*-\s*/, ' – ') : kode) + ' WIB';
}
/** "(NAMA, Kelas, Asal)" untuk santri. */
function lgIdentitas_(un) {
  const s = findUser_(un) || {};
  return '(' + [s.nama || un, s.kelas, s.asal].filter(x => String(x || '').trim()).join(', ') + ')';
}
function lgBulan_(list, tahun) {
  const b = list.map(Number).filter(x => x >= 1 && x <= 12).sort((a, c) => a - c);
  if (!b.length) return '';
  const nama = b.map(x => BULAN[x - 1]);
  const urut = b.every((x, i) => i === 0 || x === b[i - 1] + 1);
  let t;
  if (b.length === 1) t = nama[0];
  else if (urut) t = nama[0] + ' s/d ' + nama[nama.length - 1];
  else t = nama.slice(0, -1).join(', ') + ' dan ' + nama[nama.length - 1];
  return t + ' ' + tahun;
}
function lgHariDari_(tgl) {
  const m = String(tgl || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? HARI_JS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : hariIni_();
}

/* ---------- tulis log ---------- */
function lgTulis_(jenis, pelaku, target, teks, data) {
  append_('LogPortal', { id: uid_(), waktu: now_(), jenis: jenis, pelaku: pelaku || '', target: target || '', teks: teks, data: data ? JSON.stringify(data) : '' });
}
/** Baca n baris terakhir sheet LogPortal (tanpa membaca seluruh sheet). urutan: terbaru dulu. */
function lgEkor_(offset, n) {
  const s = sh_('LogPortal'), h = headers_('LogPortal');
  const total = Math.max(0, s.getLastRow() - 1);
  const end = total - offset;                 // nomor data terakhir (1-based)
  if (end <= 0) return { rows: [], total: total };
  const start = Math.max(1, end - n + 1);
  const v = s.getRange(start + 1, 1, end - start + 1, h.length).getValues();
  const rows = v.map((r, i) => { const o = { _row: start + 1 + i }; h.forEach((k, j) => { if (k) o[k] = cell_(r[j]); }); return o; })
    .filter(o => o.id).reverse();
  return { rows: rows, total: total };
}
/** Gabungkan dengan baris log serupa yang baru saja dibuat (mis. bayar iuran beberapa bulan berturut-turut). */
function lgGabung_(jenis, kunci, buat) {
  lock_(() => {
    const batas = Utilities.formatDate(new Date(Date.now() - LOG_GABUNG_MENIT * 60000), TZ, 'yyyy-MM-dd HH:mm:ss');
    const lama = lgEkor_(0, 40).rows.find(r => r.jenis === jenis && String(r.waktu) >= batas && (function () {
      try { return JSON.parse(r.data || '{}').kunci === kunci; } catch (e) { return false; }
    })());
    let dataLama = null;
    if (lama) { try { dataLama = JSON.parse(lama.data || '{}'); } catch (e) {} }
    const hasil = buat(dataLama);          // { pelaku, target, teks, data }
    if (!hasil) return;
    hasil.data.kunci = kunci;
    if (lama) deleteRows_('LogPortal', [lama._row]);  // dipindah ke paling atas (terbaru)
    lgTulis_(jenis, hasil.pelaku, hasil.target, hasil.teks, hasil.data);
  });
}

/* ---------- pasang pencatat pada aksi yang sudah ada (tanpa mengubah Code.gs) ---------- */
function lgPasang_(nama, sebelum, sesudah) {
  const asli = ACTIONS[nama];
  if (typeof asli !== 'function' || asli.__portal) return;
  const baru = function (u, p) {
    p = p || {};
    let ctx = null;
    try { ctx = sebelum ? sebelum(u, p) : null; } catch (e) { ctx = null; }
    const res = asli(u, p);
    try { sesudah(u, p, res, ctx); } catch (e) { console.warn('Live Portal (' + nama + '): ' + e); }
    return res;
  };
  baru.__portal = true;
  ACTIONS[nama] = baru;
}

/* 1. Top up saldo */
lgPasang_('saldo.save', null, (u, p) => {
  if (p.jenis === 'Keluar') return;
  const s = findUser_(p.username); if (!s) return;
  lgTulis_('topup', u.username, s.username, '{t} melakukan Top Up Saldo sebesar ' + lgRp_(p.jumlah));
});

/* 2. Iuran bulanan (beberapa bulan beruntun → satu baris "Januari s/d September") */
lgPasang_('iuran.save', (u, p) => {
  const r = readAll_('Iuran').find(x => lc_(x.username) === lc_(p.username) && String(x.tahun) === String(p.tahun) && num_(x.bulan) === num_(p.bulan));
  return { lama: r ? num_(r.jumlah) : 0 };
}, (u, p, res, ctx) => {
  const s = findUser_(p.username); if (!s) return;
  const tambah = num_(p.jumlah) - (ctx ? ctx.lama : 0);
  if (tambah <= 0) return;   // koreksi turun / tidak berubah → tidak dicatat
  lgGabung_('iuran', lc_(s.username) + '|' + p.tahun, d => {
    const bulan = Object.assign({}, (d && d.bulan) || {});
    bulan[String(num_(p.bulan))] = (bulan[String(num_(p.bulan))] || 0) + tambah;
    const total = Object.keys(bulan).reduce((a, k) => a + bulan[k], 0);
    return { pelaku: u.username, target: s.username, data: { bulan: bulan, tahun: String(p.tahun) },
      teks: '{t} membayar iuran bulanan sebesar ' + lgRp_(total) + ' untuk bulan ' + lgBulan_(Object.keys(bulan), p.tahun) };
  });
});

/* 3 & 4. Absen santri / revisi absen */
lgPasang_('absen.save', (u, p) => {
  const jenis = p.jenis || 'Santri';
  if (jenis !== 'Santri') return null;
  const tgl = p.tanggal || today_(), lama = {};
  readAll_('Absensi').forEach(a => {
    if (a.jenis === 'Santri' && a.tanggal === tgl && a.sesi === String(p.sesi || '') && a.kelas === String(p.kelas || '')) lama[lc_(a.username)] = a.status + '|' + (a.keterangan || '');
  });
  return { ada: Object.keys(lama).length > 0, lama: lama, tgl: tgl };
}, (u, p, res, ctx) => {
  if (!ctx) return;
  const items = (p.items || []).filter(i => ['H', 'I', 'S', 'A'].indexOf(i.status) >= 0);
  if (!items.length) return;
  if (ctx.ada && !items.some(i => ctx.lama[lc_(i.username)] !== i.status + '|' + (i.keterangan || ''))) return; // disimpan ulang tanpa perubahan
  let mapel = p.mapel;
  if (!mapel) { const r = rosterAll_().find(x => x.kelas === p.kelas && x.sesi === p.sesi); mapel = r ? r.mapel : ''; }
  const teks = '{p} ' + (ctx.ada ? 'merevisi absen ' : 'mengabsen ') + p.kelas + (mapel ? ' Mata Pelajaran ' + mapel : '') + ' Sesi ' + lgSesi_(p.sesi) +
    (ctx.tgl !== today_() ? ' (tanggal ' + lgTgl_(ctx.tgl) + ')' : '');
  lgTulis_(ctx.ada ? 'absen_revisi' : 'absen', u.username, '', teks);
});

/* 5. Guru pengganti (bila fitur guru pengganti tersedia di Code.gs) */
lgPasang_('pengganti.save', (u, p) => {
  const hari = lgHariDari_(p.tanggal);
  const rows = rosterAll_().filter(x => x.kelas === p.kelas && x.sesi === p.sesi);
  return rows.find(x => x.hari === hari) || rows.find(x => x.hari === 'Setiap Hari') || rows[0] || null;
}, (u, p, res, r) => {
  const g = findUser_(p.guru_pengganti); if (!g) return;
  const asal = r && r.guru ? r.guru : u.username;
  const tgl = tglValid_(p.tanggal) || today_();
  lgTulis_('pengganti', asal, g.username, '{p} menggantikan kelas kepada {t} untuk mengajar di ' + p.kelas +
    (r && r.mapel ? ' dengan Mata Pelajaran ' + r.mapel : '') + ' Sesi ' + lgSesi_(p.sesi) + (tgl !== today_() ? ' pada tanggal ' + lgTgl_(tgl) : ''));
});

/* 6. Izin pulang kampung */
lgPasang_('izinPulang.save', null, (u, p) => {
  const s = findUser_(p.username); if (!s) return;
  lgTulis_('izin_pulang', u.username, s.username, '{p} memberikan izin {t} ' + lgIdentitas_(s.username) + ' untuk pulang kampung ' +
    (p.tgl_kembali ? 'dari tanggal ' + lgTgl_(p.tgl_pulang) + ' s/d tanggal ' + lgTgl_(p.tgl_kembali) : 'mulai tanggal ' + lgTgl_(p.tgl_pulang)));
});

/* 7. Telah kembali di dayah (izin pulang / izin keluar) */
['izinPulang', 'izinKeluar'].forEach(k => {
  const sheet = k === 'izinPulang' ? 'IzinPulang' : 'IzinKeluar';
  lgPasang_(k + '.kembali', (u, p) => {
    const r = readAll_(sheet).find(x => x.id === p.id);
    return r && r.status !== 'Kembali' ? r.username : null;
  }, (u, p, res, un) => {
    if (!un) return;
    lgTulis_('kembali', u.username, un, '{t} ' + lgIdentitas_(un) + ' telah kembali di dayah');
  });
});

/* 8. Izin keluar sebentar */
lgPasang_('izinKeluar.save', null, (u, p) => {
  const s = findUser_(p.username); if (!s) return;
  lgTulis_('izin_keluar', u.username, s.username, '{p} memberikan izin {t} ' + lgIdentitas_(s.username) + ' untuk keluar sebentar');
});

/* 9. Pelanggaran (hanya catatan baru, bukan edit) */
lgPasang_('pelanggaran.save', null, (u, p) => {
  if (p.id) return;
  const s = findUser_(p.username); if (!s) return;
  lgTulis_('pelanggaran', u.username, s.username, '{t} telah melakukan pelanggaran: ' + String(p.pelanggaran || '').trim());
});

/* 10. Input nilai */
lgPasang_('nilai.save', null, (u, p) => {
  if (!(p.items || []).some(i => i.nilai !== '' && i.nilai !== null && i.nilai !== undefined)) return;
  lgGabung_('nilai', lc_(u.username) + '|' + p.kelas + '|' + lc_(p.mapel), () => ({
    pelaku: u.username, target: '', data: {},
    teks: '{p} telah memberikan nilai pelajaran ' + p.mapel + ' ' + p.kelas
  }));
});

/* 11. Uang tahunan */
lgPasang_('tahunan.save', null, (u, p) => {
  const s = findUser_(p.username); if (!s) return;
  lgTulis_('tahunan', u.username, s.username, '{t} telah membayar uang tahunan sebesar ' + lgRp_(p.jumlah) +
    ' (Tahun Ajaran ' + (p.tahun_ajaran || getSetting_('tahun_ajaran')) + ')');
});

/* ---------- baca Live Portal ---------- */
function lgSamar_(un) { const s = String(un || ''); return '@' + (s.charAt(0) || 'u') + '***'; }
function portalBaca_(u, offset, limit) {
  const admin = can_(u), me = lc_(u.username);
  const e = lgEkor_(Math.max(0, num_(offset)), Math.min(50, Math.max(1, num_(limit) || 5)));
  const items = e.rows.map(r => {
    const privat = !!LOG_PRIVAT[r.jenis];
    // "Nama User @user" — nama tidak ditampilkan bila disamarkan, atau bila sudah diikuti "(NAMA, Kelas, Asal)"
    const tok = (un, sesudah) => {
      const lihat = !privat || admin || lc_(un) === me;
      if (!lihat) return { l: lgSamar_(un) };
      const o = { u: un, l: '@' + un };
      if (!/^\s*\(/.test(sesudah || '')) { const x = findUser_(un); if (x && x.nama) o.n = x.nama; }
      return o;
    };
    const pecah = String(r.teks || '').split(/(\{p\}|\{t\})/).filter(x => x !== '');
    const parts = pecah.map((x, i) =>
      x === '{p}' ? tok(r.pelaku, pecah[i + 1]) : x === '{t}' ? tok(r.target, pecah[i + 1]) : { t: x });
    return { id: r.id, waktu: r.waktu, jenis: r.jenis, parts: parts };
  });
  return { items: items, more: num_(offset) + e.rows.length < e.total, total: e.total };
}
ACTIONS['portal.list'] = (u, p) => portalBaca_(u, p.offset, p.limit);

/* Beranda: sertakan 5 aktivitas terbaru */
(function () {
  const asli = ACTIONS.dashboard;
  if (typeof asli !== 'function' || asli.__portal) return;
  const baru = function (u, p) {
    const d = asli(u, p);
    try { const x = portalBaca_(u, 0, 5); d.portal = x.items; d.portalMore = x.more; } catch (e) { d.portal = []; }
    return d;
  };
  baru.__portal = true;
  ACTIONS.dashboard = baru;
})();

/* ============================================================
 *  ROOM CHAT: BALAS PESAN + LAMPIRAN (foto, video, dokumen)
 * ============================================================ */
const CHAT_MAKS = { foto: 5, video: 16, dokumen: 10 };   // MB
const CHAT_DILARANG = /\.(exe|bat|cmd|com|scr|msi|vbs|js|jar|apk|ps1|sh)$/i;

function chatPeta_() { const m = {}; readAll_('Chat').forEach(c => { if (c.id) m[c.id] = c; }); return m; }
function chatKutip_(q, me) {
  if (!q) return null;
  let lmp = null; try { lmp = q.lampiran ? JSON.parse(q.lampiran) : null; } catch (e) {}
  return { id: q.id, pesan: String(q.pesan || '').slice(0, 140), dariSaya: lc_(q.dari) === me, nama: (findUser_(q.dari) || {}).nama || q.dari, jenis: lmp ? lmp.jenis : '' };
}
function chatPerkaya_(m, row, peta, me) {
  if (!row) return m;
  if (row.balas && peta[row.balas]) m.balas = chatKutip_(peta[row.balas], me);
  if (row.lampiran) { try { m.lampiran = JSON.parse(row.lampiran); } catch (e) {} }
  if (row.story) { try { m.story = JSON.parse(row.story); } catch (e) {} }
  return m;
}
/** Pastikan pesan yang dibalas memang bagian dari percakapan yang sama. */
function chatBalasValid_(u, to, id) {
  if (!id) return '';
  const q = chatPeta_()[String(id)];
  if (!q) return '';
  const a = lc_(u.username), b = lc_(to);
  if (b.indexOf('g:') === 0) return q.ke === to ? q.id : '';   // grup: pesan yang dibalas harus dari grup yang sama
  const ok = (lc_(q.dari) === a && lc_(q.ke) === b) || (lc_(q.dari) === b && lc_(q.ke) === a);
  return ok ? q.id : '';
}

/* Percakapan: tambahkan kutipan balasan & lampiran */
(function () {
  const asli = ACTIONS['chat.thread'];
  if (typeof asli !== 'function' || asli.__portal) return;
  const baru = function (u, p) {
    const list = asli(u, p);
    try {
      const peta = chatPeta_(), me = lc_(u.username);
      list.forEach(m => chatPerkaya_(m, peta[m.id], peta, me));
    } catch (e) {}
    return list;
  };
  baru.__portal = true;
  ACTIONS['chat.thread'] = baru;
})();

/* Kirim pesan teks: dukung "balas" */
(function () {
  const asli = ACTIONS['chat.send'];
  if (typeof asli !== 'function' || asli.__portal) return;
  const baru = function (u, p) {
    const balas = chatBalasValid_(u, p.to, p.balas);
    const res = asli(u, p);
    if (balas && res && res.id) {
      try {
        lock_(() => {
          const r = readAll_('Chat').find(c => c.id === res.id);
          if (r) update_('Chat', r._row, { balas: balas });
        });
        res.balas = chatKutip_(chatPeta_()[balas], lc_(u.username));
      } catch (e) {}
    }
    return res;
  };
  baru.__portal = true;
  ACTIONS['chat.send'] = baru;
})();

function chatFolder_() {
  const root = folder_();
  const it = root.getFoldersByName('Chat');
  return it.hasNext() ? it.next() : root.createFolder('Chat');
}
/** Kirim foto / video / dokumen. params: to, data (data URL base64), nama, mime, pesan (keterangan), balas */
function chatFile_(u, p) {
  const to = String(p.to || '').indexOf('g:') === 0 && typeof grupCek_ === 'function' ? { username: grupCek_(u, p.to).id } : findUser_(p.to);
  if (!to) throw new Error('Penerima tidak ditemukan.');
  if (!p.data) throw new Error('File kosong.');
  const m = String(p.data).match(/^data:([^;,]+)[;,]/);
  const mime = String(p.mime || (m ? m[1] : '') || 'application/octet-stream').toLowerCase();
  const jenis = mime.indexOf('image/') === 0 ? 'foto' : mime.indexOf('video/') === 0 ? 'video' : 'dokumen';
  let nama = String(p.nama || '').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 120) || (jenis + '_' + Date.now());
  if (CHAT_DILARANG.test(nama)) throw new Error('Jenis file ini tidak diizinkan.');
  const bytes = Utilities.base64Decode(String(p.data).replace(/^data:[^,]*,/, ''));
  if (bytes.length > CHAT_MAKS[jenis] * 1024 * 1024) throw new Error('Ukuran ' + jenis + ' maksimal ' + CHAT_MAKS[jenis] + ' MB.');
  const file = chatFolder_().createFile(Utilities.newBlob(bytes, mime, Date.now() + '_' + nama));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const ket = String(p.pesan || '').trim().slice(0, 2000);
  const label = jenis === 'foto' ? '📷 Foto' : jenis === 'video' ? '🎬 Video' : '📄 ' + nama;
  const lampiran = { id: file.getId(), nama: nama, mime: mime, ukuran: bytes.length, jenis: jenis, auto: !ket };
  const cid = String(p._cid || '').replace(/[^\w-]/g, '').slice(0, 60);
  const balas = chatBalasValid_(u, to.username, p.balas);
  const grup = to.username.indexOf('g:') === 0;
  const obj = { id: cid || uid_(), dari: u.username, ke: to.username, pesan: ket || label, waktu: now_(), dibaca: grup ? '' : 'Tidak', balas: balas, lampiran: JSON.stringify(lampiran) };
  append_('Chat', obj);
  const res = { id: obj.id, dariSaya: true, pesan: obj.pesan, waktu: obj.waktu, dibaca: false, lampiran: lampiran };
  if (balas) res.balas = chatKutip_(chatPeta_()[balas], lc_(u.username));
  return res;
}
ACTIONS['chat.file'] = (u, p) => chatFile_(u, p);


/* ============================================================
 *  MEDIA LANGSUNG DARI SERVER (tanpa login Google / tanpa unduh)
 *  Dipakai bila tautan Google Drive tidak dapat diputar di perangkat.
 *  Hanya untuk file lampiran chat milik percakapan pengguna, atau story yang boleh dilihat.
 * ============================================================ */
const MEDIA_POTONG = 2 * 1024 * 1024;   // 2 MB per bagian
function mediaBoleh_(u, id) {
  const me = lc_(u.username);
  const grup = typeof grupSaya_ === 'function' ? grupSaya_(u) : {};   // grup chat (Fitur.gs)
  const ikut = c => lc_(c.dari) === me || lc_(c.ke) === me || !!grup[c.ke];
  if (readAll_('Chat').some(c => ((c.lampiran && String(c.lampiran).indexOf(id) >= 0) || (c.story && String(c.story).indexOf(id) >= 0)) && ikut(c))) return true;
  return typeof mediaBolehLain_ === 'function' && mediaBolehLain_(u, id);   // dokumentasi asrama (Fitur.gs)
}
function mediaGet_(u, p) {
  const id = String(p.id || '');
  if (!/^[\w-]{10,}$/.test(id) || !mediaBoleh_(u, id)) throw new Error('File tidak ditemukan.');
  const blob = DriveApp.getFileById(id).getBlob();
  const b = blob.getBytes(), parts = Math.max(1, Math.ceil(b.length / MEDIA_POTONG)), i = Math.max(0, Math.min(parts - 1, num_(p.part)));
  return { mime: blob.getContentType(), size: b.length, parts: parts, part: i, data: Utilities.base64Encode(b.slice(i * MEDIA_POTONG, (i + 1) * MEDIA_POTONG)) };
}
ACTIONS['media.get'] = (u, p) => mediaGet_(u, p);
