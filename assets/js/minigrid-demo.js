/*
 * minigrid-demo.js — integrasi MiniGrid (github.com/radianadhic/minigrid)
 * dengan template ini.
 *
 * Menyiapkan 6 contoh sesuai dokumentasi upstream (commit 5703470):
 *   1 → skala besar (50.000 baris) + virtual scroll + kolom beku + master-detail
 *   2 → CRUD lengkap (form modal) + edit inline + simpan ke localStorage
 *   3 → alur persetujuan (aksi Approve/Reject) + form filter + bantuan
 *   4 → aksi per baris (tanpa checkbox) + formulir 3 kolom
 *   5 → data dari API · tombol muat ulang · status muat (setLoading)
 *   6 → mode server-side: paging/sort/filter "di server" (10.000 baris)
 *
 * Pustaka MiniGrid-nya sendiri ada di assets/js/minigrid/grid.js (vanilla JS,
 * tanpa dependency). Warna & tema diatur oleh src/minigrid.css, jadi grid ikut
 * tema perbankan / mode gelap template tanpa konfigurasi tambahan.
 *
 * Dua hal yang memudahkan integrasi:
 *   • opsi `lang` diisi locale template (id/en) dan diperbarui lewat
 *     grid.setLang() saat peristiwa "i18n:changed" → label toolbar/pager/modal
 *     ikut berganti bahasa tanpa mengubah pustakanya;
 *   • contoh 5 menyediakan kait API sungguhan: setel MiniGridDemo.sumberAPI = "/api/karyawan"
 *     (opsi; template tetap jalan 100% offline karena ada simulasi bawaan).
 */
(function () {
  "use strict";

  if (!window.MiniGrid) return;

  /* ------------------------------------------------------- util kecil */
  function $(s) { return document.querySelector(s); }
  function T(s) { return window.I18n && window.I18n.t ? window.I18n.t(s, s) : s; }
  /* locale template → opsi `lang` MiniGrid (label bawaan pustaka ikut berganti) */
  function langSekarang() {
    return (window.I18n && window.I18n.locale === "en") ? "en" : "id";
  }
  function toast(pesan, jenis, judul) {
    if (window.toast) window.toast(pesan, jenis || "success", judul || T("Mini Grid"));
  }

  /* Data contoh deterministik (PRNG mulberry32) — sama setiap kali dibuka. */
  var seed = 20260917;
  function rnd() {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
  var int = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };

  var DEPAN = ["Adi", "Budi", "Citra", "Dewi", "Eko", "Fitri", "Gilang", "Hana", "Indra", "Joko", "Kirana", "Lukman", "Maya", "Nadia", "Omar", "Putri", "Qori", "Rina", "Sari", "Teguh", "Umi", "Vina", "Wahyu", "Yuni", "Zaki", "Agus", "Bella", "Candra", "Dimas", "Elsa", "Farhan", "Gita", "Hadi", "Intan", "Jaya", "Kelik", "Laras", "Marno", "Nita", "Okta", "Panji", "Rani", "Sigit", "Tari", "Ucup", "Vera", "Wawan", "Yanto", "Zulfan", "Ayu"];
  var BELAKANG = ["Saputra", "Wijaya", "Pratama", "Nugroho", "Setiawan", "Hidayat", "Kusuma", "Ramadhan", "Anggraini", "Lestari", "Susanto", "Maulana", "Permana", "Halim", "Siregar", "Nasution", "Pangestu", "Utami", "Firmansyah", "Handoko"];
  var DEP = ["Produksi", "Keuangan", "IT", "Pemasaran", "SDM", "Logistik", "QC", "Riset", "Legal", "Umum"];
  var JAB = ["Staf", "Senior Staf", "Supervisor", "Analis", "Manajer", "Kepala Seksi", "Direktur", "Koordinator"];
  var KOTA = ["Depok", "Jakarta", "Bogor", "Bekasi", "Tangerang", "Bandung", "Semarang", "Surabaya", "Medan", "Makassar", "Yogyakarta", "Denpasar"];
  var STAT = ["Aktif", "Cuti", "Probation", "Resign"];

  function iso(d) { return d.toISOString().slice(0, 10); }

  function rows(n) {
    var out = [], d;
    for (var i = 1; i <= n; i++) {
      d = new Date(2015 + int(0, 10), int(0, 11), int(1, 28));
      out.push({
        id: i,
        nama: pick(DEPAN) + " " + pick(BELAKANG),
        nik: "ID-" + String(100000 + i),
        dep: pick(DEP),
        jabatan: pick(JAB),
        kota: pick(KOTA),
        masuk: iso(d),
        gaji: int(45, 320) * 100000,
        skor: Math.round(rnd() * 1000) / 10,
        stat: pick(STAT),
        aktif: rnd() > 0.18
      });
    }
    return out;
  }

  /* ------------------------------------------------------------ kolom */
  var badge = {
    "Aktif": "bg-emerald-100 text-emerald-700",
    "Cuti": "bg-amber-100 text-amber-700",
    "Probation": "bg-sky-100 text-sky-700",
    "Resign": "bg-rose-100 text-rose-700"
  };
  var pill = function (v, map) {
    return '<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium ' +
      (map[v] || "bg-slate-100 text-slate-600") + '">' + v + "</span>";
  };

  var colsKaryawan = [
    { name: "id", label: "ID", width: 64, type: "num", align: "right", form: false },
    { name: "nama", label: "Nama Karyawan", width: 170, required: true },
    { name: "nik", label: "NIK", width: 96 },
    { name: "dep", label: "Departemen", width: 110 },
    { name: "jabatan", label: "Jabatan", width: 120 },
    { name: "kota", label: "Kota", width: 100 },
    { name: "masuk", label: "Tgl Masuk", width: 104, type: "date" },
    { name: "gaji", label: "Gaji / Bulan", width: 128, type: "num", format: "money", align: "right" },
    { name: "skor", label: "Skor", width: 70, type: "num", align: "right" },
    { name: "stat", label: "Status", width: 100, options: STAT, render: function (v) { return pill(v, badge); } },
    {
      name: "aktif", label: "Aktif", width: 60, type: "num", align: "center", bool: true,
      render: function (v) { return v ? '<span class="text-emerald-600">●</span>' : '<span class="text-slate-300">○</span>'; }
    }
  ];

  var JENIS = ["Cuti", "Sakit", "Izin"];
  var CAT = ["Acara keluarga", "Istirahat", "Urusan pribadi", "Demam", "Menjaga keluarga sakit", "Kerabat berkunjung"];
  var B3 = { "Pending": "bg-amber-100 text-amber-700", "Approved": "bg-emerald-100 text-emerald-700", "Rejected": "bg-rose-100 text-rose-700" };
  var colsCuti = [
    { name: "id", label: "No", width: 56, type: "num", align: "right", form: false },
    { name: "karyawan", label: "Nama Karyawan", width: 170, required: true },
    { name: "dep", label: "Departemen", width: 110 },
    { name: "jenis", label: "Jenis", width: 90, options: JENIS },
    { name: "mulai", label: "Tgl Mulai", width: 110, type: "date" },
    { name: "hari", label: "Hari", width: 70, type: "num", align: "right" },
    { name: "status", label: "Status", width: 100, options: ["Pending", "Approved", "Rejected"], render: function (v) { return pill(v, B3); } },
    { name: "catatan", label: "Catatan", width: 200 }
  ];

  var rows4 = [
    { id: 1, proyek: "Portal HR", pemilik: "Andini P.", dep: "SDM", pri: "Tinggi", tenggat: "2026-10-12", bobot: 40, status: "Berjalan", catatan: "Fase integrasi payroll" },
    { id: 2, proyek: "Datamart Sales", pemilik: "Bimo A.", dep: "Pemasaran", pri: "Menengah", tenggat: "2026-11-03", bobot: 25, status: "Berjalan", catatan: "Menunggu sumber data" },
    { id: 3, proyek: "Audit Akses", pemilik: "Citra M.", dep: "IT", pri: "Tinggi", tenggat: "2026-09-28", bobot: 70, status: "Berjalan", catatan: "Review izin trimestral" },
    { id: 4, proyek: "Renovasi Gudang", pemilik: "Dedi K.", dep: "Logistik", pri: "Rendah", tenggat: "2027-01-15", bobot: 10, status: "Tertunda", catatan: "Menunggu anggaran cair" },
    { id: 5, proyek: "Kampanye Q4", pemilik: "Eka S.", dep: "Pemasaran", pri: "Menengah", tenggat: "2026-12-01", bobot: 55, status: "Berjalan", catatan: "Materi kreatif direview" },
    { id: 6, proyek: "Migrasi ERP", pemilik: "Fajar N.", dep: "Keuangan", pri: "Tinggi", tenggat: "2027-02-20", bobot: 30, status: "Berjalan", catatan: "Modul GL selesai" },
    { id: 7, proyek: "SOP Keselamatan", pemilik: "Gita R.", dep: "Umum", pri: "Menengah", tenggat: "2026-10-30", bobot: 90, status: "Berjalan", catatan: "Finalisasi tanda tangan" },
    { id: 8, proyek: "Rekrutmen Massal", pemilik: "Andini P.", dep: "SDM", pri: "Tinggi", tenggat: "2026-09-25", bobot: 60, status: "Berjalan", catatan: "87 pelamar masuk" },
    { id: 9, proyek: "Optimasi Rute", pemilik: "Dedi K.", dep: "Logistik", pri: "Menengah", tenggat: "2026-12-18", bobot: 15, status: "Tertunda", catatan: "Perlu data GPS armada" },
    { id: 10, proyek: "Dashboard KPI", pemilik: "Bimo A.", dep: "IT", pri: "Rendah", tenggat: "2027-03-05", bobot: 45, status: "Berjalan", catatan: "Prototipe disetujui" },
    { id: 11, proyek: "Pelatihan Safety", pemilik: "Gita R.", dep: "SDM", pri: "Menengah", tenggat: "2026-11-20", bobot: 100, status: "Selesai", catatan: "3 angkatan lulus" },
    { id: 12, proyek: "Renegosiasi Vendor", pemilik: "Fajar N.", dep: "Keuangan", pri: "Menengah", tenggat: "2026-10-08", bobot: 80, status: "Berjalan", catatan: "Hemat 12% terproyeksi" },
    { id: 13, proyek: "Rebranding", pemilik: "Eka S.", dep: "Pemasaran", pri: "Rendah", tenggat: "2027-01-30", bobot: 20, status: "Tertunda", catatan: "Brief ulang dari direksi" },
    { id: 14, proyek: "Stock Opname", pemilik: "Dedi K.", dep: "Logistik", pri: "Tinggi", tenggat: "2026-09-30", bobot: 100, status: "Selesai", catatan: "Selisih 0,4%" }
  ];
  var B4 = {
    "Tinggi": "bg-rose-100 text-rose-700", "Menengah": "bg-amber-100 text-amber-700", "Rendah": "bg-slate-100 text-slate-600",
    "Berjalan": "bg-sky-100 text-sky-700", "Selesai": "bg-emerald-100 text-emerald-700", "Tertunda": "bg-amber-100 text-amber-700"
  };
  var colsProyek = [
    { name: "id", label: "No", width: 56, type: "num", align: "right", form: false },
    { name: "proyek", label: "Proyek", width: 150, required: true },
    { name: "pemilik", label: "Pemilik", width: 120, required: true },
    { name: "dep", label: "Departemen", width: 110 },
    { name: "pri", label: "Prioritas", width: 95, options: ["Rendah", "Menengah", "Tinggi"], render: function (v) { return pill(v, B4); } },
    { name: "tenggat", label: "Tenggat", width: 105, type: "date" },
    { name: "bobot", label: "Bobot %", width: 80, type: "num", align: "right" },
    { name: "status", label: "Status", width: 100, options: ["Berjalan", "Selesai", "Tertunda"], render: function (v) { return pill(v, B4); } },
    { name: "catatan", label: "Catatan", width: 190 }
  ];

  /* --------------------------------------------------------------- log */
  function log(teks) {
    var el = $("#mg-log");
    if (!el) return;
    el.textContent = teks + "  (" + new Date().toLocaleTimeString("id-ID") + ")";
  }
  function hitung(el, n) {
    var chip = el ? el.querySelector("[data-mg-count]") : null;
    if (chip) chip.textContent = n;
  }

  /* -------------------------------------------------------- muat ulang
     Dipakai tombol refresh di toolbar grid (opsi reload + onReload) dan
     navbar tiap halaman. Selama proses, overlay kunci layar (window.Lock)
     tampil supaya pengguna tahu data sedang diambil. */
  function jeda(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function muatUlang(no, kerja) {
    return function (g) {
      if (window.Lock) {
        window.Lock.show({
          mode: "load",
          title: T("Memuat data") + " " + T("Mini Grid") + " " + no,
          message: T("Menghubungkan ke sumber data contoh") + "…"
        });
      }
      log(T("memuat ulang data") + "…");
      return jeda(650 + Math.round(Math.random() * 450)).then(function () {
        kerja(g);
        g.s.page = 1; g.s.sel.clear(); g._skey = "";
        g.render();                       /* gambar ulang karena data sudah baru */
        if (window.Lock) window.Lock.hide();
        toast(T("Data dimuat ulang."), "success", T("Mini Grid") + " " + no);
        log(T("data dimuat ulang") + " · " + g.data.length + " " + T("baris"));
        hitung($("#minigrid-page-" + no), g.data.length);
        return g.data;
      });
    };
  }

  /* ------------------------------------------------- contoh 5 & 6: sumber data
     Dua contoh terakhir meniru grid yang datanya tidak ada di peramban:
     5) onRefresh → Promise (API), 6) server(params) → Promise {rows, total}.
     Tanpa server, keduanya memakai simulasi berlatensi supaya template tetap
     offline; kait ke API sungguhan cukup satu baris (lihat sumberAPI).     */
  var SUMBER = {};        /* no → function() yang merangkai teks status (ikut bahasa aktif) */
  function renderSumber(no) {
    var el = document.querySelector('[data-mg-sumber="' + no + '"]');
    if (el && SUMBER[no]) el.textContent = SUMBER[no]();
  }
  function tulisSumber(no, buatTeks) {
    SUMBER[no] = buatTeks;
    renderSumber(no);
  }
  function jamID() {
    try { return new Date().toLocaleTimeString(langSekarang() === "en" ? "en-GB" : "id-ID"); }
    catch (e) { return ""; }
  }

  function muatAPI(no, jumlah) {
    return function (g) {
      var sumberBagian = { jenis: "simulasi", alasan: "" };
      var sumberTeks = function () {
        if (sumberBagian.jenis === "api") return T("API") + " — GET " + sumberBagian.url;
        return T("simulasi API") + (sumberBagian.alasan ? " (" + T(sumberBagian.alasan) + ")" : "") + " · " + T("latensi 450 ms");
      };
      var selesai = function (list) {
        g.data = g.o.data = list;
        g.s.page = 1; g.s.sel.clear(); g._skey = "";
        g.render();
        tulisSumber(no, function () { return sumberTeks() + " · " + list.length + " " + T("baris") + " · " + jamID(); });
        hitung($("#minigrid-page-" + no), list.length);
        log(T("data diterima dari sumber data") + " · " + list.length + " " + T("baris"));
        return list;
      };
      if (window.Lock) {
        window.Lock.show({
          mode: "load",
          title: T("Memuat data") + " " + T("Mini Grid") + " " + no,
          message: T("Mengambil data dari API") + " · " + T("Menghubungkan ke sumber data contoh") + "…"
        });
      }
      var simulasi = function (alasan) {
        sumberBagian = { jenis: "simulasi", alasan: alasan || "" };
        return jeda(450).then(function () {
          seed = 20260919 + Math.floor(Math.random() * 100000);   /* data segar tiap panggilan */
          return selesai(tandaSegar(rows(jumlah)));
        });
      };
      var selesaiUmum = function () {
        if (window.Lock) window.Lock.hide();
        toast(T("Data dari API dimuat."), "success", T("Mini Grid") + " " + no);
      };
      /* kait API sungguhan (opsional): MiniGridDemo.sumberAPI = "/api/karyawan" */
      var url = Demo.sumberAPI;
      if (url && /^https?:/.test(location.protocol)) {
        return fetch(url).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (j) {
          var list = Array.isArray(j) ? j : (j.rows || []);
          sumberBagian = { jenis: "api", url: url };
          selesai(list);
          selesaiUmum();
          return list;
        }).catch(function () {
          return simulasi("server tidak terjangkau").then(function (l) { selesaiUmum(); return l; });
        });
      }
      return simulasi("jalankan npm run serve untuk contoh API").then(function (l) { selesaiUmum(); return l; });
    };
  }

  /* Muat ulang untuk mode server-side: permintaan diteruskan ke `server(params)`,
     jadi yang diambil hanya halaman yang sedang dilihat. */
  function muatHalaman(no) {
    return function (g) {
      if (window.Lock) {
        window.Lock.show({
          mode: "load",
          title: T("Memuat data") + " " + T("Mini Grid") + " " + no,
          message: T("Mengambil satu halaman dari server") + "…"
        });
      }
      log(T("memuat ulang data") + "…");
      g.render();                                  /* server: 200 ms debounce + latensi */
      return jeda(900).then(function () {
        if (window.Lock) window.Lock.hide();
        var jml = g.view ? g.view.length : 0;
        toast(T("Halaman dimuat ulang."), "success", T("Mini Grid") + " " + no);
        log(T("halaman dari server") + " · " + jml + " " + T("baris") + " · total " + g.s.total);
        return g.view;
      });
    };
  }

  /* Cermin logika endpoint /api/halaman (dipakai saat tak ada server). */
  function saringUrut(list, p) {
    var lv = function (r, k) { return String(r[k] == null ? "" : r[k]).toLowerCase(); };
    var satu = function (r, f) {
      var v = lv(r, f.f), t = String(f.q == null ? "" : f.q).toLowerCase();
      switch (f.op) {
        case "eq": return v === t;
        case "ne": return v !== t;
        case "bw": return v.indexOf(t) === 0;
        case "ew": return v.slice(-t.length) === t;
        case "nn": return v !== "";
        case "nl": return v === "";
        case "gt": return Number(r[f.f]) > Number(f.q);
        case "ge": return Number(r[f.f]) >= Number(f.q);
        case "lt": return Number(r[f.f]) < Number(f.q);
        case "le": return Number(r[f.f]) <= Number(f.q);
        default: return v.indexOf(t) > -1;
      }
    };
    var out = list;
    if (p.q) out = out.filter(function (r) {
      return Object.keys(r).some(function (k) { return lv(r, k).indexOf(p.q.toLowerCase()) > -1; });
    });
    Object.keys(p.filters || {}).forEach(function (k) {
      var f = p.filters[k];
      out = out.filter(function (r) { return satu(r, { f: k, op: f.op, q: f.q }); });
    });
    if ((p.rules || []).length) {
      out = out.filter(function (r) {
        var hasil = p.rules.map(function (f) { return satu(r, f); });
        return p.join === "OR" ? hasil.some(Boolean) : hasil.every(Boolean);
      });
    }
    if ((p.sort || []).length) {
      out = out.slice().sort(function (a, b) {
        for (var i = 0; i < p.sort.length; i++) {
          var k = p.sort[i][0], d = p.sort[i][1];
          if (a[k] < b[k]) return -d;
          if (a[k] > b[k]) return d;
        }
        return 0;
      });
    }
    return out;
  }

  var SERVER10 = null;
  function fungsiServer(no) {
    return function (p) {
      var kerja = function (nyata, url) {
        if (!SERVER10) SERVER10 = rows(10000);
        var hasil = saringUrut(SERVER10, p);
        var rowsPage = hasil.slice((p.page - 1) * p.size, p.page * p.size);
        var total = hasil.length, semua = SERVER10.length, hal = p.page;
        tulisSumber(no, function () {
          return (nyata ? T("server") + " — GET " + url + " · " + semua + " " + T("baris")
                        : T("simulasi server-side") + " · " + total + " / " + semua + " " + T("baris")) +
            " · " + T("halaman") + " " + hal + " · " + T("latensi 300 ms") + " · " + jamID();
        });
        hitung(document.getElementById("minigrid-page-" + no), rowsPage.length);
        return { rows: rowsPage, total: total };
      };
      /* kait API sungguhan (opsional): MiniGridDemo.sumberServer = "/api/halaman" */
      var url = Demo.sumberServer;
      if (url && /^https?:/.test(location.protocol)) {
        var qs = new URLSearchParams();
        ["page", "size", "q", "join"].forEach(function (k) { qs.set(k, p[k]); });
        qs.set("sort", JSON.stringify(p.sort || []));
        qs.set("filters", JSON.stringify(p.filters || {}));
        qs.set("rules", JSON.stringify(p.rules || []));
        return fetch(url + "?" + qs).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (j) {
          return j;
        }).catch(function () {
          return jeda(300).then(function () {
            var h = kerja(false, url);
            return h;
          });
        });
      }
      return jeda(300).then(function () {
        var h = kerja(false, "");
        log(T("halaman dari server") + " · " + h.rows.length + " " + T("baris") + " · total " + h.total);
        return h;
      });
    };
  }
  /* Data acak bisa saja kebetulan sama; satu nilai numerik digeser supaya
     hasil muat ulang selalu terlihat berubah di baris pertama. */
  function tandaSegar(list) {
    if (!list || !list.length) return list;
    var r = list[0];
    if (typeof r.bobot === "number") r.bobot = (r.bobot % 100) + 1;
    else if (typeof r.gaji === "number") r.gaji = (r.gaji % 40000000) + 4500000;
    else if (typeof r.skor === "number") r.skor = Math.round((r.skor % 99) * 10 + 11) / 10;
    return list;
  }

  function segarkanProyek(list) {
    return tandaSegar(list.map(function (r) {
      var salinan = Object.assign({}, r);
      salinan.status = pick(["Berjalan", "Berjalan", "Selesai", "Berjalan", "Tertunda"]);
      salinan.pri = pick(["Tinggi", "Menengah", "Menengah", "Rendah"]);
      salinan.bobot = Math.max(5, Math.min(100, salinan.bobot + int(-15, 15)));
      return salinan;
    }));
  }

  /* --------------------------------------------------- 4 konfigurasi */
  var KEY2 = "template-minigrid-2";

  function muat2() {
    var simpan = null;
    try { simpan = JSON.parse(localStorage.getItem(KEY2) || "null"); } catch (e) { simpan = null; }
    return Array.isArray(simpan) && simpan.length ? simpan : rows(12);
  }
  function simpan2() {
    var g = window.MiniGridDemo.grid[2];
    try { localStorage.setItem(KEY2, JSON.stringify(g.data)); } catch (e) { /* mode privat */ }
  }

  function rowsCuti() {
    var out = [];
    for (var i = 1; i <= 40; i++) {
      out.push({
        id: i,
        karyawan: pick(DEPAN) + " " + pick(BELAKANG),
        dep: pick(DEP),
        jenis: pick(JENIS),
        mulai: iso(new Date(2026, int(0, 11), int(1, 28))),
        hari: int(1, 10),
        status: pick(["Pending", "Pending", "Approved", "Rejected"]),
        catatan: pick(CAT)
      });
    }
    return out;
  }

  var KONFIG = {
    1: function (el) {
      return {
        el: "#minigrid-1", columns: colsKaryawan, data: rows(50000),
        lang: langSekarang(),
        frozen: 2, height: 460, rowHeight: 30, pageSize: 500,
        pageSizes: [100, 500, 1000, 5000, 50000],
        help: true,
        /* master-detail: chevron kiri tiap baris membentang riwayat karyawan */
        detail: function (r) {
          var PERISTIWA = [T("Penyesuaian gaji berkala"), T("Perpanjangan kontrak"), T("Mutasi antardepartemen"),
                           T("Sertifikasi internal"), T("Cuti tahunan diambil"), T("Review kinerja semester")];
          var OLEH = ["HRIS", "Manajer", "SDM"];   /* data contoh, bukan label UI */
          var p2 = function (x) { return String(x).padStart(2, "0"); };
          var out = '<table class="w-full text-[11px] text-slate-600"><thead><tr>' +
            [T("Tanggal"), T("Peristiwa"), T("Oleh")].map(function (t) {
              return '<th class="px-2 py-0.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">' + t + "</th>";
            }).join("") + "</tr></thead><tbody>";
          for (var k = 0; k < 4; k++) {
            out += '<tr class="border-t border-slate-200"><td class="px-2 py-1">' +
              (2016 + ((r.id + k * 3) % 9)) + "-" + p2(1 + (r.id + k) % 12) + "-" + p2(1 + (r.id * 7 + k) % 27) +
              '</td><td class="px-2 py-1">' + PERISTIWA[(r.id + k) % PERISTIWA.length] +
              '</td><td class="px-2 py-1">' + OLEH[(r.id + k) % 3] + "</td></tr>";
          }
          return out + "</tbody></table>";
        },
        onRefresh: muatUlang(1, function (g) {
          seed = 20260917 + Math.floor(Math.random() * 100000);   /* data baru tiap muat ulang */
          g.data = tandaSegar(rows(50000));
        }),
        onSelect: function (ids) { log(T("pilih") + " " + ids.length + " " + T("baris")); }
      };
    },
    2: function (el) {
      return {
        el: "#minigrid-2", columns: colsKaryawan, data: muat2(),
        lang: langSekarang(),
        height: 300, rowHeight: 30, pageSize: 10, frozen: 0,
        crud: true, edit: true,
        onRefresh: muatUlang(2, function (g) { g.data = muat2(); }),
        onAdd: function (r) {
          var g = window.MiniGridDemo.grid[2];
          r.id = (g.data.length ? Math.max.apply(null, g.data.map(function (x) { return x.id; })) : 0) + 1;
          if (!r.nama) r.nama = "Karyawan Baru";
          if (!r.nik) r.nik = "ID-" + (100000 + r.id);
          if (!r.dep) r.dep = "Umum";
          if (!r.jabatan) r.jabatan = "Staf";
          if (!r.kota) r.kota = "Depok";
          if (!r.masuk) r.masuk = iso(new Date());
          if (r.gaji == null || r.gaji === "") r.gaji = 6000000;
          if (r.skor == null || r.skor === "") r.skor = 70;
          if (!r.stat) r.stat = "Probation";
          if (r.aktif == null) r.aktif = 1;
          log(T("tambah baris") + " #" + r.id);
          return r;
        },
        onEdit: function (row, col, val, old) { log(T("edit") + " " + row.nama + " → " + col + ": " + old + " ⇒ " + val); simpan2(); },
        onSave: function (row, isNew) { log((isNew ? T("simpan baru") : T("simpan edit")) + " #" + row.id); simpan2(); },
        onRemove: function (rws) {
          log(T("hapus") + " " + rws.length + " " + T("baris"));
          setTimeout(simpan2, 0);
          return true;                     /* tanpa confirm(): template punya dialog sendiri */
        }
      };
    },
    3: function (el) {
      return {
        el: "#minigrid-3", columns: colsCuti, data: rowsCuti(),
        lang: langSekarang(),
        height: 360, rowHeight: 30, pageSize: 10,
        crud: true, edit: true,
        filter: false, filterForm: true, help: true, formCols: 2,
        onRefresh: muatUlang(3, function (g) { g.data = rowsCuti(); }),
        actions: [
          {
            id: "approve", label: T("Setujui"), icon: "ok", need: "some",
            fn: function (rowsTerpilih, g) {
              rowsTerpilih.forEach(function (r) { r.status = "Approved"; });
              g.render(); log(T("setujui") + " " + rowsTerpilih.length + " " + T("pengajuan"));
              toast(rowsTerpilih.length + " " + T("pengajuan disetujui."), "success");
            }
          },
          {
            id: "reject", label: T("Tolak"), icon: "no", need: "some",
            fn: function (rowsTerpilih, g) {
              rowsTerpilih.forEach(function (r) { r.status = "Rejected"; });
              g.render(); log(T("tolak") + " " + rowsTerpilih.length + " " + T("pengajuan"));
              toast(rowsTerpilih.length + " " + T("pengajuan ditolak."), "warning");
            }
          }
        ],
        onAdd: function (r) {
          var g = window.MiniGridDemo.grid[3];
          r.id = (g.data.length ? Math.max.apply(null, g.data.map(function (x) { return x.id; })) : 0) + 1;
          if (!r.status) r.status = "Pending";
          log(T("pengajuan baru") + " #" + r.id);
          return r;
        },
        onSave: function (row, isNew) { log((isNew ? T("simpan baru") : T("simpan edit")) + " #" + row.id); },
        onEdit: function (row, col, val, old) { log(T("edit") + " #" + row.id + " " + col + ": " + old + " ⇒ " + val); },
        onRemove: function (rws) { log(T("hapus") + " " + rws.length + " " + T("baris")); return true; }
      };
    },
    4: function (el) {
      return {
        el: "#minigrid-4", columns: colsProyek, data: rows4.slice(),
        lang: langSekarang(),
        height: 380, rowHeight: 30, pageSize: 8,
        select: false, rowActions: true,
        add: true, editForm: true, formCols: 3,
        onRefresh: muatUlang(4, function (g) { g.data = segarkanProyek(rows4); }),
        filter: false, filterForm: true, help: true,
        onAdd: function (r) {
          var g = window.MiniGridDemo.grid[4];
          r.id = (g.data.length ? Math.max.apply(null, g.data.map(function (x) { return x.id; })) : 0) + 1;
          if (!r.status) r.status = "Berjalan";
          log(T("proyek baru") + " #" + r.id);
          return r;
        },
        onSave: function (row, isNew) { log((isNew ? T("simpan baru") : T("simpan edit")) + " #" + row.id); }
      };
    },

    /* 5 → data dari API: kolom kosong dulu, diisi oleh onRefresh (Promise) */
    5: function (el) {
      return {
        el: "#minigrid-5", columns: colsKaryawan, data: [],
        lang: langSekarang(),
        height: 340, rowHeight: 30, pageSize: 10, frozen: 1,
        filter: false, filterForm: true, help: true, formCols: 2,
        onRefresh: muatAPI(5, 500),
        onSelect: function (ids) { log(T("pilih") + " " + ids.length + " " + T("baris")); }
      };
    },

    /* 6 → mode server-side: paging/sort/filter dikerjakan "server" (10.000 baris) */
    6: function (el) {
      return {
        el: "#minigrid-6", columns: colsKaryawan, data: [],
        lang: langSekarang(),
        height: 340, rowHeight: 30, pageSize: 10, frozen: 1,
        filter: false, filterForm: true, help: true, formCols: 2,
        server: fungsiServer(6),
        onRefresh: muatHalaman(6)
      };
    }
  };

  /* ------------------------------------------------------------- API */
  var Demo = {
    grid: {},
    siap: false,
    log: log,

    /* muat ulang / bangun grid pada halaman aktif */
    /* kait API sungguhan (opsional) — kosongkan untuk memakai simulasi offline */
    sumberAPI: null,      /* mis. "/api/karyawan" — dipakai contoh 5 */
    sumberServer: null,   /* mis. "/api/halaman"  — dipakai contoh 6 */

    init: function () {
      var dibangun = 0;
      [1, 2, 3, 4, 5, 6].forEach(function (no) {
        var host = document.getElementById("minigrid-" + no);
        if (!host) return;
        if (Demo.grid[no]) { try { Demo.grid[no].el.innerHTML = ""; } catch (e) { /* abaikan */ } }
        Demo.grid[no] = window.MiniGrid(KONFIG[no](host));
        dibangun++;
      });
      if (!dibangun) return Demo;
      Demo.siap = true;
      /* pastikan label grid langsung ikut bahasa aktif (mesin i18n juga memantau
         perubahan DOM, jadi teks yang dirender ulang tetap diterjemahkan) */
      if (window.I18n && window.I18n.apply) window.I18n.apply();

      var hitungSemua = function () {
        [1, 2, 3, 4].forEach(function (no) {
          if (Demo.grid[no]) hitung(document.getElementById("minigrid-page-" + no), Demo.grid[no].data.length);
        });
      };
      hitungSemua();

      /* Contoh 5 memuat datanya lewat jalur yang sama dengan tombol muat ulang. */
      if (Demo.grid[5]) {
        Demo.grid[5].o.onRefresh(Demo.grid[5]);
      }
      /* Contoh 6 mengisi dirinya sendiri: mode server memanggil `server(params)`
         saat grid pertama kali dirender (tanpa data di dalam peramban). */

      window.addEventListener("i18n:changed", function () {
        /* status sumber data (contoh 5 & 6) dirangkai ulang dalam bahasa aktif */
        Object.keys(SUMBER).forEach(function (no) { renderSumber(no); });
        /* label bawaan MiniGrid (toolbar, pager, modal, bantuan) ikut bahasa aktif */
        [1, 2, 3, 4, 5, 6].forEach(function (no) {
          var g = Demo.grid[no];
          if (!g || !g.setLang) return;
          g.setLang(langSekarang());
          /* aria-label area gulir disetel sekali oleh pustaka, jadi disegarkan di sini */
          var sc = g.el.querySelector('[data-role=scroller]');
          if (sc) sc.setAttribute("aria-label", g.tr("ariaTable"));
        });
        if (window.I18n && window.I18n.apply) window.I18n.apply();
      });
      return Demo;
    },

    jumlah: function (no) { return this.grid[no] ? this.grid[no].data.length : 0; },
    pilihan: function (no) { return this.grid[no] ? this.grid[no].selected().length : 0; },

    pilihSemua: function (no) {
      var g = this.grid[no];
      if (!g || !g.o.select) return 0;
      var semua = g.o.selectAll === "all" ? g.view : g.pageRows;
      semua.forEach(function (r, i) { g.s.sel.add(g.idOf(r, i)); });
      g._paint(true); g._fire();
      return g.selected().length;
    },
    bersihkanPilihan: function (no) {
      var g = this.grid[no];
      if (!g) return 0;
      g.clearSel();
      return 0;
    },

    /* buka formulir Tambah (form modal bawaan MiniGrid) */
    tambahBaris: function (no) {
      var g = this.grid[no];
      if (!g) return false;
      g._form("add");
      return true;
    },
    hapusTerpilih: function (no) {
      var g = this.grid[no];
      if (!g) return false;
      g._doRemove(g.selected());
      return true;
    },

    /* aksi khas halaman */
    eksporCsv: function (no) {
      var g = this.grid[no];
      if (!g) return false;
      g.toCSV();
      toast(T("CSV diunduh dari MiniGrid."), "success", T("Ekspor"));
      return true;
    },
    eksporXlsx: function (no) {
      var g = this.grid[no];
      if (!g || !g.toXLSX) return false;
      g.toXLSX();
      toast(T("XLSX diunduh dari MiniGrid."), "success", T("Ekspor"));
      return true;
    },
    eksporPdf: function (no) {
      var g = this.grid[no];
      if (!g || !g.toPDF) return false;
      g.toPDF();
      toast(T("PDF diunduh dari MiniGrid."), "success", T("Ekspor"));
      return true;
    },

    resetContoh2: function () {
      try { localStorage.removeItem(KEY2); } catch (e) { /* abaikan */ }
      var host = document.getElementById("minigrid-2");
      if (!host) return false;
      Demo.grid[2] = window.MiniGrid(KONFIG[2](host));
      if (window.I18n && window.I18n.apply) window.I18n.apply();
      toast(T("Contoh 2 dikembalikan ke data awal."), "info", T("Mini Grid"));
      return true;
    },

    /* muat ulang data grid tertentu (dipakai tombol refresh di navbar halaman) */
    muatUlang: function (no) {
      var g = Demo.grid[no];
      if (!g) return null;
      if (typeof g.o.onRefresh === "function") { g.o.onRefresh(g); return g; }
      g.render();
      return g;
    },

    /* aksi kustom halaman 3 (tombol di navbar/aksi juga bisa memakainya) */
    setujuiTerpilih: function () {
      var g = this.grid[3];
      if (!g) return 0;
      var rowsTerpilih = g.view.filter(function (r, i) { return g.s.sel.has(g.idOf(r, i)); });
      rowsTerpilih.forEach(function (r) { r.status = "Approved"; });
      g.render(); g.clearSel();
      toast(rowsTerpilih.length + " " + T("pengajuan disetujui."), "success");
      return rowsTerpilih.length;
    },
    tolakTerpilih: function () {
      var g = this.grid[3];
      if (!g) return 0;
      var rowsTerpilih = g.view.filter(function (r, i) { return g.s.sel.has(g.idOf(r, i)); });
      rowsTerpilih.forEach(function (r) { r.status = "Rejected"; });
      g.render(); g.clearSel();
      toast(rowsTerpilih.length + " " + T("pengajuan ditolak."), "warning");
      return rowsTerpilih.length;
    }
  };

  window.MiniGridDemo = Demo;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { Demo.init(); });
  else Demo.init();
})();
