/*
 * aichat.js — asisten AI yang selalu muncul di setiap halaman (window.AIChat).
 *
 * Sifat:
 *   • Tanpa dependensi. Tidak butuh Alpine (halaman perkenalan/index.html pun
 *     tidak memakai x-data) — widget membangun DOM-nya sendiri lalu menempel
 *     ke <body>. Bila ada .mobile-app (aplikasi nasabah) ia duduk DI DALAM
 *     kerangka ponsel.
 *   • Selalu tampak: tombol bulat melayang di kanan bawah pada SEMUA halaman.
 *     Panel terbuka otomatis saat kunjungan pertama, dan statusnya diingat —
 *     jadi saat berpindah halaman percakapan tetap terbuka.
 *   • Otak default = simulasi offline (pencocokan kata kunci, dwibahasa ID/EN,
 *     tanpa satu pun permintaan jaringan). Bisa diganti model sungguhan:
 *
 *       window.AIChat.setProvider(async function (o) {
 *         // o = { pesan, riwayat, bahasa, halaman }
 *         var r = await fetch("/api/chat", { method:"POST", body: JSON.stringify(o) });
 *         return (await r.json()).jawaban;   // string, atau { teks, tautan:[…] }
 *       });
 *
 * API: versi, buka, tutup, alihkan, kirim(teks), bersihkan, riwayat,
 *      setProvider(fn), provider, tanya(teks) → Promise<string>.
 * Data: localStorage "app.aiChat" = { kenal, buka, riwayat[] }.
 */
(function () {
  "use strict";

  var LS = "app.aiChat";
  var MAKS = 60;                 // batas riwayat tersimpan
  var TUNDA_BALAS = [420, 980];  // jeda "mengetik" (ms) agar terasa hidup

  /* ------------------------------------------------------------ util bantu */
  function T(s) {
    try { return window.T ? window.T(s) : s; } catch (e) { return s; }
  }
  function bahasa() {
    try {
      if (window.I18n && window.I18n.locale) return window.I18n.locale;
      return document.documentElement.getAttribute("lang") || "id";
    } catch (e) { return "id"; }
  }
  function simpan(o) {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) { /* mode privat */ }
  }
  function muat() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { return {}; }
  }
  function jamKini() {
    try {
      return new Date().toLocaleTimeString(bahasa() === "en" ? "en-GB" : "id-ID",
        { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function dalamPonsel() { return !!document.querySelector(".mobile-app"); }
  function diFolder(nama) {
    return new RegExp("(^|/)" + nama + "/").test(location.pathname);
  }
  function acak(a, b) { return a + Math.random() * (b - a); }

  /* Alamat halaman lain — menyesuaikan letak berkas sekarang, termasuk berkas
     mandiri di folder offline/ yang namanya sudah diterjemahkan. */
  var OFFLINE = {
    index: "dashboard.html", dashboard: "dashboard.html", tables: "tabel.html",
    analytics: "analitik.html", charts: "grafik.html", widgets: "komponen.html",
    forms: "formulir.html", notifications: "notifikasi.html", scheduler: "scheduler.html",
    "kartu-qris": "kartu-qris.html", qris: "qris.html", mobile: "mobile-nasabah.html",
    login: "login.html", icons: "dashboard.html", "mini-grid-1": "mini-grid-1.html",
    aggrid: "ag-grid.html"
  };
  function halaman(nama) {
    var berkas = (nama === "index" ? "index" : nama) + ".html";
    var diOffline = diFolder("offline");
    if (diOffline) return OFFLINE[nama] || "dashboard.html";
    if (diFolder("pages") || diFolder("mobile")) return "../pages/" + berkas;
    return "pages/" + berkas;
  }

  /* ------------------------------------------------------------ kosakata UI */
  var LABEL = {
    judul: function () { return T("Asisten AI"); },
    sub: function () { return T("Simulasi offline · siap disambung API"); },
    buka: function () { return T("Buka asisten AI"); },
    tutup: function () { return T("Tutup asisten"); },
    perkecil: function () { return T("Perkecil panel"); },
    bersihkan: function () { return T("Bersihkan percakapan"); },
    tanya: function () { return T("Tulis pertanyaan…"); },
    kirim: function () { return T("Kirim"); },
    mengetik: function () { return T("Asisten sedang mengetik…"); },
    catatan: function () {
      return T("Jawaban dibuat di peramban ini tanpa jaringan. Sambungkan model sungguhan lewat window.AIChat.setProvider(fn).");
    },
    saran: function () { return T("Coba tanya"); },
    teaser: function () { return T("Tanya apa saja — saya siap membantu."); }
  };

  /* Tiap label saran = teks yang dikirim sebagai pertanyaan. */
  var SARAN = [
    function () { return T("Apa itu Aurivo Dash?"); },
    function () { return T("Ganti mode gelap"); },
    function () { return T("Notifikasi saya"); },
    function () { return T("Jadwal otomatis"); },
    function () { return T("QRIS"); },
    function () { return T("Mode offline"); }
  ];

  /* ------------------------------------------------------------ otak simulasi
     Setiap topik: { tmpl, cocok (regex), balas(args) } — balasan disimpan
     sebagai KUNCI template (bukan teks jadi) supaya bisa dibangun ulang saat
     bahasa diganti. */
  function tautan(nama, label) { return { label: T(label), href: halaman(nama) }; }
  function aksiTema() {
    return { label: bahasa() === "en" ? "Switch theme" : "Ganti tema", aksi: "tema" };
  }
  function aksiJalankanTema() { return { label: T("Ganti tema"), aksi: "tema" }; }

  var TEKS = {
    sapaan: function () {
      return T("Halo! Saya asisten demo Aurivo Dash. Tanya apa saja soal halaman, tema, komponen, atau data contoh — semua jawaban dibuat lokal di peramban, tanpa jaringan.");
    },
    kapabilitas: function () {
      return T("Saya bisa menjelaskan isi halaman, mengganti tema gelap/terang, menunjukkan letak menu (notifikasi, jadwal, QRIS, mobile), dan menceritakan bagaimana template ini bekerja offline.");
    },
    template: function () {
      return T("Aurivo Dash adalah template dashboard perbankan bergaya AdminLTE v3, dibangun ulang dengan Tailwind CSS v4 + Alpine.js: 25 halaman, aplikasi nasabah 9 layar, dwibahasa Indonesia/English, 6 preset tema perbankan, dan seluruh aset disimpan lokal.");
    },
    tema: function (a) {
      return a && a.gelap
        ? T("Siap — tema diganti ke mode gelap.")
        : T("Siap — tema kembali ke mode terang.");
    },
    notif: function (a) {
      return a && a.jumlah > 0
        ? T("Ada " + a.jumlah + " notifikasi belum dibaca.")
        : T("Tidak ada notifikasi yang belum dibaca — semua sudah rapi.");
    },
    jadwal: function () {
      return T("Halaman Scheduler berisi 7 job berkala (autodebet, laporan harian, rekonsiliasi) lengkap dengan agenda pekan dan riwayat eksekusi. Di aplikasi nasabah ada layar Jadwal otomatis untuk menjeda, menjalankan, atau menghapus jadwal.");
    },
    qris: function () {
      return T("Halaman QRIS membangun payload EMVCo lengkap dengan CRC16 (statis & dinamis), sedangkan di aplikasi nasabah ada QRIS saya plus simulasi pembayaran dan kartu bank 3D.");
    },
    kartu: function () {
      return T("Kartu dengan QRIS menampilkan tiga kartu bank (debit, kredit, virtual) yang bisa dibalik 3D, dengan sensor nomor, atur limit, dan blokir kartu.");
    },
    mobile: function () {
      return T("Aplikasi nasabah ada di mobile/index.html: 9 layar dengan layar kunci biometric + PIN, tagihan/top up, jadwal otomatis, pusat notifikasi, dan pengaturan keamanan.");
    },
    biometric: function () {
      return T("Layar kunci memakai sidik jari simulasi dan PIN 6 digit (demo: 123456). Kunci otomatis bisa diatur di layar Keamanan, dan transaksi besar di atas Rp 1 juta meminta verifikasi ulang.");
    },
    offline: function () {
      return T("Semua aset (CSS, ikon, font, pustaka) tersimpan lokal, dan folder offline/ berisi 20 berkas HTML mandiri yang jalan dari file:// tanpa satu pun permintaan jaringan.");
    },
    grid: function () {
      return T("Ada tabel pintar, AG Grid Community, dan empat demo Mini Grid: 50.000 baris dengan virtual scroll, CRUD modal, alur persetujuan, serta aksi per baris — semuanya bisa diekspor CSV.");
    },
    bahasa: function () {
      return T("Halaman ini dwibahasa. Tombol ID/EN ada di navbar dan pilihan bahasa juga muncul di profil aplikasi nasabah; terjemahan disimpan di src/i18n/en.json.");
    },
    login: function () {
      return T("Halaman masuk memakai splash screen lalu dua langkah: kata sandi admin@perusahaan.id / admin123, lanjut verifikasi OTP 6 digit (tombol isi otomatis tersedia).");
    },
    data: function () {
      return T("Tidak ada data yang dikirim ke mana pun: seluruh data contoh hidup di berkas JavaScript dan localStorage. Widget ini pun hanya menyimpan percakapan di peramban Anda.");
    },
    tanggal: function () {
      var waktu = new Date().toLocaleString(bahasa() === "en" ? "en-GB" : "id-ID",
        { dateStyle: "full", timeStyle: "short" });
      return T("Waktu sekarang:") + " " + waktu + " · " + T("jam di footer ikut berjalan sendiri.");
    },
    terima: function () {
      return T("Sama-sama! Senang bisa membantu. Kalau ada yang ingin dijelaskan lagi, tulis saja.");
    },
    lapor: function () {
      return T("Siap, saya catat: \"") + "{PESAN}" + T("\". Di mode simulasi saya belum bisa mengubah data, tetapi di produksi balasan ini bisa diarahkan ke API sungguhan.");
    },
    gagalApi: function (a) {
      return T("Gagal menghubungi API:") + " " + ((a && a.pesan) || "-") + " — " +
        T("saya kembali memakai jawaban simulasi lokal.");
    },
    fallback: function () {
      return T("Saya belum punya jawaban khusus untuk itu di mode simulasi. Coba kata kunci seperti tema, notifikasi, jadwal, QRIS, tabel, mobile, atau offline — atau sambungkan model sungguhan lewat window.AIChat.setProvider(fn).");
    }
  };

  var TOPIK = [
    { tmpl: "sapaan", cocok: /^(halo|hai|hi|hello|hei|hey|pagi|siang|sore|malam|assalam|permisi)\b/i },
    { tmpl: "terima", cocok: /(terima kasih|makasih|thanks|thank you|thx|mantap|keren)\b/i },
    { tmpl: "tanggal", cocok: /(jam berapa|tanggal berapa|hari apa|what time|what date|sekarang jam)\b/i },
    {
      tmpl: "tema", aksiTema: true,
      cocok: /\b(tema|gelap|terang|dark|light|theme|skin|warna|color|accent)\b/i
    },
    {
      tmpl: "notif", cocok: /\b(notif\w*|notification\w*|lonceng|bell|belum dibaca|unread)\b/i,
      kait: "notifications"
    },
    {
      tmpl: "jadwal", cocok: /\b(jadwal\w*|schedul\w*|autodebet|cron|job|terjadwal)\b/i,
      kait: "scheduler"
    },
    { tmpl: "qris", cocok: /\b(qris|qr code|kode qr|qr|bayar\w*|payment\w*)\b/i, kait: "qris" },
    { tmpl: "kartu", cocok: /\b(kartu|cards?|kredit|debit|limit|blokir)\b/i, kait: "kartu-qris" },
    {
      tmpl: "biometric", cocok: /\b(biometric|sidik jari|fingerprint|pin|kunci aplikasi|unlock)\b/i,
      kait: "mobile"
    },
    { tmpl: "mobile", cocok: /\b(mobile|ponsel|nasabah|seluler|hp|android|ios)\b/i, kait: "mobile" },
    { tmpl: "offline", cocok: /\b(offline|tanpa jaringan|tanpa internet|mandiri|single.?file|cdn|file:\/\/)\b/i },
    { tmpl: "grid", cocok: /\b(tabel|table|grid|minigrid|ag grid|ekspor|csv|paginasi)\b/i, kait: "tables" },
    { tmpl: "bahasa", cocok: /(bahasa|language|english|inggris|indonesia|terjemah|translat)/i },
    { tmpl: "login", cocok: /\b(login|masuk|otp|splash|kata sandi|password|daftar akun|register)\b/i, kait: "login" },
    { tmpl: "data", cocok: /\b(data|privasi|privacy|api|server|lokal|localstorage|aman|keamanan data)\b/i },
    { tmpl: "kapabilitas", cocok: /(apa yang bisa|bisa apa|bantuan|bantu\b|help|fitur apa|kamu siapa|siapa kamu|what can you|who are you)/i },
    { tmpl: "template", cocok: /(template|adminlte|aurivo|apa ini|apa itu|tentang|what is this|about)/i }
  ];

  function cariTopik(pesan) {
    for (var i = 0; i < TOPIK.length; i++) {
      if (TOPIK[i].cocok.test(pesan)) return TOPIK[i];
    }
    return null;
  }

  /* Balasan untuk satu pesan: { tmpl, args, aksi[], tautan[] } */
  function pikirkan(pesan) {
    var topik = cariTopik(pesan);
    if (!topik) return { tmpl: "fallback", saran: true };

    /* Tema: sekalian dikerjakan, bukan hanya dijelaskan. */
    if (topik.aksiTema) {
      var jadiGelap = gantiTema();
      return { tmpl: "tema", args: { gelap: jadiGelap }, aksi: [aksiJalankanTema()] };
    }
    if (topik.tmpl === "notif") {
      var n = jumlahBelumDibaca();
      return {
        tmpl: "notif", args: { jumlah: n },
        aksi: [tautan("notifications", "Buka Pusat Notifikasi")],
        saran: true
      };
    }
    if (topik.tmpl === "kapabilitas") return { tmpl: "kapabilitas", saran: true };

    var aksi = [];
    if (topik.kait) aksi.push(tautan(topik.kait, "Buka halaman ini"));
    if (topik.tmpl === "mobile") aksi.push(tautan("index", "Kembali ke dashboard"));
    return { tmpl: topik.tmpl, aksi: aksi, saran: topik.tmpl === "template" || topik.tmpl === "offline" };
  }

  /* ------------------------------------------------------------ tema & notifikasi */
  function jumlahBelumDibaca() {
    try {
      var lingkup = dalamPonsel() ? "mobile" : "admin";
      if (window.Alpine && window.Alpine.store("notif")) return window.Alpine.store("notif").belum(lingkup);
      return document.querySelectorAll('[data-notif-baris][data-baca="0"]').length;
    } catch (e) { return 0; }
  }
  /* Mengembalikan true bila sekarang mode gelap. */
  function gantiTema() {
    var html = document.documentElement;
    var gelap = html.getAttribute("data-theme") !== "dark";
    try {
      if (window.Alpine && window.Alpine.store("ui") && window.Alpine.store("ui").setTheme) {
        window.Alpine.store("ui").setTheme(gelap ? "dark" : "light");
        return gelap;
      }
    } catch (e) { /* Alpine belum siap */ }
    html.setAttribute("data-theme", gelap ? "dark" : "light");
    try { localStorage.setItem("app.theme", gelap ? "dark" : "light"); } catch (e) {}
    window.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme: gelap ? "dark" : "light" } }));
    return gelap;
  }

  /* ------------------------------------------------------------ state */
  var state = muat();
  if (!Array.isArray(state.riwayat)) state.riwayat = [];
  var el = {};            // simpul DOM
  var terbuka = false;
  var mengetik = false;
  var belumDibaca = 0;
  var provider = null;

  /* ------------------------------------------------------------ bangun DOM */
  function svgIkon(nama, ukuran) {
    // ikon resmi template (assets/js/icons.js) bila ada, kalau tidak teks biasa
    var i = document.createElement("i");
    i.setAttribute("data-icon", nama);
    i.setAttribute("data-size", String(ukuran || 16));
    return i;
  }
  function tombolIkon(nama, label, ukuran) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "aichat-ikon-tombol";
    b.setAttribute("aria-label", label);
    b.setAttribute("title", label);
    b.appendChild(svgIkon(nama, ukuran || 14));
    return b;
  }

  function bangun() {
    var root = document.createElement("div");
    root.className = "aichat no-print" + (dalamPonsel() ? " aichat-dalam-app" : "");
    root.id = "aichat";
    root.setAttribute("data-buka", "0");

    /* --- panel --- */
    var panel = document.createElement("div");
    panel.className = "aichat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.hidden = true;

    var kepala = document.createElement("div");
    kepala.className = "aichat-kepala";
    var avatar = document.createElement("span");
    avatar.className = "aichat-avatar";
    avatar.appendChild(svgIkon("robot", 18));
    var idn = document.createElement("div");
    idn.className = "aichat-identitas";
    el.judul = document.createElement("b");
    el.judul.className = "aichat-judul";
    var sub = document.createElement("span");
    sub.className = "aichat-sub";
    var dot = document.createElement("span");
    dot.className = "aichat-dot";
    el.subTeks = document.createElement("span");
    sub.appendChild(dot);
    sub.appendChild(el.subTeks);
    idn.appendChild(el.judul);
    idn.appendChild(sub);
    var aksiKepala = document.createElement("div");
    aksiKepala.className = "aichat-aksi-kepala";
    el.btnBersih = tombolIkon("arrow-clockwise", "", 14);
    el.btnPerkecil = tombolIkon("dash", "", 14);
    el.btnTutup = tombolIkon("x-lg", "", 14);
    aksiKepala.appendChild(el.btnBersih);
    aksiKepala.appendChild(el.btnPerkecil);
    aksiKepala.appendChild(el.btnTutup);
    kepala.appendChild(avatar);
    kepala.appendChild(idn);
    kepala.appendChild(aksiKepala);

    /* --- daftar pesan --- */
    el.isi = document.createElement("div");
    el.isi.className = "aichat-isi";
    el.isi.setAttribute("role", "log");
    el.isi.setAttribute("aria-live", "polite");
    el.isi.setAttribute("aria-label", LABEL.mengetik());

    /* --- saran cepat --- */
    el.saran = document.createElement("div");
    el.saran.className = "aichat-saran";
    el.saran.setAttribute("role", "group");
    el.saran.setAttribute("aria-label", LABEL.saran());

    /* --- kaki --- */
    var kaki = document.createElement("form");
    kaki.className = "aichat-kaki";
    el.input = document.createElement("input");
    el.input.className = "aichat-input";
    el.input.type = "text";
    el.input.autocomplete = "off";
    el.input.setAttribute("aria-label", LABEL.tanya());
    el.btnKirim = document.createElement("button");
    el.btnKirim.type = "submit";
    el.btnKirim.className = "aichat-kirim";
    el.btnKirim.appendChild(svgIkon("send-fill", 15));
    kaki.appendChild(el.input);
    kaki.appendChild(el.btnKirim);

    el.catatan = document.createElement("p");
    el.catatan.className = "aichat-catatan";

    panel.appendChild(kepala);
    panel.appendChild(el.isi);
    panel.appendChild(el.saran);
    panel.appendChild(kaki);
    panel.appendChild(el.catatan);

    /* --- tombol peluncur + balon teaser --- */
    el.teaser = document.createElement("button");
    el.teaser.type = "button";
    el.teaser.className = "aichat-teaser";
    el.teaser.hidden = true;
    el.tombol = document.createElement("button");
    el.tombol.type = "button";
    el.tombol.className = "aichat-tombol";
    el.tombol.appendChild(svgIkon("chat-dots-fill", 20));
    el.lencana = document.createElement("span");
    el.lencana.className = "aichat-lencana";
    el.lencana.hidden = true;
    el.tombol.appendChild(el.lencana);

    root.appendChild(panel);
    root.appendChild(el.teaser);
    root.appendChild(el.tombol);
    (dalamPonsel() ? document.querySelector(".mobile-app") : document.body).appendChild(root);
    el.root = root;
    el.panel = panel;
    el.kaki = kaki;
  }

  /* ------------------------------------------------------------ gambar ulang teks UI */
  function segarkanLabel() {
    el.judul.textContent = LABEL.judul();
    el.subTeks.textContent = LABEL.sub();
    el.input.placeholder = LABEL.tanya();
    el.input.setAttribute("aria-label", LABEL.tanya());
    el.btnKirim.setAttribute("aria-label", LABEL.kirim());
    el.btnKirim.setAttribute("title", LABEL.kirim());
    el.btnTutup.setAttribute("aria-label", LABEL.tutup());
    el.btnTutup.setAttribute("title", LABEL.tutup());
    el.btnPerkecil.setAttribute("aria-label", LABEL.perkecil());
    el.btnPerkecil.setAttribute("title", LABEL.perkecil());
    el.btnBersih.setAttribute("aria-label", LABEL.bersihkan());
    el.btnBersih.setAttribute("title", LABEL.bersihkan());
    el.tombol.setAttribute("aria-label", LABEL.buka());
    el.teaser.textContent = LABEL.teaser();
    el.catatan.textContent = LABEL.catatan();
    el.isi.setAttribute("aria-label", LABEL.mengetik());
    el.saran.setAttribute("aria-label", LABEL.saran());
    segarkanSaran();
  }
  function segarkanSaran() {
    el.saran.textContent = "";
    SARAN.forEach(function (fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = fn();
      b.addEventListener("click", function () { kirim(fn()); });
      el.saran.appendChild(b);
    });
  }

  /* ------------------------------------------------------------ render pesan */
  function teksPesan(p) {
    if (p.tmpl && TEKS[p.tmpl]) {
      var out = TEKS[p.tmpl](p.args);
      if (p.tmpl === "lapor") out = out.replace("{PESAN}", p.args && p.args.pesan ? p.args.pesan : "");
      return out;
    }
    return p.teks || "";
  }
  function gambarPesan(p, animate) {
    var baris = document.createElement("div");
    baris.className = "aichat-baris";
    baris.setAttribute("data-dari", p.dari === "saya" ? "saya" : "ai");
    var muka = document.createElement("span");
    muka.className = "aichat-muka";
    muka.appendChild(svgIkon(p.dari === "saya" ? "person" : "robot", 12));
    var balon = document.createElement("div");
    balon.className = "aichat-balon";
    balon.textContent = teksPesan(p);
    if (p.jam) {
      var jam = document.createElement("span");
      jam.className = "aichat-jam";
      jam.textContent = p.jam;
      balon.appendChild(jam);
    }
    /* tautan aksi (selalu dibangun ulang, ikut bahasa terbaru) */
    (p.aksi || []).forEach(function (a) {
      if (a.href) {
        var link = document.createElement("a");
        link.className = "aichat-tautan";
        link.href = a.href;
        link.textContent = a.label;
        if (/^https?:/.test(a.href)) { link.target = "_blank"; link.rel = "noopener"; }
        balon.appendChild(link);
      } else {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "aichat-tautan";
        b.textContent = a.label;
        b.addEventListener("click", function () { jalankanAksi(a.aksi); });
        balon.appendChild(b);
      }
    });
    baris.appendChild(muka);
    baris.appendChild(balon);
    if (animate) baris.setAttribute("data-baru", "1");
    el.isi.appendChild(baris);
    gulirBawah();
    return baris;
  }
  function gulirBawah() {
    el.isi.scrollTop = el.isi.scrollHeight;
  }
  function gambarSemua() {
    el.isi.textContent = "";
    state.riwayat.forEach(function (p) { gambarPesan(p, false); });
  }
  function tampilkanMengetik() {
    var baris = document.createElement("div");
    baris.className = "aichat-baris";
    baris.setAttribute("data-mengetik", "1");
    var muka = document.createElement("span");
    muka.className = "aichat-muka";
    muka.appendChild(svgIkon("robot", 12));
    var balon = document.createElement("div");
    balon.className = "aichat-balon";
    var ind = document.createElement("span");
    ind.className = "aichat-mengetik";
    ind.setAttribute("aria-label", LABEL.mengetik());
    ind.appendChild(document.createElement("span"));
    ind.appendChild(document.createElement("span"));
    ind.appendChild(document.createElement("span"));
    balon.appendChild(ind);
    baris.appendChild(muka);
    baris.appendChild(balon);
    el.isi.appendChild(baris);
    gulirBawah();
    return baris;
  }

  /* ------------------------------------------------------------ aksi */
  function jalankanAksi(nama) {
    if (nama === "tema") {
      var gelap = gantiTema();
      tambahAi({ tmpl: "tema", args: { gelap: gelap }, aksi: [aksiJalankanTema()] }, true);
    }
  }

  /* ------------------------------------------------------------ alur pesan */
  function simpanRiwayat() {
    state.riwayat = state.riwayat.slice(-MAKS);
    state.buka = terbuka ? 1 : 0;
    simpan(state);
  }
  function tambah(p, animate) {
    state.riwayat.push(p);
    simpanRiwayat();
    if (!el.isi) return;
    gambarPesan(p, animate);
    if (!terbuka && p.dari === "ai") {
      belumDibaca++;
      segarkanLencana();
    }
  }
  function tambahAi(p, animate) { tambah(Object.assign({ dari: "ai", jam: jamKini() }, p), animate); }

  /* Kirim pesan pengguna → balasan (provider bila ada, kalau tidak simulasi). */
  function kirim(teks) {
    teks = (teks || "").trim();
    if (!teks || mengetik) return Promise.resolve("");
    tambah({ dari: "saya", teks: teks, jam: jamKini() }, true);
    state.kenal = 1;
    simpanRiwayat();
    if (el.input) el.input.value = "";
    mengetik = true;
    el.btnKirim.disabled = true;
    var barisKetik = tampilkanMengetik();

    var selesai = function (balas) {
      barisKetik.remove();
      mengetik = false;
      el.btnKirim.disabled = false;
      tambahAi(balas, true);
      return balas.tmpl;
    };
    var gagal = function (err) {
      barisKetik.remove();
      mengetik = false;
      el.btnKirim.disabled = false;
      if (provider) tambahAi({ tmpl: "gagalApi", args: { pesan: err && err.message ? err.message : "" }, saran: true }, true);
      else tambahAi({ tmpl: "fallback", saran: true }, true);
    };

    return new Promise(function (resolve) {
      setTimeout(function () {
        if (provider) {
          Promise.resolve(provider({ pesan: teks, riwayat: state.riwayat.slice(-12), bahasa: bahasa(), halaman: location.pathname }))
            .then(function (jawab) {
              if (jawab && typeof jawab === "object") {
                selesai({ tmpl: null, teks: String(jawab.teks || ""), aksi: jawab.tautan || [], saran: true });
              } else {
                selesai({ tmpl: null, teks: String(jawab == null ? "" : jawab), saran: true });
              }
              resolve("provider");
            })
            .catch(function (err) { gagal(err); resolve("gagal"); });
        } else {
          var balas = pikirkan(teks);
          selesai(balas);
          resolve(balas.tmpl);
        }
      }, provider ? 120 : acak(TUNDA_BALAS[0], TUNDA_BALAS[1]));
    });
  }

  /* ------------------------------------------------------------ buka/tutup */
  function segarkanLencana() {
    if (!el.lencana) return;
    if (belumDibaca > 0 && !terbuka) {
      el.lencana.hidden = false;
      el.lencana.textContent = belumDibaca > 9 ? "9+" : String(belumDibaca);
    } else {
      el.lencana.hidden = true;
    }
  }
  function sembunyikanTeaser() {
    if (el.teaser) el.teaser.hidden = true;
    try { sessionStorage.setItem("app.aiChat.teaser", "1"); } catch (e) {}
  }
  function buka(fokus) {
    if (terbuka) return;
    terbuka = true;
    belumDibaca = 0;
    segarkanLencana();
    sembunyikanTeaser();
    el.panel.hidden = false;
    el.root.setAttribute("data-buka", "1");
    el.tombol.setAttribute("aria-expanded", "true");
    if (fokus !== false && el.input) { try { el.input.focus({ preventScroll: true }); } catch (e) {} }
    simpanRiwayat();
  }
  function tutup(alasan) {
    if (!terbuka) return;
    terbuka = false;
    el.panel.hidden = true;
    el.root.setAttribute("data-buka", "0");
    el.tombol.setAttribute("aria-expanded", "false");
    if (alasan === "pengguna") { try { sessionStorage.setItem("app.aiChat.teaser", "1"); } catch (e) {} }
    simpanRiwayat();
  }
  function alihkan() { terbuka ? tutup("pengguna") : buka(); }

  function bersihkan() {
    state.riwayat = [];
    simpanRiwayat();
    gambarSemua();
    sambut();
  }

  /* ------------------------------------------------------------ sapaan awal */
  function sambut() {
    if (state.riwayat.length) return;
    tambahAi({ tmpl: "kapabilitas", saran: true }, true);
    tambahAi({ tmpl: "template", saran: true }, true);
  }

  /* ------------------------------------------------------------ pasang */
  function pasang() {
    if (el.root || document.getElementById("aichat")) return;
    bangun();
    segarkanLabel();
    gambarSemua();

    el.tombol.addEventListener("click", function () { alihkan(); });
    el.teaser.addEventListener("click", function () { buka(); });
    el.btnTutup.addEventListener("click", function () { tutup("pengguna"); });
    el.btnPerkecil.addEventListener("click", function () { tutup("pengguna"); });
    el.btnBersih.addEventListener("click", function () { bersihkan(); });
    el.kaki.addEventListener("submit", function (e) {
      e.preventDefault();
      kirim(el.input.value);
    });
    el.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim(el.input.value); }
    });
    el.panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") tutup("pengguna");
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && terbuka && document.activeElement === el.input) tutup("pengguna");
    });

    /* Bahasa berganti → label & semua balasan template digambar ulang. */
    window.addEventListener("i18n:changed", function () {
      segarkanLabel();
      gambarSemua();
    });

    /* Ikon (assets/js/icons.js lewat app.js) — gambar sekarang dan sekali lagi
       setelah semua berkas selesai dimuat, untuk jaga-jaga bila app.js belum siap. */
    if (window.renderIcons) window.renderIcons(el.root);
    window.addEventListener("load", function () {
      if (window.renderIcons) { try { window.renderIcons(el.root); } catch (e) {} }
    });

    /* Sapa saat kunjungan pertama; sesudah itu ikuti pilihan pengguna. */
    var pertama = state.kenal !== 1;
    if (pertama) {
      state.kenal = 1;
      simpanRiwayat();
      sambut();
      setTimeout(function () { buka(false); }, 900);
    } else if (state.buka === 1) {
      buka(false);
    } else if (!teaserSudahTampil()) {
      setTimeout(function () {
        if (!terbuka) { el.teaser.hidden = false; setTimeout(sembunyikanTeaser, 9000); }
      }, 1400);
    }
    if (state.riwayat.length && !terbuka) belumDibaca = 0;
    segarkanLencana();
  }
  function teaserSudahTampil() {
    try { return sessionStorage.getItem("app.aiChat.teaser") === "1"; } catch (e) { return true; }
  }

  /* ------------------------------------------------------------ API publik */
  var AIChat = {
    versi: "1.0.0",
    buka: function () { buka(); return true; },
    tutup: function () { tutup("pengguna"); return true; },
    alihkan: function () { alihkan(); return terbuka; },
    terbuka: function () { return terbuka; },
    kirim: function (teks) { buka(false); return kirim(teks); },
    bersihkan: function () { bersihkan(); return true; },
    riwayat: function () { return state.riwayat.slice(); },
    halaman: halaman,
    /* Ganti otak: fn({pesan, riwayat, bahasa, halaman}) → string | {teks, tautan} */
    setProvider: function (fn) {
      if (typeof fn !== "function" && fn !== null) return false;
      provider = fn || null;
      el.catatan.textContent = provider
        ? T("Model eksternal aktif lewat window.AIChat.setProvider().")
        : LABEL.catatan();
      return true;
    },
    provider: function () { return provider; },
    /* Uji cepat dari konsol: AIChat.tanya("tema") */
    tanya: function (teks) { buka(false); return kirim(teks); }
  };

  window.AIChat = AIChat;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pasang);
  else pasang();
})();
