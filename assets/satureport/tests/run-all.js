/* ============================================================
 * SatuReport Offline — Suite Uji Headless Lengkap
 * Jalankan:  node tests/run-all.js
 * Mensimulasikan lingkungan sandbox (localStorage diblokir,
 * popup diblokir, IndexedDB shim) lalu menguji seluruh fitur.
 * ============================================================ */
const fs = require("fs");
const R = __dirname + "/../";
let fail = 0;
const ok = (n, c, info = "") => { if (!c) { fail++; console.error("  ✗", n, info); } else console.log("  ✓", n); };
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/* ---------- stub DOM & IndexedDB shim ---------- */
const elBase = () => ({
  style: {}, innerHTML: "", appendChild() {}, remove() {}, focus() {},
  select() { this._selected = true; },
  click() { if (this.onchange) this.onchange(); },
  value: "",
});
let nextFileContent = null;
globalThis.document = {
  addEventListener() {}, body: elBase(),
  getElementById: () => elBase(),
  createElement(tag) {
    const e = elBase();
    if (tag === "input") Object.defineProperty(e, "files", { get() { return nextFileContent ? [nextFileContent] : []; } });
    return e;
  },
};
globalThis.FileReader = class { readAsText(f) { this.result = f; setTimeout(() => this.onload && this.onload(), 0); } };
if (!URL.createObjectURL) { URL.createObjectURL = () => "blob:x"; URL.revokeObjectURL = () => {}; }

function makeIDBShim() {
  let store = {};
  return {
    open() {
      const req = {};
      setTimeout(() => { req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); }, 0);
      req.result = {
        createObjectStore() {},
        transaction() {
          const cp = { oncomplete: null };
          setTimeout(() => cp.oncomplete && cp.oncomplete(), 1);
          return {
            set oncomplete(f) { cp.oncomplete = f; }, set onerror(f) {}, set onabort(f) {},
            objectStore() {
              return {
                put(v, k) { store[k] = v; },
                delete(k) { delete store[k]; },
                get(k) { const rq = {}; setTimeout(() => { rq.result = store[k]; rq.onsuccess && rq.onsuccess(); }, 0); return rq; },
                openCursor() {
                  const rq = {};
                  setTimeout(() => {
                    const ks = Object.keys(store); let i = 0;
                    const step = () => {
                      if (i < ks.length) { const k = ks[i++]; rq.result = { key: k, value: store[k], continue() { rq.result = undefined; setTimeout(step, 0); } }; }
                      else rq.result = null;
                      rq.onsuccess && rq.onsuccess();
                    };
                    step();
                  }, 0);
                  return rq;
                },
              };
            },
          };
        },
      };
      return req;
    },
    _dump: () => store,
  };
}
const shim = makeIDBShim();
globalThis.indexedDB = shim;
globalThis.window = {
  localStorage: { getItem() { throw new Error("sandbox"); }, setItem() { throw new Error("sandbox"); }, removeItem() { throw new Error("sandbox"); }, key() { throw new Error("sandbox"); }, length: 0 },
  location: { search: "", href: "" }, open: () => null, addEventListener() {},
  showSaveFilePicker: undefined,
};
globalThis.location = window.location;
// Simulasi sandbox offline: dialog native diblokir diam-diam (confirm->false, prompt->null)
globalThis.prompt = () => null;
globalThis.confirm = () => false;
globalThis.alert = () => {};

eval(fs.readFileSync(R + "js/report-core.js", "utf8"));
eval(fs.readFileSync(R + "js/i18n.js", "utf8"));
eval(fs.readFileSync(R + "examples/examples.js", "utf8"));
eval(fs.readFileSync(R + "js/designer.js", "utf8"));
eval(fs.readFileSync(R + "js/viewer.js", "utf8"));
const A = window.SatuReport;
const EX = window.SATU_EXAMPLES;
window.SatuI18n.setLang("id"); // test deterministik: default Bahasa Indonesia

(async () => {
  /* ============ CORE: ekspresi & chart & paginasi ============ */
  console.log("== CORE: parser, ekspresi ==");
  ok("toNum id-ID", A.toNum("12.500.000") === 12500000);
  ok("toNum en", A.toNum("12,500.50") === 12500.5);
  const rows = [{ qty: 2, price: 1000 }, { qty: 3, price: 2000 }, { qty: 5, price: 500 }];
  const ctx = { aggRows: rows, page: 2, pages: 5, row: 1, count: 3 };
  ok("Sum", A.evalExpr("Sum(qty)", {}, {}, ctx) === 10);
  ok("Avg", A.evalExpr("Avg(qty)", {}, {}, ctx) === 3.33);
  ok("Count + PageNo", A.evalTemplate("{Count()} baris, hal {PageNo}/{PageCount}", {}, {}, ctx) === "3 baris, hal 2/5");
  ok("__pages", A.resolveSpecial("__pages", { pages: 4 }) === "4");
  ok("paperSize landscape swap", A.paperSize("A4", "landscape").w === 1123);

  console.log("== CORE: chart ==");
  const exChart = EX.byId("sales-chart");
  const line = exChart.layout.footerSection.items.find((i) => i.chartType === "line");
  const svg = A.chartSVG(line, exChart.data, exChart.data);
  ok("line chart 9 titik", (svg.match(/<circle/g) || []).length === 9);
  const donut = A.chartSVG(exChart.layout.footerSection.items.find((i) => i.chartType === "donut"), exChart.data, exChart.data);
  ok("donut 5 slice", (donut.match(/<path/g) || []).length === 5);
  ok("chart kosong -> placeholder", A.chartSVG({ binding: "zzz" }, {}, {}).includes("Tidak ada data"));

  console.log("== CORE: paginasi ==");
  const exInv = EX.byId("invoice");
  const P = A.renderPages({ layout: exInv.layout, data: exInv.data });
  ok("invoice multi-halaman", P.total >= 2, "total=" + P.total);
  ok("sheet2 PageHeader", P.sheets[1].innerHTML.includes("PT SATU SEJAHTERA — Faktur Penjualan"));
  ok("nomor halaman benar", P.sheets[1].innerHTML.includes("Halaman 2 dari " + P.total));
  ok("grand total tampil", P.sheets.some((s) => s.innerHTML.includes(exInv.data.totals.grand)));

  console.log("== CORE: xlsx ==");
  const xb = A.buildXLSX(A.normalizeLayout(exInv.layout), exInv.data);
  ok("xlsx zip valid", xb[0] === 0x50 && xb[1] === 0x4b);

  /* ============ STORAGE: IDB & perpustakaan ============ */
  console.log("== INDEXEDDB & STORE ==");
  await A.idb.set("k1", "v1");
  ok("idb set/get", (await A.idb.get("k1")) === "v1");
  const backend = await A.store.ready();
  ok("backend indexeddb", backend === "indexeddb", backend);

  const c = window.reportDesigner();
  c.$watch = () => {};
  await c.init();
  ok("designer init backend", c.storageBackend === "indexeddb");

  console.log("== PERPUSTAKAAN (dialog in-app, tanpa confirm/prompt native) ==");
  // helper: jalankan aksi, lalu jawab dialog in-app yang terbuka
  const okPrompt = (v) => { if (!c.pmOpen) throw new Error("dialog prompt tidak terbuka"); c.pmValue = v; c.pmAnswer(true); };
  const okConfirm = () => { if (!c.cfOpen) throw new Error("dialog konfirmasi tidak terbuka"); c.cfAnswer(true); };
  // batal prompt -> tidak menambah entri
  let p = c.saveLibAs();
  ok("dialog prompt terbuka", c.pmOpen === true);
  c.pmAnswer(false); await p;
  ok("batal prompt -> tidak tersimpan", c.libIndex().length === 0);
  // simpan bernama
  p = c.saveLibAs(); okPrompt("Invoice Bulanan"); await p;
  let idx = c.libIndex();
  ok("simpan bernama", idx.length === 1 && idx[0].name === "Invoice Bulanan");
  const libId = idx[0].id;
  await tick();
  ok("tersalin ke idb", !!shim._dump()["satureport.lib." + libId]);
  ok("meta itemCount", c.libItemsWithMeta()[0].itemCount > 0);
  // konfirmasi batal -> layout tidak berubah
  const nSebelum = c.allItems().length;
  p = c.newLayout();
  ok("dialog konfirmasi terbuka", c.cfOpen === true);
  c.cfAnswer(false); await p;
  ok("batal konfirmasi -> layout utuh", c.allItems().length === nSebelum);
  // konfirmasi ya -> layout direset
  p = c.newLayout(); okConfirm(); await p;
  c.openLib(libId);
  ok("buka dari pustaka", c.allItems().length > 1);
  p = c.renameLib(libId); okPrompt("Invoice Tahunan"); await p;
  ok("ganti nama", c.libIndex()[0].name === "Invoice Tahunan");
  p = c.delLib(libId); okConfirm(); await p;
  await tick(30);
  ok("hapus + idb bersih", c.libIndex().length === 0 && !shim._dump()["satureport.lib." + libId]);

  /* ============ EXPORT JSON MODAL & IMPORT ============ */
  console.log("== EXPORT JSON MODAL ==");
  c.openExportModal();
  ok("modal + json valid", c.exportModal && (() => { const j = JSON.parse(c.exportJson); return j.layout && j.layout.contentSection && j.data; })());
  ok("filename", c.exportFilename.endsWith(".json"));
  let downloaded = null;
  const origDl = A.download;
  A.download = (content, fname) => { downloaded = { content, fname }; };
  c.downloadExportJson();
  ok("unduh fallback", !!downloaded && downloaded.fname === c.exportFilename);
  ok("toast petunjuk salin", /Salin JSON/.test(c.toastMsg));
  const origCopy = A.copyText;
  A.copyText = async () => true;
  await c.copyExportJson();
  ok("salin sukses -> toast", /disalin/.test(c.toastMsg));
  A.copyText = async () => false;
  await c.copyExportJson();
  ok("salin gagal -> toast manual", /Ctrl\+C/.test(c.toastMsg));
  A.download = origDl; A.copyText = origCopy;
  ok("copyText aman memori", typeof (await A.copyText("x")) === "boolean");

  console.log("== SAVE AS (sandbox blocker) ==");
  const hadPicker = "showSaveFilePicker" in globalThis.window;
  const origPicker = globalThis.window.showSaveFilePicker;
  // 1) picker melempar SecurityError seperti di iframe sandbox -> "blocked" + toast jujur, modal tetap terbuka
  globalThis.window.showSaveFilePicker = async () => { throw Object.assign(new Error("sandbox"), { name: "SecurityError" }); };
  let r = await A.saveFileSmart("{}", "a.json");
  ok("SecurityError -> blocked (bukan saved palsu)", r === "blocked");
  c.exportModal = true; c.exportJson = "{}"; c.exportFilename = "a.json"; c.toastMsg = "";
  await c.saveAsExportJson();
  ok("toast diblokir + modal tetap terbuka", /diblokir/.test(c.toastMsg) && c.exportModal === true);
  // 2) pengguna membatalkan dialog -> "aborted", tanpa toast error
  globalThis.window.showSaveFilePicker = async () => { throw Object.assign(new Error("batal"), { name: "AbortError" }); };
  r = await A.saveFileSmart("{}", "a.json");
  ok("AbortError -> aborted", r === "aborted");
  c.toastMsg = "";
  await c.saveAsExportJson();
  ok("batal -> tanpa toast", c.toastMsg === "");
  // 3) picker sukses -> "saved", file tertulis, modal tertutup
  let written = null;
  globalThis.window.showSaveFilePicker = async () => ({
    name: "a.json",
    createWritable: async () => ({ async write(t) { written = t; }, async close() {} }),
  });
  r = await A.saveFileSmart("{\"x\":1}", "a.json");
  ok("sukses -> saved + konten tertulis", r === "saved" && written === "{\"x\":1}");
  c.exportModal = true; c.toastMsg = "";
  await c.saveAsExportJson();
  ok("sukses -> modal tertutup + toast", c.exportModal === false && /disimpan/.test(c.toastMsg));
  // 4) tanpa picker sama sekali -> fallback download, status "downloaded", toast petunjuk
  delete globalThis.window.showSaveFilePicker;
  let dl2 = null; const origDl2 = A.download;
  A.download = (content, fname) => { dl2 = { content, fname }; };
  r = await A.saveFileSmart("[]", "b.json");
  ok("tanpa picker -> downloaded jujur", r === "downloaded" && dl2 && dl2.fname === "b.json");
  c.exportModal = true; c.toastMsg = "";
  await c.saveAsExportJson();
  ok("downloaded -> toast unduhan dimulai", /Unduhan dimulai/.test(c.toastMsg));
  A.download = origDl2;
  if (hadPicker) globalThis.window.showSaveFilePicker = origPicker; else delete globalThis.window.showSaveFilePicker;

  console.log("== IMPORT PINTAR ==");
  nextFileContent = JSON.stringify({ name: "Paket Uji", layout: A.sampleLayout(), data: A.sampleData() });
  p = c.newLayout(); okConfirm(); await p;
  c.importLayout();
  await tick(10);
  ok("paket {layout,data}", c.allItems().length > 1 && /Paket Uji/.test(c.toastMsg));
  nextFileContent = JSON.stringify(A.sampleLayout());
  c.importLayout();
  await tick(10);
  ok("layout polos", /diimpor/.test(c.toastMsg));

  console.log("== DATA SOURCE DINAMIS ==");
  // setelah init (sample) -> ada grup content + field skalar
  ok("dataSource awal dari sample", (() => {
    const names = c.dataSource.map((n) => n.field);
    const content = c.dataSource.find((n) => n.field === "content");
    return names.includes("company") && content && content.children.some((ch) => ch.field === "name");
  })());
  // ganti data lewat modal -> pohon ikut berubah
  c.dataJsonText = JSON.stringify({ produk: [{ nama: "Apel", harga: 5000 }], nomor: "INV-1" });
  c.applyDataModal();
  ok("applyDataModal -> dataSource baru", (() => {
    const g = c.dataSource.find((n) => n.field === "produk");
    const leaf = c.dataSource.find((n) => n.field === "nomor");
    return g && g.children.length === 2 && g.children.some((ch) => ch.field === "harga") && leaf && !leaf.children;
  })());
  // objek bersarang -> di-flatten bertitik
  c.dataJsonText = JSON.stringify({ user: { address: { city: "Depok", zip: "16411" } } });
  c.applyDataModal();
  ok("objek bersarang -> address.city", (() => {
    const g = c.dataSource.find((n) => n.field === "user");
    return g && g.children.every((ch) => ch.field.startsWith("address.")) && g.children.some((ch) => ch.field === "address.city");
  })());
  ok("flatFields path bertitik", c.flatFields().some((f) => f.field === "address.city"));
  // data kosong -> dataSource kosong
  c.dataJsonText = "{}";
  c.applyDataModal();
  ok("data {} -> dataSource []", Array.isArray(c.dataSource) && c.dataSource.length === 0);
  // newLayout -> previewData KOSONG & dataSource KOSONG
  c.dataJsonText = JSON.stringify(A.sampleData()); c.applyDataModal();
  p = c.newLayout(); okConfirm(); await p;
  ok("Report Baru -> data bersih", c.dataSource.length === 0 && Object.keys(c.previewData).length === 0 && A.store.get("satureport.offline.data") === "{}");
  // muat ulang sample via modal agar langkah berikutnya normal
  c.dataJsonText = JSON.stringify(A.sampleData()); c.applyDataModal();

  console.log("== SEMUA TOMBOL ==");
  const ev = (key, extra = {}) => ({ key, target: { tagName: "DIV" }, preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false, ...extra });
  p = c.newLayout(); okConfirm(); await p;
  ok("Report Baru", c.allItems().length === 1); // item demo page footer
  ok("Contoh", (c.loadSample(), c.allItems().length > 3));
  ok("Tambah item berbagai tipe", (c.addItemAt("headerSection", "text", 5, 5), c.addItemAt("footerSection", "chart", 20, 20), c.addItemAt("footerSection", "barcode", 10, 5), c.allItems().length >= 4));
  ok("Undo/Redo", (() => { const n = c.allItems().length; c.undo(); const m = c.allItems().length; c.redo(); return m !== n && c.allItems().length === n; })());
  ok("Select all + duplikasi", (c.selectAll(), (() => { const n = c.allItems().length; c.duplicateSelected(); return c.allItems().length === n * 2; })()));
  ok("Copy/paste", (c.copySelected(), c.paste(), true));
  ok("Align", (c.selectAll(), c.align("left"), c.align("sameW"), true));
  ok("Hapus", (c.deleteSelected(), c.selIds.length === 0));
  ok("Sub group tambah/hapus", await (async () => {
    const pa = c.addSubGroup(); okPrompt("items"); await pa;
    const t = c.selectedSection.startsWith("group:");
    const pr = c.removeSubGroup(); okConfirm(); await pr;
    return t && !c.selectedSection;
  })());
  ok("Simpan", (c.save(), !!A.store.get("satureport.offline.layout")));
  ok("Export XLSX", (c.exportXLSX(), true));
  ok("Export PDF popup diblokir -> toast", (c.exportPDF(), /Popup cetak diblokir/.test(c.toastMsg)));
  ok("Preview async + handoff", (await c.preview(), tick(), !!A.store.get("satureport.offline.preview")));
  ok("Data modal valid/rusak", (() => {
    c.openDataModal(); c.dataJsonText = "{\"a\":1}"; c.applyDataModal();
    const closed = !c.showDataModal;
    c.openDataModal(); c.dataJsonText = "{x"; c.applyDataModal();
    return closed && !!c.dataJsonError;
  })());
  ok("Keyboard", (c.addItemAt("headerSection", "text", 10, 10), c.onKeydown(ev("ArrowRight")), c.onKeydown(ev("z", { ctrlKey: true })), c.onKeydown(ev("y", { ctrlKey: true })), c.onKeydown(ev("Delete")), c.onKeydown(ev("Escape")), true));
  ok("Undo stack ada", c.undoStack.length > 0);
  ok("Properti item", (() => {
    c.addItemAt("headerSection", "text", 5, 5);
    c.updItem("text", "Halo"); c.updItem("x", "99", true);
    c.beginStyle(); c.updStyle("fontSize", "20", true); c.commitStyle();
    const it = c.singleItem().item;
    return it.x === 99 && it.style.fontSize === 20;
  })());
  ok("Chart tool + properti + preview", (() => {
    c.previewData = A.sampleData(); // pastikan data preview tersedia
    c.tool = "chart";
    c.addItemAt("footerSection", "chart", 20, 20);
    const it = c.singleItem().item;
    c.updItem("chartType", "donut"); c.updItem("binding", "content"); c.updItem("labelField", "name"); c.updItem("valueField", "qty");
    const s = c.chartOf(it, "footerSection");
    return s.includes("path") && s.includes("Budi Santoso");
  })());
  ok("Page setup (updPage/updMargin)", (() => {
    c.updPage({ pagination: true, paper: "A4", orientation: "portrait" });
    c.updMargin("left", "60");
    return c.layout.width === (794 - 60 - 47);
  })());
  ok("Sisipkan ekspresi", (() => {
    c.addItemAt("headerSection", "text", 5, 30);
    c.insertExpr(" — Total: {Sum(total)}");
    return c.singleItem().item.text.includes("{Sum(total)}");
  })());
  ok("Load ?example=stock-report", (async () => {
    window.location.search = "?example=stock-report";
    const c2 = window.reportDesigner(); c2.$watch = () => {};
    await c2.init();
    window.location.search = "";
    return c2.layout.contentSection.groups.length > 0;
  })());

  console.log("== VIEWER ==");
  const v = window.reportViewer();
  v.$nextTick = () => {};
  v.render = () => {};
  await v.init();
  ok("viewer init backend", v.storageBackend === "indexeddb");
  ok("zoom & fit", (v.zoomIn(), v.zoomOut(), v.zoomReset(), v.zoomFit(), true));
  ok("buka layout/data file aman", (v.openLayoutFile(), v.openDataFile(), true));
  ok("contoh & galeri & designer nav", (v.loadSample(), v.openGallery(), v.openDesigner(), true));
  // exportPDF butuh host ter-render -> stub DOM halaman
  const origGid = document.getElementById;
  document.getElementById = () => ({
    firstElementChild: { cloneNode() { return { style: {}, outerHTML: "<div>page</div>" }; } },
    querySelectorAll: () => [],
  });
  v.toastMsg = "";
  ok("viewer xlsx/pdf aman + toast popup diblokir", (v.exportXLSX(), v.exportPDF(), /Popup cetak diblokir/.test(v.toastMsg)));
  document.getElementById = origGid;
  ok("viewer export modal", (v.openExportModal(), (() => { const p = JSON.parse(v.exportJson); return p.layout && p.data; })()));
  ok("rowCount angka", typeof v.rowCount() === "number");

  console.log("== VIEWER MUAT FILE PINTAR ==");
  // paket {name,layout,data} -> layout & data ikut termuat
  nextFileContent = JSON.stringify({ name: "Paket Uji", layout: A.sampleLayout(), data: A.sampleData() });
  v.openLayoutFile(); await tick(10);
  ok("paket -> layout+data", /Paket layout/.test(v.toastMsg) && v.data.company === "PT. Satu Sejahtera");
  // layout polos -> tetap jalan
  nextFileContent = JSON.stringify(A.sampleLayout());
  v.openLayoutFile(); await tick(10);
  ok("layout polos", /Layout dimuat/.test(v.toastMsg));
  // file data berisi paket -> ambil pkg.data
  nextFileContent = JSON.stringify({ layout: {}, data: A.sampleData() });
  v.openDataFile(); await tick(10);
  ok("data dari paket", v.data.company === "PT. Satu Sejahtera");
  // data polos
  nextFileContent = JSON.stringify(A.sampleData());
  v.openDataFile(); await tick(10);
  ok("data polos", /Data dimuat/.test(v.toastMsg));
  // JSON rusak -> error muncul via toast (bukan alert yang diblokir sandbox)
  nextFileContent = "{ini bukan json";
  v.openLayoutFile(); await tick(10);
  ok("json rusak -> toast peringatan", /^⚠ File layout tidak valid/.test(v.toastMsg));

  console.log("== CONTOH FILE JSON ==");
  const layStr = fs.readFileSync(R + "contoh-layout.json", "utf8");
  const datStr = fs.readFileSync(R + "contoh-data.json", "utf8");
  const layJ = JSON.parse(layStr), datJ = JSON.parse(datStr);
  ok("contoh-layout.json valid & v2", layJ.version === 2 && layJ.contentSection.binding === "content");
  ok("contoh-data.json cocok dgn layout", datJ.content.length === 5 && datJ.company && datJ.footer1);
  nextFileContent = layStr;
  v.openLayoutFile(); await tick(10);
  ok("viewer muat contoh layout dari disk", /Layout dimuat/.test(v.toastMsg));
  nextFileContent = datStr;
  v.openDataFile(); await tick(10);
  ok("viewer muat contoh data dari disk", /Data dimuat/.test(v.toastMsg) && v.data.content.length === 5);
  ok("sum(total) pada contoh data", (() => { const s = A.evalTemplate("{Sum(total)}", datJ, datJ, { aggRows: datJ.content }); return String(s).includes("46200000"); })());
  ok("renderPages contoh tanpa error", (() => { const rp = A.renderPages({ layout: layJ, data: datJ }); const h = rp.sheets[0].innerHTML; return rp.sheets.length >= 1 && h.includes("Budi Santoso") && h.includes("PT Maju Bersama") && h.includes("46200000"); })());

  console.log("== MUAT DATA API ==");
  const origFetch = globalThis.fetch;
  const mkRes = (body, ok = true, status = 200) => ({ ok, status, statusText: ok ? "" : "Internal Error", json: async () => (typeof body === "string" ? JSON.parse(body) : body) });
  window.location.protocol = "http:";
  // 1) respons objek -> dipakai apa adanya
  globalThis.fetch = async () => mkRes({ company: "API Corp", content: [{ a: 1 }] });
  let dj = await A.fetchJson("https://api.test/x");
  ok("API objek", dj.company === "API Corp" && dj.content.length === 1);
  // 2) respons array -> dibungkus {content:[...]}
  globalThis.fetch = async () => mkRes([{ name: "u1" }, { name: "u2" }]);
  dj = await A.fetchJson("https://api.test/users");
  ok("API array -> content", Array.isArray(dj.content) && dj.content.length === 2 && dj.content[0].name === "u1");
  // 3) HTTP error -> error jelas (tanpa proxy)
  globalThis.fetch = async () => mkRes("{}", false, 500);
  let msg = "";
  try { await A.fetchJson("https://api.test/err"); } catch (e) { msg = e.message; }
  ok("HTTP 500 -> error", /HTTP 500/.test(msg));
  // 4) jaringan/CORS gagal -> fallback proxy berhasil
  globalThis.fetch = async (u) => {
    if (String(u).startsWith("/api-proxy?")) return mkRes({ content: [{ z: 9 }], via: "proxy" });
    throw new TypeError("Failed to fetch");
  };
  dj = await A.fetchJson("https://api.test/cors");
  ok("CORS -> fallback proxy", dj.via === "proxy" && dj.content[0].z === 9);
  // 5) dua-duanya gagal -> pesan error menggabungkan keduanya
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  msg = "";
  try { await A.fetchJson("https://api.test/mati"); } catch (e) { msg = e.message; }
  ok("total gagal -> pesan", /jaringan\/CORS/.test(msg) && /proxy/.test(msg));
  // 6) URL tidak valid
  msg = "";
  try { await A.fetchJson("ftp://salah"); } catch (e) { msg = e.message; }
  ok("URL non-http ditolak", /http/.test(msg));
  // 7) viewer.loadFromApi sukses
  globalThis.fetch = async () => mkRes([{ name: "Budi API" }]);
  v.apiUrl = "https://api.test/users";
  await v.loadFromApi();
  ok("viewer loadFromApi", v.data.content[0].name === "Budi API" && /API dimuat/.test(v.toastMsg) && v.apiBusy === false && v.apiModal === false);
  // 8) viewer.loadFromApi gagal -> toast ⚠, modal tetap terbuka
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  v.apiModal = true; v.toastMsg = "";
  await v.loadFromApi();
  ok("viewer loadFromApi gagal -> toast", /^⚠/.test(v.toastMsg) && v.apiModal === true);
  // 9) designer.loadDataFromApi -> isi textarea modal
  globalThis.fetch = async () => mkRes({ h: 1 });
  c.apiUrl = "https://api.test/d";
  await c.loadDataFromApi();
  ok("designer loadDataFromApi", JSON.parse(c.dataJsonText).h === 1 && /API dimuat/.test(c.toastMsg));
  globalThis.fetch = async () => mkRes("{}", false, 404);
  await c.loadDataFromApi();
  ok("designer loadDataFromApi error -> dataJsonError", /HTTP 404/.test(c.dataJsonError));
  globalThis.fetch = origFetch;
  window.location.protocol = "";

  console.log("== SATU FILE PAKET {layout,data,API?} ==");
  // designer: ekspor default = paket layout+data (+API bila sumber data = API & apiUrl diisi)
  c.dsType = "api";
  c.apiUrl = "https://api.test/users";
  c.exportLayout();
  const pkg1 = JSON.parse(c.exportJson);
  ok("ekspor designer = paket lengkap", !!(pkg1.layout && pkg1.data && pkg1.API === "https://api.test/users" && pkg1.name));
  ok("nama file paket", c.exportFilename.endsWith(".satureport.json"));
  // mode layout-saja
  c.exportWithData = false; c.refreshExportJson();
  const pkg2 = JSON.parse(c.exportJson);
  ok("mode layout saja", !!pkg2.contentSection && !("data" in pkg2) && !("API" in pkg2));
  c.exportWithData = true; c.refreshExportJson();
  c.exportModal = false;
  // designer: impor paket ber-API -> apiUrl ikut terisi
  nextFileContent = JSON.stringify({ name: "Pak", layout: A.sampleLayout(), data: { x: 1 }, API: "https://api.test/lain" });
  c.importLayout(); await tick(10);
  ok("impor paket API -> apiUrl", c.apiUrl === "https://api.test/lain" && c.previewData.x === 1);
  // viewer: buka paket tanpa API (dari file contoh di disk)
  nextFileContent = fs.readFileSync(R + "contoh-paket.json", "utf8");
  v.openLayoutFile(); await tick(10);
  ok("viewer buka contoh-paket.json", v.data.company === "PT Maju Bersama Sejahtera" && /Paket layout \+ data/.test(v.toastMsg));
  // viewer: paket ber-API -> auto fetch OK -> data live menang
  globalThis.fetch = async () => mkRes([{ name: "User Live 1" }, { name: "User Live 2" }]);
  nextFileContent = fs.readFileSync(R + "contoh-paket-api.json", "utf8");
  v.openLayoutFile(); await tick(30);
  ok("paket API -> fetch live sukses", v.data.content.length === 2 && v.data.content[0].name === "User Live 1" && /API dimuat/.test(v.toastMsg));
  // viewer: paket ber-API tapi fetch gagal -> data cadangan tertanam dipakai
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  nextFileContent = fs.readFileSync(R + "contoh-paket-api.json", "utf8");
  v.openLayoutFile(); await tick(30);
  ok("paket API gagal -> data cadangan tetap", v.data.content.length === 6 && v.data.content[0].name === "Leanne Graham" && /^⚠/.test(v.toastMsg));
  globalThis.fetch = origFetch;
  // viewer: ekspor menyertakan API yang pernah dimuat
  v.apiUrl = "https://api.test/abc";
  v.openExportModal();
  ok("ekspor viewer sertakan API", JSON.parse(v.exportJson).API === "https://api.test/abc");
  v.exportModal = false;
  // round-trip: paket ekspor designer -> langsung bisa dibuka viewer
  c.exportLayout(); nextFileContent = c.exportJson;
  v.openLayoutFile(); await tick(30);
  ok("round-trip designer->viewer", v.layout.contentSection && v.data && typeof v.data === "object");
  v.exportModal = false; c.exportModal = false;


  console.log("== QUERY KUSTOM + PARAMETER ==");
  window.location.protocol = "http:";
  // normalisasi & substitusi parameter
  ok("normalizeParams bentuk array/peta", (() => {
    const a = A.normalizeParams([{ name: "tahun", options: ["2026"] }, "kota"]);
    const b = A.normalizeParams({ start: "2026-01-01", limit: 10 });
    return a.length === 2 && a[1].name === "kota" && b.find((p) => p.name === "limit").type === "number";
  })());
  ok("substituteParams", A.substituteParams("select * where th = {tahun}", { tahun: 2026 }).includes("2026")
    && A.substituteParams("http://h/api?k={kota}", { kota: "Depok" }).endsWith("k=Depok"));
  // fetchQuery: POST dgn query tersubstitusi + params
  let postCap = null;
  globalThis.fetch = async (u, opts) => { postCap = { u: String(u), method: opts && opts.method, body: JSON.parse(opts.body) }; return mkRes([{ a: 1 }, { a: 2 }]); };
  const qdata = await A.fetchQuery("https://db.test/api", "select * from v where tahun = {tahun}", { tahun: "2026" });
  ok("fetchQuery POST + substitusi", postCap.method === "POST" && postCap.body.query.includes("2026") && postCap.body.params.tahun === "2026" && qdata.content.length === 2);
  // fetchQuery fallback proxy (CORS)
  globalThis.fetch = async (u, opts) => { if (String(u).startsWith("/api-proxy?")) { postCap.u = String(u); return mkRes([{ z: 1 }]); } throw new TypeError("Failed to fetch"); };
  const qdata2 = await A.fetchQuery("https://db.test/api", "select 1", {});
  ok("fetchQuery -> proxy", postCap.u.startsWith("/api-proxy?") && qdata2.content[0].z === 1);
  // viewer: paket format user {layout, data:{query, endpoint}}
  globalThis.fetch = async (u, opts) => mkRes([{ name: "Hasil Query", city: "Jakarta", product: "X", qty: 1, price: 5, total: 5 }]);
  v.awaitingParams = false; v.render = () => {};
  nextFileContent = fs.readFileSync(R + "contoh-paket-query.json", "utf8");
  v.openLayoutFile(); await tick(10);
  ok("paket query -> gerbang parameter terbuka", v.paramModal === true && v.awaitingParams === true && v.paramDefs.length === 1);
  v.params.tahun = "2026"; await v.applyParams(); await tick(20);
  ok("applyParams -> query jalan", v.data.content.length === 1 && v.data.content[0].name === "Hasil Query");
  // viewer: report berparameter offline -> filter baris di klien
  globalThis.fetch = origFetch;
  v.render = () => {};
  nextFileContent = fs.readFileSync(R + "contoh-paket-param.json", "utf8");
  v.openLayoutFile(); await tick(10);
  ok("paket param -> menunggu isi form", v.awaitingParams === true && v.paramDefs.length === 2);
  v.params.tahun = "2026"; v.params.kota = "Depok";
  await v.applyParams();
  ok("filter tahun+kota", (() => { const d = v.dataWithParams(); return d.content.length === 1 && d.content[0].city === "Depok" && d.content[0].tahun === 2026; })());
  ok("params tersedia di ekspresi", A.evalTemplate("{params.tahun}", v.dataWithParams(), v.dataWithParams()) === "2026");
  ok("kota Semua -> tanpa filter kota", (() => { v.params.kota = "Semua"; const n = v.dataWithParams().content.length; return n === 5; })());
  // contoh galeri baru terdaftar
  const exQ = window.SATU_EXAMPLES.byId("query-custom"), exP = window.SATU_EXAMPLES.byId("param-report");
  ok("contoh galeri query+param", !!(exQ && exQ.query && exQ.endpoint && exP && exP.params.length === 2));
  // ekspor viewer membawa params + spesifikasi query
  v.openExportModal();
  const pkgQ = JSON.parse(v.exportJson);
  ok("ekspor membawa params", Array.isArray(pkgQ.params) && pkgQ.params.length === 2);
  v.exportModal = false; v.params = {}; v.paramDefs = []; v.awaitingParams = false;
  globalThis.fetch = origFetch;

  const exApi = window.SATU_EXAMPLES && window.SATU_EXAMPLES.byId("api-users");
  ok("contoh api-users terdaftar", !!exApi && exApi.apiUrl && Array.isArray(exApi.data.content));
  ok("layout contoh cocok field API", (() => {
    const binds = exApi.layout.contentSection.items.filter((i) => i.binding).map((i) => i.binding);
    const u = exApi.data.content[0];
    return ["name", "username", "email", "phone", "address.city", "company.name"].every((b) => binds.includes(b) && A.resolveBinding(b, u, exApi.data) != null);
  })());
  ok("render contoh dgn data cadangan", (() => { const rp = A.renderPages({ layout: exApi.layout, data: exApi.data }); const h = rp.sheets[0].innerHTML; return h.includes("Leanne Graham") && h.includes("Romaguera-Crona") && h.includes("6 pengguna"); })());
  // viewer membuka ?example=api-users -> apiUrl terisi + toast hint
  window.location.search = "?example=api-users";
  const v2 = window.reportViewer();
  v2.$nextTick = () => {}; v2.render = () => {};
  await v2.init();
  ok("viewer ?example=api-users -> apiUrl+hint", v2.apiUrl === exApi.apiUrl && /API live/.test(v2.toastMsg));
  window.location.search = "";

  console.log("== DESIGNER: SUMBER DATA & TEST PREVIEW ==");
  window.location.protocol = "http:";
  // 1) manual -> payload tanpa API/query
  c.dsType = "manual"; c.apiUrl = ""; c.dsQuery = ""; c.dsEndpoint = "";
  let pj = JSON.parse(c.buildExportPayload());
  ok("manual -> tanpa API/query", !("API" in pj) && !("query" in pj) && pj.layout && pj.data);
  // 2) api -> tersimpan + payload berisi API
  c.dsType = "api"; c.apiUrl = "https://api.test/jual?tahun={tahun}";
  c.saveDsSettings();
  const savedDs = JSON.parse(A.store.get("satureport.offline.datasource"));
  ok("pengaturan api tersimpan", savedDs.dsType === "api" && savedDs.apiUrl.includes("api.test") && /^✓/.test(c.dsMsg));
  pj = JSON.parse(c.buildExportPayload());
  ok("payload api", pj.API === "https://api.test/jual?tahun={tahun}" && !("query" in pj));
  // 3) query -> payload berisi query+endpoint
  c.dsType = "query"; c.dsQuery = "select * from penjualan where tahun = {tahun}"; c.dsEndpoint = "http://localhost:8080/api/report-query";
  c.saveDsSettings();
  pj = JSON.parse(c.buildExportPayload());
  ok("payload query", pj.query.includes("select * from penjualan") && pj.endpoint.includes("8080") && !("API" in pj));
  // 4) Test Muat Data (query) -> previewData + Data Source berubah
  globalThis.fetch = async (u, o) => mkRes([{ tahun: 2026, city: "Depok", name: "Siti", product: "Mouse", qty: 10, price: 125000, total: 1250000 }]);
  await c.testDs();
  ok("testDs query sukses", c.previewData.content[0].city === "Depok" && c.dataSource.find((n) => n.field === "content").children.some((ch) => ch.field === "tahun") && /baris/.test(c.dsMsg));
  // 5) Test api gagal -> dsMsg ⚠ (jaringan mati dua-duanya)
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  c.dsType = "api";
  await c.testDs();
  ok("testDs gagal -> ⚠", /^⚠/.test(c.dsMsg));
  // 6) import paket query -> pengaturan sumber data ikut pulih
  globalThis.fetch = origFetch;
  nextFileContent = JSON.stringify({ name: "Q", layout: A.sampleLayout(), data: { query: "select 1", endpoint: "http://h/api" } });
  c.importLayout(); await tick(10);
  ok("import paket query -> dsType", c.dsType === "query" && c.dsEndpoint === "http://h/api" && JSON.parse(A.store.get("satureport.offline.datasource")).dsType === "query");
  // 7) Test Preview manual -> modal render in-app
  c.dsType = "manual";
  c.$nextTick = (f) => f();
  await c.testPreview();
  ok("testPreview -> modal + sheets", c.previewModal === true && c._pv && c._pv.total >= 1);
  ok("pvFit/pvZoom aman", (c.pvFit(), c.pvZoom(0.1), c.pvZoom(-0.1), c.previewZoom > 0.2));
  c.previewModal = false;
  // 8) elemen UI ada di markup
  const dhtml = fs.readFileSync(R + "designer.html", "utf8");
  ok("markup tombol & panel properti", dhtml.includes("leftTab='props'") && dhtml.includes("testPreview()") && dhtml.includes("ds-preview-host") && dhtml.includes("t('savePkg')") && !dhtml.includes("x-show=\"showDsModal\""));
  globalThis.fetch = origFetch;

  console.log("== DESIGNER: PROPERTI REPORT (PARAMETER) ==");
  window.location.protocol = "http:";
  // 1) tambah/hapus parameter + nama unik
  c.paramDefs = [];
  c.addParam(); c.addParam(); c.addParam();
  ok("addParam nama unik", c.paramDefs.length === 3 && new Set(c.paramDefs.map((p) => p.name)).size === 3);
  c.removeParam(2); c.removeParam(1);
  ok("removeParam", c.paramDefs.length === 1 && c.paramDefs[0].name === "param1");
  // 2) isi properti parameter: label/tipe/opsi/default/field
  const p0 = c.paramDefs[0];
  p0.name = "tahun"; p0.label = "Tahun"; p0.type = "select"; p0.default = "2026"; p0.field = "tahun";
  c.setParamOptions(p0, { target: { value: "2025, 2026" } });
  ok("opsi select diparse", JSON.stringify(p0.options) === '["2025","2026"]' && c.optsText(p0) === "2025, 2026");
  // 3) simpan -> LS_PARAMS round-trip + normalisasi label/field
  c.saveDsSettings();
  const savedPs = JSON.parse(A.store.get("satureport.offline.params"));
  ok("parameter tersimpan", savedPs.length === 1 && savedPs[0].name === "tahun" && savedPs[0].label === "Tahun" && savedPs[0].field === "tahun" && /1 parameter/.test(c.dsMsg));
  // 4) payload paket memuat params
  pj = JSON.parse(await c.buildExportPayload());
  ok("payload memuat params", Array.isArray(pj.params) && pj.params[0].name === "tahun" && pj.params[0].type === "select");
  // 5) query dikirim dengan params + {param} tersubstitusi
  let seenBody = null;
  globalThis.fetch = async (u, o) => { seenBody = o && o.body ? JSON.parse(o.body) : null; return mkRes([{ tahun: 2026 }]); };
  c.dsType = "query"; c.dsQuery = "select * from penjualan where tahun = {tahun}"; c.dsEndpoint = "http://h/api";
  await c.testDs();
  ok("query pakai parameter", !!seenBody && seenBody.params && String(seenBody.params.tahun) === "2026" && seenBody.query.includes("= 2026"));
  globalThis.fetch = origFetch;
  // 6) previewWithParams: filter content menurut nilai Default + {params} tersedia utk ekspresi
  c.previewData = { company: "PT X", content: [{ tahun: 2025, city: "A" }, { tahun: 2026, city: "B" }] };
  let pvCtx = c.previewWithParams();
  ok("preview filter param", pvCtx.content.length === 1 && pvCtx.content[0].tahun === 2026 && pvCtx.params.tahun === "2026" && pvCtx.p === pvCtx.params);
  p0.default = "Semua";
  pvCtx = c.previewWithParams();
  ok("nilai 'Semua' = tanpa filter", pvCtx.content.length === 2);
  // 7) impor paket berisi params -> paramDefs pulih
  p0.default = "2026";
  nextFileContent = JSON.stringify({ name: "P", layout: A.sampleLayout(), params: [{ name: "kota", default: "Depok" }] });
  c.importLayout(); await tick(10);
  ok("import paket -> params pulih", c.paramDefs.length === 1 && c.paramDefs[0].name === "kota" && c.paramDefs[0].field === "kota");
  // 8) markup UI properti report
  const dhtml2 = fs.readFileSync(R + "designer.html", "utf8");
  ok("markup properti report", dhtml2.includes("t('propsReport')") && dhtml2.includes("addParam()") && dhtml2.includes("paramDefs.length") && dhtml2.includes("setParamOptions") && dhtml2.includes("Simpan Properti") && dhtml2.includes("1️⃣ Sumber Data") && dhtml2.includes("2️⃣ Parameter"));
  // reset state agar suite lain tak terpengaruh
  c.paramDefs = []; c.dsType = "manual";
  A.store.set("satureport.offline.params", "[]");

  console.log("== RELOAD VIEWER ==");
  window.location.protocol = "http:";
  v.awaitingParams = false; v.paramModal = false; v.paramDefs = []; v.params = {};
  v.dsApi = null; v.dsQuery = null; v.dsEndpoint = null; v.toastMsg = "";
  // 1) tanpa sumber data -> hanya render + toast
  v.reloadReport();
  ok("reload polos", /dimuat ulang/.test(v.toastMsg));
  // 2) sumber API -> GET dipanggil ulang
  let nFetch = 0;
  globalThis.fetch = async () => { nFetch++; return mkRes([{ a: 9 }]); };
  v.dsApi = "https://api.test/reload"; v.apiUrl = v.dsApi;
  v.reloadReport(); await tick(20);
  ok("reload API -> fetch ulang", nFetch === 1 && v.data.content[0].a === 9);
  // 3) sumber query -> POST dipanggil ulang
  let postN = 0;
  globalThis.fetch = async (u, o) => { postN++; return mkRes([{ b: 7 }]); };
  v.dsApi = null; v.dsQuery = "select 1"; v.dsEndpoint = "https://db.test/api";
  v.reloadReport(); await tick(20);
  ok("reload query -> POST ulang", postN === 1 && v.data.content[0].b === 7);
  // 4) berparameter -> FORM PARAMETER TAMPIL TERLEBIH DAHULU (fetch belum jalan)
  postN = 0;
  v.paramDefs = A.normalizeParams([{ name: "tahun", type: "select", options: ["2025", "2026"], default: "2026", field: "tahun" }]);
  v.params = { tahun: "2026" }; v.paramModal = false; v.toastMsg = "";
  v.reloadReport();
  ok("reload berparameter -> modal dulu", v.paramModal === true && postN === 0 && /parameter/i.test(v.toastMsg));
  await v.applyParams(); await tick(20);
  ok("applyParams -> query dijalankan", postN === 1);
  v.paramDefs = []; v.params = {}; v.dsQuery = null; v.dsEndpoint = null;
  globalThis.fetch = origFetch;
  // 5) tombol toolbar ada di markup
  ok("tombol ⟳ Reload di toolbar", fs.readFileSync(R + "viewer.html", "utf8").includes("reloadReport()"));

  console.log("== VIEWER: MUAT FILE PAKET DARI SERVER (?url=) ==");
  window.location.protocol = "http:";
  // 0) file gabungan benar-benar ada di direktori server & berisi layout+params+data
  const pkgFile = R + "laporan-penjualan.satureport.json";
  const rawPkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, "utf8")) : null;
  ok("file paket server ada & lengkap", !!rawPkg && !!rawPkg.layout && !!rawPkg.data && Array.isArray(rawPkg.params) && rawPkg.data.content.length >= 8);
  // 1) loadFromUrl sukses -> paket diterapkan + gerbang parameter aktif
  v.awaitingParams = false; v.paramModal = false; v.paramDefs = []; v.params = {}; v.layout = null; v.toastMsg = "";
  let askedUrl = null;
  globalThis.fetch = async (u) => { askedUrl = String(u); return mkRes(rawPkg); };
  const okUrl = await v.loadFromUrl("laporan-penjualan.satureport.json");
  ok("loadFromUrl -> paket diterapkan", okUrl === true && askedUrl === "laporan-penjualan.satureport.json" && !!v.layout && /File server:/.test(v.source));
  ok("loadFromUrl berparameter -> form dulu", v.awaitingParams === true && v.paramModal === true && v.paramDefs.length === 2 && v.params.tahun === "2026");
  await v.applyParams();
  const dnUrl = v.dataWithParams();
  ok("terapkan parameter (filter offline)", v.awaitingParams === false && dnUrl.content.length === 5 && dnUrl.content.every((r) => String(r.tahun) === "2026") && dnUrl.params.tahun === "2026");
  // 2) HTTP error -> false + toast ⚠
  globalThis.fetch = async () => mkRes("{}", false, 404);
  v.toastMsg = "";
  const ok404 = await v.loadFromUrl("tidak-ada.json");
  ok("loadFromUrl HTTP 404 -> ⚠", ok404 === false && /^⚠/.test(v.toastMsg) && v.toastMsg.includes("404"));
  // 3) jaringan diblokir (sandbox) -> false + petunjuk live preview
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  v.toastMsg = "";
  const okNet = await v.loadFromUrl("laporan-penjualan.satureport.json");
  ok("loadFromUrl offline sandbox -> ⚠+petunjuk", okNet === false && /^⚠/.test(v.toastMsg) && /LIVE PREVIEW|server/i.test(v.toastMsg));
  globalThis.fetch = origFetch;
  // 4) markup contoh server-file di halaman contoh
  const exHtml = fs.readFileSync(R + "examples.html", "utf8");
  ok("kartu contoh server-file di examples", exHtml.includes("server-file") && exHtml.includes("viewer.html?url=laporan-penjualan.satureport.json") && exHtml.includes("ex.openUrl"));
  // bersihkan state viewer
  v.awaitingParams = false; v.paramModal = false; v.paramDefs = []; v.params = {};
  v.data = A.sampleData(); v.layout = A.sampleLayout();

  console.log("== PIVOT TABLE / CROSSTAB (elemen 'pivot') ==");
  // 1) pivotData: sum + total baris/kolom/grand
  const pvRows = [{ c: "Jakarta", y: 2025, v: 10 }, { c: "Jakarta", y: 2026, v: 20 }, { c: "Depok", y: 2025, v: 5 }];
  const pd = A.pivotData(pvRows, { row: "c", col: "y", value: "v", agg: "sum" });
  ok("pivotData kunci baris/kolom", JSON.stringify(pd.rowKeys) === '["Jakarta","Depok"]' && JSON.stringify(pd.colKeys) === '["2025","2026"]');
  ok("pivotData sel & kosong", pd.cell("Jakarta", "2025") === 10 && pd.cell("Jakarta", "2026") === 20 && pd.cell("Depok", "2026") === null);
  ok("pivotData total", pd.rowTotal("Jakarta") === 30 && pd.colTotal("2025") === 15 && pd.grand === 35);
  // 2) agregasi lain
  const pdCount = A.pivotData(pvRows, { row: "c", col: "y", agg: "count" });
  const pdAvg = A.pivotData(pvRows, { row: "c", col: "y", value: "v", agg: "avg" });
  const pdMin = A.pivotData(pvRows, { row: "c", col: "y", value: "v", agg: "min" });
  const pdMax = A.pivotData(pvRows, { row: "c", col: "y", value: "v", agg: "max" });
  ok("agregasi count/avg/min/max", pdCount.cell("Jakarta", "2025") === 1 && pdCount.grand === 3 && pdAvg.cell("Jakarta", "2026") === 20 && pdAvg.grand === 35 / 3 && pdMin.grand === 5 && pdMax.grand === 20);
  // 3) tanpa row/col -> kosong
  ok("pivotData tanpa row/col -> empty", A.pivotData(pvRows, {}).empty === true);
  // 4) pivotTable HTML: label, angka, TOTAL, strip '–'
  const pvItem = { type: "pivot", binding: "rows", pivot: { row: "c", col: "y", value: "v", agg: "sum" }, x: 0, y: 0, width: 300, height: 20, style: {} };
  const pvRoot = { rows: pvRows };
  const pvHtml = A.pivotTable(pvItem, pvRoot, pvRoot);
  ok("pivotTable HTML", pvHtml.html.includes("Jakarta") && pvHtml.html.includes("Depok") && pvHtml.html.includes("2025") && pvHtml.html.includes("TOTAL") && pvHtml.html.includes("<td") && pvHtml.html.includes("–") && pvHtml.html.includes(">35<"));
  // 5) renderItemHTML: tinggi otomatis mengikuti jumlah baris (2 kota → 1+2+1 baris × 2×10?; hRow=fs*2)
  const pvH = A.pivotTable(pvItem, pvRoot, pvRoot).height; // 4 baris × 18 + 2 = 74
  const itHtml = A.renderItemHTML(pvItem, pvRoot, pvRoot, {});
  ok("renderItemHTML pivot auto-height", pvH === 74 && itHtml.includes("height:" + pvH + "px") && !itHtml.includes("height:20px"));
  // 6) contoh 'pivot-table' ada & grand total = Sum(total) data
  const exPv = EX.byId("pivot-table");
  const pvIt2 = exPv && exPv.layout.contentSection.items.find((i) => i.type === "pivot");
  const sumAll = exPv ? exPv.data.content.reduce((s, r) => s + r.total, 0) : 0;
  const pv2 = exPv ? A.pivotTable(pvIt2, exPv.data, exPv.data) : { html: "", height: 0 };
  ok("contoh pivot-table valid", !!exPv && !!pvIt2 && exPv.data.content.length === 9 && pv2.html.includes("city") && pv2.html.includes("TOTAL") && pv2.html.includes(A.fmtNum(sumAll)));
  // 7) render contoh penuh via renderPages (DOM stubbed) -> tabel pivot muncul di sheet
  const pvPages = A.renderPages({ layout: exPv.layout, data: exPv.data });
  const pvSheetHtml = pvPages.sheets.map((s) => s.innerHTML || "").join("");
  ok("render halaman memuat pivot", pvSheetHtml.includes("6d28d9") && pvSheetHtml.includes("TOTAL") && pvSheetHtml.includes(A.fmtNum(sumAll)));
  // 8) designer: tool ▦ Pivot + panel kanan + pengecualian XLSX
  const dhtml3 = fs.readFileSync(R + "designer.html", "utf8");
  const core3 = fs.readFileSync(R + "js/report-core.js", "utf8");
  ok("designer tool & panel pivot", dhtml3.includes("tool='pivot'") && dhtml3.includes("updPivot(") && dhtml3.includes('x1="3" y1="9" x2="21" y2="9"') && dhtml3.includes("Baris (row field)"));
  ok("XLSX abaikan pivot", core3.includes('"chart", "pivot"'));

  console.log("== I18N — DUAL BAHASA (ID/EN) ==");
  const I = window.SatuI18n;
  I.setLang("id");
  ok("id sebagai default", I.lang === "id" && I.t("save") === "Simpan" && I.t("propsReport") === "Properti Report");
  I.setLang("en");
  ok("switch ke en", I.t("save") === "Save" && I.t("propsReport") === "Report Properties" && I.t("vShowReport") === "Show Report");
  ok("interpolasi {n}", /7/.test(I.t("rowsLoaded", { n: 7 })) && I.t("rowsLoaded", { n: 7 }).includes("content rows loaded"));
  ok("fallback: key tak dikenal & tak ada di id -> key mentah", I.t("zzz-tidak-ada") === "zzz-tidak-ada");
  I.setLang("id");
  I.toggle(); const togEn = I.t("save"); I.toggle();
  ok("toggle id->en->id", togEn === "Save" && I.t("save") === "Simpan");
  // komponen: designer & viewer ikut bahasa (reaktif via _lang)
  c.switchLang(); ok("designer switchLang -> en", c._lang === "en" && c.t("savePkg") === "Save Layout+Data");
  c.switchLang(); ok("designer kembali id", c.t("savePkg") === "Simpan Layout+Data");
  v.switchLang(); ok("viewer switchLang -> en", v._lang === "en" && v.t("vShowReport") === "Show Report");
  v.switchLang();
  // markup tombol bahasa ada di tiga halaman
  const dhtml4 = fs.readFileSync(R + "designer.html", "utf8"), vhtml4 = fs.readFileSync(R + "viewer.html", "utf8"), xhtml4 = fs.readFileSync(R + "examples.html", "utf8");
  ok("tombol 🌐 di designer/viewer/examples", dhtml4.includes("switchLang()") && vhtml4.includes("switchLang()") && xhtml4.includes("switchLang()"));
  ok("i18n termuat di halaman", dhtml4.includes("SatuI18n") && vhtml4.includes("SatuI18n") && xhtml4.includes("SatuI18n"));

  console.log("== AUTO-GENERATE LAYOUT DARI SUMBER DATA ==");
  SatuI18nSync(() => { I.setLang("id"); c._lang = "id"; });
  // 1) deteksi array utama + tipe field
  const rowsD = [{ kota: "Jakarta", tahun: 2025, total: 1000000 }, { kota: "Depok", tahun: 2026, total: 2000000 }];
  const detD = c.detectDataArray({ content: rowsD, meta: "x" });
  ok("deteksi array content", detD.binding === "content" && detD.rows.length === 2 && detD.fields.length === 3);
  const fTotal = detD.fields.find((f) => f.name === "total"), fKota = detD.fields.find((f) => f.name === "kota");
  ok("deteksi tipe numerik vs teks", fTotal.numeric === true && detD.fields.find((f) => f.name === "tahun").numeric === true && fKota.numeric === false);
  ok("deteksi array non-content", c.detectDataArray({ sales: [{ a: 1, b: "x" }] }).binding === "sales");
  ok("tanpa array -> null", c.detectDataArray({ a: 1 }) === null && c.detectDataArray(null) === null && c.detectDataArray({ arr: [] }) === null && c.detectDataArray({ arr: [1, 2] }) === null);
  // 2) generate: struktur lengkap + alignment + total
  const L1 = c.generateAutoLayout(detD);
  ok("layout auto: struktur", L1.version === 2 && L1.contentSection.binding === "content" && L1.contentSection.items.some((i) => i.binding === "kota") && L1.contentSection.items.some((i) => i.binding === "total") && L1.footerSection.items[0].text.includes("{Sum(total)}") && L1.headerSection.items[0].text === "LAPORAN OTOMATIS");
  ok("kolom numerik rata kanan, teks kiri", L1.contentSection.items.find((i) => i.binding === "total").style.textAlign === "right" && L1.contentSection.items.find((i) => i.binding === "kota").style.textAlign === "left");
  ok("header kolom berulang di tiap halaman", L1.pageHeaderSection.visible === true && L1.pageHeaderSection.items.filter((i) => i.style && i.style.fontWeight === "bold").length >= 2);
  // 3) bisa dirender penuh
  const pgAl = A.renderPages({ layout: L1, data: { content: rowsD } });
  const alSheet = pgAl.sheets.map((s) => s.innerHTML || "").join("");
  ok("layout auto dirender (header kolom + nilai + total)", pgAl.total >= 1 && alSheet.includes("Jakarta") && alSheet.includes("total") && alSheet.includes("LAPORAN OTOMATIS"));
  // 4) bilingual mengikuti bahasa aktif
  I.setLang("en"); c._lang = "en";
  const L2 = c.generateAutoLayout(detD);
  ok("auto layout bilingual", L2.headerSection.items[0].text === "AUTO REPORT" && L2.contentSection.binding === "content");
  I.setLang("id"); c._lang = "id";
  // 5) garis parameter ikut tergambar
  c.paramDefs = [{ name: "tahun", default: "2026", type: "text", label: "", field: "" }];
  const L3 = c.generateAutoLayout(detD);
  ok("baris parameter di header", L3.headerSection.items.some((i) => i.text.includes("{params.tahun}")));
  c.paramDefs = [];
  // 6) alur tombol: confirm -> terapkan (manual). Untuk API/query datanya sudah ada di previewData hasil Test Muat Data.
  c.previewData = { content: [{ kota: "A", total: 1 }] };
  const prAl = c.autoLayout();
  ok("autoLayout minta konfirmasi", c.cfOpen === true);
  c.cfAnswer(true); await prAl;
  ok("layout terganti & toast", c.layout.contentSection.binding === "content" && c.layout.contentSection.items.some((i) => i.binding === "kota") && /🪄|otomatis/i.test(c.toastMsg));
  // 7) tanpa array -> tolak sopan ⚠
  c.previewData = { a: 1 };
  const prNo = await c.autoLayout();
  ok("tanpa array -> ⚠", prNo === false && /^⚠/.test(c.toastMsg));
  // 8) tombol auto layout ada di toolbar & panel properti + tooltip bilingual
  ok("tombol 🪄 ada", dhtml4.includes("autoLayout()") && dhtml4.includes("t('autoLayoutTitle')") && dhtml4.includes("t('autoLayoutBtn')"));
  function SatuI18nSync(f) { f(); }

  console.log("== REGRESI: parameter Teks → input teks (bukan combo box) & filter jalan ==");
  // 1) MARKUP: x-if WAJIB di <template>, bukan di elemen select/input langsung
  const vtpl = fs.readFileSync(R + "viewer.html", "utf8");
  ok("select dibungkus <template x-if>", !vtpl.includes("<select x-if=") && vtpl.includes('<template x-if="p.type === \'select\'">'));
  ok("input dibungkus <template x-if>", !vtpl.includes("<input x-if=") && vtpl.includes('<template x-if="p.type !== \'select\'">'));
  // 2) LOGIKA: param teks default kosong -> tanpa filter; diisi -> filter jalan
  v.paramDefs = A.normalizeParams([{ name: "kota", type: "text", default: "", field: "city" }]);
  v.params = { kota: "" };
  v.data = { content: [{ city: "Jakarta", total: 1 }, { city: "Depok", total: 2 }] };
  ok("teks + default kosong -> semua baris lolos", v.dataWithParams().content.length === 2);
  v.params.kota = "Depok"; // seolah diketik user di input teks
  ok("teks terisi 'Depok' -> filter jalan", v.dataWithParams().content.length === 1 && v.dataWithParams().content[0].city === "Depok");
  // 3) package end-to-end: _applyPackage params teks -> nilai default tidak kosong-ketimpa
  v._applyPackage({ layout: A.sampleLayout(), params: [{ name: "kota", label: "Kota", type: "text", default: "", field: "city" }], data: { content: [{ city: "Jakarta" }, { city: "Depok" }] } }, "test");
  ok("paket param teks -> gerbang & default utuh", v.awaitingParams === true && v.params.kota === "" && v.paramDefs[0].type === "text");
  v.params.kota = "Depok";
  await v.applyParams();
  ok("applyParams -> satu baris terfilter", v.awaitingParams === false && v.dataWithParams().content.length === 1);
  // bersihkan state viewer
  v.paramDefs = []; v.params = {}; v.awaitingParams = false; v.data = A.sampleData(); v.layout = A.sampleLayout();

  console.log("== EKSPRESI KONDISI — data keluar: field == params.x ==");
  const rowsD3 = [
    { city: "Jakarta", tahun: 2025, qty: 2, total: 100 },
    { city: "Depok", tahun: 2026, qty: 5, total: 250 },
    { city: "Depok", tahun: 2025, qty: 9, total: 150 },
  ];
  const root5 = { params: { kota: "Depok", tahun: 2026 }, content: rowsD3 };
  const ctx5 = { aggRows: rowsD3 };
  // 1) passesCond dasar: == params, numerik, literal, operator
  ok("== params (string)", A.passesCond("city == params.kota", rowsD3[0], root5) === false && A.passesCond("city == params.kota", rowsD3[1], root5) === true);
  ok("== params (numerik)", A.passesCond("tahun == params.tahun", rowsD3[1], root5) === true && A.passesCond("tahun == params.tahun", rowsD3[0], root5) === false);
  ok("literal berkutip & bare", A.passesCond("city == 'Depok'", rowsD3[1], root5) && A.passesCond("city == Depok", rowsD3[2], root5) && !A.passesCond("city == 'Depok'", rowsD3[0], root5));
  ok("> < >= <= != <>", A.passesCond("qty > 4", rowsD3[1], root5) && A.passesCond("qty >= 5", rowsD3[1], root5) && A.passesCond("qty < 9", rowsD3[1], root5) && !A.passesCond("qty != 5", rowsD3[1], root5) && A.passesCond("qty <> 2", rowsD3[1], root5) && A.passesCond("qty <= 5", rowsD3[1], root5));
  ok("RHS binding field lain", A.passesCond("tahun == tahun", rowsD3[0], root5) === true);
  ok("kondisi kosong/tak valid -> tanpa filter", A.passesCond("", rowsD3[0], root5) && A.passesCond("ngasal", rowsD3[0], root5));
  // 2) agregat berkondisi (argumen ke-3)
  ok("Sum(total,'content','city == params.kota') = 400", A.evalExpr("Sum(total,'content','city == params.kota')", root5, root5, ctx5) === 400);
  ok("Count('','content','tahun == params.tahun') = 1", A.evalExpr("Count('','content','tahun == params.tahun')", root5, root5, ctx5) === 1);
  ok("CountIf(...) alias", A.evalExpr("CountIf('','content','qty >= 5')", root5, root5, ctx5) === 2);
  ok("agregat tanpa kondisi tetap", A.evalExpr("Sum(total)", root5, root5, ctx5) === 500 && A.evalExpr("Sum(total,'content')", root5, root5, ctx5) === 500 && A.evalExpr("Count()", root5, root5, ctx5) === 3);
  ok("argumen berkutip ganda ok", A.evalExpr('Sum(total,"content","city == params.kota")', root5, root5, ctx5) === 400);
  ok("template menyertakan kondisi", A.evalTemplate("Depok={Sum(total,'content','city == params.kota')} / semua={Sum(total)}", root5, root5, ctx5) === "Depok=400 / semua=500");
  // 3) contentSection.filter — baris yang dirender hanya yg lolos
  const layF = {
    width: 700,
    pageHeaderSection: { visible: false, height: 0 },
    headerSection: { visible: false, height: 0, items: [] },
    contentSection: { binding: "content", filter: "city == params.kota", height: 20, items: [{ type: "text", binding: "city", x: 0, y: 0, width: 100, height: 14, style: {} }] },
    footerSection: { visible: true, height: 20, items: [{ type: "text", text: "Total:{Sum(total)}", binding: "", x: 0, y: 0, width: 200, height: 14, style: {} }] },
    pageFooterSection: { visible: false, height: 0 },
  };
  const nb = A.buildBands(A.normalizeLayout(layF), root5);
  ok("buildBands: baris terfilter = 2", nb.aggRows.length === 2);
  const hf = A.renderPages({ layout: layF, data: root5 }).sheets.map((s) => s.innerHTML || "").join("");
  ok("render: hanya Depok; agregat ikut terfilter (400)", !hf.includes("Jakarta") && hf.includes("Total:400"));
  // 4) normalize menjaga filter + panel designer punya field-nya
  ok("normalize menjaga filter", A.normalizeLayout({ contentSection: { binding: "content", filter: "qty > 5" } }).contentSection.filter === "qty > 5");
  const dhtml5 = fs.readFileSync(R + "designer.html", "utf8");
  ok("panel Content: filter ekspresi", dhtml5.includes("updSection('filter'") && dhtml5.includes("Filter ekspresi") && dhtml5.includes("city == params.kota"));
  // 5) dokumentasi menyebut formatnya
  const docMd = fs.readFileSync(R + "DOKUMENTASI-DATA.md", "utf8");
  ok("dok: contoh ekspresi ada", docMd.includes("city == params.kota") && docMd.includes("Sum(total,'content','city == params.kota')"));

  console.log("== TOOLBAR RAPI — ikon SVG seragam ==");
  const dh6 = fs.readFileSync(R + "designer.html", "utf8");
  const vh6 = fs.readFileSync(R + "viewer.html", "utf8");
  const hdr6 = (s) => s.slice(s.indexOf("<header"), s.indexOf("</header>"));
  const hdrD6 = hdr6(dh6), hdrV6 = hdr6(vh6);
  const nTic = (h) => (h.match(/<span class="tic">/g) || []).length;
  const nSvg = (h) => (h.match(/<svg /g) || []).length;
  const legacyGlyph = /🖼|📊|▦|⭢|↶|↷|🗑|⧉|📄|✨|📂|🗄|🪄|▶|⎙|⬇|🌐|⚙|⟳|📚|↻|✎|▌▍▌|⤢|🧾/;
  ok("CSS .tic/.tgrp ada di kedua halaman", dh6.includes(".tic {") && vh6.includes(".tic {") && vh6.includes(".tgrp {"));
  ok("designer: semua tombol berikon .tic + svg 1:1", nTic(hdrD6) >= 26 && nSvg(hdrD6) === nTic(hdrD6));
  ok("viewer: ikon >= 16 & svg 1:1 (1:1 = badge teks)", nTic(hdrV6) >= 16 && nSvg(hdrV6) === nTic(hdrV6));
  ok("tanpa glif emoji/gaya campur warisan di header", !legacyGlyph.test(hdrD6) && !legacyGlyph.test(hdrV6));
  ok("grup zoom menyatu (tgrp/tval)", hdrV6.includes('class="tgrp"') && hdrV6.includes('class="tval"'));
  ok("handler toolbar designer tak berubah", ["undo()", "redo()", "deleteSelected()", "duplicateSelected()", "openDataModal()", "newLayout()", "importLayout()", "loadSample()", "openLibModal()", "save()", "exportLayout()", "autoLayout()", "testPreview()", "exportPDF()", "exportXLSX()", "switchLang()", "tool='pivot'"].every((x) => hdrD6.includes(x)));
  ok("handler toolbar viewer tak berubah", ["openLayoutFile()", "openDataFile()", "openApiModal()", "openParamModal()", "openGallery()", "loadSample()", "reloadReport()", "init()", "zoomOut()", "zoomIn()", "zoomFit()", "zoomReset()", "openExportModal()", "exportPDF()", "exportXLSX()", "openDesigner()", "switchLang()"].every((x) => hdrV6.includes(x)));
  ok("binding i18n toolbar utuh", ["t('savePkg')", "t('open')", "t('sample')", "t('myLayouts')", "t('save')", "t('autoLayout')", "t('testPreview')", "t('propsReport')", "t('langTitle')"].every((x) => hdrD6.includes(x)) && ["t('vOpenLayout')", "t('vData')", "t('vApi')", "t('vParam')", "t('vReload')", "t('exOpenDesigner')", "t('langTitle')"].every((x) => hdrV6.includes(x)));

  console.log("== REBRAND: AnkaReport -> SatuReport ==");
  const rbFiles = ["designer.html", "viewer.html", "examples.html", "index.html", "js/report-core.js", "js/i18n.js", "js/designer.js", "js/viewer.js", "examples/examples.js", "DOKUMENTASI-DATA.md", "build.js", "server.py"];
  const rbRead = (f) => fs.readFileSync(R + f, "utf8");
  ok("nol jejak 'AnkaReport' di semua berkas brand", rbFiles.every((f) => !rbRead(f).includes("AnkaReport")));
  ok("nol jejak kunci/ekstensi lama", rbFiles.every((f) => !/\.ankareport\.json|"ankareport\.(lang|offline|lib)/.test(rbRead(f))));
  ok("judul halaman mengandung SatuReport", ["designer.html", "viewer.html", "examples.html", "index.html"].every((f) => /<title>[^<]*SatuReport/.test(rbRead(f))));
  ok("logo badge huruf S", ["designer.html", "viewer.html"].every((f) => rbRead(f).includes('font-black shadow">S</div>')) && rbRead("index.html").includes('shadow-blue-500/30">S</div>'));
  ok("kunci penyimpanan prefiks baru", rbRead("designer.html").includes("satureport.offline.layout") && rbRead("designer.html").includes("satureport.lib.index") && rbRead("js/report-core.js").includes('DB_NAME = "satureport-offline"') && rbRead("js/i18n.js").includes(".satureport.json"));
  ok("kredit GH inspirasi tetap utuh", rbRead("js/report-core.js").includes("https://github.com/ankareport/ankareport"));
  ok("legacyBrandKey memetakan kunci lama", A.legacyBrandKey("ankareport.lang") === "satureport.lang" && A.legacyBrandKey("ankareport.lib.abc") === "satureport.lib.abc" && A.legacyBrandKey("satureport.x") === "satureport.x" && A.legacyBrandKey("") === "" && A.legacyBrandKey(null) === null);
  // migrasi LS end-to-end (idb branch inert di shim node)
  const lsBackup = window.localStorage;
  const lsMock = (() => { const m = new Map(); return { get length() { return m.size; }, key(i) { return [...m.keys()][i] || null; }, getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); } }; })();
  lsMock.setItem("ankareport.lang", "en"); lsMock.setItem("ankareport.lib.x1", "L1");
  lsMock.setItem("satureport.offline.layout", "KEPT"); lsMock.setItem("other.key", "bebas");
  window.localStorage = lsMock;
  const n1 = await A.migrateLegacyBrandStorage();
  const n2 = await A.migrateLegacyBrandStorage();
  window.localStorage = lsBackup;
  ok("migrasi: kunci lawas tersalin & tak menimpa yg ada", n1 === 2 && lsMock.getItem("satureport.lang") === "en" && lsMock.getItem("satureport.lib.x1") === "L1" && lsMock.getItem("satureport.offline.layout") === "KEPT" && lsMock.getItem("other.key") === "bebas");
  ok("migrasi idempoten", n2 === 0 && lsMock.getItem("satureport.lang") === "en");
  ok("file java/json ter-rename", fs.existsSync(R + "contoh-java-api/SatuReportApiDemo.java") && !fs.existsSync(R + "contoh-java-api/AnkaReportApiDemo.java") && fs.existsSync(R + "laporan-penjualan.satureport.json") && rbRead("js/viewer.js").includes("laporan-penjualan.satureport.json"));
  ok("README java & dokumen rebrand", rbRead("contoh-java-api/README.md").includes("SatuReportApiDemo") && rbRead("DOKUMENTASI-DATA.md").includes("SatuReport"));

  console.log("== SUB REPORT / MASTER–DETAIL ==");
  const exSub = EX.byId("sales-subreport");
  ok("contoh terdaftar di galeri", !!exSub && exSub.layout.contentSection.binding === "content" && exSub.layout.contentSection.groups[0].binding === "transaksi");
  const subData = exSub.data;
  ok("data: 3 master kota, 7 detail transaksi", subData.content.length === 3 && subData.content.reduce((s, m) => s + m.transaksi.length, 0) === 7);
  ok("subtotal master: Sum(total,'transaksi') & Count('','transaksi')",
    A.evalExpr("Sum(total,'transaksi')", subData.content[0], subData) === 66400000 &&
    A.evalExpr("Count('','transaksi')", subData.content[0], subData) === 3 &&
    A.evalExpr("Sum(total,'transaksi')", subData.content[1], subData) === 21400000 &&
    A.evalExpr("Sum(total,'transaksi')", subData.content[2], subData) === 27750000);
  // Agregat LOKAL per master di dalam band sub group (enhancement engine)
  const laySub = { width: 400,
    headerSection: { visible: false, height: 0 },
    contentSection: { binding: "content", height: 14, items: [{ type: "text", text: "m{Count()}", binding: "", x: 0, y: 0, width: 60, height: 12, style: {} }],
      groups: [{ height: 14, binding: "transaksi", items: [{ type: "text", text: "{Sum(qty)}", binding: "", x: 0, y: 0, width: 60, height: 12, style: {} }] }] },
    footerSection: { visible: false, height: 0 } };
  const bbSub = A.buildBands(A.normalizeLayout(laySub), { content: [{ m: 1, transaksi: [{ qty: 3 }, { qty: 4 }] }, { m: 2, transaksi: [{ qty: 1 }] }] });
  ok("band: 2 master + 3 detail", bbSub.bands.length === 5);
  const htmlSub = bbSub.bands.map((b) => b.make({ page: 1, pages: 1 })).join("");
  ok("Sum(qty) di band sub group = lokal per master (7,7,1)", (htmlSub.match(/>7</g) || []).length === 2 && (htmlSub.match(/>1</g) || []).length === 1 && (htmlSub.match(/>8</g) || []).length === 0);
  ok("Count() di band CONTENT tetap level master (m2)", htmlSub.includes(">m2<") && !htmlSub.includes(">m3<"));
  // Render contoh end-to-end: urutan & kelengkapan
  const hS = A.renderPages({ layout: exSub.layout, data: subData }).sheets.map((s) => s.innerHTML || "").join("");
  ok("render: semua kota & faktur tampak", ["Jakarta", "Depok", "Bandung", "INV-0901", "INV-0905", "INV-0908", "INV-0912", "INV-0914", "INV-0920", "INV-0922"].every((x) => hS.includes(x)) && hS.includes("115.550.000"));
  ok("render: detail Depok muncul > Jakarta, Bandung > Depok", hS.indexOf("INV-0901") > hS.indexOf("Jakarta") && hS.indexOf("INV-0905") > hS.indexOf("INV-0901") && hS.indexOf("INV-0908") > hS.indexOf("INV-0922"));
  ok("subtotal ekspresi Jakarta tampil di header master (66400000)", hS.includes("66400000"));
  ok("contoh ter-inline di designer & galeri", fs.readFileSync(R + "designer.html", "utf8").includes("sales-subreport") && fs.readFileSync(R + "examples.html", "utf8").includes("sales-subreport"));
  ok("dok bagian F sub report ada", fs.readFileSync(R + "DOKUMENTASI-DATA.md", "utf8").includes("## F. Sub report / master–detail"));
  console.log(fail ? "\n❌ " + fail + " GAGAL" : "\n✅ SEMUA SUITE LOLOS — " + "core/chart/paginasi/idb/pustaka/export-import/api/query/param/reload/tombol/viewer/url-server/pivot/i18n/autolayout/kondisi-expr/toolbar/rebrand/subreport");

  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
