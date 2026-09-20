/* ============================================================
 * SatuReport Offline — Report Designer (Alpine.js component)
 * Fitur: drag & drop, move/resize, bulk move/resize, sub group,
 * undo/redo, elements list, binding, styles, export PDF/XLSX.
 * ============================================================ */
(function () {
  const A = () => window.SatuReport;
  const LS_LAYOUT = "satureport.offline.layout";
  const LS_DATA = "satureport.offline.data";
  const LS_PREVIEW = "satureport.offline.preview";
  const LS_DS = "satureport.offline.datasource"; // pengaturan sumber data: manual|api|query
  const LS_PARAMS = "satureport.offline.params"; // definisi parameter report [{name,label,type,default,options,field}]

  window.reportDesigner = function () {
    return {
      /* ---------- state ---------- */
      layout: null,
      dataSource: [],
      previewData: null,
      selIds: [],
      selectedSection: null, // 'headerSection' | 'contentSection' | 'footerSection' | 'group:<id>'
      tool: "select", // select | text | image | barcode | line
      _lang: (typeof window !== "undefined" && window.SatuI18n) ? window.SatuI18n.lang : "id", // dual bahasa id|en
      zoom: 1,
      gridSnap: true,
      gridSize: 5,
      leftTab: "data", // data | elements | props (properti report)
      undoStack: [],
      redoStack: [],
      clipboard: [],
      showDataModal: false,
      dataJsonText: "",
      apiUrl: "",
      apiBusy: false,
      dataJsonError: "",
      /* pengaturan sumber data report (manual JSON | API GET | query kustom)
         — panel "Properti" di sidebar kiri (leftTab='props') */
      dsType: "manual",
      dsEndpoint: "",
      dsQuery: "",
      dsBusy: false,
      dsMsg: "",
      /* parameter report (properti): dipakai untuk {param} di URL/query, {params.x} di teks, filter baris */
      paramDefs: [],
      /* test preview report in-app */
      previewModal: false,
      previewZoom: 1,
      _pv: null,
      /* dialog in-app (confirm/prompt asli diblokir diam-diam di sandbox preview) */
      cfOpen: false, cfMsg: "", cfRes: null,
      pmOpen: false, pmMsg: "", pmValue: "", pmRes: null,
      storageBackend: "memory",
      showLibModal: false,
      exportModal: false,
      exportWithData: true, // default: satu file paket {layout, data}
      exportJson: "",
      exportFilename: "layout.json",
      fsAccessOK: false,
      toastMsg: "",
      _toastTimer: null,
      _pendingSnap: null,
      _lastHistType: null,
      _lastHistTime: 0,
      _drag: null,
      _saveTimer: null,

      /* ---------- init ---------- */
      async init() {
        // dukung pemuatan contoh: designer.html?example=<id> (lihat examples/examples.js)
        this.showDataModal = false; // pastikan modal tidak pernah terbuka saat load
        // tunggu IndexedDB (fallback localStorage/memori otomatis)
        this.storageBackend = await A().store.ready();
        this.fsAccessOK = typeof window.showSaveFilePicker === "function";
        // pulihkan pengaturan sumber data (Query/API) & parameter dari sesi sebelumnya
        try { const ds = A().store.get(LS_DS); if (ds) this.applyDsSpec(JSON.parse(ds)); } catch (e) {}
        try { const ps = A().store.get(LS_PARAMS); if (ps) { const arr = JSON.parse(ps); if (Array.isArray(arr)) this.paramDefs = arr; } } catch (e) {}
        const q = new URLSearchParams(location.search).get("example");
        const ex = q && window.SATU_EXAMPLES ? window.SATU_EXAMPLES.byId(q) : null;

        const savedLayout = ex ? null : A().store.get(LS_LAYOUT);
        const savedData = ex ? null : A().store.get(LS_DATA);
        this.layout = ex
          ? A().normalizeLayout(A().clone(ex.layout))
          : savedLayout
            ? A().normalizeLayout(JSON.parse(savedLayout))
            : A().sampleLayout();
        this.previewData = ex
          ? A().clone(ex.data)
          : savedData
            ? JSON.parse(savedData)
            : A().sampleData();
        // Data Source SELALU diturunkan dari data yang benar-benar dimuat
        this.refreshDataSource();
        // contoh berparameter (param-report) ikut mengisi paramDefs
        if (ex && Array.isArray(ex.params) && ex.params.length) this.paramDefs = A().normalizeParams(ex.params);
        if (ex) this.toast("Contoh dimuat: " + ex.title);
        this.$watch("layout", () => this.autosave(), { deep: true });

        document.addEventListener("keydown", (e) => this.onKeydown(e));
        document.addEventListener("mousemove", (e) => this.onMouseMove(e));
        document.addEventListener("mouseup", (e) => this.onMouseUp(e));
      },

      autosave() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
          A().store.set(LS_LAYOUT, JSON.stringify(this.layout));
        }, 800);
      },

      toast(msg) {
        this.toastMsg = msg;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => (this.toastMsg = ""), 2200);
      },

      /* ---------- i18n (dual bahasa) ---------- */
      t(key, vars) {
        const _l = this._lang; // referensi state -> Alpine reaktif saat bahasa diganti
        return (typeof window !== "undefined" && window.SatuI18n) ? window.SatuI18n.t(key, vars) : key;
      },
      switchLang() {
        if (typeof window === "undefined" || !window.SatuI18n) return;
        window.SatuI18n.toggle();
        this._lang = window.SatuI18n.lang;
        this.toast(this._lang === "en" ? "Language: English 🇬🇧" : "Bahasa: Indonesia 🇮🇩");
      },

      /* ---- dialog in-app: confirm() & prompt() asli diblokir sandbox ---- */
      askConfirm(msg) {
        return new Promise((res) => { this.cfMsg = msg; this.cfRes = res; this.cfOpen = true; });
      },
      cfAnswer(v) {
        this.cfOpen = false;
        const r = this.cfRes; this.cfRes = null;
        if (r) r(v);
      },
      askPrompt(msg, def = "") {
        return new Promise((res) => { this.pmMsg = msg; this.pmValue = def; this.pmRes = res; this.pmOpen = true; });
      },
      pmAnswer(ok) {
        this.pmOpen = false;
        const r = this.pmRes; this.pmRes = null;
        if (r) r(ok ? this.pmValue : null);
      },

      /* ---------- history ---------- */
      begin() { if (this._pendingSnap == null) this._pendingSnap = JSON.stringify(this.layout); },
      commit(type) {
        const now = Date.now();
        if (this._pendingSnap != null) {
          const merged = type && this._lastHistType === type && now - this._lastHistTime < 1200;
          if (!merged) {
            this.undoStack.push(this._pendingSnap);
            if (this.undoStack.length > 120) this.undoStack.shift();
            this.redoStack = [];
          }
          this._pendingSnap = null;
          this._lastHistType = type || null;
          this._lastHistTime = now;
        }
      },
      mutate(fn, type) { this.begin(); fn(); this.commit(type); },
      undo() {
        if (!this.undoStack.length) return;
        this._pendingSnap = null;
        this.redoStack.push(JSON.stringify(this.layout));
        this.layout = A().normalizeLayout(JSON.parse(this.undoStack.pop()));
        this.toast("Undo");
      },
      redo() {
        if (!this.redoStack.length) return;
        this._pendingSnap = null;
        this.undoStack.push(JSON.stringify(this.layout));
        this.layout = A().normalizeLayout(JSON.parse(this.redoStack.pop()));
        this.toast("Redo");
      },

      /* ---------- sections helper ---------- */
      sections() {
        const L = this.layout;
        const out = [
          { key: "pageHeaderSection", label: "Page Header • tiap halaman", sec: L.pageHeaderSection },
          { key: "headerSection", label: "Report Header", sec: L.headerSection },
          { key: "contentSection", label: "Content (Detail)", sec: L.contentSection },
        ];
        (this.layout.contentSection.groups || []).forEach((g) =>
          out.push({ key: "group:" + g.id, label: "Sub Group" + (g.binding ? " — " + g.binding : ""), sec: g })
        );
        out.push({ key: "footerSection", label: "Report Footer", sec: L.footerSection });
        out.push({ key: "pageFooterSection", label: "Page Footer • tiap halaman", sec: L.pageFooterSection });
        return out;
      },
      isSectionSelected(key) { return this.selectedSection === key && !this.selIds.length; },
      contentIsArray() {
        const v = A().resolvePath(this.previewData, this.layout.contentSection.binding);
        return Array.isArray(v);
      },
      firstRow() {
        const v = A().resolvePath(this.previewData, this.layout.contentSection.binding);
        return Array.isArray(v) && v.length ? v[0] : this.previewData;
      },
      scopeFor(key) {
        if (key === "contentSection") return this.firstRow();
        if (key.startsWith("group:")) return this.firstRow();
        return this.previewData;
      },
      previewValue(item, sectionKey) {
        const scope = this.scopeFor(sectionKey);
        const aggRows = A().resolvePath(this.previewData, this.layout.contentSection.binding);
        return A().itemValue(item, scope, this.previewData, {
          page: 1, pages: 1, row: 0, count: 1,
          aggRows: Array.isArray(aggRows) ? aggRows : [],
        });
      },

      /* ---------- pengaturan halaman (ala ActiveReports) ---------- */
      syncPageWidth() {
        const p = this.layout.page;
        if (p && p.pagination) {
          const s = A().paperSize(p.paper, p.orientation);
          this.layout.width = Math.max(200, s.w - p.margins.left - p.margins.right);
        }
      },
      updPage(patch) {
        this.mutate(() => {
          Object.assign(this.layout.page, patch);
          this.syncPageWidth();
        }, "page");
      },
      updMargin(key, value) {
        this.mutate(() => {
          this.layout.page.margins[key] = Math.max(0, A().num(value));
          this.syncPageWidth();
        }, "page");
      },
      insertExpr(expr) {
        if (!expr) return;
        const f = this.singleItem();
        if (!f) return;
        this.mutate(() => { f.item.text = (f.item.text || "") + expr; }, "prop");
      },

      /* ---------- item lookup / selection ---------- */
      allItems() {
        const out = [];
        for (const s of this.sections()) {
          (s.sec.items || []).forEach((it) => out.push({ item: it, sectionKey: s.key }));
        }
        return out;
      },
      findItem(id) {
        for (const s of this.sections()) {
          const it = (s.sec.items || []).find((i) => i.id === id);
          if (it) return { item: it, section: s.sec, sectionKey: s.key };
        }
        return null;
      },
      selectedItems() { return this.selIds.map((id) => this.findItem(id)).filter(Boolean); },
      singleItem() { return this.selIds.length === 1 ? this.findItem(this.selIds[0]) : null; },
      isSel(id) { return this.selIds.includes(id); },

      selectItem(e, id) {
        e.stopPropagation();
        const multi = e.ctrlKey || e.metaKey || e.shiftKey;
        if (multi) {
          if (this.isSel(id)) this.selIds = this.selIds.filter((x) => x !== id);
          else this.selIds = [...this.selIds, id];
        } else if (!this.isSel(id)) {
          this.selIds = [id];
        }
        this.selectedSection = null;
      },
      selectSection(key) {
        this.selectedSection = key;
        this.selIds = [];
      },
      clearSelection() {
        this.selIds = [];
        this.selectedSection = null;
      },
      selectAll() {
        this.selIds = this.allItems().map((x) => x.item.id);
      },

      /* ---------- drag & resize items ---------- */
      itemStyleObject(item) {
        // catatan: koordinat asli — kontainer canvas sudah di-scale via transform
        return {
          left: item.x + "px",
          top: item.y + "px",
          width: item.width + "px",
          height: item.height + "px",
        };
      },
      itemInnerStyle(item) {
        return A().styleToCss(item.style) + (item.style?.padding ? "" : "padding:1px 2px;");
      },
      barcodeOf(item, sectionKey) {
        const v = this.previewValue(item, sectionKey);
        return A().barcodeSVG(v, { color: item.style?.color || "#000", showText: item.showText !== false });
      },
      chartOf(item, sectionKey) {
        const scope = this.scopeFor(sectionKey);
        return A().chartSVG(item, scope, this.previewData);
      },

      onItemMouseDown(e, id) {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const multi = e.ctrlKey || e.metaKey || e.shiftKey;
        const wasSel = this.isSel(id);
        let base = wasSel ? [...this.selIds] : (multi ? [...this.selIds, id] : [id]);
        this.selIds = base;
        this.selectedSection = null;
        this.begin();
        this._drag = {
          kind: "move",
          startX: e.clientX, startY: e.clientY,
          moved: false,
          toggleId: multi && wasSel ? id : null,
          items: this.selectedItems().map(({ item, sectionKey }) => {
            const sec = this.sections().find((s) => s.key === sectionKey).sec;
            return { item, ox: item.x, oy: item.y, maxY: sec.height - item.height };
          }),
        };
      },

      onHandleMouseDown(e, dir) {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        this.begin();
        const sel = this.selectedItems().map((x) => x.item);
        if (!sel.length) return;
        const bb = this.selBBox();
        this._drag = {
          kind: "resize", dir,
          startX: e.clientX, startY: e.clientY,
          bbox: bb,
          items: sel.map((it) => ({ item: it, ox: it.x, oy: it.y, ow: it.width, oh: it.height })),
        };
      },

      onSectionResizeMouseDown(e, sectionKey) {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const sec = this.sections().find((s) => s.key === sectionKey).sec;
        this.begin();
        this._drag = { kind: "sectionResize", sec, startY: e.clientY, oh: sec.height };
      },

      selBBox() {
        const items = this.selectedItems().map((x) => x.item);
        if (!items.length) return null;
        const x1 = Math.min(...items.map((i) => i.x));
        const y1 = Math.min(...items.map((i) => i.y));
        const x2 = Math.max(...items.map((i) => i.x + i.width));
        const y2 = Math.max(...items.map((i) => i.y + i.height));
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      },
      selBBoxPx() {
        const bb = this.selBBox();
        if (!bb) return null;
        return { left: bb.x + "px", top: bb.y + "px", width: bb.w + "px", height: bb.h + "px" };
      },

      snap(v) { return this.gridSnap ? Math.round(v / this.gridSize) * this.gridSize : Math.round(v); },

      onMouseMove(e) {
        const d = this._drag;
        if (!d) return;
        const z = this.zoom;
        if (d.kind === "move") {
          const dx = (e.clientX - d.startX) / z, dy = (e.clientY - d.startY) / z;
          if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
          d.moved = true;
          const gdx = this.snap(dx), gdy = this.snap(dy);
          d.items.forEach((it) => {
            it.item.x = Math.max(0, Math.min(this.layout.width - it.item.width, it.ox + gdx));
            it.item.y = Math.max(0, Math.min(Math.max(0, it.maxY), it.oy + gdy));
          });
        } else if (d.kind === "resize") {
          const dx = this.snap((e.clientX - d.startX) / z), dy = this.snap((e.clientY - d.startY) / z);
          const bb = d.bbox;
          let scaleX = bb.w ? (bb.w + (d.dir.includes("e") ? dx : d.dir.includes("w") ? -dx : 0)) / bb.w : 1;
          let scaleY = bb.h ? (bb.h + (d.dir.includes("s") ? dy : d.dir.includes("n") ? -dy : 0)) / bb.h : 1;
          scaleX = Math.max(0.05, scaleX); scaleY = Math.max(0.05, scaleY);
          d.items.forEach((r) => {
            if (d.dir.includes("e") || d.dir.includes("w")) {
              r.item.width = Math.max(6, Math.round(r.ow * scaleX));
              r.item.x = d.dir.includes("w") ? r.ox + (r.ow - r.item.width) : r.ox;
            }
            if (d.dir.includes("n") || d.dir.includes("s")) {
              r.item.height = Math.max(6, Math.round(r.oh * scaleY));
              r.item.y = d.dir.includes("n") ? r.oy + (r.oh - r.item.height) : r.oy;
            }
            if (r.item.type === "line") r.item.height = 2;
          });
        } else if (d.kind === "sectionResize") {
          const dy = (e.clientY - d.startY) / z;
          d.sec.height = Math.max(24, Math.min(400, Math.round(d.oh + dy)));
        }
      },
      onMouseUp(e) {
        const d = this._drag;
        if (!d) return;
        this._drag = null;
        if (d.kind === "move" && d.toggleId && !d.moved) {
          this.selIds = this.selIds.filter((x) => x !== d.toggleId);
        }
        this.commit(d.kind === "sectionResize" ? "secResize" : d.kind);
      },

      /* ---------- section click / tools / drop ---------- */
      onSectionClick(e, sectionKey) {
        e.stopPropagation();
        if (this.tool === "select") { this.selectSection(sectionKey); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const x = this.snap((e.clientX - rect.left) / this.zoom);
        const y = this.snap((e.clientY - rect.top) / this.zoom);
        this.addItemAt(sectionKey, this.tool, x, y);
        this.tool = "select";
      },
      onCanvasClick() { this.clearSelection(); },

      addItemAt(sectionKey, type, x, y, extra = {}) {
        const sec = this.sections().find((s) => s.key === sectionKey).sec;
        const defs = {
          text: { width: 120, height: 20, text: "Teks baru" },
          image: { width: 90, height: 60, src: "" },
          barcode: { width: 150, height: 48, text: "1234567890" },
          chart: { width: 280, height: 180, text: "Grafik Baru", chartType: "bar", binding: "", labelField: "", valueField: "", showValues: true, showLegend: true },
          pivot: { width: 340, height: 140, text: "", binding: "", pivot: { row: "city", col: "tahun", value: "total", agg: "sum", rowTotal: true, colTotal: true } },
          line: { width: 140, height: 2, style: { borderColor: "#0f172a", borderWidth: 1 } },
        };
        const def = defs[type] || defs.text;
        const item = A().normalizeItem(Object.assign({ type, x: Math.max(0, x), y: Math.max(0, y) }, def, extra));
        if ((type === "chart" || type === "pivot") && !item.binding) {
          item.binding = this.layout.contentSection.binding || "content";
        }
        item.width = Math.min(item.width, this.layout.width - item.x);
        this.mutate(() => {
          sec.items.push(item);
          this.selIds = [item.id];
          this.selectedSection = null;
        });
        if (type === "image") this.pickImage(item.id);
      },
      onDropField(e, sectionKey) {
        e.preventDefault();
        e.stopPropagation();
        let f;
        try { f = JSON.parse(e.dataTransfer.getData("application/x-anka-field")); } catch (err) { return; }
        if (!f) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = this.snap((e.clientX - rect.left) / this.zoom);
        const y = this.snap((e.clientY - rect.top) / this.zoom);
        this.addItemAt(sectionKey, f.type || "text", x, y, { text: f.label, binding: f.field });
      },
      onFieldDragStart(e, field) {
        e.dataTransfer.setData("application/x-anka-field", JSON.stringify(field));
        e.dataTransfer.effectAllowed = "copy";
      },

      /* ---------- add sub group / remove ---------- */
      async addSubGroup() {
        const binding = await this.askPrompt("Binding sub group (nama array di dalam baris content, mis. 'items'):", "items");
        if (binding === null) return;
        this.mutate(() => {
          const g = { id: A().uid("gr"), height: 28, binding: binding.trim(), visible: true, style: { backgroundColor: "#ffffff" }, items: [] };
          this.layout.contentSection.groups.push(g);
          this.selectedSection = "group:" + g.id;
          this.selIds = [];
        });
        this.toast("Sub group ditambahkan");
      },
      async removeSubGroup() {
        if (!this.selectedSection?.startsWith("group:")) return;
        const id = this.selectedSection.slice(6);
        if (!(await this.askConfirm("Hapus sub group ini beserta isinya?"))) return;
        this.mutate(() => {
          const gs = this.layout.contentSection.groups;
          const i = gs.findIndex((g) => g.id === id);
          if (i >= 0) gs.splice(i, 1);
          this.selectedSection = null;
        });
      },

      /* ---------- delete / duplicate / copy-paste ---------- */
      deleteSelected() {
        if (!this.selIds.length) return;
        this.mutate(() => {
          for (const s of this.sections()) {
            s.sec.items = (s.sec.items || []).filter((it) => !this.selIds.includes(it.id));
          }
          this.selIds = [];
        });
        this.toast("Item dihapus");
      },
      duplicateSelected() {
        const sel = this.selectedItems();
        if (!sel.length) return;
        const newIds = [];
        this.mutate(() => {
          sel.forEach(({ item }) => {
            const copy = A().clone(item);
            copy.id = A().uid();
            copy.x += 8; copy.y += 8;
            const found = this.findItem(item.id);
            found.section.items.push(copy);
            newIds.push(copy.id);
          });
          this.selIds = newIds;
        });
        this.toast("Item diduplikasi");
      },
      copySelected() {
        this.clipboard = this.selectedItems().map((x) => A().clone(x.item));
        if (this.clipboard.length) this.toast(this.clipboard.length + " item disalin");
      },
      paste() {
        if (!this.clipboard.length) return;
        const targetKey = this.selectedItems()[0]?.sectionKey || this.selectedSection || "contentSection";
        const sec = this.sections().find((s) => s.key === targetKey).sec;
        const newIds = [];
        this.mutate(() => {
          this.clipboard.forEach((c) => {
            const copy = A().clone(c);
            copy.id = A().uid();
            copy.x += 10; copy.y += 10;
            sec.items.push(copy);
            newIds.push(copy.id);
          });
          this.selIds = newIds;
        });
      },

      /* ---------- align tools ---------- */
      align(mode) {
        const sel = this.selectedItems().map((x) => x.item);
        if (!sel.length) return;
        const bb = this.selBBox();
        this.mutate(() => {
          sel.forEach((it) => {
            switch (mode) {
              case "left": it.x = bb.x; break;
              case "center": it.x = Math.round(bb.x + (bb.w - it.width) / 2); break;
              case "right": it.x = bb.x + bb.w - it.width; break;
              case "top": it.y = bb.y; break;
              case "middle": it.y = Math.round(bb.y + (bb.h - it.height) / 2); break;
              case "bottom": it.y = bb.y + bb.h - it.height; break;
              case "sameW": it.width = bb.w; break;
              case "sameH": it.height = bb.h; break;
            }
          });
        }, "align");
      },

      /* ---------- image pick ---------- */
      pickImage(id) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            this.mutate(() => { const f = this.findItem(id); if (f) f.item.src = reader.result; });
          };
          reader.readAsDataURL(file);
        };
        input.click();
      },

      /* ---------- keyboard ---------- */
      onKeydown(e) {
        const tag = (e.target.tagName || "").toLowerCase();
        if (["input", "textarea", "select"].includes(tag) || e.target.isContentEditable) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
        if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
        if (mod && e.key.toLowerCase() === "c") { this.copySelected(); return; }
        if (mod && e.key.toLowerCase() === "v") { this.paste(); return; }
        if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); this.duplicateSelected(); return; }
        if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); this.selectAll(); return; }
        if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); this.save(); return; }
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); this.deleteSelected(); return; }
        if (e.key === "Escape") { this.clearSelection(); this.tool = "select"; return; }
        const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (arrows[e.key] && this.selIds.length) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const [dx, dy] = arrows[e.key];
          this.begin();
          this.selectedItems().forEach(({ item }) => {
            item.x = Math.max(0, item.x + dx * step);
            item.y = Math.max(0, item.y + dy * step);
          });
          this.commit("nudge");
        }
      },

      /* ---------- data & preview ---------- */
      // bangun ulang pohon Data Source dari previewData terkini
      refreshDataSource() {
        this.dataSource = A().dataSourceFromData(this.previewData);
      },
      openDataModal() {
        this.dataJsonText = JSON.stringify(this.previewData, null, 2);
        this.dataJsonError = "";
        this.showDataModal = true;
      },
      applyDataModal() {
        try {
          this.previewData = JSON.parse(this.dataJsonText);
          this.refreshDataSource();
          A().store.set(LS_DATA, JSON.stringify(this.previewData));
          this.showDataModal = false;
          this.toast("Data preview diperbarui");
        } catch (err) { this.dataJsonError = err.message; }
      },
      // muat data dari API JSON -> isi textarea modal (tinjau dulu, lalu Terapkan)
      async loadDataFromApi() {
        if (this.apiBusy) return;
        this.apiBusy = true;
        this.dataJsonError = "";
        try {
          const data = await A().fetchJson(this.apiUrl);
          this.dataJsonText = JSON.stringify(data, null, 2);
          this.toast("Data dari API dimuat ✓ — tinjau lalu klik Terapkan");
        } catch (err) {
          this.dataJsonError = err && err.message ? err.message : "Gagal memuat API";
        } finally {
          this.apiBusy = false;
        }
      },
      resetSampleData() {
        this.dataJsonText = JSON.stringify(A().sampleData(), null, 2);
        this.dataJsonError = "";
      },

      /* ---------- pengaturan sumber data (manual | api | query) ---------- */
      dsSpec() {
        return {
          dsType: this.dsType,
          apiUrl: (this.apiUrl || "").trim(),
          dsEndpoint: (this.dsEndpoint || "").trim(),
          dsQuery: this.dsQuery || "",
        };
      },
      // terapkan spesifikasi sumber data (dr init/import/pustaka) ke state
      applyDsSpec(spec) {
        if (!spec) return;
        this.dsType = spec.dsType || "manual";
        if (spec.apiUrl !== undefined) this.apiUrl = spec.apiUrl;
        if (spec.dsEndpoint !== undefined) this.dsEndpoint = spec.dsEndpoint;
        if (spec.dsQuery !== undefined) this.dsQuery = spec.dsQuery;
      },
      saveDsSettings() {
        A().store.set(LS_DS, JSON.stringify(this.dsSpec()));
        A().store.set(LS_PARAMS, JSON.stringify(this.normalizeParamDefs()));
        const np = this.normalizeParamDefs().length;
        this.dsMsg = this.t("settingsSavedMsg") + " (" + this.storageBackend + ")" + (np ? this.t("withParamsMsg", { n: np }) : "") + this.t("exportNote");
        this.toast(this.t("propsSaved"));
      },
      setDsType(t) { this.dsType = t; this.dsMsg = ""; },

      /* ---------- PARAMETER report (properti report) ---------- */
      // map nilai parameter saat ini (nilai uji = kolom Default) → dipakai Test Preview & substitusi {param}
      paramValues() {
        const v = {};
        this.normalizeParamDefs().forEach((p) => { v[p.name] = p.default ?? ""; });
        return v;
      },
      addParam() {
        let i = this.paramDefs.length + 1;
        while (this.paramDefs.some((p) => p && p.name === "param" + i)) i++;
        this.paramDefs.push({ name: "param" + i, label: "", type: "text", default: "", options: null, field: "" });
        this.dsMsg = "";
      },
      removeParam(i) { this.paramDefs.splice(i, 1); },
      // rapikan definisi: buang baris tanpa nama, label/field default → name
      normalizeParamDefs() {
        return A().normalizeParams(
          this.paramDefs
            .filter((p) => p && String(p.name || "").trim())
            .map((p) => ({ ...p, name: String(p.name).trim(), label: p.label || p.name, field: p.field || p.name }))
        );
      },
      optsText(p) { return (p.options || []).join(", "); },
      setParamOptions(p, ev) {
        const arr = String((ev && ev.target && ev.target.value) || "").split(",").map((s) => s.trim()).filter(Boolean);
        p.options = arr.length ? arr : null;
      },
      // data untuk Test Preview: filter baris content menurut parameter + sediakan {params}/{p} utk ekspresi
      previewWithParams() {
        const defs = this.normalizeParamDefs();
        if (!defs.length) return this.previewData;
        const params = this.paramValues();
        let data = this.previewData;
        if (Array.isArray(data && data.content)) {
          const active = defs.filter((p) => { const v = params[p.name]; return v !== "" && v != null && String(v).toLowerCase() !== "semua"; });
          if (active.length) {
            data = Object.assign({}, data, {
              content: data.content.filter((row) => active.every((p) => String(A().resolveBinding(p.field || p.name, row, data)) === String(params[p.name]))),
            });
          }
        }
        return Object.assign({}, data, { params, p: params });
      },

      /* Ambil data sesuai pengaturan sumber, jadikan data preview. Return true bila sukses. */
      async fetchDsData() {
        const s = this.dsSpec();
        const params = this.paramValues(); // {param} di URL/query diganti nilai Default parameter
        if (s.dsType === "api") {
          if (!s.apiUrl) throw new Error(this.t("apiEmpty"));
          return await A().fetchJson(A().substituteParams(s.apiUrl, params));
        }
        if (s.dsType === "query") {
          if (!s.dsEndpoint) throw new Error(this.t("endpointEmpty"));
          if (!s.dsQuery.trim()) throw new Error(this.t("queryEmpty"));
          return await A().fetchQuery(s.dsEndpoint, s.dsQuery, params);
        }
        return this.previewData; // manual: pakai data JSON yang ada
      },
      async testDs() {
        if (this.dsBusy) return;
        this.dsBusy = true; this.dsMsg = this.t("loadingMsg");
        try {
          const data = await this.fetchDsData();
          this.previewData = data;
          this.refreshDataSource();
          A().store.set(LS_DATA, JSON.stringify(data));
          const n = Array.isArray(data && data.content) ? data.content.length : null;
          this.dsMsg = n !== null ? this.t("rowsLoaded", { n }) : this.t("objLoaded");
          this.toast(this.t("dataFromLoaded", { src: this.t(this.dsType === "query" ? "srcQuery" : this.dsType === "api" ? "srcApi" : "srcJson") }));
          return true;
        } catch (err) {
          this.dsMsg = "⚠ " + (err && err.message ? err.message : "Gagal memuat");
          return false;
        } finally {
          this.dsBusy = false;
        }
      },

      /* ---------- AUTO-GENERATE LAYOUT dari sumber data (manual / API / query) ---------- */
      // cari array baris utama di data: utamakan "content", lalu array-berisi-objek pertama yang ditemukan
      detectDataArray(data) {
        if (!data || typeof data !== "object") return null;
        const asRows = (key) => {
          const rows = data[key];
          return Array.isArray(rows) && rows.length && typeof rows[0] === "object" && rows[0] !== null && !Array.isArray(rows[0]) ? rows : null;
        };
        let binding = null, rows = asRows("content");
        if (rows) binding = "content";
        if (!rows) for (const k in data) { rows = asRows(k); if (rows) { binding = k; break; } }
        if (!rows) return null;
        // union field (urut kemunculan) sampel ≤50 baris pertama
        const sample = rows.slice(0, 50);
        const names = [];
        sample.forEach((r) => Object.keys(r || {}).forEach((k) => { if (!names.includes(k)) names.push(k); }));
        if (!names.length) return null;
        const fields = names.map((name) => {
          const vals = sample.map((r) => r[name]).filter((v) => v !== undefined && v !== null && v !== "");
          const numeric = !!vals.length && vals.every((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(+v)));
          return { name, numeric };
        });
        return { binding, rows, fields };
      },

      // susun layout lengkap (judul, header kolom berulang, baris data, footer total) — bilingual ikut bahasa aktif
      generateAutoLayout(det) {
        const t = (k, v) => this.t(k, v);
        const MAXC = 8;
        const shown = det.fields.slice(0, MAXC);
        const rest = det.fields.length - shown.length;
        const CW = 700; // lebar area konten A4
        const NUMW = 96;
        const nText = Math.max(1, shown.filter((f) => !f.numeric).length);
        const wText = Math.floor((CW - shown.filter((f) => f.numeric).length * NUMW) / nText);
        let acc = 0;
        const cols = shown.map((f) => { const w = f.numeric ? NUMW : wText; const c = { f, x: acc, w }; acc += w; return c; });
        // header kolom di pageHeader -> terulang di setiap halaman
        const colHead = cols.map(({ f, x, w }) => ({
          type: "text", text: f.name, binding: "", x: x + 4, y: 22, width: Math.max(24, w - 8), height: 16,
          style: { fontSize: 10, fontWeight: "bold", color: "#0f172a", textAlign: f.numeric ? "right" : "left" },
        }));
        colHead.push({ type: "line", text: "", binding: "", x: 0, y: 40, width: CW, height: 1, style: { borderColor: "#94a3b8", borderWidth: 1 } });
        // baris data (per record) — nominal (total/harga/price/amount/jumlah) ditebalkan
        const colRow = cols.map(({ f, x, w }) => ({
          type: "text", text: "", binding: f.name, x: x + 4, y: 8, width: Math.max(24, w - 8), height: 18,
          style: { fontSize: 10, color: "#0f172a", textAlign: f.numeric ? "right" : "left", fontWeight: /total|amount|jumlah|price|harga/i.test(f.name) ? "bold" : "normal" },
        }));
        colRow.push({ type: "line", text: "", binding: "", x: 0, y: 30, width: CW, height: 1, style: { borderColor: "#e2e8f0", borderWidth: 1 } });
        // footer: jumlah baris + total 1–2 kolom numerik terakhir
        const nums = det.fields.filter((f) => f.numeric).slice(-2);
        const totalTxt = nums.map((f) => t("autoTotal", { f: f.name })).join(" — ");
        // baris parameter kanan atas (Periode {params.x})
        const ps = this.normalizeParamDefs();
        const paramLines = ps.map((p, i) => ({
          type: "text", text: (i ? "" : t("autoParamLine")) + p.label + ": {params." + p.name + "}", binding: "",
          x: 460, y: 14 + i * 20, width: 222, height: 14,
          style: { color: i ? "#ccfbf1" : "#ffffff", fontSize: i ? 10 : 13, fontWeight: i ? "normal" : "bold", textAlign: "right" },
        }));
        return {
          version: 2,
          name: t("autoTitle"),
          width: CW,
          page: { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: true },
          pageHeaderSection: {
            height: 44, visible: true, style: {},
            items: [
              { type: "text", text: t("autoColsNote", { shown: shown.length, total: det.fields.length, binding: det.binding }) + (rest ? "  •  " + t("autoMoreCols", { n: rest, names: det.fields.slice(MAXC).map((f) => f.name).join(", ") }) : ""), binding: "", x: 0, y: 4, width: 500, height: 13, style: { fontSize: 8, color: "#94a3b8" } },
              { type: "text", text: t("autoPrinted"), binding: "", x: 520, y: 4, width: 180, height: 13, style: { fontSize: 8, color: "#94a3b8", textAlign: "right" } },
              ...colHead,
            ],
          },
          headerSection: {
            height: Math.max(64, 24 + ps.length * 20), visible: true, style: { backgroundColor: "#0f766e" },
            items: [
              { type: "text", text: t("autoTitle"), binding: "", x: 18, y: 14, width: 430, height: 24, style: { color: "#ffffff", fontSize: 16, fontWeight: "bold" } },
              { type: "text", text: t("autoSub") + " — " + det.binding + " (" + det.rows.length + " " + t("autoRows") + ")", binding: "", x: 18, y: 40, width: 430, height: 14, style: { color: "#ccfbf1", fontSize: 10 } },
              ...paramLines,
            ],
          },
          contentSection: { height: 34, binding: det.binding, visible: true, style: {}, groups: [], items: colRow },
          footerSection: {
            height: 44, visible: true, style: { backgroundColor: "#f0fdfa" },
            items: [
              { type: "text", text: t("autoCount") + (totalTxt ? " — " + totalTxt : ""), binding: "", x: 12, y: 8, width: 660, height: 15, style: { fontSize: 11, fontWeight: "bold", color: "#0f172a" } },
              { type: "text", text: t("autoSub") + " • SatuReport ({Now})", binding: "", x: 12, y: 26, width: 400, height: 12, style: { fontSize: 8, color: "#64748b" } },
            ],
          },
          pageFooterSection: { height: 30, visible: true, style: {}, items: [
            { type: "text", text: t("autoPageInfo"), binding: "", x: 200, y: 8, width: 300, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "center" } },
          ] },
        };
      },

      // tombol 🪄: deteksi array dari data sumber (manual/API/query yg sudah di-Test) -> konfirmasi -> terapkan
      async autoLayout() {
        const det = this.detectDataArray(this.previewData);
        if (!det) { this.toast(this.t("autoNoArray")); return false; }
        const cols = Math.min(det.fields.length, 8);
        const hasItems = Object.keys(this.layout || {}).some((k) => /Section$/.test(k) && this.layout[k] && (this.layout[k].items || []).length);
        if (hasItems) {
          const yes = await this.askConfirm(this.t("autoConfirm", { rows: det.rows.length, cols, binding: det.binding }));
          if (!yes) return false;
        }
        const L = this.generateAutoLayout(det);
        this.mutate(() => { this.layout = A().normalizeLayout(L); this.selIds = []; this.selectedSection = null; });
        this.toast(this.t("autoDone", { cols, binding: det.binding, rows: det.rows.length }));
        return true;
      },

      /* ---------- TEST PREVIEW REPORT (render langsung di dalam designer) ---------- */
      async testPreview() {
        // ambil data dari sumber terlebih dulu (API/query); manual pakai data yg ada
        if (this.dsType !== "manual") {
          const okFetch = await this.testDs();
          if (!okFetch) this.toast(this.t("previewFetchFail"));
        }
        this.previewModal = true;
        this.previewZoom = 1;
        this.$nextTick(() => this.renderPreviewSheets());
      },
      renderPreviewSheets() {
        const host = document.getElementById("ds-preview-host");
        if (!host) return;
        host.innerHTML = "";
        try {
          const { sheets, total, size } = A().renderPages({ layout: this.layout, data: this.previewWithParams() });
          this._pv = { sheets, total, size };
        } catch (err) {
          host.innerHTML = '<div style="padding:40px;text-align:center;color:#fca5a5">Gagal render: ' + A().esc(err.message) + "</div>";
          return;
        }
        this._pvPaint(host);
      },
      _pvPaint(host) {
        const p = this._pv; if (!p) return;
        host.innerHTML = "";
        p.sheets.forEach((sh) => {
          sh.style.transform = `scale(${this.previewZoom})`;
          sh.style.transformOrigin = "top center";
          const wrap = document.createElement("div");
          wrap.style.cssText = `width:${p.size.w * this.previewZoom}px;height:${p.size.h * this.previewZoom}px;margin:0 auto 20px;`;
          wrap.className = "shadow-[0_20px_60px_rgba(0,0,0,.5)]";
          wrap.appendChild(sh);
          host.appendChild(wrap);
        });
      },
      pvZoom(d) {
        this.previewZoom = Math.min(2, Math.max(0.3, +(this.previewZoom + d).toFixed(2)));
        const host = document.getElementById("ds-preview-host");
        if (host) this._pvPaint(host);
      },
      pvFit() {
        const p = this._pv; if (!p) return;
        const iw = (typeof window !== "undefined" && window.innerWidth) || 900;
        const modalW = Math.min(iw - 48, 1000);
        this.previewZoom = Math.max(0.3, +(modalW / p.size.w).toFixed(2));
        const host = document.getElementById("ds-preview-host");
        if (host) this._pvPaint(host);
      },

      flatFields() {
        const out = [];
        const walk = (nodes, prefix) => {
          (nodes || []).forEach((n) => {
            if (n.children && n.children.length) walk(n.children, prefix ? prefix + "." + n.field : n.field);
            else out.push({ label: (n.label || n.field), field: prefix ? n.field : n.field, full: prefix ? prefix + " / " + (n.label || n.field) : (n.label || n.field) });
          });
        };
        walk(this.dataSource, "");
        return out;
      },
      specialFields() {
        return [
          { label: "📄 No. Halaman", field: "__page" },
          { label: "🔢 No. Baris", field: "__row" },
          { label: "🧾 Jumlah Baris", field: "__count" },
          { label: "🕒 Tanggal Cetak", field: "__now" },
        ];
      },

      /* ---------- perpustakaan layout (IndexedDB) ---------- */
      libIndex() {
        try { return JSON.parse(A().store.get("satureport.lib.index") || "[]"); }
        catch (e) { return []; }
      },
      saveLibIndex(idx) { A().store.set("satureport.lib.index", JSON.stringify(idx)); },
      openLibModal() { this.showLibModal = true; },
      async saveLibAs() {
        const idx = this.libIndex();
        const cur = idx.find((e) => e.current);
        const name = await this.askPrompt("Nama layout:", cur ? cur.name : (this.layout.name || "Layout Tanpa Nama"));
        if (name === null) return;
        const id = cur ? cur.id : A().uid("lib");
        const entry = { id, name: name.trim() || "Layout Tanpa Nama", savedAt: Date.now(), current: true };
        const next = idx.filter((e) => e.id !== id).map((e) => ({ ...e, current: false }));
        next.unshift(entry);
        const stored = { ...entry, layout: this.layout, data: this.previewData };
        {
          const s = this.dsSpec();
          if (s.dsType === "api" && s.apiUrl) stored.API = s.apiUrl;
          else if (s.dsType === "query" && s.dsQuery.trim() && s.dsEndpoint) { stored.query = s.dsQuery; stored.endpoint = s.dsEndpoint; }
          const ps = this.normalizeParamDefs();
          if (ps.length) stored.params = ps; // properti parameter ikut tersimpan di pustakaan
        }
        A().store.set("satureport.lib." + id, JSON.stringify(stored));
        this.saveLibIndex(next);
        this.save(); // sekaligus slot autosave
        this.toast("Tersimpan di perpustakaan: " + entry.name + " ✓");
      },
      openLib(id) {
        const raw = A().store.get("satureport.lib." + id);
        if (!raw) return;
        try {
          const entry = JSON.parse(raw);
          this.mutate(() => {
            this.layout = A().normalizeLayout(entry.layout);
            this.selIds = []; this.selectedSection = null;
          });
          const dataIsQuery = !!(entry.data && typeof entry.data.query === "string" && typeof entry.data.endpoint === "string");
          if (entry.data && !dataIsQuery) {
            this.previewData = entry.data;
            this.refreshDataSource();
            A().store.set(LS_DATA, JSON.stringify(entry.data));
          }
          const qSpec = (entry.query && entry.endpoint) ? entry : (dataIsQuery ? entry.data : null);
          if (qSpec) {
            this.applyDsSpec({ dsType: "query", dsQuery: qSpec.query, dsEndpoint: qSpec.endpoint });
          } else if (entry.API || entry.apiUrl) {
            this.applyDsSpec({ dsType: "api", apiUrl: entry.API || entry.apiUrl });
          }
          A().store.set(LS_DS, JSON.stringify(this.dsSpec()));
          if (Array.isArray(entry.params) && entry.params.length) {
            this.paramDefs = A().normalizeParams(entry.params);
            A().store.set(LS_PARAMS, JSON.stringify(this.paramDefs));
          }
          this.saveLibIndex(this.libIndex().map((e) => ({ ...e, current: e.id === id })));
          this.showLibModal = false;
          this.toast("Layout dibuka: " + entry.name);
        } catch (e) { this.toast("Data layout rusak: " + e.message); }
      },
      async renameLib(id) {
        const idx = this.libIndex();
        const e = idx.find((x) => x.id === id);
        if (!e) return;
        const name = await this.askPrompt("Ubah nama layout:", e.name);
        if (name === null || !name.trim()) return;
        e.name = name.trim();
        this.saveLibIndex(idx);
        const raw = A().store.get("satureport.lib." + id);
        if (raw) {
          try { const entry = JSON.parse(raw); entry.name = e.name; A().store.set("satureport.lib." + id, JSON.stringify(entry)); } catch (er) {}
        }
      },
      async delLib(id) {
        if (!(await this.askConfirm("Hapus layout ini dari perpustakaan?"))) return;
        A().store.del("satureport.lib." + id);
        this.saveLibIndex(this.libIndex().filter((e) => e.id !== id));
        this.toast("Layout dihapus dari perpustakaan");
      },
      exportLib(id) {
        const raw = A().store.get("satureport.lib." + id);
        if (!raw) return;
        try {
          const entry = JSON.parse(raw);
          const pkg = { name: entry.name, layout: entry.layout, data: entry.data };
          if (entry.API || entry.apiUrl) pkg.API = entry.API || entry.apiUrl;
          if (entry.query && entry.endpoint) { pkg.query = entry.query; pkg.endpoint = entry.endpoint; }
          if (Array.isArray(entry.params) && entry.params.length) pkg.params = entry.params;
          this.openExportModal(JSON.stringify(pkg, null, 2), this.slugFilename(entry.name) + ".satureport.json");
        } catch (e) {}
      },
      libItems() { return this.libIndex(); },
      libItemsWithMeta() {
        return this.libIndex().map((e) => {
          let count = 0;
          const raw = A().store.get("satureport.lib." + e.id);
          if (raw) {
            try {
              const entry = JSON.parse(raw);
              const L = A().normalizeLayout(entry.layout || {});
              count = ["pageHeaderSection", "headerSection", "contentSection", "footerSection", "pageFooterSection"]
                .reduce((a, k) => a + (L[k]?.items?.length || 0), 0);
            } catch (er) {}
          }
          return { ...e, itemCount: count };
        });
      },

      /* ---------- export JSON ke file (modal dengan 3 opsi) ---------- */
      // satu file paket: {name, layout, data} (+ API / query+endpoint sesuai pengaturan sumber data)
      buildExportPayload() {
        if (!this.exportWithData) return JSON.stringify(this.layout, null, 2);
        const pkg = { name: this.layout.name || "Layout Tanpa Nama", layout: this.layout, data: this.previewData };
        const s = this.dsSpec();
        if (s.dsType === "api" && s.apiUrl) pkg.API = s.apiUrl;
        else if (s.dsType === "query" && s.dsQuery.trim() && s.dsEndpoint) { pkg.query = s.dsQuery; pkg.endpoint = s.dsEndpoint; }
        const ps = this.normalizeParamDefs();
        if (ps.length) pkg.params = ps; // properti parameter report → form parameter di Viewer
        return JSON.stringify(pkg, null, 2);
      },
      refreshExportJson() {
        if (!this.exportModal) return;
        this.exportJson = this.buildExportPayload();
        this.exportFilename = this.slugFilename(this.layout.name || "layout-satureport") + (this.exportWithData ? ".satureport.json" : ".json");
      },
      openExportModal(payloadJson, filename) {
        if (payloadJson) {
          this.exportJson = payloadJson;
          this.exportFilename = filename || "layout.json";
        } else {
          this.exportJson = this.buildExportPayload();
          this.exportFilename = this.slugFilename(this.layout.name || "layout-satureport") + (this.exportWithData ? ".satureport.json" : ".json");
        }
        this.showLibModal = false;
        this.showDataModal = false;
        this.exportModal = true;
      },
      slugFilename(s) { return (s || "layout-satureport").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); },
      downloadExportJson() {
        A().download(this.exportJson, this.exportFilename || "layout.json", "application/json");
        this.toast("Unduhan dimulai — bila tidak muncul, gunakan 'Salin JSON'");
      },
      async saveAsExportJson() {
        const r = await A().saveFileSmart(this.exportJson, this.exportFilename || "layout.json", "application/json");
        if (r === "saved") { this.exportModal = false; this.toast("Layout disimpan ke file ✓"); }
        else if (r === "downloaded") this.toast("Unduhan dimulai — bila file tidak muncul (pratinjau sandbox), gunakan 📋 Salin JSON");
        else if (r !== "aborted") this.toast("Save As diblokir browser di pratinjau — klik 📋 Salin JSON, tempel ke editor & simpan sebagai .json");
      },
      async copyExportJson() {
        const okc = await A().copyText(this.exportJson);
        this.toast(okc ? "JSON disalin ke clipboard ✓ — tempel ke editor & simpan sebagai .json" : "Gagal menyalin — blok teks di atas lalu Ctrl+C");
      },

      /* ---------- file ops ---------- */
      save() {
        A().store.set(LS_LAYOUT, JSON.stringify(this.layout));
        A().store.set(LS_DATA, JSON.stringify(this.previewData));
        this.toast("Layout tersimpan ✓ (" + this.storageBackend + ")");
      },
      exportLayout() { this.openExportModal(); },
      async newLayout() {
        if (!(await this.askConfirm("Buat layout baru? Layout dan data preview akan dikosongkan."))) return;
        this.mutate(() => {
          this.layout = A().emptyLayout();
          this.selIds = []; this.selectedSection = null;
        });
        // bersihkan juga data preview + panel Data Source
        this.previewData = {};
        this.refreshDataSource();
        A().store.set(LS_DATA, "{}");
        this.toast("Layout baru dibuat (data dikosongkan)");
      },
      loadSample() {
        this.mutate(() => {
          this.layout = A().sampleLayout();
          this.selIds = []; this.selectedSection = null;
        });
        this.toast("Contoh layout dimuat");
      },
      importLayout() {
        const input = document.createElement("input");
        input.type = "file"; input.accept = ".json,application/json";
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result);
              // dukung format: layout polos ATAU paket {name?, layout, data}
              const entry = parsed && parsed.layout ? parsed : { layout: parsed };
              this.mutate(() => {
                this.layout = A().normalizeLayout(entry.layout);
                this.selIds = []; this.selectedSection = null;
              });
              // data bisa berisi dokumen data ATAU pengaturan kueri {query, endpoint}
              const dataIsQuery = !!(entry.data && typeof entry.data.query === "string" && typeof entry.data.endpoint === "string");
              if (entry.data && !dataIsQuery) {
                this.previewData = entry.data;
                this.refreshDataSource();
                A().store.set(LS_DATA, JSON.stringify(entry.data));
              }
              // pulihkan pengaturan sumber data dari paket (root entry ATAU di dalam data)
              const qSpec = (entry.query && entry.endpoint) ? entry : (dataIsQuery ? entry.data : null);
              if (qSpec) {
                this.applyDsSpec({ dsType: "query", dsQuery: qSpec.query, dsEndpoint: qSpec.endpoint });
              } else if (entry.API || entry.apiUrl) {
                this.applyDsSpec({ dsType: "api", apiUrl: entry.API || entry.apiUrl });
              } else {
                this.applyDsSpec({ dsType: "manual" });
              }
              A().store.set(LS_DS, JSON.stringify(this.dsSpec()));
              if (Array.isArray(entry.params) && entry.params.length) {
                this.paramDefs = A().normalizeParams(entry.params);
                A().store.set(LS_PARAMS, JSON.stringify(this.paramDefs));
              }
              this.toast("Layout diimpor" + (entry.name ? ": " + entry.name : "") + " ✓" + (entry.API ? " (+API)" : qSpec ? " (+query)" : "") + (Array.isArray(entry.params) && entry.params.length ? " (+" + entry.params.length + " param)" : ""));
            } catch (err) { this.toast("File tidak valid: " + err.message); }
          };
          reader.readAsText(file);
        };
        input.click();
      },

      /* ---------- preview & export ---------- */
      makePageForPrint() {
        return A().render({ layout: this.layout, data: this.previewData });
      },
      async preview() {
        await A().store.setAwait(LS_PREVIEW, JSON.stringify({ layout: this.layout, data: this.previewData, savedAt: Date.now() }));
        const w = window.open("viewer.html", "_blank");
        if (!w) this.toast("Popup diblokir — buka viewer.html secara manual");
      },
      exportPDF() {
        if (!A().printHTML(this.makePageForPrint(), "SatuReport")) this.toast("Popup cetak diblokir — izinkan popup untuk export PDF");
      },
      exportXLSX() {
        const bytes = A().buildXLSX(this.layout, this.previewData, "Report");
        A().download(bytes, "report-satureport.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        this.toast("XLSX diexport ✓");
      },

      /* ---------- zoom ---------- */
      zoomIn() { this.zoom = Math.min(2, Math.round((this.zoom + 0.1) * 10) / 10); },
      zoomOut() { this.zoom = Math.max(0.4, Math.round((this.zoom - 0.1) * 10) / 10); },
      zoomReset() { this.zoom = 1; },

      /* ---------- property panel helpers ---------- */
      updItem(key, value, isNum = false) {
        const f = this.singleItem();
        if (!f) return;
        this.mutate(() => { f.item[key] = isNum ? A().num(value) : value; }, "prop");
      },
      // ubah konfigurasi nested elemen pivot: pivot.row / pivot.col / pivot.value / pivot.agg / pivot.rowTotal / pivot.colTotal
      updPivot(key, value) {
        const f = this.singleItem();
        if (!f) return;
        this.mutate(() => {
          if (!f.item.pivot) f.item.pivot = { row: "city", col: "tahun", value: "total", agg: "sum", rowTotal: true, colTotal: true };
          f.item.pivot[key] = value;
        }, "prop");
      },
      updStyle(key, value, isNum = false) {
        const sel = this.selectedItems();
        sel.forEach(({ item }) => {
          if (item.type === "line" && key === "height") return;
          if (isNum) item.style[key] = value === "" ? undefined : A().num(value);
          else item.style[key] = value === "" ? undefined : value;
        });
      },
      commitStyle() { this.commit("style"); },
      beginStyle() { this.begin(); },
      updSection(key, value, isNum = false) {
        const s = this.sections().find((x) => x.key === this.selectedSection);
        if (!s) return;
        this.mutate(() => { s.sec[key] = isNum ? A().num(value) : value; }, "secprop");
      },
      updSectionStyle(key, value) {
        const s = this.sections().find((x) => x.key === this.selectedSection);
        if (!s) return;
        this.mutate(() => { s.sec.style[key] = value === "" ? undefined : value; }, "secprop");
      },
      sectionOf(key) { return this.sections().find((x) => x.key === key)?.sec; },

      itemTypeLabel(t) {
        return { text: "Teks", image: "Gambar", barcode: "Barcode", chart: "Grafik", line: "Garis" }[t] || t;
      },
      itemLabel(it) {
        return it.name || it.text || it.binding || this.itemTypeLabel(it.type);
      },
    };
  };
})();
