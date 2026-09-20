/*
 * lock.js — kunci layar & animasi memuat (loading) untuk template ini.
 *
 * Dipakai saat "form sedang dikirim" atau "data sedang dimuat" supaya pengguna
 * tidak bisa menekan apa pun sementara proses berjalan, dengan animasi gembok.
 *
 *   Lock.show({ title, message, mode, tone })   // mode: 'load' | 'form' | 'screen'
 *   Lock.hide()
 *   Lock.tulis('mengunggah…')                    // ganti pesan saat overlay tampil
 *   Lock.jalan(1500, { ... })                    // tampilkan sekian ms lalu tutup
 *   Lock.wrap(fetch('/api/x'), { ... })          // otomatis tutup saat Promise selesai
 *   Lock.demo(3, { ... })                        // contoh: hitung mundur 0,3… untuk demo
 *
 * Tanpa dependency. Warna mengikuti token tema (--c-*) sehingga ikut preset
 * perbankan & mode gelap. Semua teks lewat I18n.t() agar dwibahasa.
 */
(function () {
  "use strict";

  function T(s) { return window.I18n && window.I18n.t ? window.I18n.t(s, s) : s; }
  function $(s) { return document.querySelector(s); }
  function isi(el, t) { if (el) el.textContent = t; }

  var timer = null;
  var tick = null;
  var el = null;

  var JUDUL = {
    load: "Memuat data",
    form: "Mengirim formulir",
    screen: "Layar terkunci"
  };
  var PESAN = {
    load: "Menyiapkan data terbaru…",
    form: "Mohon tunggu, jangan tutup halaman ini.",
    screen: "Masukkan PIN untuk membuka kembali."
  };
  var IKON = {
    load: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3.5V9h-5.5"/>',
    form: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/>',
    screen: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };

  var GEMBOK =
    '<path d="M6.5 11V8a5.5 5.5 0 0 1 11 0v3"/>' +
    '<rect x="3.5" y="11" width="17" height="10.5" rx="2.4"/>' +
    '<circle cx="12" cy="15.4" r="1.6"/>' +
    '<path d="M12 17v2.1"/>';

  function bangun() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "lock-overlay";
    el.setAttribute("data-lock", "");
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-busy", "true");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="lock-box">' +
        '<div class="lock-ring" aria-hidden="true">' +
          '<svg class="lock-ring-svg" viewBox="0 0 120 120">' +
            '<circle cx="60" cy="60" r="52" />' +
          "</svg>" +
          '<div class="lock-gembok is-locked" data-lock-gembok aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + GEMBOK + "</svg>" +
          "</div>" +
        "</div>" +
        '<div class="lock-judul" data-lock-title>' + T(JUDUL.load) + "</div>" +
        '<p class="lock-pesan" data-lock-message>' + T(PESAN.load) + "</p>" +
        '<div class="lock-bar" aria-hidden="true"><i></i></div>' +
        '<div class="lock-jejak" data-lock-steps aria-hidden="true"><i></i><i></i><i></i></div>' +
      "</div>";
    document.body.appendChild(el);
    return el;
  }

  function terapkanTeks(judul, pesan) {
    isi($("[data-lock-title]"), judul);
    isi($("[data-lock-message]"), pesan);
  }

  var Lock = {
    get tampil() { return !!el && el.getAttribute("data-open") === "1"; },

    show: function (o) {
      o = o || {};
      var w = bangun();
      var mode = o.mode || "load";
      w.setAttribute("data-mode", mode);
      terapkanTeks(o.title || T(JUDUL[mode] || JUDUL.load), o.message || T(PESAN[mode] || PESAN.load));
      var ikon = $("[data-lock-ikon]") || $(".lock-gembok");
      if (ikon) {
        ikon.classList.toggle("is-locked", mode !== "screen");
        ikon.classList.toggle("is-screen", mode === "screen");
      }
      if (o.gembok === false) w.setAttribute("data-tanpa-gembok", "1"); else w.removeAttribute("data-tanpa-gembok");
      w.setAttribute("data-tone", o.tone || "primary");
      if (timer) { clearTimeout(timer); timer = null; }
      if (tick) { clearInterval(tick); tick = null; }
      w.setAttribute("data-open", "1");
      w.setAttribute("aria-hidden", "false");
      document.documentElement.style.setProperty("overflow", "hidden");
      if (o.auto) Lock.jalan(o.auto);
      return Lock;
    },

    tulis: function (pesan, judul) {
      if (!el) return Lock;
      if (judul) isi($("[data-lock-title]"), judul);
      if (pesan) isi($("[data-lock-message]"), pesan);
      return Lock;
    },

    hide: function () {
      if (!el) return Lock;
      if (timer) { clearTimeout(timer); timer = null; }
      if (tick) { clearInterval(tick); tick = null; }
      el.setAttribute("data-open", "0");
      el.setAttribute("aria-hidden", "true");
      el.removeAttribute("data-progress");
      document.documentElement.style.removeProperty("overflow");
      return Lock;
    },

    /* tampilkan lalu tutup otomatis setelah ms */
    jalan: function (ms, o) {
      Lock.show(o);
      timer = setTimeout(function () { Lock.hide(); }, Math.max(300, ms || 1200));
      return Lock;
    },

    /* ikuti Promise: tutup begitu selesai (berhasil maupun gagal) */
    wrap: function (janji, o) {
      Lock.show(o);
      var beres = function () { Lock.hide(); };
      if (janji && typeof janji.then === "function") janji.then(beres, beres);
      else beres();
      return janji;
    },

    /* contoh interaktif: hitung mundur dengan angka di jejak langkah */
    demo: function (detik, o) {
      var sisa = detik || 3;
      Lock.show(o || { mode: "screen", message: T("Layar akan terbuka otomatis…") });
      el.setAttribute("data-progress", "count");
      var kotak = $("[data-lock-steps]");
      function gambar() {
        isi(kotak, sisa > 0 ? String(sisa) : "");
        isi($("[data-lock-message]"), sisa > 0 ? T("Terbuka dalam") + " " + sisa + " " + T("detik") + "…" : T("Membuka layar…"));
      }
      gambar();
      tick = setInterval(function () {
        sisa -= 1;
        gambar();
        if (sisa <= 0) { clearInterval(tick); tick = null; setTimeout(Lock.hide, 350); }
      }, 1000);
      return Lock;
    },

    /* dipakai setelah bahasa diganti supaya teks overlay ikut berubah */
    segarkan: function () {
      if (!el || !Lock.tampil) return;
      var mode = el.getAttribute("data-mode") || "load";
      terapkanTeks(T(JUDUL[mode]), T(PESAN[mode]));
    },

    versi: "1.0.0"
  };

  window.Lock = Lock;

  window.addEventListener("i18n:changed", function () {
    if (Lock.tampil) {
      var mode = el.getAttribute("data-mode") || "load";
      terapkanTeks(T(JUDUL[mode]), T(PESAN[mode]));
    }
  });

  /* Pintasan papan tik: tombol Esc menutup overlay (kecuali mode screen) */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && Lock.tampil && el.getAttribute("data-mode") !== "screen") Lock.hide();
  });
})();
