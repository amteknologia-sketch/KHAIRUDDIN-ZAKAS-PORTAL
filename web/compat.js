/*
 * ALHUDA MOBILE — penyesuaian lintas browser untuk versi web
 * (Chrome, Safari macOS/iPhone/iPad, Firefox, Edge, Samsung Internet, Opera).
 * Dimuat SEBELUM tampilan aplikasi; bagian "after" dijalankan setelah aplikasi siap.
 */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var IOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  window.ALHUDA_WEB = true;

  /* ---------- 1. Tinggi layar yang benar di HP (bilah alamat Safari/Chrome) ---------- */
  var css = document.createElement('style');
  css.id = 'alhuda-compat-css';
  css.textContent =
    '@supports (height:100dvh){html,body{height:100dvh}}' +
    'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    'select.in{-webkit-appearance:none;appearance:none;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 16px) 50%,calc(100% - 11px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:28px}' +
    '@media (hover:none){input.in,select.in,textarea.in{font-size:16px}}'; // iPhone tidak memperbesar layar saat mengetik
  (document.head || document.documentElement).appendChild(css);

  /* ---------- 2. Penyimpanan aman (Safari mode privat / cookie diblokir) ---------- */
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); }
  catch (e) {
    var mem = {};
    var fake = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; }, key: function (i) { return Object.keys(mem)[i] || null; }
    };
    Object.defineProperty(fake, 'length', { get: function () { return Object.keys(mem).length; } });
    try { Object.defineProperty(window, 'localStorage', { value: fake, configurable: true }); } catch (e2) {}
  }

  /* ---------- 3. Notifikasi: Chrome Android wajib lewat Service Worker; Safari/Firefox minta izin hanya setelah sentuhan ---------- */
  var N = window.Notification;
  if (typeof N === 'function') {
    var W = function (title, opt) {
      opt = opt || {};
      if (!opt.icon) opt.icon = 'icons/icon-192.png';
      if (!opt.badge) opt.badge = 'icons/favicon-32.png';
      var viaPage = function () { try { return new N(title, opt); } catch (e) { return null; } };
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function (r) { return r.showNotification(title, opt); }).catch(viaPage);
      } else viaPage();
    };
    Object.defineProperty(W, 'permission', { get: function () { return N.permission; } });
    W.requestPermission = function (cb) {
      var ask = function () {
        try {
          var p = N.requestPermission(cb);
          return p && p.then ? p.catch(function () { return N.permission; }) : Promise.resolve(N.permission);
        } catch (e) { return Promise.resolve(N.permission); }
      };
      var active = navigator.userActivation ? navigator.userActivation.isActive : false;
      if (active) return ask();
      // Tunggu sentuhan/klik berikutnya (Safari & Firefox menolak permintaan tanpa interaksi)
      return new Promise(function (res) {
        var once = function () { document.removeEventListener('click', once, true); document.removeEventListener('touchend', once, true); ask().then(res); };
        document.addEventListener('click', once, true);
        document.addEventListener('touchend', once, true);
      });
    };
    try { window.Notification = W; } catch (e) {}
  }

  /* ---------- 4. Tangkap tawaran "Instal aplikasi" yang muncul sebelum aplikasi siap ---------- */
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__bip = e; });

  /* ---------- 5. Input bulan/tanggal untuk browser yang belum mendukung (Safari Mac, Firefox) ---------- */
  function supports(type) { var i = document.createElement('input'); i.setAttribute('type', type); i.value = 'x'; return i.type === type && i.value !== 'x'; }
  var NO_MONTH = !supports('month'), NO_DATE = !supports('date'), NO_TIME = !supports('time');
  var BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fixInputs(root) {
    if (!root || !root.querySelectorAll) return;
    if (NO_MONTH) Array.prototype.forEach.call(root.querySelectorAll('input[type=month]'), function (el) {
      var s = document.createElement('select');
      Array.prototype.forEach.call(el.attributes, function (a) { if (a.name !== 'type' && a.name !== 'value') s.setAttribute(a.name, a.value); });
      var cur = el.value || el.getAttribute('value') || '';
      var d = new Date(), y = d.getFullYear(), m = d.getMonth();
      var list = [];
      for (var i = -48; i <= 0; i++) { var t = new Date(y, m + i, 1); list.push(t.getFullYear() + '-' + pad(t.getMonth() + 1)); }
      if (cur && list.indexOf(cur) < 0) list.push(cur);
      list.sort().reverse().forEach(function (v) {
        var o = document.createElement('option'); o.value = v; o.textContent = BLN[+v.slice(5, 7) - 1] + ' ' + v.slice(0, 4);
        if (v === cur) o.selected = true; s.appendChild(o);
      });
      el.parentNode.replaceChild(s, el);
    });
    if (NO_DATE) Array.prototype.forEach.call(root.querySelectorAll('input[type=date]:not([placeholder])'), function (el) {
      el.setAttribute('placeholder', 'TTTT-BB-HH (contoh 2026-01-31)'); el.setAttribute('pattern', '\\d{4}-\\d{2}-\\d{2}'); el.setAttribute('inputmode', 'numeric');
    });
    if (NO_TIME) Array.prototype.forEach.call(root.querySelectorAll('input[type=time]:not([placeholder])'), function (el) {
      el.setAttribute('placeholder', 'JJ:MM'); el.setAttribute('pattern', '\\d{2}:\\d{2}'); el.setAttribute('inputmode', 'numeric');
    });
  }
  if ((NO_MONTH || NO_DATE || NO_TIME) && window.MutationObserver) {
    new MutationObserver(function (list) {
      list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) fixInputs(n.parentNode || n); }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------- 6. Warna bilah status mengikuti tema ---------- */
  function syncThemeColor() {
    try {
      var c = getComputedStyle(document.documentElement).getPropertyValue('--pri2').trim();
      if (!c) return;
      var m = document.querySelector('meta[name=theme-color]');
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
      m.setAttribute('content', c);
    } catch (e) {}
  }

  /* ---------- 7. Tombol "Kembali" browser / HP menutup halaman aplikasi, bukan keluar ---------- */
  var trapOn = false;
  function trap() {
    if (trapOn || !window.history || !history.pushState) return;
    trapOn = true;
    try { history.replaceState({ alhuda: 0 }, ''); history.pushState({ alhuda: 1 }, ''); } catch (e) { return; }
    window.addEventListener('popstate', function () {
      var handled = false;
      try { handled = typeof window.back === 'function' && window.back(); } catch (e) {}
      if (handled) { try { history.pushState({ alhuda: 1 }, ''); } catch (e) {} }
      else { trapOn = false; history.back(); }
    });
  }

  /* ---------- 8. PDF di iPhone/iPad yang dipasang ke Layar Utama: pakai menu Bagikan ---------- */
  function patchPdf() {
    var orig = window.savePdf;
    if (typeof orig !== 'function' || !IOS || !STANDALONE) return;
    window.savePdf = function (r) {
      try {
        var bin = atob(r.base64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var file = new File([arr], r.name, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && typeof window.sheet === 'function') {
          var d = window.sheet('Dokumen PDF', '<div class="muted" style="margin-bottom:12px">' + r.name.replace(/[<>&"]/g, '') + ' siap. Ketuk tombol di bawah untuk menyimpan ke File, mencetak, atau mengirim.</div><button class="btn full" id="pdfShare">Simpan / Bagikan PDF</button>');
          d.querySelector('#pdfShare').onclick = function () { navigator.share({ files: [file], title: r.name }).catch(function () {}); };
          return;
        }
      } catch (e) {}
      return orig(r);
    };
  }

  /* ---------- Dijalankan setelah tampilan aplikasi dimuat ---------- */
  window.__alhudaAfterApp = function () {
    fixInputs(document.body);
    syncThemeColor();
    if (window.MutationObserver) new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    trap();
    patchPdf();
    // tawaran instal yang datang lebih awal
    try {
      if (window.__bip && typeof installPrompt !== 'undefined' && !installPrompt) {
        installPrompt = window.__bip; // eslint-disable-line no-undef
        if (typeof window.showInstallBar === 'function') window.showInstallBar();
      }
    } catch (e) {}
  };

  // Klik notifikasi (dari Service Worker) → buka chat pengirim
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'open-chat' && d.from && typeof window.chatWith === 'function') { try { window.chatWith(d.from); } catch (x) {} }
    });
  }
})();
