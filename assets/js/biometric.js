/*
 * biometric.js — kunci aplikasi "biometric / PIN" untuk template ini (demo).
 *
 * Tidak ada sensor sidik jari di peramban, jadi:
 *   - sidik jari disimulasikan (tahan/klik ikon → animasi pemindaian → berhasil),
 *   - PIN diperiksa di sisi klien (localStorage "app.pin", bawaan 123456),
 *   - di produksi, ganti `pindai()` dengan WebAuthn
 *     `navigator.credentials.get({ publicKey: … })` atau SDK milik aplikasi asli.
 *
 *   Bio.kunci({ alasan, judul })   → tampilkan layar kunci (Promise → true saat terbuka)
 *   Bio.minta({ alasan, nominal })  → minta verifikasi (langsung true bila fitur dimatikan)
 *   Bio.aktif() / Bio.setAktif(bool)
 *   Bio.idle(ms)                   → kunci otomatis setelah sekian ms tanpa interaksi
 *   Bio.setPin('654321') / Bio.pin()
 *
 * Peristiwa: "bio:locked" dan "bio:unlocked".
 */
(function () {
  "use strict";

  var PIN_BAWAAN = "123456";
  var el = null;
  var janji = null;        // Promise yang selesai saat layar terbuka
  var selesaiJanji = null; // fungsi resolve-nya
  var idleTimer = null;
  var percobaan = 0;

  function T(s) { return window.I18n && window.I18n.t ? window.I18n.t(s, s) : s; }
  function $ (s, r) { return (r || el || document).querySelector(s); }
  function LS(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  var IKON = {
    scan: '<path d="M12 2.5a9.5 9.5 0 0 0-9.5 9.5"/><path d="M21.5 12A9.5 9.5 0 0 0 12 2.5"/>' +
          '<path d="M2.5 13.5c0 2 .4 3.4 1.2 4.6"/><path d="M21.5 13.5a9.5 9.5 0 0 1-1.6 5.2"/>' +
          '<path d="M6 12a6 6 0 0 1 12 0c0 3.6-.6 6.2-1.7 8.1"/><path d="M9 12a3 3 0 0 1 6 0c0 3-.3 5-1 6.6"/>' +
          '<path d="M12 12v5.2"/>',
    gembok: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };

  /* -------------------------------------------------------------- elemen */
  function bangun() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "bio-layar";
    el.setAttribute("data-bio", "");
    el.setAttribute("data-open", "0");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="bio-kotak">' +
        '<div class="bio-kepala">' +
          '<span class="bio-merek"><i data-icon="shield-lock" data-size="15"></i> Bank<b>Nusantara</b></span>' +
          '<span class="bio-jam" data-bio-jam>--:--</span>' +
        '</div>' +
        '<div class="bio-akun">' +
          '<span class="avatar avatar-lg bio-avatar">AS</span>' +
          '<b>Aulia Saputra</b>' +
          '<span class="bio-rek">Tabungan 8820 1234 5678</span>' +
        '</div>' +
        '<p class="bio-alasan" data-bio-alasan></p>' +

        /* ---- mode sidik jari ---- */
        '<div data-bio-panel="jari" class="bio-panel">' +
          '<button type="button" class="bio-jari" data-bio-jari aria-label="' + T("Pindai sidik jari") + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + IKON.scan + "</svg>" +
            '<span class="bio-scan" aria-hidden="true"></span>' +
          "</button>" +
          '<p class="bio-petunjuk" data-bio-petunjuk>' + T("Sentuh sensor untuk membuka") + "</p>" +
          '<button type="button" class="btn btn-light btn-block btn-sm" data-bio-pin-pilih>' +
            '<i data-icon="keyboard" data-size="14"></i> ' + T("Gunakan PIN") +
          "</button>" +
        "</div>" +

        /* ---- mode PIN ---- */
        '<div data-bio-panel="pin" class="bio-panel" hidden>' +
          '<div class="bio-pin-titik" data-bio-titik aria-label="' + T("Enam digit PIN") + '"></div>' +
          '<p class="bio-salah" data-bio-salah hidden>' + T("PIN salah, coba lagi") + "</p>" +
          '<div class="bio-numpad">' +
            ["1","2","3","4","5","6","7","8","9"].map(function (d) { return '<button type="button" data-bio-angka="' + d + '">' + d + "</button>"; }).join("") +
            '<button type="button" class="bio-bantu" data-bio-jari-kembali>' + T("Sidik jari") + "</button>" +
            '<button type="button" data-bio-angka="0">0</button>' +
            '<button type="button" class="bio-bantu" data-bio-hapus aria-label="Hapus">⌫</button>' +
          "</div>" +
          '<button type="button" class="bio-lupa" data-bio-lupa>' + T("Lupa PIN?") + "</button>" +
        "</div>" +

        '<p class="bio-demo">' + T("Mode demo: sidik jari selalu berhasil, PIN bawaan") + " <b>123456</b></p>" +
      "</div>";
    (document.querySelector(".mobile-app") || document.body).appendChild(el);
    if (window.renderIcons) window.renderIcons(el);
    pasang();
    return el;
  }

  function jam() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    var t = $("[data-bio-jam]");
    if (t) t.textContent = p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function gambarTitik() {
    var isi = pin_sementara.length;
    var kotak = $("[data-bio-titik]");
    if (!kotak) return;
    kotak.innerHTML = "";
    for (var i = 0; i < 6; i++) {
      var s = document.createElement("i");
      if (i < isi) s.className = "terisi";
      kotak.appendChild(s);
    }
  }

  var pin_sementara = "";
  function panel(mode) {
    ["jari", "pin"].forEach(function (m) {
      var p = $('[data-bio-panel="' + m + '"]');
      if (p) p.hidden = m !== mode;
    });
    el.setAttribute("data-mode", mode);
    if (mode === "pin") { pin_sementara = ""; gambarTitik(); var salah = $("[data-bio-salah]"); if (salah) salah.hidden = true; }
  }

  function getarSalah() {
    var kotak = $(".bio-kotak");
    if (!kotak) return;
    kotak.classList.add("bio-getar");
    setTimeout(function () { kotak.classList.remove("bio-getar"); }, 480);
  }

  function pindai(jari) {
    if (!jari || jari.classList.contains("memindai")) return;
    jari.classList.add("memindai");
    var petunjuk = $("[data-bio-petunjuk]");
    if (petunjuk) petunjuk.textContent = T("Memindai sidik jari…");
    setTimeout(function () {
      jari.classList.remove("memindai");
      jari.classList.add("berhasil");
      if (petunjuk) petunjuk.textContent = T("Terverifikasi");
      setTimeout(function () { jari.classList.remove("berhasil"); selesai(true); }, 420);
    }, 950);
  }

  function selesai(ok) {
    if (!el) return;
    el.setAttribute("data-open", "0");
    el.setAttribute("aria-hidden", "true");
    percobaan = 0;
    var p = selesaiJanji; selesaiJanji = null; janji = null;
    if (ok) window.dispatchEvent(new CustomEvent("bio:unlocked"));
    if (p) p(!!ok);
  }

  function pasang() {
    var jari = $("[data-bio-jari]");
    jari.addEventListener("click", function () { pindai(jari); });
    jari.addEventListener("pointerdown", function (e) { e.preventDefault(); pindai(jari); });

    $("[data-bio-pin-pilih]").addEventListener("click", function () { panel("pin"); });
    $("[data-bio-jari-kembali]").addEventListener("click", function () { panel("jari"); });
    $("[data-bio-hapus]").addEventListener("click", function () {
      pin_sementara = pin_sementara.slice(0, -1);
      gambarTitik();
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-bio-angka]"), function (b) {
      b.addEventListener("click", function () { angka(b.getAttribute("data-bio-angka")); });
    });
    $("[data-bio-lupa]").addEventListener("click", function () {
      if (window.Alpine && window.Alpine.store("dialog")) {
        window.Alpine.store("dialog").ask({
          title: T("Atur ulang PIN?"),
          message: T("PIN demo akan dikembalikan ke 123456. Di aplikasi sungguhan, PIN harus diatur ulang lewat verifikasi identitas."),
          confirmText: T("Atur ulang"), tone: "danger",
          onConfirm: function () {
            Bio.setPin(PIN_BAWAAN);
            if (window.toast) window.toast(T("PIN diatur ulang ke 123456 (demo)."), "warning", T("Keamanan"));
            panel("jari");
          }
        });
      }
    });
  }

  function angka(d) {
    if (pin_sementara.length >= 6) return;
    pin_sementara += d;
    gambarTitik();
    if (pin_sementara.length === 6) {
      setTimeout(function () {
        if (pin_sementara === Bio.pin()) {
          var petunjuk = $(".bio-pin-titik");
          if (petunjuk) petunjuk.classList.add("bio-ok");
          setTimeout(function () { selesai(true); if (petunjuk) petunjuk.classList.remove("bio-ok"); }, 350);
        } else {
          percobaan += 1;
          getarSalah();
          var salah = $("[data-bio-salah]");
          if (salah) {
            salah.hidden = false;
            salah.textContent = percobaan >= 3
              ? T("PIN salah 3 kali. Gunakan sidik jari atau atur ulang PIN.")
              : T("PIN salah, coba lagi");
          }
          pin_sementara = "";
          gambarTitik();
        }
      }, 160);
    }
  }

  var Bio = {
    versi: "1.0.0",

    aktif: function () { return LS("app.bio") !== "0"; },
    setAktif: function (v) { LS("app.bio", v ? "1" : "0"); },
    pin: function () { return LS("app.pin") || PIN_BAWAAN; },
    setPin: function (p) { LS("app.pin", String(p)); return true; },

    /* tampilkan layar kunci; mengembalikan Promise yang selesai saat terbuka */
    kunci: function (o) {
      o = o || {};
      if (janji) return janji;                       // sudah terkunci
      bangun();
      jam();
      var alasan = $("[data-bio-alasan]");
      if (alasan) alasan.textContent = o.alasan || T("Buka dengan sidik jari atau PIN");
      var nama = $(".bio-akun b");
      if (nama && o.nama) nama.textContent = o.nama;
      panel("jari");
      el.setAttribute("data-open", "1");
      el.setAttribute("aria-hidden", "false");
      window.dispatchEvent(new CustomEvent("bio:locked"));
      janji = new Promise(function (resolve) { selesaiJanji = resolve; });
      return janji;
    },

    /* minta konfirmasi (mis. sebelum transaksi besar). Nonaktif → langsung true */
    minta: function (o) {
      o = o || {};
      if (!Bio.aktif()) return Promise.resolve(true);
      return Bio.kunci({ alasan: o.alasan || T("Konfirmasi dengan sidik jari atau PIN") });
    },

    tutup: function () { selesai(false); },
    terbuka: function () { return !!el && el.getAttribute("data-open") === "1"; },

    /* kunci otomatis setelah ms tanpa interaksi (mata uang: milidetik) */
    idle: function (ms) {
      var tunggu = Math.max(5000, ms || 90000);
      function reset() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
          if (!Bio.terbuka() && !document.hidden) Bio.kunci({ alasan: T("Aplikasi terkunci karena tidak ada aktivitas") });
        }, tunggu);
      }
      ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
        document.addEventListener(ev, reset, { passive: true });
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { clearTimeout(idleTimer); }
        else {
          if (Bio.aktif() && !Bio.terbuka()) Bio.kunci({ alasan: T("Aplikasi terkunci saat kembali") });
          reset();
        }
      });
      reset();
      return tunggu;
    },

    /* dipakai halaman pengaturan keamanan */
    uji: function () { return Bio.kunci({ alasan: T("Uji kunci aplikasi") }); }
  };
  window.Bio = Bio;

  window.addEventListener("i18n:changed", function () {
    if (!el || el.getAttribute("data-open") !== "1") return;
    var alasan = $("[data-bio-alasan]");
    if (alasan) alasan.textContent = T("Buka dengan sidik jari atau PIN");
    var p = $("[data-bio-petunjuk]");
    if (p) p.textContent = T("Sentuh sensor untuk membuka");
    var lupa = $("[data-bio-lupa]");
    if (lupa) lupa.textContent = T("Lupa PIN?");
    var kembali = $("[data-bio-jari-kembali]");
    if (kembali) kembali.textContent = T("Sidik jari");
    var pilih = $("[data-bio-pin-pilih]");
    if (pilih) pilih.innerHTML = '<i data-icon="keyboard" data-size="14"></i> ' + T("Gunakan PIN");
    var demo = $(".bio-demo");
    if (demo) demo.innerHTML = T("Mode demo: sidik jari selalu berhasil, PIN bawaan") + " <b>123456</b>";
    if (window.renderIcons) window.renderIcons(el);
  });
})();
