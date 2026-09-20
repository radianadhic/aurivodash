/* ============================================================
 * SatuReport Offline — Report Viewer (Alpine.js component)
 * Merender layout + data, print/PDF, export XLSX.
 * ============================================================ */
(function () {
  const A = () => window.SatuReport;
  const LS_PREVIEW = "satureport.offline.preview";

  window.reportViewer = function () {
    return {
      layout: null,
      data: null,
      source: "",
      zoom: 1,
      toastMsg: "",
      pageCount: 0,
      sheetW: 0,
      storageBackend: "memory",
      exportModal: false,
      exportJson: "",
      exportFilename: "layout.json",
      fsAccessOK: false,
      apiModal: false,
      apiUrl: "",
      apiBusy: false,
      /* sumber data & parameter report */
      dsApi: null, dsQuery: null, dsEndpoint: null,
      paramDefs: [],
      _lang: (typeof window !== "undefined" && window.SatuI18n) ? window.SatuI18n.lang : "id", // dual bahasa id|en
      params: {},
      paramModal: false,
      awaitingParams: false, // report disembunyikan sampai parameter diisi
      _toastTimer: null,

      async init() {
        // Prioritas: ?url=<file server> -> ?example=<id> -> preview dari designer -> contoh bawaan
        this.storageBackend = await A().store.ready();
        this.fsAccessOK = typeof window.showSaveFilePicker === "function";
        const sp = new URLSearchParams(location.search);
        const q = sp.get("example");
        const qUrl = sp.get("url"); // file paket gabungan {layout,params?,data?} di direktori server
        let loadedFromUrl = false;
        if (qUrl) loadedFromUrl = await this.loadFromUrl(qUrl);
        const ex = q && window.SATU_EXAMPLES ? window.SATU_EXAMPLES.byId(q) : null;
        if (loadedFromUrl) {
          /* paket dari server sudah diterapkan (+ parameter/modal otomatis) */
        } else if (ex) {
          this.data = ex.data;
          this._applyPackage(
            { name: ex.title, layout: ex.layout, data: ex.data, API: ex.apiUrl, query: ex.query, endpoint: ex.endpoint, params: ex.params },
            "Contoh: " + ex.title
          );
          if (ex.apiUrl && !this.paramDefs.length) {
            this.source += " — data cadangan offline";
            this._apiHint = "Contoh ini punya API live: klik 🌐 API → Muat Data (URL sudah terisi)";
          }
        } else {
          const saved = A().store.get(LS_PREVIEW);
          if (saved) {
            try {
              const p = JSON.parse(saved);
              this.layout = p.layout;
              this.data = p.data;
              this.source = "Preview dari Designer (" + new Date(p.savedAt).toLocaleString("id-ID") + ")";
            } catch (e) {}
          }
          if (!this.layout) {
            this.layout = A().sampleLayout();
            this.data = A().sampleData();
            this.source = "Contoh bawaan";
          }
        }
        this.layout = A().normalizeLayout(this.layout);
        this.$nextTick(() => this.render());
        if (this._apiHint) { this.toast(this._apiHint, 6000); this._apiHint = null; }
      },

      render() {
        const host = document.getElementById("report-host");
        const wrapper = document.getElementById("page-wrapper");
        host.innerHTML = "";
        if (this.awaitingParams) {
          // report disembunyikan sampai form parameter diisi
          host.innerHTML = '<div style="padding:70px 24px;text-align:center;color:#94a3b8;font-size:13px;background:#fff;border-radius:12px">' + A().esc(this.t("vHiddenAwaitParams")) + "</div>";
          this.pageCount = 0;
          return;
        }
        const data = this.dataWithParams();
        const paginated = !!this.layout.page?.pagination;

        if (paginated) {
          // gaya ActiveReports: lembar-lembar kertas per halaman
          const { sheets, total, size } = A().renderPages({ layout: this.layout, data });
          this.pageCount = total;
          this.sheetW = size.w;
          sheets.forEach((sh) => {
            sh.style.transform = `scale(${this.zoom})`;
            sh.style.transformOrigin = "top left";
            const wrap = document.createElement("div");
            wrap.style.cssText = `width:${size.w * this.zoom}px;height:${size.h * this.zoom}px;margin:0 auto 24px;`;
            wrap.className = "shadow-[0_20px_60px_rgba(0,0,0,.5)]";
            wrap.appendChild(sh);
            host.appendChild(wrap);
          });
          wrapper.style.width = size.w * this.zoom + "px";
          wrapper.style.height = "auto";
        } else {
          const page = A().render({ layout: this.layout, data });
          page.style.transform = `scale(${this.zoom})`;
          page.style.transformOrigin = "top left";
          page.className += " shadow-[0_20px_60px_rgba(0,0,0,.5)]";
          host.appendChild(page);
          this.pageCount = 1;
          this.sheetW = page.offsetWidth;
          this.wrapPages(page);
        }
      },

      wrapPages(page) {
        const wrapper = document.getElementById("page-wrapper");
        wrapper.style.width = page.offsetWidth * this.zoom + "px";
        wrapper.style.height = page.offsetHeight * this.zoom + "px";
      },

      toast(msg, dur = 2600) {
        this.toastMsg = msg;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => (this.toastMsg = ""), dur);
      },

      /* ---------- i18n (dual bahasa) ---------- */
      t(key, vars) {
        const _l = this._lang; // referensi state -> reaktif
        return (typeof window !== "undefined" && window.SatuI18n) ? window.SatuI18n.t(key, vars) : key;
      },
      switchLang() {
        if (typeof window === "undefined" || !window.SatuI18n) return;
        window.SatuI18n.toggle();
        this._lang = window.SatuI18n.lang;
        this.toast(this._lang === "en" ? "Language: English 🇬🇧" : "Bahasa: Indonesia 🇮🇩");
        if (this.layout) this.render(); // label tersembunyi parameter ikut bahasa
      },

      /* ---- buka file layout & data ---- */
      openLayoutFile() {
        this._pick((txt) => {
          const pkg = JSON.parse(txt);
          const isPkg = pkg && typeof pkg === "object" && pkg.layout && typeof pkg.layout === "object";
          if (isPkg) {
            this._applyPackage(pkg, pkg.name ? "File: " + pkg.name : "Layout dari file");
          } else {
            // layout polos -> reset sumber data & parameter
            this.dsApi = this.dsQuery = this.dsEndpoint = null;
            this.paramDefs = []; this.params = {}; this.awaitingParams = false;
            this.layout = A().normalizeLayout(pkg);
            this.source = "Layout dari file";
            this.render();
            this.toast("Layout dimuat ✓");
          }
        }, "File layout tidak valid: ");
      },

      /* Terapkan paket {name?, layout, data?, API?, query?+endpoint?, params?}
         - data: {query, endpoint} -> dianggap spesifikasi query kustom (bukan data statik)
         - params -> report disembunyikan sampai form parameter diisi */
      /* Muat file paket gabungan {layout, params?, data?} LANGSUNG dari direktori server:
         viewer.html?url=laporan-penjualan.satureport.json
         - GET relatif terhadap halaman viewer (boleh http(s)/path penuh)
         - params/query/API di dalam paket diproses seperti paket impor biasa
         - gagal (HTTP error / JSON rusak / jaringan diblokir sandbox) -> toast ⚠, return false */
      async loadFromUrl(url) {
        this.toast("⏳ Memuat file dari server: " + url + " …");
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const pkg = await res.json();
          if (!pkg || typeof pkg !== "object") throw new Error("bukan objek JSON");
          this.data = (pkg.data && typeof pkg.data === "object" && !(typeof pkg.data.query === "string" && typeof pkg.data.endpoint === "string")) ? pkg.data : (pkg.data || this.data);
          this._applyPackage(pkg, "File server: " + url);
          return true;
        } catch (err) {
          const why = err && err.message ? err.message : "kesalahan jaringan";
          this.toast(this.t("vLoadFromUrlFail", { url, why }), 7000);
          return false;
        }
      },

      _applyPackage(pkg, sourceLabel) {
        let embedded = pkg.data && typeof pkg.data === "object" ? pkg.data : null;
        let query = typeof pkg.query === "string" ? pkg.query : null;
        let endpoint = typeof pkg.endpoint === "string" ? pkg.endpoint : null;
        if (embedded && typeof embedded.query === "string" && typeof embedded.endpoint === "string") {
          query = embedded.query; endpoint = embedded.endpoint; embedded = null; // data datang dari endpoint
        }
        this.dsApi = pkg.API || pkg.apiUrl || null;
        this.dsQuery = query; this.dsEndpoint = endpoint;
        this.paramDefs = A().normalizeParams(pkg.params || (pkg.layout && pkg.layout.params));
        this.params = {};
        this.paramDefs.forEach((d) => (this.params[d.name] = d.default));
        this.layout = A().normalizeLayout(pkg.layout);
        if (embedded) this.data = embedded;
        if (this.dsApi) this.apiUrl = this.dsApi;
        this.source = sourceLabel || "Layout dari file";

        if (this.paramDefs.length) {
          // gerbang parameter: report belum tampil sampai form diisi
          this.awaitingParams = true;
          this.paramModal = true;
          this.render();
          this.toast(this.t("vParamGate"));
          return;
        }
        this.awaitingParams = false;
        this.render();
        if (this.dsQuery && this.dsEndpoint) { this.toast("Paket dimuat ✓ — menjalankan query…"); this.loadFromQuery(); }
        else if (this.dsApi) { this.toast("Paket dimuat ✓ — mengambil data dari API…"); this.loadFromApi(); }
        else this.toast(embedded ? this.t("vPkgLoaded") : this.t("vLayoutLoaded"));
      },

      /* ---- muat ulang data sesuai sumber report ----
         Bila report punya parameter -> form parameter tampil TERLEBIH DAHULU,
         lalu Tampilkan Report menjalankan ulang API/query/filter. */
      reloadReport() {
        if (this.paramDefs.length) {
          this.paramModal = true;
          this.toast(this.t("vParamGate2"));
          return;
        }
        if (this.dsQuery && this.dsEndpoint) { this.toast("Menjalankan ulang query…"); this.loadFromQuery(); return; }
        if (this.dsApi) { this.toast("Mengambil ulang data API…"); this.loadFromApi(); return; }
        this.render();
        this.toast(this.t("vReloaded"));
      },

      /* ---- parameter report ---- */
      openParamModal() {
        if (!this.paramDefs.length) return this.toast("Report ini tidak memiliki parameter");
        this.paramModal = true;
      },
      cancelParams() { // tutup modal -> tetap tampilkan dgn nilai default/terkini
        this.paramModal = false;
        if (this.awaitingParams) this.applyParams();
      },
      async applyParams() {
        this.paramModal = false;
        this.awaitingParams = false;
        if (this.dsQuery && this.dsEndpoint) {
          this.render();
          this.toast("Menjalankan query dengan parameter…");
          await this.loadFromQuery();
        } else if (this.dsApi) {
          this.render();
          this.toast("Mengambil data API dengan parameter…");
          await this.loadFromApi();
        } else {
          this.render();
          this.toast(this.t("vParamApplied"));
        }
      },
      // data + parameter utk ekspresi: {params.xxx} / {p.xxx}; sekaligus filter baris content
      dataWithParams() {
        const d = this.data;
        if (!d || typeof d !== "object") return d;
        let out = d;
        if (this.paramDefs.length && Array.isArray(d.content)) {
          const filters = this.paramDefs.filter((p) => {
            const v = this.params[p.name];
            return v !== undefined && v !== "" && v !== "Semua" && v !== "*" && (p.field !== null);
          });
          if (filters.length) {
            out = Object.assign({}, d, {
              content: d.content.filter((row) =>
                filters.every((p) => String(A().resolveBinding(p.field || p.name, row, d)) === String(this.params[p.name]))
              ),
            });
          }
        }
        if (this.params && Object.keys(this.params).length)
          out = Object.assign({}, out, { params: this.params, p: this.params });
        return out;
      },
      openDataFile() {
        this._pick((txt) => {
          const pkg = JSON.parse(txt);
          // dukung paket {layout, data} — ambil bagian datanya saja
          const isPkg = pkg && typeof pkg === "object" && pkg.data && typeof pkg.data === "object";
          this.data = isPkg ? pkg.data : pkg;
          this.dsApi = this.dsQuery = this.dsEndpoint = null; // data manual menggantikan sumber API/query
          this.render();
          this.toast(isPkg ? "Data (dari paket) dimuat ✓" : "Data dimuat ✓");
        }, "File data tidak valid: ");
      },
      _pick(onLoaded, errPrefix) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.onchange = () => {
          const f = input.files[0];
          if (!f) return;
          const r = new FileReader();
          // NB: alert() diblokir diam-diam di iframe sandbox -> tampilkan error via toast
          r.onload = () => {
            try { onLoaded(r.result); } catch (err) { this.toast("⚠ " + errPrefix + err.message, 6000); }
          };
          r.readAsText(f);
        };
        input.click();
      },
      loadSample() {
        this.layout = A().sampleLayout();
        this.data = A().sampleData();
        this.dsApi = this.dsQuery = this.dsEndpoint = null;
        this.paramDefs = []; this.params = {}; this.awaitingParams = false;
        this.source = "Contoh bawaan";
        this.render();
        this.toast("Contoh dimuat");
      },

      /* ---- muat data dari API JSON ---- */
      openApiModal() {
        this.exportModal = false;
        this.apiModal = true;
      },
      async loadFromApi() {
        if (this.apiBusy) return;
        this.apiBusy = true;
        try {
          const url = A().substituteParams(this.apiUrl, this.params); // {namaParam} di URL diganti nilai
          const data = await A().fetchJson(url);
          this.data = data;
          this.source = "API: " + url.replace(/^https?:\/\//, "").slice(0, 48);
          this.render();
          this.apiModal = false;
          this.toast("Data dari API dimuat ✓ — " + (Array.isArray(data.content) ? data.content.length + " baris (content)" : "objek JSON"));
        } catch (err) {
          this.toast("⚠ " + (err && err.message ? err.message : "Gagal memuat API"), 6000);
        } finally {
          this.apiBusy = false;
        }
      },
      // jalankan query kustom dari paket {query, endpoint}
      async loadFromQuery() {
        if (this.apiBusy) return;
        this.apiBusy = true;
        try {
          const data = await A().fetchQuery(this.dsEndpoint, this.dsQuery, this.params);
          this.data = data;
          this.source = "Query: " + String(this.dsEndpoint).slice(0, 48);
          this.render();
          this.toast("Data query termuat ✓ — " + (Array.isArray(data.content) ? data.content.length + " baris" : "objek JSON"));
        } catch (err) {
          this.toast("⚠ " + (err && err.message ? err.message : "Query gagal"), 6000);
        } finally {
          this.apiBusy = false;
        }
      },
      openGallery() { window.location.href = "examples.html"; },
      openExportModal() {
        const fname = (this.source.startsWith("Contoh:") ? this.source.slice(8).trim() : "layout-satureport")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".json";
        this.exportFilename = fname;
        const pkg = { layout: this.layout, data: this.data };
        if (this.apiUrl && this.apiUrl.trim()) pkg.API = this.apiUrl.trim(); // simpan URL API agar file bisa memuat data live lagi
        if (this.dsQuery && this.dsEndpoint) { pkg.query = this.dsQuery; pkg.endpoint = this.dsEndpoint; }
        if (this.paramDefs.length) pkg.params = this.paramDefs;
        this.exportJson = JSON.stringify(pkg, null, 2);
        this.exportModal = true;
      },
      downloadExportJson() {
        A().download(this.exportJson, this.exportFilename || "layout.json", "application/json");
        this.toast("Unduhan dimulai — bila tidak muncul, gunakan 'Salin JSON'");
      },
      async saveAsExportJson() {
        const r = await A().saveFileSmart(this.exportJson, this.exportFilename || "layout.json", "application/json");
        if (r === "saved") { this.exportModal = false; this.toast("Layout disimpan ke file ✓"); }
        else if (r === "downloaded") this.toast("Unduhan dimulai — bila file tidak muncul (pratinjau sandbox), gunakan 📋 Salin JSON");
        else if (r !== "aborted") this.toast("Save As diblokir browser di pratinjau — klik 📋 Salin JSON, tempel & simpan sebagai .json");
      },
      async copyExportJson() {
        const okc = await A().copyText(this.exportJson);
        this.toast(okc ? "JSON disalin ke clipboard ✓" : "Gagal menyalin — blok teks lalu Ctrl+C");
      },
      openDesigner() {
        const q = new URLSearchParams(location.search).get("example");
        window.location.href = q ? "designer.html?example=" + encodeURIComponent(q) : "designer.html";
      },

      /* ---- export ---- */
      exportPDF() {
        const host = document.getElementById("report-host");
        if (!host.firstElementChild) return;
        let html = "";
        let pageSizeCss = "";
        if (this.layout.page?.pagination) {
          const size = A().paperSize(this.layout.page.paper, this.layout.page.orientation);
          pageSizeCss = `${size.wmm}mm ${size.hmm}mm`;
          host.querySelectorAll(".ar-sheet").forEach((sh) => {
            const c = sh.cloneNode(true);
            c.style.transform = "none";
            c.style.margin = "0";
            html += c.outerHTML;
          });
        } else {
          const c = host.firstElementChild.cloneNode(true);
          c.style.transform = "none";
          html = c.outerHTML;
        }
        if (!A().printHTML(html, "SatuReport", pageSizeCss)) this.toast("Popup cetak diblokir — izinkan popup untuk export PDF");
      },
      exportXLSX() {
        const bytes = A().buildXLSX(this.layout, this.dataWithParams(), "Report");
        A().download(bytes, "report-satureport.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        this.toast("XLSX diexport ✓");
      },

      /* ---- zoom ---- */
      zoomIn() { this.zoom = Math.min(2.5, Math.round((this.zoom + 0.1) * 10) / 10); this.render(); },
      zoomOut() { this.zoom = Math.max(0.3, Math.round((this.zoom - 0.1) * 10) / 10); this.render(); },
      zoomReset() { this.zoom = 1; this.render(); },
      zoomFit() {
        const area = document.getElementById("viewer-area");
        const pageW = this.layout.page?.pagination
          ? A().paperSize(this.layout.page.paper, this.layout.page.orientation).w
          : (this.layout?.width || 700);
        this.zoom = Math.max(0.2, Math.round(Math.min(2.5, area.clientWidth / (pageW + 64)) * 20) / 20);
        this.render();
      },

      rowCount() {
        const v = A().resolvePath(this.data || {}, this.layout?.contentSection?.binding);
        return Array.isArray(v) ? v.length : 0;
      },
    };
  };
})();
