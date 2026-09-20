/**
 * satureport-tools.js — penghubung halaman template dengan aplikasi SatuReport.
 *
 * Tiga halaman Tools (Report Design / Report Viewer / Report Example) menampilkan
 * aplikasi SatuReport di dalam iframe. Berkas aplikasinya di-vendor apa adanya di
 * assets/satureport/ (designer.html, viewer.html, examples.html) dan tetap mandiri —
 * skrip ini hanya mengurus hal-hal yang menyangkut halaman template:
 *
 *   1. membuka aplikasi di tab baru,
 *   2. memuat ulang / melayarkan-penuh bingkai aplikasi,
 *   3. menyamakan bahasa aplikasi dengan bahasa template (ID/EN).
 *
 * Tanpa skrip ini pun aplikasinya tetap jalan; ini hanya kenyamanan.
 */
(function () {
  "use strict";

  /* Letak berkas aplikasi relatif terhadap halaman di folder pages/ */
  var BASE = "../assets/satureport/";
  var BERKAS = {
    "report-design": "designer.html",
    "report-viewer": "viewer.html",
    "report-example": "examples.html"
  };

  function berkas(nama) {
    return BASE + (BERKAS[nama] || BERKAS["report-design"]);
  }

  /* ---------- bahasa: template (app.locale) → aplikasi (satureport.lang) ---------- */
  function bahasaTemplate() {
    try {
      return localStorage.getItem("app.locale") === "en" ? "en" : "id";
    } catch (e) {
      return "id";
    }
  }

  function samakanBahasa(muatUlang) {
    var l = bahasaTemplate();
    try {
      localStorage.setItem("satureport.lang", l);
    } catch (e) { /* mode privat: aplikasi memakai bahasa peramban */ }
    if (muatUlang) semuaBingkai(function (f) { muatUlangBingkai(f); });
  }

  function semuaBingkai(cb) {
    Array.prototype.forEach.call(document.querySelectorAll("iframe[data-sr]"), function (f) {
      cb(f);
    });
  }

  function muatUlangBingkai(f) {
    try {
      f.contentWindow.location.reload();
    } catch (e) {
      /* bila diblokir (mis. dibuka lewat file:// di peramban tertentu) */
      f.src = f.src;
    }
  }

  /* ---------- API publik ---------- */
  var SatuTools = {
    /* buka aplikasi di tab baru */
    buka: function (nama) {
      window.open(berkas(nama), "_blank", "noopener");
    },

    /* tautan aplikasi (dipakai tombol/link biasa) */
    tautan: berkas,

    /* muat ulang bingkai aplikasi */
    muatUlang: function (id) {
      var f = id ? document.getElementById(id) : null;
      if (f) muatUlangBingkai(f);
      else semuaBingkai(muatUlangBingkai);
    },

    /* layar penuh untuk kartu pembungkus (memakai mekanisme kartu template) */
    layarPenuh: function (idKartu) {
      var kartu = document.getElementById(idKartu);
      if (!kartu) return;
      var tombol = kartu.querySelector('[data-card-tool="fullscreen"]');
      if (tombol) tombol.click();
      else kartu.classList.toggle("card-maximized");
    },

    /* samakan bahasa aplikasi dengan bahasa template sekarang */
    samakanBahasa: function () {
      samakanBahasa(true);
    }
  };

  window.SatuTools = SatuTools;

  /* Saat bahasa template diganti (tombol ID/EN), aplikasi ikut berganti bahasa. */
  window.addEventListener("i18n:changed", function () {
    samakanBahasa(true);
  });
})();
