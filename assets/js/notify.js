/*
 * notify.js — notifikasi "push" palsu + pusat notifikasi untuk template ini.
 *
 * Tidak ada server, jadi notifikasi:
 *   1. disimpan di localStorage (per lingkup: "mobile" = aplikasi nasabah, "admin" = dashboard),
 *   2. ditampilkan sebagai banner yang meluncur dari atas (seperti push notification),
 *   3. bisa dibaca/ditandai/hapus lewat Alpine store `$store.notif`.
 *
 *   Notify.push({ lingkup, judul, pesan, ikon, tone, kategori, klik, banner })
 *   Notify.banner(...)          → tampilkan banner saja
 *   Notify.uji('mobile'|'admin') → kirim notifikasi contoh acak
 *   Notify.waktu(iso)           → "baru saja" / "3 menit lalu" / tanggal
 *
 * Alpine store: $store.notif → { admin, mobile, lingkup(s), belum(s), push(o),
 *   baca(id,s), bacaSemua(s), hapus(id,s), hapusSemua(s), uji(s), waktu(iso) }
 */
(function () {
  "use strict";

  var KUNCI = "notif.v1";
  var MAKS = 60;
  function T(s) { return window.I18n && window.I18n.t ? window.I18n.t(s, s) : s; }

  /* ---------------------------------------------------------- contoh data */
  var CONTOH_ADMIN = [
    { judul: "Pesanan #INV-2041 sudah dibayar", pesan: "Rp 198.100 masuk ke rekening operasional.", ikon: "cart-check", tone: "success", kategori: "Transaksi", menit: 2 },
    { judul: "Stok Kopi Arabika di bawah minimum", pesan: "Sisa 12 kg dari batas 25 kg. Segera lakukan pemesanan.", ikon: "exclamation-triangle-fill", tone: "danger", kategori: "Peringatan", menit: 65, penting: true },
    { judul: "Pengguna baru mendaftar", pesan: "Nadia Maharani bergabung sebagai Staf Keuangan.", ikon: "person-plus", tone: "info", kategori: "Pengguna", menit: 18 },
    { judul: "Sinkronisasi data selesai", pesan: "1.284 baris dari cabang Bandung berhasil disinkronkan.", ikon: "arrow-clockwise", tone: "warning", kategori: "Sistem", menit: 180 },
    { judul: "Jadwal autodebet akan berjalan", pesan: "Autodebet tagihan PLN jatuh tempo besok pukul 06.00.", ikon: "calendar-check", tone: "info", kategori: "Jadwal", menit: 300 },
    { judul: "Percobaan masuk gagal 3x", pesan: "Akun admin@perusahaan.id dibatasi sementara di perangkat baru.", ikon: "shield-exclamation", tone: "danger", kategori: "Keamanan", menit: 420, penting: true }
  ];
  var CONTOH_MOBILE = [
    { judul: "Transfer berhasil", pesan: "Rp 2.000.000 terkirim ke Budi Santoso (BCA ••••3344).", ikon: "check2-circle", tone: "success", kategori: "Transaksi", menit: 6 },
    { judul: "Cashback QRIS 10%", pesan: "Anda mendapat cashback Rp 12.500 dari Kopi Nusantara.", ikon: "gift", tone: "success", kategori: "Promo", menit: 40 },
    { judul: "Tagihan listrik menunggu", pesan: "PLN pascabayar Rp 245.600 jatuh tempo 25 Sep.", ikon: "receipt", tone: "warning", kategori: "Tagihan", menit: 90, penting: true },
    { judul: "Perangkat baru masuk", pesan: "Ada masuk dari perangkat baru: Android 14 · Jakarta.", ikon: "shield-lock", tone: "info", kategori: "Keamanan", menit: 240 },
    { judul: "Autodebet aktif", pesan: "Top up GoPay Rp 100.000 dijalankan setiap Senin.", ikon: "calendar-check", tone: "info", kategori: "Jadwal", menit: 600 },
    { judul: "Bayar tagihan dapat poin", pesan: "Bayar 2 tagihan bulan ini → 500 poin ekstra.", ikon: "star", tone: "success", kategori: "Promo", menit: 1500 }
  ];

  function waktuDariMenit(menit) { return new Date(Date.now() - menit * 60000).toISOString(); }
  function buatContoh(lingkup) {
    var sumber = lingkup === "mobile" ? CONTOH_MOBILE : CONTOH_ADMIN;
    return sumber.map(function (c, i) {
      return {
        id: "NT-" + lingkup + "-" + (1000 + i), lingkup: lingkup, judul: c.judul, pesan: c.pesan,
        ikon: c.ikon, tone: c.tone || "info", kategori: c.kategori || "Sistem",
        waktu: waktuDariMenit(c.menit), baca: i > 2, penting: !!c.penting
      };
    });
  }

  /* ------------------------------------------------------------ penyimpanan */
  function muat() {
    try {
      var mentah = localStorage.getItem(KUNCI);
      if (mentah) {
        var d = JSON.parse(mentah);
        if (d && d.admin && d.mobile) return d;
      }
    } catch (e) {}
    var awal = { admin: buatContoh("admin"), mobile: buatContoh("mobile") };
    simpan(awal);
    return awal;
  }
  function simpan(d) {
    try { localStorage.setItem(KUNCI, JSON.stringify(d)); } catch (e) {}
  }

  /* -------------------------------------------------------------- waktu */
  function waktu(iso) {
    if (!iso) return "";
    var selisih = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (selisih < 45) return T("baru saja");
    if (selisih < 3600) return selisih < 120 ? T("1 menit lalu") : Math.round(selisih / 60) + " " + T("menit lalu");
    if (selisih < 86400) return Math.round(selisih / 3600) + " " + T("jam lalu");
    if (selisih < 172800) return T("kemarin");
    var d = new Date(iso);
    return d.getDate() + " " + T(["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getMonth()]) + " " + d.getFullYear();
  }

  /* -------------------------------------------------------------- banner */
  function hostBanner() {
    var hp = document.querySelector(".mobile-app");
    if (hp) {
      var lama = hp.querySelector(".push-host");
      if (!lama) { lama = document.createElement("div"); lama.className = "push-host"; hp.appendChild(lama); }
      return lama;
    }
    var b = document.body.querySelector(":scope > .push-host");
    if (!b) { b = document.createElement("div"); b.className = "push-host push-host-desktop"; document.body.appendChild(b); }
    return b;
  }
  var bannerAktif = null;

  function banner(o) {
    o = o || {};
    var host = hostBanner();
    if (!host) return null;
    if (bannerAktif && bannerAktif.parentNode) bannerAktif.parentNode.removeChild(bannerAktif);
    var kartu = document.createElement("div");
    kartu.className = "push-banner";
    kartu.setAttribute("role", "status");
    kartu.setAttribute("data-tone", o.tone || "info");
    kartu.innerHTML =
      '<span class="push-ikon"><i data-icon="' + (o.ikon || "bell-fill") + '" data-size="16"></i></span>' +
      '<span class="push-isi">' +
        '<b class="push-judul"></b>' +
        '<span class="push-pesan"></span>' +
        '<span class="push-waktu">' + (o.sekarang ? T("baru saja") : waktu(o.waktu)) + "</span>" +
      "</span>" +
      '<button type="button" class="push-tutup" aria-label="' + T("Tutup notifikasi") + '"><i data-icon="x-lg" data-size="12"></i></button>';
    kartu.querySelector(".push-judul").textContent = o.judul || T("Notifikasi baru");
    kartu.querySelector(".push-pesan").textContent = o.pesan || "";
    host.appendChild(kartu);
    if (window.renderIcons) window.renderIcons(kartu);
    requestAnimationFrame(function () { kartu.classList.add("masuk"); });
    bannerAktif = kartu;

    var timer = setTimeout(tutup, o.lama || 6500);
    function tutup() {
      clearTimeout(timer);
      kartu.classList.remove("masuk");
      setTimeout(function () { if (kartu.parentNode) kartu.parentNode.removeChild(kartu); }, 320);
    }
    kartu.querySelector(".push-tutup").addEventListener("click", function (e) { e.stopPropagation(); tutup(); });
    kartu.addEventListener("click", function () {
      tutup();
      if (typeof o.klik === "function") o.klik();
      else window.dispatchEvent(new CustomEvent("notify:open", { detail: { lingkup: o.lingkup || "admin" } }));
    });
    window.dispatchEvent(new CustomEvent("notify:banner", { detail: o }));
    return kartu;
  }

  var Notify = {
    versi: "1.0.0",
    banner: banner,
    waktu: waktu,

    /* kirim "push": simpan + banner */
    push: function (o) {
      o = o || {};
      var lingkup = o.lingkup === "mobile" ? "mobile" : "admin";
      var item = {
        id: o.id || "NT-" + lingkup + "-" + Math.floor(1000 + Math.random() * 8999),
        lingkup: lingkup, judul: o.judul || T("Notifikasi baru"), pesan: o.pesan || "",
        ikon: o.ikon || "bell-fill", tone: o.tone || "info", kategori: o.kategori || "Sistem",
        waktu: o.waktu || new Date().toISOString(), baca: false, penting: !!o.penting
      };
      if (window.Alpine && window.Alpine.store("notif")) window.Alpine.store("notif").tambah(lingkup, item);
      else {
        var d = muat();
        d[lingkup].unshift(item);
        d[lingkup] = d[lingkup].slice(0, MAKS);
        simpan(d);
      }
      if (o.banner !== false) banner(item);
      return item;
    },

    /* notifikasi contoh acak untuk demo tombol "Kirim notifikasi uji" */
    uji: function (lingkup) {
      lingkup = lingkup === "mobile" ? "mobile" : "admin";
      var bank = lingkup === "mobile"
        ? [
            { judul: "Pembayaran berhasil", pesan: "Tagihan IndiHome Rp 385.000 sudah dibayar.", ikon: "check2-circle", tone: "success", kategori: "Tagihan" },
            { judul: "Top up berhasil", pesan: "Saldo GoPay bertambah Rp 100.000.", ikon: "plus-circle", tone: "success", kategori: "Top up" },
            { judul: "Promo baru untuk Anda", pesan: "Diskon 20% di merchant QRIS pilihan akhir pekan ini.", ikon: "gift", tone: "info", kategori: "Promo" }
          ]
        : [
            { judul: "Laporan harian siap", pesan: "Rekap transaksi 18 Sep 2026 sudah tersedia.", ikon: "file-earmark-text", tone: "info", kategori: "Sistem" },
            { judul: "Job terjadwal dieksekusi", pesan: "Rekonsiliasi pagi selesai dalam 42 detik.", ikon: "calendar-check", tone: "success", kategori: "Jadwal" },
            { judul: "Ambang batas limit terlampaui", pesan: "Merchant ID1024 melewati limit harian.", ikon: "exclamation-triangle-fill", tone: "danger", kategori: "Peringatan", penting: true }
          ];
      var pilih = bank[Math.floor(Math.random() * bank.length)];
      return Notify.push(Object.assign({ lingkup: lingkup }, pilih));
    }
  };
  window.Notify = Notify;

  /* ------------------------------------------------------- Alpine store */
  document.addEventListener("alpine:init", function () {
    if (!window.Alpine) return;
    var d = muat();
    window.Alpine.store("notif", {
      admin: d.admin,
      mobile: d.mobile,
      lingkup: function (s) { return (s === "mobile" ? this.mobile : this.admin) || []; },
      belum: function (s) { return this.lingkup(s).filter(function (i) { return !i.baca; }).length; },
      tambah: function (s, item) {
        var arr = [item].concat(this.lingkup(s)).slice(0, MAKS);
        this[s === "mobile" ? "mobile" : "admin"] = arr;
        simpan({ admin: this.admin, mobile: this.mobile });
        window.dispatchEvent(new CustomEvent("notify:changed", { detail: { lingkup: s } }));
      },
      baca: function (id, s) {
        var kunci = s === "mobile" ? "mobile" : "admin";
        this[kunci] = this[kunci].map(function (i) { return i.id === id ? Object.assign({}, i, { baca: true }) : i; });
        simpan({ admin: this.admin, mobile: this.mobile });
      },
      belumBacaToggle: function (id, s) {
        var kunci = s === "mobile" ? "mobile" : "admin";
        this[kunci] = this[kunci].map(function (i) { return i.id === id ? Object.assign({}, i, { baca: !i.baca }) : i; });
        simpan({ admin: this.admin, mobile: this.mobile });
      },
      bacaSemua: function (s) {
        var kunci = s === "mobile" ? "mobile" : "admin";
        this[kunci] = this[kunci].map(function (i) { return Object.assign({}, i, { baca: true }); });
        simpan({ admin: this.admin, mobile: this.mobile });
        window.dispatchEvent(new CustomEvent("notify:changed", { detail: { lingkup: s } }));
      },
      hapus: function (id, s) {
        var kunci = s === "mobile" ? "mobile" : "admin";
        this[kunci] = this[kunci].filter(function (i) { return i.id !== id; });
        simpan({ admin: this.admin, mobile: this.mobile });
      },
      hapusSemua: function (s) {
        var kunci = s === "mobile" ? "mobile" : "admin";
        this[kunci] = [];
        simpan({ admin: this.admin, mobile: this.mobile });
      },
      hapusTerbaca: function (s) {
        var kunci = s === "mobile" ? "mobile" : "admin";
        this[kunci] = this[kunci].filter(function (i) { return !i.baca; });
        simpan({ admin: this.admin, mobile: this.mobile });
      },
      uji: function (s) { return Notify.uji(s); },
      waktu: function (iso) { return waktu(iso); },
      /* dipakai saat bahasa diganti agar label waktu ikut berubah */
      segarkan: function () { this.admin = this.admin.slice(); this.mobile = this.mobile.slice(); }
    });
  });
})();
