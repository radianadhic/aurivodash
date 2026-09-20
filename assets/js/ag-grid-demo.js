/*
 * ag-grid-demo.js — integrasi AG Grid Community (v36, MIT) dengan tema template.
 *
 * Menampilkan grid contoh "Portofolio Nasabah" + grid ringkas "Per Cabang".
 * Catatan integrasi:
 *  - warna grid diambil dari CSS variable template (--c-primary, --c-card-bg, …)
 *    sehingga ikut berubah saat tema/skin perbankan diganti (event "theme:changed");
 *  - teks antarmuka grid mengikuti bahasa aktif (ID/EN) lewat localeText,
 *    dan disegarkan saat event "i18n:changed";
 *  - semua aset lokal: tidak ada permintaan jaringan.
 */
(function () {
  "use strict";

  if (!window.agGrid) return;
  var ag = window.agGrid;
  ag.ModuleRegistry.registerModules([ag.AllCommunityModule]);

  /* ------------------------------------------------------------ data contoh */
  var NASABAH = [
    ["NB-1001", "Aulia Saputra", "Prioritas", "1200-8891-01", 1284500000, 4.8, "Jakarta", "Aktif", "2023-02-12"],
    ["NB-1002", "Rani Setiawati", "Retail", "1200-8892-02", 186500000, -1.2, "Bandung", "Aktif", "2024-07-01"],
    ["NB-1003", "Budi Prakoso", "Korporat", "1200-8893-03", 8750000000, 7.4, "Surabaya", "Aktif", "2021-11-23"],
    ["NB-1004", "Nadia Maharani", "Prioritas", "1200-8894-04", 2310000000, 2.1, "Depok", "Menunggu verifikasi", "2025-01-19"],
    ["NB-1005", "Andi Dermawan", "Retail", "1200-8895-05", 42500000, -6.7, "Medan", "Aktif", "2025-03-04"],
    ["NB-1006", "Dewi Lestari", "Korporat", "1200-8896-06", 6120000000, 3.3, "Jakarta", "Aktif", "2022-05-30"],
    ["NB-1007", "Gita Puspita", "Prioritas", "1200-8897-07", 945000000, 1.9, "Semarang", "Dibekukan", "2023-09-14"],
    ["NB-1008", "Bayu Setiadi", "Retail", "1200-8898-08", 78300000, 12.5, "Malang", "Aktif", "2025-06-27"],
    ["NB-1009", "Tirta Wibawa", "Korporat", "1200-8899-09", 3475000000, 0.4, "Jakarta", "Aktif", "2020-08-08"],
    ["NB-1010", "Lina Susanti", "Retail", "1200-8900-10", 156000000, -3.8, "Bogor", "Aktif", "2024-12-02"],
    ["NB-1011", "Maya Kirana", "Prioritas", "1200-8901-11", 1780000000, 5.6, "Denpasar", "Aktif", "2023-04-21"],
    ["NB-1012", "Hendra Wijaya", "Retail", "1200-8902-12", 239000000, 0.9, "Yogyakarta", "Menunggu verifikasi", "2025-08-11"],
    ["NB-1013", "Sri Anggraeni", "Korporat", "1200-8903-13", 4230000000, -0.7, "Surabaya", "Aktif", "2021-03-17"],
    ["NB-1014", "Fajar Nugroho", "Retail", "1200-8904-14", 67400000, 8.2, "Bekasi", "Aktif", "2025-05-09"],
    ["NB-1015", "Intan Permata", "Prioritas", "1200-8905-15", 1120000000, 2.8, "Bandung", "Aktif", "2022-10-03"],
    ["NB-1016", "Yoga Pratama", "Retail", "1200-8906-16", 51800000, -2.4, "Tangerang", "Dibekukan", "2024-02-26"],
    ["NB-1017", "Sinta Dewanti", "Korporat", "1200-8907-17", 7840000000, 6.1, "Jakarta", "Aktif", "2020-12-15"],
    ["NB-1018", "Rizky Ramadhan", "Retail", "1200-8908-18", 132000000, 1.4, "Palembang", "Aktif", "2025-07-30"],
    ["NB-1019", "Wulan Sari", "Prioritas", "1200-8909-19", 674500000, -4.9, "Makassar", "Menunggu verifikasi", "2025-09-02"],
    ["NB-1020", "Bambang Sutrisno", "Korporat", "1200-8910-20", 2910000000, 3.7, "Semarang", "Aktif", "2021-06-12"]
  ].map(function (r) {
    return {
      id: r[0], nama: r[1], segmen: r[2], rekening: r[3], saldo: r[4],
      perubahan: r[5], cabang: r[6], status: r[7], bergabung: new Date(r[8] + "T00:00:00")
    };
  });

  var CABANG = [
    { cabang: "Jakarta", nasabah: 1284, dana: 42850000000, perubahan: 4.8 },
    { cabang: "Surabaya", nasabah: 642, dana: 18620000000, perubahan: 2.1 },
    { cabang: "Bandung", nasabah: 511, dana: 12440000000, perubahan: -1.4 },
    { cabang: "Medan", nasabah: 388, dana: 9120000000, perubahan: 1.2 },
    { cabang: "Semarang", nasabah: 274, dana: 6180000000, perubahan: 3.6 },
    { cabang: "Denpasar", nasabah: 196, dana: 5310000000, perubahan: 5.2 }
  ];

  /* ------------------------------------------------------------ penerjemah */
  function T(s) { return window.T ? window.T(s) : (window.I18n && window.I18n.t ? window.I18n.t(s, s) : s); }
  function en() { return window.I18n && window.I18n.locale === "en"; }

  function fmtRp(v) {
    var loc = en() ? "en-US" : "id-ID";
    return (en() ? "IDR " : "Rp ") + Number(v).toLocaleString(loc);
  }
  function fmtJt(v) {
    var angka = v / 1000000;
    var teks = angka.toLocaleString(en() ? "en-US" : "id-ID", { maximumFractionDigits: 1 });
    return "Rp " + teks + " " + T("jt");
  }
  /* Tanggal: objek Date supaya filter tanggal bawaan AG Grid bisa dipakai. */
  function fmtTanggal(d) {
    if (!(d instanceof Date)) return d;
    return d.toLocaleDateString(en() ? "en-US" : "id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  /* localeText untuk AG Grid — sebagian besar kunci antarmuka yang terlihat */
  var LOCALE_ID = {
    page: "Halaman", to: "sampai", of: "dari", next: "Berikutnya", last: "Terakhir",
    first: "Pertama", previous: "Sebelumnya", loadingOoo: "Memuat…", noRowsToShow: "Tidak ada data untuk ditampilkan",
    filterOoo: "Menyaring…", equals: "Sama dengan", notEqual: "Tidak sama dengan", lessThan: "Kurang dari",
    greaterThan: "Lebih dari", inRange: "Di antara", inRangeStart: "Dari", inRangeEnd: "Sampai",
    contains: "Mengandung", notContains: "Tidak mengandung", startsWith: "Diawali", endsWith: "Diakhiri",
    blank: "Kosong", notBlank: "Tidak kosong", andCondition: "Dan", orCondition: "Atau",
    applyFilter: "Terapkan", resetFilter: "Setel ulang", clearFilter: "Bersihkan", cancelFilter: "Batal",
    searchOoo: "Cari…", columns: "Kolom", filters: "Saringan", pinColumn: "Sematkan kolom",
    autosizeThiscolumn: "Sesuaikan lebar kolom ini", autosizeAllColumns: "Sesuaikan semua lebar kolom",
    resetColumns: "Setel ulang kolom", sortAscending: "Urut naik", sortDescending: "Urut turun",
    sortUnSort: "Hapus urutan", pinLeft: "Sematkan kiri", pinRight: "Sematkan kanan", noPin: "Lepas sematan",
    paginationPageSize: "Baris per halaman", paginationPageSizeSelectorValues: "Pilihan jumlah baris",
    pageSizeSelectorLabel: "Baris per halaman", paginationPageSizeSelectorLabel: "Baris per halaman",
    totalRows: "Total baris", filteredRows: "Tersaring", more: "Lainnya"
  };
  var LOCALE_EN = {
    page: "Page", to: "to", of: "of", next: "Next", last: "Last", first: "First", previous: "Previous",
    paginationPageSize: "Rows per page", pageSizeSelectorLabel: "Rows per page",
    paginationPageSizeSelectorLabel: "Rows per page"
  };
  function localeText() { return en() ? LOCALE_EN : LOCALE_ID; }

  /* ------------------------------------------------------------- tema grid */
  /* Warna dibaca dari CSS variable template → grid ikut tema/skin perbankan. */
  function vars() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n, fb) { return (cs.getPropertyValue(n) || "").trim() || fb; };
    return {
      primary: v("--c-primary", "#007bff"),
      fg: v("--c-fg", "#212529"),
      muted: v("--c-muted", "#7a8794"),
      border: v("--c-border", "#dee2e6"),
      card: v("--c-card-bg", "#ffffff"),
      surface2: v("--c-surface-2", "#f4f6f9"),
      font: v("--font-sans", "sans-serif")
    };
  }

  function makeTheme(kompak) {
    var c = vars();
    return ag.themeQuartz.withParams({
      accentColor: c.primary,
      backgroundColor: c.card,
      foregroundColor: c.fg,
      borderColor: c.border,
      chromeBackgroundColor: c.surface2,
      headerBackgroundColor: c.surface2,
      headerTextColor: c.fg,
      oddRowBackgroundColor: "transparent",
      rowHoverColor: c.surface2,
      selectedRowBackgroundColor: c.surface2,
      fontFamily: c.font,
      fontSize: "0.92rem",
      headerFontWeight: 600,
      spacing: kompak ? 4 : 6,
      borderRadius: 4,
      wrapperBorderRadius: 6,
      cellHorizontalPadding: kompak ? 10 : 14
    });
  }

  /* ------------------------------------------------------------ sel khusus */
  function badgeCell(text) {
    var map = {
      "Aktif": "badge-soft-success", "Active": "badge-soft-success",
      "Menunggu verifikasi": "badge-soft-warning", "Waiting verification": "badge-soft-warning",
      "Dibekukan": "badge-soft-danger", "Frozen": "badge-soft-danger"
    };
    var span = document.createElement("span");
    span.className = "badge " + (map[text] || "badge-soft-secondary");
    span.textContent = T(text);
    return span;
  }
  function deltaCell(p) {
    var naik = (p.value || 0) >= 0;
    var span = document.createElement("span");
    span.className = "font-semibold " + (naik ? "text-success" : "text-danger");
    span.textContent = (naik ? "▲ " : "▼ ") + Math.abs(p.value).toLocaleString(en() ? "en-US" : "id-ID", { minimumFractionDigits: 1 }) + "%";
    return span;
  }

  /* ------------------------------------------------------------- kolom grid */
  function kolomNasabah() {
    return [
      { field: "id", headerName: "ID", width: 110, pinned: "left", checkboxSelection: true, headerCheckboxSelection: true },
      {
        field: "nama", headerName: T("Nama nasabah"), flex: 1.4, minWidth: 160,
        filter: "agTextColumnFilter", cellClass: "font-semibold"
      },
      {
        field: "segmen", headerName: T("Segmen"), width: 130, filter: "agTextColumnFilter",
        cellRenderer: function (p) {
          var w = { Prioritas: "badge-soft-info", Korporat: "badge-soft-primary", Retail: "badge-soft-secondary" };
          var s = document.createElement("span");
          s.className = "badge " + (w[p.value] || "badge-soft-secondary");
          s.textContent = T(p.value);
          return s;
        }
      },
      { field: "rekening", headerName: T("No. rekening"), width: 160, filter: "agTextColumnFilter" },
      {
        field: "saldo", headerName: T("Saldo"), width: 190, filter: "agNumberColumnFilter",
        type: "numericColumn", valueFormatter: function (p) { return fmtRp(p.value); }
      },
      {
        field: "perubahan", headerName: T("Perubahan"), width: 130, filter: "agNumberColumnFilter",
        type: "numericColumn", cellRenderer: deltaCell,
        valueFormatter: function (p) { return p.value + "%"; }
      },
      /* Catatan: Set Filter & Multi Filter termasuk fitur Enterprise, jadi kolom teks
         memakai Text Filter (Community). Penyaring "pilih dari daftar" disediakan
         lewat dropdown di toolbar halaman (lihat terapkanSaringan()). */
      { field: "cabang", headerName: T("Cabang"), width: 150, filter: "agTextColumnFilter" },
      {
        field: "status", headerName: T("Status"), width: 190, filter: "agTextColumnFilter",
        cellRenderer: function (p) { return badgeCell(p.value); }
      },
      {
        field: "bergabung", headerName: T("Tanggal bergabung"), width: 170,
        filter: "agDateColumnFilter", valueFormatter: function (p) { return fmtTanggal(p.value); },
        filterParams: { comparator: function (a, b) { return a.getTime() - b.getTime(); } }
      }
    ];
  }

  function kolomCabang() {
    return [
      { field: "cabang", headerName: T("Cabang"), width: 160, pinned: "left", rowDrag: false },
      { field: "nasabah", headerName: T("Jumlah nasabah"), width: 160, type: "numericColumn", valueFormatter: function (p) { return Number(p.value).toLocaleString(en() ? "en-US" : "id-ID"); } },
      { field: "dana", headerName: T("Dana kelolaan"), width: 180, type: "numericColumn", valueFormatter: function (p) { return fmtJt(p.value); } },
      { field: "perubahan", headerName: T("Perubahan"), width: 130, type: "numericColumn", cellRenderer: deltaCell }
    ];
  }

  /* ------------------------------------------------------------------ state */
  var gridUtama = null, gridCabang = null;
  var $ = function (s) { return document.querySelector(s); };

  function ringkasPilihan(api) {
    var el = $("#ag-selection-info");
    if (!el) return;
    var rows = api.getSelectedRows();
    var total = rows.reduce(function (a, r) { return a + (r.saldo || 0); }, 0);
    el.textContent = rows.length
      ? T("Terpilih") + ": " + rows.length + " " + T("nasabah") + " · " + fmtRp(total)
      : T("Belum ada baris dipilih");
  }

  function buatGridUtama() {
    var host = $("#ag-grid-nasabah");
    if (!host) return;
    if (gridUtama) { gridUtama.destroy(); gridUtama = null; }
    gridUtama = ag.createGrid(host, {
      theme: makeTheme(false),
      columnDefs: kolomNasabah(),
      rowData: NASABAH,
      defaultColDef: { sortable: true, resizable: true, filter: true, floatingFilter: true, minWidth: 110 },
      rowSelection: { mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true },
      pagination: true,
      paginationPageSize: 10,
      paginationPageSizeSelector: [10, 20, 50],
      animateRows: true,
      localeText: localeText(),
      onSelectionChanged: function () { ringkasPilihan(gridUtama); },
      onGridReady: function () { ringkasPilihan(gridUtama); },
      onFilterChanged: function () { sinkronSaringan(); }
    });
    return gridUtama;
  }

  function buatGridCabang() {
    var host = $("#ag-grid-cabang");
    if (!host) return;
    if (gridCabang) { gridCabang.destroy(); gridCabang = null; }
    gridCabang = ag.createGrid(host, {
      theme: makeTheme(true),
      columnDefs: kolomCabang(),
      rowData: CABANG,
      defaultColDef: { sortable: true, resizable: true },
      domLayout: "autoHeight",
      localeText: localeText()
    });
    return gridCabang;
  }

  /* ------------------------------------------- penyaring pilihan di toolbar */
  /* Dropdown "Pilih cabang/status" memakai Text Filter Community dengan
     kondisi "sama dengan" — setara Set Filter, tapi tanpa fitur Enterprise. */
  function bacaSaringan(model, field) {
    var f = model[field];
    if (!f) return "";
    if (f.conditions && f.conditions[0]) return f.conditions[0].filter || "";
    return f.filter || "";
  }

  function terapkanSaringan(field, nilai) {
    if (!gridUtama) return;
    var model = gridUtama.getFilterModel() || {};
    if (nilai) model[field] = { filterType: "text", type: "equals", filter: nilai };
    else delete model[field];
    gridUtama.setFilterModel(Object.keys(model).length ? model : null);
  }

  /* Model filter berubah dari mana pun (menu kolom / floating filter / dropdown)
     → nilai dropdown ikut disesuaikan supaya tidak bertentangan. */
  function sinkronSaringan() {
    if (!gridUtama) return;
    var model = gridUtama.getFilterModel() || {};
    var sc = $("#ag-filter-cabang");
    var ss = $("#ag-filter-status");
    if (sc) sc.value = bacaSaringan(model, "cabang") || "";
    if (ss) ss.value = bacaSaringan(model, "status") || "";
  }

  function bersihkanSaringan() {
    if (!gridUtama) return;
    gridUtama.setFilterModel(null);
    var q = $("#ag-quick-filter");
    if (q) q.value = "";
    gridUtama.setGridOption("quickFilterText", "");
    sinkronSaringan();
    window.toast(T("Semua saringan dibersihkan."), "info", T("AG Grid"));
  }

  /* ---------------------------------------------------------------- aksi UI */
  function pasangAksi() {
    var cari = $("#ag-quick-filter");
    if (cari) {
      cari.addEventListener("input", function () {
        if (gridUtama) gridUtama.setGridOption("quickFilterText", cari.value);
      });
    }
    var ukuran = $("#ag-page-size");
    if (ukuran) {
      ukuran.addEventListener("change", function () {
        if (gridUtama) gridUtama.setGridOption("paginationPageSize", parseInt(ukuran.value, 10));
      });
    }
    var sCabang = $("#ag-filter-cabang");
    if (sCabang) sCabang.addEventListener("change", function () { terapkanSaringan("cabang", sCabang.value); });
    var sStatus = $("#ag-filter-status");
    if (sStatus) sStatus.addEventListener("change", function () { terapkanSaringan("status", sStatus.value); });
    var sReset = $("#ag-filter-reset");
    if (sReset) sReset.addEventListener("click", bersihkanSaringan);
  }

  window.AgGridDemo = {
    /* ekspor CSV memakai fasilitas AG Grid (gratis di Community) */
    eksporCsv: function () {
      if (!gridUtama) return;
      gridUtama.exportDataAsCsv({
        fileName: "portofolio-nasabah.csv",
        /* nilai tanggal ditulis ISO agar CSV rapi dibuka di Excel/Sheets */
        processCellCallback: function (p) {
          return p.value instanceof Date ? p.value.toISOString().slice(0, 10) : p.value;
        }
      });
      window.toast(T("CSV diekspor dari AG Grid."), "success", T("Ekspor"));
    },
    autoSize: function () {
      if (!gridUtama) return;
      gridUtama.autoSizeAllColumns();
      window.toast(T("Lebar kolom disesuaikan."), "info", T("AG Grid"));
    },
    hapusPilihan: function () {
      if (!gridUtama) return;
      gridUtama.deselectAll();
    },
    tambahBaris: function () {
      if (!gridUtama) return;
      var n = NASABAH.length + 1;
      var baru = {
        id: "NB-" + (1000 + n), nama: "Nasabah Baru " + n, segmen: "Retail",
        rekening: "1200-89" + n + "-00", saldo: 25000000 + n * 1000000, perubahan: 1.5,
        cabang: "Jakarta", status: "Menunggu verifikasi", bergabung: new Date()
      };
      gridUtama.applyTransaction({ add: [baru] });
      window.toast(T("1 baris ditambahkan ke grid."), "success", T("AG Grid"));
    },
    jumlahBaris: function () { return gridUtama ? gridUtama.getDisplayedRowCount() : 0; },
    pilihan: function () { return gridUtama ? gridUtama.getSelectedRows().length : 0; },
    /* dipakai juga oleh pengujian otomatis (qa/check-ag-grid.mjs) */
    saringCabang: function (nilai) { terapkanSaringan("cabang", nilai); return this.jumlahBaris(); },
    saringStatus: function (nilai) { terapkanSaringan("status", nilai); return this.jumlahBaris(); },
    bersihkanSaringan: bersihkanSaringan
  };

  /* --------------------------------------------------------------- bootstrap */
  function init() {
    buatGridUtama();
    buatGridCabang();
    pasangAksi();

    /* tema/skin perbankan berganti → tema grid ikut */
    window.addEventListener("theme:changed", function () {
      if (gridUtama) gridUtama.setGridOption("theme", makeTheme(false));
      if (gridCabang) gridCabang.setGridOption("theme", makeTheme(true));
    });

    /* bahasa berganti → buat ulang grid dengan localeText & header baru */
    window.addEventListener("i18n:changed", function () {
      if (gridUtama) {
        var state = { kolom: gridUtama.getColumnState(), filter: gridUtama.getFilterModel(), halaman: gridUtama.paginationGetCurrentPage() };
        buatGridUtama();
        try {
          gridUtama.applyColumnState({ state: state.kolom, applyOrder: true });
          Object.keys(state.filter).forEach(function (k) { gridUtama.setFilterModel(state.filter); });
          gridUtama.paginationGoToPage(Math.min(state.halaman, Math.max(0, gridUtama.paginationGetTotalPages() - 1)));
          sinkronSaringan();
        } catch (e) { /* abaikan: tampilan bahasa lebih penting daripada posisi */ }
      }
      if (gridCabang) buatGridCabang();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
