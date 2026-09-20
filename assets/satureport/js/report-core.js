/* ============================================================
 * SatuReport Offline — Core Engine
 * Model layout, renderer (dipakai designer & viewer), binding
 * resolver, barcode Code39, dan export XLSX (zip builder mandiri).
 * Terinspirasi dari https://github.com/ankareport/ankareport
 * ============================================================ */
(function (global) {
  "use strict";

  const SatuReport = { version: "1.0.0-offline" };

  /* ---------------- ID & util ---------------- */
  let _seq = 0;
  SatuReport.uid = (p = "it") => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
  SatuReport.clone = (o) => JSON.parse(JSON.stringify(o));
  SatuReport.esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  SatuReport.num = (v, d = 0) => (isFinite(+v) ? Math.round(+v) : d);

  /* ---------------- Ukuran kertas ---------------- */
  SatuReport.paperSize = (paper = "A4", orientation = "portrait") => {
    const S = {
      A4: { w: 794, h: 1123, wmm: 210, hmm: 297 },
      Letter: { w: 816, h: 1056, wmm: 216, hmm: 279 },
    };
    let s = S[paper] || S.A4;
    if (orientation === "landscape") s = { w: s.h, h: s.w, wmm: s.hmm, hmm: s.wmm };
    return s;
  };

  /* ---------------- Model ---------------- */
  const ITEM_DEFAULT = () => ({ height: 50, visible: true, style: {}, items: [] });

  SatuReport.emptyLayout = () => ({
    version: 2,
    width: 700,
    page: { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: true },
    pageHeaderSection: { height: 34, visible: true, style: {}, items: [] },
    headerSection: { height: 70, visible: true, style: {}, items: [] },
    contentSection: { height: 50, binding: "content", visible: true, style: {}, items: [], groups: [] },
    footerSection: { height: 45, visible: true, style: {}, items: [] },
    pageFooterSection: {
      height: 30, visible: true, style: {},
      items: [{ type: "text", text: "Halaman {PageNo} dari {PageCount}", binding: "", x: 200, y: 8, width: 300, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "center" } }],
    },
  });

  SatuReport.normalizeLayout = (layout) => {
    const l = Object.assign({}, layout || {});
    // konfigurasi halaman
    const dp = { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: false };
    l.page = Object.assign({}, dp, l.page || {}, { margins: Object.assign({}, dp.margins, (l.page || {}).margins || {}) });
    // band-band
    for (const key of ["headerSection", "contentSection", "footerSection"]) {
      l[key] = Object.assign(ITEM_DEFAULT(), l[key] || {});
      l[key].items = (l[key].items || []).map((it) => SatuReport.normalizeItem(it));
    }
    for (const key of ["pageHeaderSection", "pageFooterSection"]) {
      l[key] = Object.assign({ height: key === "pageHeaderSection" ? 34 : 30, visible: false, style: {}, items: [] }, l[key] || {});
      l[key].items = (l[key].items || []).map((it) => SatuReport.normalizeItem(it));
    }
    const cs = l.contentSection;
    cs.groups = (cs.groups || []).map((g) =>
      Object.assign({ id: SatuReport.uid("gr"), height: 30, binding: "", visible: true, style: {}, items: [] }, g, {
        items: (g.items || []).map((it) => SatuReport.normalizeItem(it)),
      })
    );
    // sinkronkan lebar area konten dengan kertas saat mode per halaman aktif
    if (l.page.pagination) {
      const s = SatuReport.paperSize(l.page.paper, l.page.orientation);
      l.width = Math.max(200, s.w - l.page.margins.left - l.page.margins.right);
    }
    l.width = Math.max(100, SatuReport.num(l.width || 700, 700));
    return l;
  };

  SatuReport.normalizeItem = (it) =>
    Object.assign(
      {
        id: SatuReport.uid(),
        type: "text", // text | image | barcode | line
        name: "",
        text: "",
        binding: "",
        x: 0, y: 0, width: 100, height: 20,
        src: "",
        style: {},
      },
      it,
      { style: Object.assign({}, it.style || {}) }
    );

  /* ---------------- Sample (mengikuti README satureport) ---------------- */
  SatuReport.sampleDataSource = () => [
    { label: "Nama Perusahaan", field: "company" },
    { label: "Judul Laporan", field: "title" },
    { label: "Tanggal", field: "date" },
    {
      label: "Content",
      field: "content",
      children: [
        { label: "Nama", field: "name" },
        { label: "Kota", field: "city" },
        { label: "Produk", field: "product" },
        { label: "Qty", field: "qty" },
        { label: "Harga", field: "price" },
        { label: "Total", field: "total" },
      ],
    },
    { label: "Footer 1", field: "footer1" },
    { label: "Footer 2", field: "footer2" },
  ];

  SatuReport.sampleLayout = () =>
    SatuReport.normalizeLayout({
      width: 700,
      headerSection: {
        height: 86, visible: true,
        style: { backgroundColor: "#0f172a" },
        items: [
          { type: "text", text: "PT. Satu Sejahtera", binding: "company", x: 16, y: 10, width: 320, height: 24, style: { color: "#ffffff", fontSize: 18, fontWeight: "bold" } },
          { type: "text", text: "Laporan Penjualan", binding: "title", x: 16, y: 38, width: 250, height: 18, style: { color: "#94a3b8", fontSize: 12 } },
          { type: "text", text: "Tanggal", binding: "date", x: 520, y: 12, width: 160, height: 18, style: { color: "#cbd5e1", fontSize: 11, textAlign: "right" } },
          { type: "barcode", text: "INV-2026-001", binding: "invoiceNo", x: 530, y: 36, width: 150, height: 40, style: { color: "#ffffff" } },
        ],
      },
      contentSection: {
        height: 30, binding: "content", visible: true,
        style: {},
        items: [
          { type: "text", text: "Nama", binding: "name", x: 10, y: 6, width: 130, height: 18, style: { fontSize: 11 } },
          { type: "text", text: "Kota", binding: "city", x: 145, y: 6, width: 90, height: 18, style: { fontSize: 11 } },
          { type: "text", text: "Produk", binding: "product", x: 240, y: 6, width: 160, height: 18, style: { fontSize: 11 } },
          { type: "text", text: "Qty", binding: "qty", x: 405, y: 6, width: 50, height: 18, style: { fontSize: 11, textAlign: "right" } },
          { type: "text", text: "Harga", binding: "price", x: 460, y: 6, width: 100, height: 18, style: { fontSize: 11, textAlign: "right" } },
          { type: "text", text: "Total", binding: "total", x: 565, y: 6, width: 120, height: 18, style: { fontSize: 11, textAlign: "right", fontWeight: "bold" } },
        ],
        groups: [],
      },
      footerSection: {
        height: 50, visible: true,
        style: { backgroundColor: "#f1f5f9" },
        items: [
          { type: "text", text: "Footer 1", binding: "footer1", x: 12, y: 8, width: 300, height: 16, style: { fontSize: 10, color: "#64748b" } },
          { type: "text", text: "Footer 2", binding: "footer2", x: 12, y: 26, width: 300, height: 16, style: { fontSize: 10, color: "#64748b" } },
          { type: "text", text: "Halaman", binding: "__page", x: 560, y: 16, width: 120, height: 16, style: { fontSize: 10, textAlign: "right", color: "#64748b" } },
        ],
      },
    });

  SatuReport.sampleData = () => ({
    company: "PT. Satu Sejahtera",
    title: "Laporan Penjualan — September 2026",
    date: "17 September 2026",
    invoiceNo: "INV-2026-001",
    content: [
      { name: "Budi Santoso", city: "Jakarta", product: "Laptop Pro 14\"", qty: 2, price: "15.500.000", total: "31.000.000" },
      { name: "Siti Rahayu", city: "Depok", product: "Mouse Wireless", qty: 10, price: "125.000", total: "1.250.000" },
      { name: "Agus Wijaya", city: "Bandung", product: "Keyboard Mechanical", qty: 5, price: "750.000", total: "3.750.000" },
      { name: "Dewi Lestari", city: "Surabaya", product: "Monitor 27\"", qty: 3, price: "2.800.000", total: "8.400.000" },
      { name: "Rizki Pratama", city: "Bekasi", product: "Webcam HD", qty: 4, price: "450.000", total: "1.800.000" },
    ],
    footer1: "Dicetak oleh sistem SatuReport Offline",
    footer2: "Dokumen ini sah tanpa tanda tangan basah",
  });

  /* ---------------- Binding resolver ---------------- */
  SatuReport.resolvePath = (obj, path) => {
    if (!path) return undefined;
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };

  // scope lokal (baris content/group) diprioritaskan, lalu root
  SatuReport.resolveBinding = (binding, scope, root) => {
    if (!binding) return undefined;
    let v = SatuReport.resolvePath(scope, binding);
    if (v === undefined && scope !== root) v = SatuReport.resolvePath(root, binding);
    return v;
  };

  // binding khusus: __page, __pages, __row, __rowNo, __count, __now
  SatuReport.resolveSpecial = (binding, ctx) => {
    switch (binding) {
      case "__page": return `Hal. ${ctx.page ?? 1}`;
      case "__pages": return ctx.pages != null ? String(ctx.pages) : "1";
      case "__row": return ctx.row != null ? String(ctx.row + 1) : "";
      case "__rowNo": return ctx.row != null ? String(ctx.row + 1) : "";
      case "__count": return ctx.count != null ? String(ctx.count) : "";
      case "__now": return new Date().toLocaleString("id-ID");
      default: return undefined;
    }
  };

  /* ---------- EKSPRESI KONDISI: "field == params.kota" ----------
   * Dipakai untuk: (1) contentSection.filter — hanya baris yg lolos yg dicetak;
   * (2) argumen ke-3 fungsi agregasi: {Sum(total,'content','city == params.kota')}.
   * Operator: ==  !=  <>  >  <  >=  <=   (numerik bila kedua sisi angka).
   * Sisi kanan boleh literal ('Depok'/Depok/2026) atau binding (params.kota, city). */
  SatuReport.splitArgs = (s) => {
    const out = []; let cur = "", q = null, depth = 0;
    for (const ch of String(s)) {
      if (q) { cur += ch; if (ch === q) q = null; }
      else if (ch === "'" || ch === "\"") { q = ch; cur += ch; }
      else if (ch === "(") { depth++; cur += ch; }
      else if (ch === ")") { depth--; cur += ch; }
      else if (ch === "," && depth === 0) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur !== "" || out.length) out.push(cur);
    return out.map((x) => x.trim());
  };
  SatuReport.unquote = (tok) => {
    tok = String(tok == null ? "" : tok).trim();
    return tok.length >= 2 && /^["'].*["']$/.test(tok) ? tok.slice(1, -1) : tok;
  };
  // nilai RHS kondisi: literal berkutip -> isinya; selain itu coba binding (params.kota, field lain)
  SatuReport.evalCondValue = (tok, row, root) => {
    tok = String(tok == null ? "" : tok).trim();
    if (/^["'].*["']$/.test(tok)) return tok.slice(1, -1);
    const b = SatuReport.resolveBinding(tok, row, root);
    return b === undefined ? SatuReport.unquote(tok) : b;
  };
  SatuReport.passesCond = (cond, row, root) => {
    if (!cond || !String(cond).trim()) return true;
    const m = String(cond).trim().match(/^([\w.]+)\s*(==|!=|<>|>=|<=|>|<|=)\s*([\s\S]+)$/);
    if (!m) return true; // kondisi tak dikenali -> tidak menyaring apa pun
    const [, field, opRaw, rhs] = m;
    const op = opRaw === "=" ? "==" : opRaw;
    const lv = SatuReport.resolveBinding(field, row, root);
    const rv = SatuReport.evalCondValue(rhs, row, root);
    // perbandingan NUMERIK bila kedua sisi terlihat angka polos (hindari "12.500.000" dsb)
    const plain = (v) => /^-?\s*\d+(\.\d+)?\s*$/.test(String(v == null ? "" : v));
    const bothNum = plain(lv) && plain(rv) && lv !== "" && rv !== "";
    const l = bothNum ? SatuReport.toNum(lv) : String(lv == null ? "" : lv);
    const r = bothNum ? SatuReport.toNum(rv) : String(rv == null ? "" : rv);
    switch (op) {
      case "==": return String(l) === String(r) && (bothNum ? l === r : true);
      case "!=": case "<>": return !(String(l) === String(r) && (bothNum ? l === r : true));
      case ">": return l > r;
      case "<": return l < r;
      case ">=": return l >= r;
      case "<=": return l <= r;
      default: return true;
    }
  };

  /* ---------------- Ekspresi ala ActiveReports ({...}) ----------------
   * Dalam teks item: {field}, {Sum(field)}, {Sum(field,'arrayPath')},
   * {Sum(field,'arrayPath','kondisi')} — mis. {Sum(total,'content','city == params.kota')},
   * {Avg}, {Min}, {Max}, {Count}, {CountIf}, {PageNo}, {PageCount}, {RowNo}, {RowCount}, {Now} */
  SatuReport.evalExpr = (expr, scope, root, ctx = {}) => {
    const mFn = expr.match(/^(Sum|Avg|Min|Max|CountIf|Count)\s*\(([\s\S]*)\)$/i);
    if (mFn) {
      const [, fnRaw, argStr] = mFn;
      const fn = fnRaw.toLowerCase();
      const args = SatuReport.splitArgs(argStr);
      const field = SatuReport.unquote(args[0] || "");
      const arrPath = SatuReport.unquote(args[1] || "");
      const cond = args.length > 2 ? SatuReport.unquote(args.slice(2).join(", ")) : "";
      let arr = arrPath ? SatuReport.resolveBinding(arrPath, scope, root) : ctx.aggRows;
      if (!Array.isArray(arr)) arr = [];
      if (cond) arr = arr.filter((r) => SatuReport.passesCond(cond, r, root));
      if (fn === "count" || fn === "countif") {
        if (!field) return arr.length;
        return arr.filter((r) => SatuReport.resolveBinding(field, r, root) != null).length;
      }
      const vals = arr.map((r) => SatuReport.toNum(SatuReport.resolveBinding(field, r, root)));
      if (!vals.length) return 0;
      const sum = vals.reduce((a, b) => a + b, 0);
      const out = fn === "sum" ? sum : fn === "avg" ? sum / vals.length : fn === "min" ? Math.min(...vals) : Math.max(...vals);
      return Math.round(out * 100) / 100;
    }
    const mSys = expr.match(/^(PageNo|PageCount|RowNo|RowCount|Now)$/i);
    if (mSys) {
      const k = mSys[1].toLowerCase();
      if (k === "pageno") return ctx.page ?? 1;
      if (k === "pagecount") return ctx.pages ?? 1;
      if (k === "rowno") return ctx.row != null ? ctx.row + 1 : "";
      if (k === "rowcount") return ctx.count ?? (ctx.aggRows ? ctx.aggRows.length : "");
      if (k === "now") return new Date().toLocaleString("id-ID");
    }
    return SatuReport.resolveBinding(expr, scope, root);
  };

  SatuReport.evalTemplate = (text, scope, root, ctx = {}) =>
    String(text ?? "").replace(/\{([^{}]+)\}/g, (mm, inner) => {
      const v = SatuReport.evalExpr(inner.trim(), scope, root, ctx);
      return v == null ? "" : String(v);
    });

  SatuReport.itemValue = (item, scope, root, ctx = {}) => {
    if (item.binding) {
      const sp = SatuReport.resolveSpecial(item.binding, ctx);
      if (sp !== undefined) return sp;
      const v = SatuReport.resolveBinding(item.binding, scope, root);
      return v === undefined || v === null ? "" : v;
    }
    // tanpa binding: teks boleh mengandung ekspresi {...}
    return SatuReport.evalTemplate(item.text ?? "", scope, root, ctx);
  };

  /* ---------------- Barcode Code 39 ---------------- */
  // Pola biner 12 modul (1=bar, 0=space), lebar bar: 1 = 1 modul, 11 = 2 modul.
  const CODE39 = {
    "0": "101001101101", "1": "110100101011", "2": "101100101011", "3": "110110010101",
    "4": "101001101011", "5": "110100110101", "6": "101100110101", "7": "101001011011",
    "8": "110100101101", "9": "101100101101", "A": "110101001011", "B": "101101001011",
    "C": "110110100101", "D": "101011001011", "E": "110101100101", "F": "101101100101",
    "G": "101010011011", "H": "110101001101", "I": "101101001101", "J": "101011001101",
    "K": "110101010011", "L": "101101010011", "M": "110110101001", "N": "101011010011",
    "O": "110101101001", "P": "101101101001", "Q": "101010110011", "R": "110101011001",
    "S": "101101011001", "T": "101011011001", "U": "110010101011", "V": "100110101011",
    "W": "110011010101", "X": "100101101011", "Y": "110010110101", "Z": "100110110101",
    "-": "100101011011", ".": "110010101101", " ": "100110101101", "$": "100100100101",
    "/": "100100101001", "+": "100101001001", "%": "101001001001", "*": "100101101101",
  };

  // Menghasilkan SVG barcode Code39 untuk nilai tsb.
  SatuReport.barcodeSVG = (value, opts = {}) => {
    const color = opts.color || "#000000";
    const showText = opts.showText !== false;
    let v = String(value ?? "").toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "");
    if (!v) v = "SATU";
    const chars = "*" + v + "*";
    let x = 0;
    const rects = [];
    for (let ci = 0; ci < chars.length; ci++) {
      const pat = CODE39[chars[ci]];
      if (!pat) continue;
      let i = 0;
      while (i < pat.length) {
        let j = i;
        while (j < pat.length && pat[j] === pat[i]) j++;
        const w = j - i; // lebar modul
        if (pat[i] === "1") rects.push(`<rect x="${x}" y="0" width="${w}" height="40" fill="${color}"/>`);
        x += w;
        i = j;
      }
      x += 1; // jarak antar karakter
    }
    const h = showText ? 52 : 42;
    const text = showText
      ? `<text x="${x / 2}" y="50" font-family="monospace" font-size="10" text-anchor="middle" fill="${color}">${SatuReport.esc(v)}</text>`
      : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 0 ${x + 8} ${h}" preserveAspectRatio="none" width="100%" height="100%">${rects.join("")}${text}</svg>`;
  };

  /* ---------------- Chart (SVG murni, tanpa library) ---------------- */
  // Parser angka toleran format: 12500, "12500", "12.500.000" (id), "12,500.50" (en), "4,5"
  SatuReport.toNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).trim();
    if (!s) return 0;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return parseFloat(s.replace(/,/g, "")) || 0;
    if (/^-?\d+,\d+$/.test(s)) return parseFloat(s.replace(",", ".")) || 0;
    const f = parseFloat(s.replace(/[^\d.,-]/g, ""));
    return isFinite(f) ? f : 0;
  };
  SatuReport.fmtShort = (v) => {
    const a = Math.abs(v);
    const f = (n) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    if (a >= 1e9) return f(v / 1e9) + " M";
    if (a >= 1e6) return f(v / 1e6) + " jt";
    if (a >= 1e3) return f(v / 1e3) + " rb";
    return String(Math.round(v * 100) / 100);
  };
  const CHART_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6"];

  // item: { chartType: bar|line|pie|donut, binding(path array), labelField, valueField, text(judul), showLegend, showValues, style.color }
  SatuReport.chartSVG = (item, scope, root) => {
    const data = SatuReport.resolveBinding(item.binding, scope, root);
    const rows = Array.isArray(data) ? data : [];
    const lf = item.labelField || "label";
    const vf = item.valueField || "value";
    const type = item.chartType || "bar";
    const color = item.style?.color || "#3b82f6";
    const showLegend = item.showLegend !== false;
    const showValues = item.showValues !== false;
    const agg = new Map();
    rows.forEach((r) => {
      if (r == null) return;
      const l = typeof r === "object" ? SatuReport.resolvePath(r, lf) : r;
      const v = typeof r === "object" ? SatuReport.toNum(SatuReport.resolvePath(r, vf)) : SatuReport.toNum(r);
      const key = String(l ?? "");
      agg.set(key, (agg.get(key) || 0) + v);
    });
    const pts = [...agg.entries()].map(([label, value]) => ({ label, value })).slice(0, 12);
    const W = 400, H = 300;
    const titleH = item.text ? 30 : 0;
    const F = `font-family="ui-sans-serif,system-ui,sans-serif"`;
    const empty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#e2e8f0" stroke-dasharray="5 4" rx="6"/>${item.text ? `<text x="${W / 2}" y="24" font-size="13" font-weight="bold" text-anchor="middle" fill="#334155" ${F}>${SatuReport.esc(item.text)}</text>` : ""}<text x="${W / 2}" y="${H / 2 + 10}" font-size="11" text-anchor="middle" fill="#94a3b8" ${F}>Tidak ada data — atur binding, field label &amp; nilai</text></svg>`;
    if (!pts.length || pts.every((p) => !p.value)) return empty;

    if (type === "pie" || type === "donut") {
      const donut = type === "donut";
      const total = pts.reduce((a, p) => a + p.value, 0) || 1;
      const cx = showLegend ? 110 : W / 2, cy = titleH + (H - titleH) / 2 + 4, r = Math.min(95, (H - titleH) / 2 - 14);
      let ang = -Math.PI / 2;
      let paths = "";
      pts.forEach((p, i) => {
        const frac = p.value / total;
        const a2 = ang + frac * Math.PI * 2;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        paths += `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${CHART_PALETTE[i % CHART_PALETTE.length]}" stroke="#ffffff" stroke-width="1.5"/>`;
        ang = a2;
      });
      let inner = "";
      if (donut) {
        inner = `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="${item.style?.backgroundColor || "#ffffff"}"/>
          <text x="${cx}" y="${cy - 4}" font-size="16" font-weight="bold" text-anchor="middle" fill="#0f172a" ${F}>${SatuReport.fmtShort(total)}</text>
          <text x="${cx}" y="${cy + 13}" font-size="9" text-anchor="middle" fill="#94a3b8" ${F}>Total</text>`;
      }
      let legend = "";
      if (showLegend) {
        const lx = 230, lh = 22;
        let ly = cy - (pts.length * lh) / 2 + 6;
        pts.forEach((p, i) => {
          const pct = ((p.value / total) * 100).toFixed(1).replace(".", ",");
          legend += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${CHART_PALETTE[i % CHART_PALETTE.length]}"/>
            <text x="${lx + 16}" y="${ly}" font-size="10" fill="#334155" ${F}>${SatuReport.esc(p.label)}</text>
            <text x="${W - 8}" y="${ly}" font-size="10" text-anchor="end" fill="#64748b" ${F}>${pct}%</text>`;
          ly += lh;
        });
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${item.text ? `<text x="${W / 2}" y="20" font-size="13" font-weight="bold" text-anchor="middle" fill="#334155" ${F}>${SatuReport.esc(item.text)}</text>` : ""}${paths}${inner}${legend}</svg>`;
    }

    // ---- bar & line ----
    const padL = 40, padR = 10, padT = titleH + 8, padB = 44;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = Math.max(...pts.map((p) => p.value), 0) || 1;
    const nice = niceCeil(max);
    const n = pts.length;
    const step = plotW / n;
    let grid = "";
    for (let g = 0; g <= 4; g++) {
      const gy = padT + plotH - (plotH * g) / 4;
      grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#e2e8f0" stroke-width="1" ${g === 0 ? 'stroke-dasharray="none"' : 'stroke-dasharray="3 3"'}/>
        <text x="${padL - 5}" y="${gy + 3}" font-size="9" text-anchor="end" fill="#94a3b8" ${F}>${SatuReport.fmtShort((nice * g) / 4)}</text>`;
    }
    let labels = "";
    pts.forEach((p, i) => {
      const lx = padL + step * i + step / 2;
      const ly = padT + plotH + 13;
      labels += n > 6
        ? `<text x="${lx}" y="${ly}" font-size="9" text-anchor="end" fill="#64748b" transform="rotate(-30 ${lx} ${ly})" ${F}>${SatuReport.esc(p.label)}</text>`
        : `<text x="${lx}" y="${ly}" font-size="9" text-anchor="middle" fill="#64748b" ${F}>${SatuReport.esc(p.label)}</text>`;
    });
    const title = item.text ? `<text x="${W / 2}" y="20" font-size="13" font-weight="bold" text-anchor="middle" fill="#334155" ${F}>${SatuReport.esc(item.text)}</text>` : "";
    const seriesName = `<text x="${W - padR}" y="${padT - 0}" font-size="9" text-anchor="end" fill="#94a3b8" ${F}></text>`;

    if (type === "line") {
      const coords = pts.map((p, i) => [padL + step * i + step / 2, padT + plotH - (p.value / nice) * plotH]);
      const linePts = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      const area = `M ${coords[0][0].toFixed(1)} ${padT + plotH} L ` + coords.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ") + ` L ${coords[coords.length - 1][0].toFixed(1)} ${padT + plotH} Z`;
      let dots = "", vals = "";
      coords.forEach(([x, y], i) => {
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="${color}" stroke-width="2.5"/>`;
        if (showValues) vals += `<text x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" font-size="9" text-anchor="middle" fill="${color}" font-weight="bold" ${F}>${SatuReport.fmtShort(pts[i].value)}</text>`;
      });
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${title}${grid}${labels}<path d="${area}" fill="${color}" fill-opacity="0.12"/><polyline points="${linePts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${vals}${seriesName}</svg>`;
    }

    // bar (default)
    const bw = Math.min(step * 0.62, 42);
    let bars = "", vals = "";
    pts.forEach((p, i) => {
      const bh = Math.max(1, (p.value / nice) * plotH);
      const bx = padL + step * i + (step - bw) / 2;
      const by = padT + plotH - bh;
      bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color}"/>`;
      if (showValues) vals += `<text x="${(bx + bw / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" font-size="9" text-anchor="middle" fill="#475569" font-weight="bold" ${F}>${SatuReport.fmtShort(p.value)}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${title}${grid}${labels}${bars}${vals}${seriesName}</svg>`;
  };
  function niceCeil(v) {
    if (v <= 0) return 1;
    const exp = Math.floor(Math.log10(v));
    const base = Math.pow(10, exp);
    const m = v / base;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return nice * base;
  }

  /* ---------------- Style -> CSS ---------------- */
  /* ---------------- PIVOT / CROSSTAB ---------------- */
  SatuReport.fmtNum = (v) => (v === null || v === undefined || v === "" || !isFinite(+v)) ? "" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 });

  // ringkas array baris -> matriks pivot baris x kolom (agregasi: sum|count|avg|min|max)
  SatuReport.pivotData = (rows, cfg = {}) => {
    rows = Array.isArray(rows) ? rows : [];
    const rowF = cfg.row || "", colF = cfg.col || "", valF = cfg.value || "";
    const agg = String(cfg.agg || "sum").toLowerCase();
    const colKeys = [], rowKeys = [], cells = {}, rowAgg = {}, colAgg = {};
    const newCell = () => ({ n: 0, s: 0, min: Infinity, max: -Infinity });
    const grand = newCell();
    const touch = (c, v) => {
      c.n++;
      const num = SatuReport.toNum(v);
      if (v !== null && v !== undefined && v !== "" && isFinite(num)) {
        c.s += num; if (num < c.min) c.min = num; if (num > c.max) c.max = num;
      }
    };
    const val = (c) => {
      if (!c || !c.n) return null;
      if (agg === "count") return c.n;
      if (agg === "avg") return c.s / c.n;
      if (agg === "min") return c.min === Infinity ? null : c.min;
      if (agg === "max") return c.max === -Infinity ? null : c.max;
      return c.s;
    };
    if (!rowF || !colF) return { rowKeys, colKeys, cell: () => null, rowTotal: () => null, colTotal: () => null, grand: null, empty: true };
    rows.forEach((r) => {
      if (r == null) return;
      const rk = String(SatuReport.resolvePath(r, rowF) ?? "—");
      const ck = String(SatuReport.resolvePath(r, colF) ?? "—");
      if (!rowKeys.includes(rk)) rowKeys.push(rk);
      if (!colKeys.includes(ck)) colKeys.push(ck);
      const v = valF ? SatuReport.resolvePath(r, valF) : 1;
      const key = rk + "" + ck;
      if (!cells[key]) cells[key] = newCell();
      if (!rowAgg[rk]) rowAgg[rk] = newCell();
      if (!colAgg[ck]) colAgg[ck] = newCell();
      touch(cells[key], v); touch(rowAgg[rk], v); touch(colAgg[ck], v); touch(grand, v);
    });
    return {
      rowKeys, colKeys,
      cell: (rk, ck) => val(cells[rk + "" + ck]),
      rowTotal: (rk) => val(rowAgg[rk]),
      colTotal: (ck) => val(colAgg[ck]),
      grand: val(grand),
      empty: !rowKeys.length,
    };
  };

  // tabel HTML utk elemen pivot -> { html, height } (tinggi otomatis mengikuti jumlah baris)
  SatuReport.pivotTable = (item, scope, root) => {
    const cfg = item.pivot || {};
    const fs = +((item.style && item.style.fontSize) || 9) || 9;
    const hRow = Math.round(fs * 2);
    const F = "font-family:ui-sans-serif,system-ui,sans-serif;";
    const empty = (msg) => ({
      height: Math.max(item.height, hRow * 3),
      html: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:1px dashed #cbd5e1;border-radius:6px;color:#94a3b8;font-size:${fs + 1}px;${F}">${SatuReport.esc(msg)}</div>`,
    });
    if (!cfg.row || !cfg.col) return empty("Pivot: atur row & col (mis. row = kota, col = tahun)");
    const data = item.binding ? SatuReport.resolveBinding(item.binding, scope, root) : null;
    const p = SatuReport.pivotData(data, cfg);
    if (p.empty) return empty("Pivot: tidak ada data untuk binding '" + (item.binding || "") + "'");
    const headerBg = cfg.headerBg || "#334155";
    const bd = "1px solid #cbd5e1";
    const th = `border:${bd};background:${headerBg};color:#ffffff;font-weight:bold;padding:1px 4px;text-align:center;`;
    const tdL = `border:${bd};padding:1px 4px;text-align:left;`;
    const tdR = `border:${bd};padding:1px 4px;text-align:right;`;
    const showRowTotal = cfg.rowTotal !== false;
    const showColTotal = cfg.colTotal !== false;
    let head = `<tr><th style="${th}text-align:left;">${SatuReport.esc(cfg.row)} \\ ${SatuReport.esc(cfg.col)}</th>`;
    p.colKeys.forEach((ck) => (head += `<th style="${th}">${SatuReport.esc(ck)}</th>`));
    if (showRowTotal) head += `<th style="${th}background:#1e293b;">TOTAL</th>`;
    head += "</tr>";
    let body = "";
    p.rowKeys.forEach((rk, i) => {
      body += `<tr${i % 2 ? ' style="background:#f8fafc"' : ""}><td style="${tdL}font-weight:600;">${SatuReport.esc(rk)}</td>`;
      p.colKeys.forEach((ck) => {
        const v = p.cell(rk, ck);
        body += `<td style="${tdR}">${v === null ? "–" : SatuReport.esc(SatuReport.fmtNum(v))}</td>`;
      });
      if (showRowTotal) body += `<td style="${tdR}background:#eef2ff;font-weight:bold;">${SatuReport.esc(SatuReport.fmtNum(p.rowTotal(rk)))}</td>`;
      body += "</tr>";
    });
    let foot = "";
    if (showColTotal) {
      foot = `<tr><td style="${tdL}background:#f1f5f9;font-weight:bold;">TOTAL</td>`;
      p.colKeys.forEach((ck) => (foot += `<td style="${tdR}background:#f1f5f9;font-weight:bold;">${SatuReport.esc(SatuReport.fmtNum(p.colTotal(ck)))}</td>`));
      if (showRowTotal) foot += `<td style="${tdR}background:#e2e8f0;font-weight:bold;">${SatuReport.esc(SatuReport.fmtNum(p.grand))}</td>`;
      foot += "</tr>";
    }
    const nRows = 1 + p.rowKeys.length + (showColTotal ? 1 : 0);
    return {
      height: Math.max(item.height, nRows * hRow + 2),
      html: `<table style="border-collapse:collapse;width:100%;table-layout:auto;${F}font-size:${fs}px;color:#0f172a;">${head}${body}${foot}</table>`,
    };
  };

  SatuReport.styleToCss = (s = {}) => {
    const m = {
      color: "color", backgroundColor: "background-color", fontSize: "font-size",
      fontWeight: "font-weight", fontStyle: "font-style", textDecoration: "text-decoration",
      textAlign: "text-align", fontFamily: "font-family", lineHeight: "line-height",
      borderWidth: "border-width", borderColor: "border-color", borderStyle: "border-style",
      borderRadius: "border-radius", padding: "padding", opacity: "opacity", objectFit: "object-fit",
    };
    let css = "";
    for (const k in m) {
      if (s[k] === undefined || s[k] === "" || s[k] === null) continue;
      let v = s[k];
      if (["fontSize", "borderWidth", "borderRadius", "padding", "lineHeight"].includes(k) && isFinite(+v)) v = v + "px";
      css += `${m[k]}:${v};`;
    }
    return css;
  };

  /* ---------------- Renderer ---------------- */
  // Render 1 item -> HTML absolut (dipakai viewer, designer juga boleh)
  SatuReport.renderItemHTML = (item, scope, root, ctx = {}) => {
    const base = `position:absolute;left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px;box-sizing:border-box;overflow:hidden;`;
    const st = SatuReport.styleToCss(item.style);
    if (item.type === "image") {
      let src = item.src || "";
      if (item.binding) {
        const v = SatuReport.resolveBinding(item.binding, scope, root);
        if (typeof v === "string" && v) src = v;
      }
      const fit = item.style?.objectFit || "contain";
      return `<div style="${base}${st}">${src ? `<img src="${SatuReport.esc(src)}" alt="" style="width:100%;height:100%;object-fit:${fit};display:block;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;border:1px dashed #cbd5e1;">no image</div>`}</div>`;
    }
    if (item.type === "barcode") {
      const val = SatuReport.itemValue(item, scope, root, ctx);
      const color = item.style?.color || "#000000";
      return `<div style="${base}${st}">${SatuReport.barcodeSVG(val, { color, showText: item.showText !== false })}</div>`;
    }
    if (item.type === "chart") {
      return `<div style="${base}${st}">${SatuReport.chartSVG(item, scope, root, ctx)}</div>`;
    }
    if (item.type === "pivot") {
      const pv = SatuReport.pivotTable(item, scope, root);
      // tinggi mengikuti isi tabel & biarkan terlihat bila melebihi kotak
      const baseGrown = base.replace(`height:${item.height}px`, `height:${pv.height}px`).replace("overflow:hidden;", "overflow:visible;");
      return `<div style="${baseGrown}${st}">${pv.html}</div>`;
    }
    if (item.type === "line") {
      const color = item.style?.borderColor || item.style?.color || "#000000";
      const bw = item.style?.borderWidth || 1;
      return `<div style="${base}border-top:${bw}px solid ${color};height:0;overflow:visible;"></div>`;
    }
    // text
    const val = SatuReport.itemValue(item, scope, root, ctx);
    const pad = item.style?.padding ? "" : "padding:1px 2px;";
    return `<div style="${base}${pad}${st}white-space:pre-wrap;word-break:break-word;">${SatuReport.esc(val)}</div>`;
  };

  SatuReport.renderSectionHTML = (section, scope, root, ctx = {}) => {
    if (!section || section.visible === false) return "";
    const st = SatuReport.styleToCss(section.style);
    const items = (section.items || []).map((it) => SatuReport.renderItemHTML(it, scope, root, ctx)).join("");
    return `<div class="ar-section" style="position:relative;width:100%;height:${section.height}px;${st}overflow:hidden;">${items}</div>`;
  };

  // Bangun daftar band (pabrik HTML dengan tinggi tetap) — dipakai render & paginasi
  SatuReport.buildBands = (layout, data) => {
    const root = data || {};
    const bands = [];
    const aggRows = (() => {
      let a = layout.contentSection.binding ? SatuReport.resolvePath(root, layout.contentSection.binding) : null;
      a = Array.isArray(a) ? a : [];
      // contentSection.filter: ekspresi kondisi ("city == params.kota") — hanya baris yg lolos yg dicetak
      const f = layout.contentSection.filter;
      if (f && String(f).trim()) a = a.filter((r) => SatuReport.passesCond(f, r, root));
      return a;
    })();
    const mk = (sec, scopeFn, extraCtx) => ({
      h: sec.height,
      make: (ctx) => SatuReport.renderSectionHTML(sec, typeof scopeFn === "function" ? scopeFn() : scopeFn, root, Object.assign({ aggRows }, extraCtx || {}, ctx)),
    });
    if (layout.headerSection && layout.headerSection.visible !== false) bands.push(mk(layout.headerSection, root));
    const cs = layout.contentSection;
    if (cs && cs.visible !== false) {
      if (aggRows.length) {
        aggRows.forEach((row, i) => {
          bands.push(mk(cs, row, { row: i, count: aggRows.length }));
          (cs.groups || []).forEach((g) => {
            if (g.visible === false) return;
            const gArr = g.binding ? SatuReport.resolvePath(row, g.binding) : null;
            const rows = Array.isArray(gArr) ? gArr : [row];
            // aggRows = baris sub group: agregat di dalam band sub group bersifat LOKAL per master
            rows.forEach((gRow, gi) => bands.push(mk(g, gRow, { row: gi, count: rows.length, aggRows: rows })));
          });
        });
      } else {
        bands.push(mk(cs, root));
      }
    }
    if (layout.footerSection && layout.footerSection.visible !== false) bands.push(mk(layout.footerSection, root));
    return { bands, aggRows };
  };

  // Render laporan penuh -> satu elemen DIV "halaman" (mode kontinu).
  SatuReport.render = ({ layout, data }) => {
    layout = SatuReport.normalizeLayout(layout);
    data = data || {};
    const { bands } = SatuReport.buildBands(layout, data);
    const ctx = { page: 1, pages: 1 };
    let html = bands.map((b) => b.make(ctx)).join("");

    const page = document.createElement("div");
    page.className = "ar-page";
    page.style.cssText = `position:relative;width:${layout.width}px;background:#ffffff;box-sizing:content-box;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;color:#0f172a;`;
    page.innerHTML = html;
    return page;
  };

  /* ---------------- Paginasi ala ActiveReports ----------------
   * Report Header (hlm 1) & Report Footer (akhir data) mengalir;
   * Page Header & Page Footer berulang pada SETIAP halaman. */
  SatuReport.renderPages = ({ layout, data }) => {
    layout = SatuReport.normalizeLayout(layout);
    const { bands, aggRows } = SatuReport.buildBands(layout, data || {});
    const root = data || {};
    const p = layout.page;
    const size = SatuReport.paperSize(p.paper, p.orientation);
    const m = p.margins;
    const effW = Math.max(200, size.w - m.left - m.right);
    const phSec = layout.pageHeaderSection, pfSec = layout.pageFooterSection;
    const ph = phSec.visible !== false ? phSec.height : 0;
    const pf = pfSec.visible !== false ? pfSec.height : 0;
    const usable = Math.max(120, size.h - m.top - m.bottom - ph - pf);

    // tata band ke halaman
    const pages = [[]];
    let used = 0;
    for (const b of bands) {
      if (used > 0 && used + b.h > usable) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(b);
      used += b.h;
    }
    const total = pages.length;

    const sheets = pages.map((pageBands, pi) => {
      const ctx = { page: pi + 1, pages: total };
      const headHTML = ph
        ? `<div style="position:absolute;left:${m.left}px;top:${m.top}px;width:${effW}px;">${SatuReport.renderSectionHTML(phSec, root, root, Object.assign({ aggRows }, ctx))}</div>`
        : "";
      const footHTML = pf
        ? `<div style="position:absolute;left:${m.left}px;top:${size.h - m.bottom - pf}px;width:${effW}px;">${SatuReport.renderSectionHTML(pfSec, root, root, Object.assign({ aggRows }, ctx))}</div>`
        : "";
      const body = pageBands.map((b) => b.make(ctx)).join("");
      const sheet = document.createElement("div");
      sheet.className = "ar-sheet";
      sheet.style.cssText = `position:relative;width:${size.w}px;height:${size.h}px;background:#ffffff;box-sizing:border-box;overflow:hidden;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;color:#0f172a;`;
      sheet.innerHTML = headHTML +
        `<div style="position:absolute;left:${m.left}px;top:${m.top + ph}px;width:${effW}px;height:${usable}px;overflow:hidden;">${body}</div>` +
        footHTML;
      return sheet;
    });

    return { sheets, total, size, effW, pagesInfo: { usable, ph, pf } };
  };

  /* ---------------- ZIP builder (stored, tanpa kompresi) + CRC32 ---------------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  SatuReport.zipStore = (files) => {
    // files: [{name, content(string)}] -> Uint8Array zip
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const push = (arr) => { chunks.push(arr); offset += arr.length; };
    const u16 = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
    const u32 = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]);
    const dosTime = (() => { const d = new Date(); return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)); })();
    const dosDate = (() => { const d = new Date(); return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()); })();

    for (const f of files) {
      const nameB = enc.encode(f.name);
      const dataB = enc.encode(f.content);
      const crc = crc32(dataB);
      const local = [u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(dataB.length), u32(dataB.length), u16(nameB.length), u16(0), nameB, dataB];
      const localOffset = offset;
      local.forEach(push);
      central.push({ nameB, crc, size: dataB.length, localOffset });
    }
    const cdStart = offset;
    for (const c of central) {
      [u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(c.crc), u32(c.size), u32(c.size), u16(c.nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.localOffset), c.nameB].forEach(push);
    }
    const cdEnd = offset;
    push(u32(0x06054b50)); push(u16(0)); push(u16(0)); push(u16(central.length)); push(u16(central.length));
    push(u32(cdEnd - cdStart)); push(u32(cdStart)); push(u16(0));

    const out = new Uint8Array(offset);
    let pos = 0;
    for (const ch of chunks) { out.set(ch, pos); pos += ch.length; }
    return out;
  };

  /* ---------------- Export XLSX ---------------- */
  const xesc = (v) =>
    String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  SatuReport.buildXLSX = (layout, data, sheetName = "Report") => {
    layout = SatuReport.normalizeLayout(layout);
    const cs = layout.contentSection;
    const cols = (cs.items || []).filter((it) => it.binding && !["image", "line", "chart", "pivot"].includes(it.type));
    const arr = cs.binding ? SatuReport.resolvePath(data || {}, cs.binding) : null;
    const rows = Array.isArray(arr) ? arr : [];
    const headers = cols.map((c) => (c.text && c.text !== c.binding ? c.text : c.binding));

    const cell = (v, r, c, isHead) => {
      const ref = String.fromCharCode(65 + c) + (r + 1);
      if (typeof v === "number") return `<c r="${ref}"${isHead ? ' s="1"' : ""}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${isHead ? ' s="1"' : ""}><is><t>${xesc(v)}</t></is></c>`;
    };
    let rowsXml = `<row r="1">${headers.map((h, i) => cell(h, 0, i, true)).join("")}</row>`;
    rows.forEach((row, ri) => {
      rowsXml += `<row r="${ri + 2}">${cols.map((c, ci) => {
        let v = SatuReport.resolveBinding(c.binding, row, data);
        if (v === undefined || v === null) v = "";
        return cell(v, ri + 1, ci, false);
      }).join("")}</row>`;
    });
    const colWidths = cols.map((c) => `<col min="${cols.indexOf(c) + 1}" max="${cols.indexOf(c) + 1}" width="${Math.max(10, Math.min(40, c.width / 6))}" customWidth="1"/>`).join("");

    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${colWidths}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xesc(sheetName.slice(0, 28))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

    return SatuReport.zipStore([
      { name: "[Content_Types].xml", content: contentTypes },
      { name: "_rels/.rels", content: rootRels },
      { name: "xl/workbook.xml", content: workbook },
      { name: "xl/_rels/workbook.xml.rels", content: wbRels },
      { name: "xl/worksheets/sheet1.xml", content: sheet },
      { name: "xl/styles.xml", content: styles },
    ]);
  };

  /* ---------------- Download helper ---------------- */
  SatuReport.download = (bytesOrString, filename, mime = "application/octet-stream") => {
    const blob = bytesOrString instanceof Uint8Array ? new Blob([bytesOrString], { type: mime }) : new Blob([bytesOrString], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  };

  /* ---------------- Salin ke clipboard (dengan fallback) ---------------- */
  SatuReport.copyText = async (text) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const okc = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
      ta.remove();
      return !!okc;
    } catch (e) { return false; }
  };

  /* ---------------- Simpan ke file (Save As native bila bisa) ---------------- */
  SatuReport.saveFileSmart = async (text, filename, mime = "application/json") => {
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "SatuReport Layout", accept: { [mime]: ["." + filename.split(".").pop()] } }],
        });
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        return "saved";
      } catch (e) {
        if (e && e.name === "AbortError") return "aborted";
        // Sandbox pratinjau memblokir File System Access API (SecurityError/NotAllowedError)
        // -> JANGAN jatuh ke anchor-download (juga diblokir diam-diam); laporkan jujur.
        return "blocked";
      }
    }
    SatuReport.download(text, filename, mime);
    return "downloaded";
  };

  /* ---------------- Muat data dari API JSON ---------------- */
  // Normalisasi respons API: array -> {content: array}; objek dipakai apa adanya.
  SatuReport.normalizeApiData = (j) => {
    if (Array.isArray(j)) return { content: j };
    if (j && typeof j === "object") return j;
    throw new Error("Respons API bukan objek/array JSON");
  };

  // fetch dengan timeout + fallback proxy same-origin (/api-proxy?url=...) bila
  // fetch langsung gagal karena jaringan diblokir (sandbox) atau CORS.
  SatuReport.fetchJson = async (url) => {
    url = String(url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("URL harus diawali http:// atau https://");
    const tryFetch = async (u) => {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
      try {
        const res = await fetch(u, Object.assign({ headers: { Accept: "application/json" } }, ctrl ? { signal: ctrl.signal } : {}));
        if (!res.ok) throw new Error("HTTP " + res.status + (res.statusText ? " " + res.statusText : ""));
        return await res.json();
      } finally { if (timer) clearTimeout(timer); }
    };
    try {
      return SatuReport.normalizeApiData(await tryFetch(url));
    } catch (e1) {
      const netFail = e1 instanceof TypeError || /failed to fetch|networkerror|load failed|abort/i.test(String((e1 && e1.message) || e1));
      if (!netFail) throw e1; // HTTP error / JSON rusak -> langsung laporkan
      // coba proxy same-origin (server :8000) untuk mengatasi CORS
      const sameOrigin = typeof location !== "undefined" && /^https?:$/.test(location.protocol);
      if (sameOrigin) {
        try {
          return SatuReport.normalizeApiData(await tryFetch("/api-proxy?url=" + encodeURIComponent(url)));
        } catch (e2) {
          throw new Error("API gagal dimuat (jaringan/CORS): " + (e1.message || e1) + " — proxy: " + (e2.message || e2));
        }
      }
      throw new Error("API gagal dimuat: " + (e1.message || e1) + ". Di pratinjau sandbox jaringan diblokir — buka aplikasi lewat live preview server (tab penuh).");
    }
  };

  /* ---------------- Print (Export PDF via dialog print) ---------------- */
  // content: elemen atau string HTML; pageSizeCss: mis "210mm 297mm" utk @page size
  SatuReport.printHTML = (content, title = "Report", pageSizeCss = "") => {
    const body = typeof content === "string" ? content : content.outerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    // alert() diblokir sandbox -> kembalikan status, biarkan pemanggil menampilkan toast
    if (!win) return false;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${SatuReport.esc(title)}</title>
<style>
body{margin:0;background:#fff;}
.ar-page{margin:0 auto;}
.ar-sheet{margin:0 auto;page-break-after:always;}
.ar-sheet:last-child{page-break-after:auto;}
@media print{@page{${pageSizeCss ? "size:" + pageSizeCss + ";" : ""}margin:${pageSizeCss ? "0" : "8mm"};}}
</style></head>
<body>${body}<scr` + `ipt>window.onload=()=>{setTimeout(()=>window.print(),200);};</scr` + `ipt></body></html>`);
    win.document.close();
    return true;
  };

  // ganti placeholder {nama} di string dgn nilai parameter
  SatuReport.substituteParams = (str, params = {}) =>
    String(str || "").replace(/\{(\w[\w.]*)\}/g, (m, k) => (params[k] != null && params[k] !== "" ? String(params[k]) : m));

  // normalisasi definisi parameter report: array objek / array string / peta {nama: default}
  SatuReport.normalizeParams = (spec) => {
    if (!spec) return [];
    const one = (name, p = {}) => ({
      name, label: p.label || name, type: p.type || "text",
      default: p.default ?? "", options: p.options || null, field: p.field ?? name,
    });
    if (Array.isArray(spec)) return spec.map((p) => (typeof p === "string" ? one(p) : one(p.name, p)));
    if (typeof spec === "object") return Object.keys(spec).map((k) => one(k, { type: typeof spec[k] === "number" ? "number" : "text", default: spec[k] }));
    return [];
  };

  // jalankan "query kustom" ke endpoint (POST JSON {query, params})
  // dipakai paket semacam {layout, data:{query:"select ...",endpoint:"http://host/api"}}
  SatuReport.fetchQuery = async (endpoint, query, params = {}) => {
    endpoint = String(endpoint || "").trim();
    if (!endpoint) throw new Error("Endpoint query kosong");
    if (!/^https?:\/\//i.test(endpoint) && !endpoint.startsWith("/")) throw new Error("Endpoint harus URL http(s) atau path /...");
    const body = JSON.stringify({ query: SatuReport.substituteParams(query, params), params });
    const post = async (u) => {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
      try {
        const res = await fetch(u, Object.assign({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body }, ctrl ? { signal: ctrl.signal } : {}));
        if (!res.ok) throw new Error("HTTP " + res.status + (res.statusText ? " " + res.statusText : ""));
        return await res.json();
      } finally { if (timer) clearTimeout(timer); }
    };
    try {
      return SatuReport.normalizeApiData(await post(endpoint));
    } catch (e1) {
      const netFail = e1 instanceof TypeError || /failed to fetch|networkerror|load failed|abort/i.test(String((e1 && e1.message) || e1));
      if (!netFail) throw e1;
      const canProxy = typeof location !== "undefined" && /^https?:$/.test(location.protocol) && !endpoint.startsWith("/");
      if (canProxy) {
        try { return SatuReport.normalizeApiData(await post("/api-proxy?url=" + encodeURIComponent(endpoint))); }
        catch (e2) { throw new Error("Query gagal (jaringan/CORS): " + (e1.message || e1) + " — proxy: " + (e2.message || e2)); }
      }
      throw new Error("Query gagal: " + (e1.message || e1) + (endpoint.startsWith("/") ? " (endpoint relatif hanya berfungsi lewat server)" : ""));
    }
  };

  /* ---------------- Data Source yang diturunkan dari data nyata ---------------- */
  // Bangun pohon field {label, field, children?} dari objek data (maks 2 level grup,
  // cocok dgn panel designer). Objek/array bersarang di-flatten dgn titik: address.city
  SatuReport.dataSourceFromData = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    const leaf = (label, field) => ({ label, field });
    const fieldsOf = (obj, prefix = "") => {
      const out = [];
      for (const k of Object.keys(obj || {})) {
        const v = obj[k];
        const f = prefix ? prefix + "." + k : k;
        if (Array.isArray(v)) out.push(leaf(k + " [array]", f));
        else if (v && typeof v === "object") out.push(...fieldsOf(v, f));
        else out.push(leaf(k, f));
      }
      return out;
    };
    const out = [];
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (Array.isArray(v)) {
        const row = v.find((r) => r && typeof r === "object");
        out.push({ label: k, field: k, children: row ? fieldsOf(row) : [] });
      } else if (v && typeof v === "object") {
        out.push({ label: k, field: k, children: fieldsOf(v) });
      } else {
        out.push(leaf(k, k));
      }
    }
    return out;
  };

  /* ---------------- IndexedDB (penyimpanan utama) ---------------- */
  const DB_NAME = "satureport-offline";
  const DB_STORE = "kv";
  let _dbPromise = null;
  function ensureDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") return resolve(null);
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = () => {
        try { req.result.createObjectStore(DB_STORE); } catch (e) {}
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return _dbPromise;
  }
  /* ---- Migrasi merek lawas (prefiks "ankareport") -> SatuReport (sekali jalan, aman bila gagal) ---- */
  SatuReport.legacyBrandKey = (k) => (k && String(k).indexOf("ankareport") === 0 ? "satureport" + String(k).slice(10) : k);
  function readAllDbByName(dbName) { // baca semua {k:v} dari DB lawas tanpa membuat barunya di browser yg tidak punya
    return new Promise((res) => {
      const out = {};
      if (typeof indexedDB === "undefined") return res(out);
      let req;
      try { req = indexedDB.open(dbName, 1); } catch (e) { return res(out); }
      req.onupgradeneeded = () => { try { req.transaction.abort(); } catch (e) {} }; // jangan ciptakan DB lawas
      req.onerror = () => res(out);
      req.onblocked = () => res(out);
      req.onsuccess = () => {
        try {
          if (!req.result.objectStoreNames || !req.result.objectStoreNames.contains(DB_STORE)) { try { req.result.close(); } catch (e) {} return res(out); }
          const rq = req.result.transaction(DB_STORE, "readonly").objectStore(DB_STORE).openCursor();
          rq.onsuccess = () => {
            const cur = rq.result;
            if (cur) { out[cur.key] = cur.value; cur.continue(); }
            else { try { req.result.close(); } catch (e) {} res(out); }
          };
          rq.onerror = () => { try { req.result.close(); } catch (e) {} res(out); };
        } catch (e) { try { req.result.close(); } catch (e2) {} res(out); }
      };
    });
  }
  SatuReport.migrateLegacyBrandStorage = async function () {
    let n = 0;
    try { // 1) IndexedDB "ankareport-offline" -> DB baru; kunci "ankareport*" -> "satureport*"
      const oldRecs = await readAllDbByName("ankareport-offline");
      for (const k in oldRecs) {
        const nk = SatuReport.legacyBrandKey(k);
        if (nk && (await SatuReport.idb.get(nk)) == null) { await SatuReport.idb.set(nk, oldRecs[k]); n++; }
      }
      if (Object.keys(oldRecs).length) { try { indexedDB.deleteDatabase("ankareport-offline"); } catch (e) {} }
    } catch (e) {}
    try { // 2) localStorage warisan -> kunci prefiks baru (target yg sudah ada tidak ditimpa)
      const moves = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && SatuReport.legacyBrandKey(k) !== k) moves.push(k);
      }
      for (const k of moves) {
        const nk = SatuReport.legacyBrandKey(k);
        if (window.localStorage.getItem(nk) == null) { window.localStorage.setItem(nk, window.localStorage.getItem(k)); n++; }
      }
    } catch (e) {}
    return n;
  };

  SatuReport.idb = {
    async available() { return !!(await ensureDB()); },
    async set(key, val) {
      const db = await ensureDB();
      if (!db) return false;
      return new Promise((res) => {
        try {
          const tx = db.transaction(DB_STORE, "readwrite");
          tx.objectStore(DB_STORE).put(val, key);
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
          tx.onabort = () => res(false);
        } catch (e) { res(false); }
      });
    },
    async get(key) {
      const db = await ensureDB();
      if (!db) return null;
      return new Promise((res) => {
        try {
          const rq = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
          rq.onsuccess = () => res(rq.result === undefined ? null : rq.result);
          rq.onerror = () => res(null);
        } catch (e) { res(null); }
      });
    },
    async del(key) {
      const db = await ensureDB();
      if (!db) return false;
      return new Promise((res) => {
        try {
          const tx = db.transaction(DB_STORE, "readwrite");
          tx.objectStore(DB_STORE).delete(key);
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
        } catch (e) { res(false); }
      });
    },
    async all() {
      const db = await ensureDB();
      const out = {};
      if (!db) return out;
      return new Promise((res) => {
        try {
          const rq = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).openCursor();
          rq.onsuccess = () => {
            const cur = rq.result;
            if (cur) { out[cur.key] = cur.value; cur.continue(); }
            else res(out);
          };
          rq.onerror = () => res(out);
        } catch (e) { res(out); }
      });
    },
  };

  /* ---------------- Storage aman berlapis ----------------
   * Urutan backend: IndexedDB (utama) -> localStorage (migrasi lama) -> memori.
   * API sinkron via cache memori; get() instan setelah ready(). */
  const _memStore = {};
  SatuReport.store = {
    backend: "memory",
    get(key) { return key in _memStore ? _memStore[key] : null; },
    set(key, val) {
      _memStore[key] = String(val);
      this._persist(key, _memStore[key]); // async fire-and-forget
    },
    async setAwait(key, val) {
      _memStore[key] = String(val);
      await this._persist(key, _memStore[key]);
    },
    async del(key) {
      delete _memStore[key];
      await SatuReport.idb.del(key);
      try { window.localStorage.removeItem(key); } catch (e) {}
    },
    async _persist(key, val) {
      const ok = await SatuReport.idb.set(key, val);
      if (!ok) { try { window.localStorage.setItem(key, val); } catch (e) {} }
    },
    async ready() {
      try { await SatuReport.migrateLegacyBrandStorage(); } catch (e) {}
      if (await SatuReport.idb.available()) {
        const all = await SatuReport.idb.all();
        // Migrasi sekali: salin warisan localStorage -> IndexedDB
        if (!Object.keys(all).length) {
          try {
            const legacy = {};
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i);
              if (k && k.startsWith("satureport")) legacy[k] = window.localStorage.getItem(k);
            }
            for (const k in legacy) await SatuReport.idb.set(k, legacy[k]);
            Object.assign(all, legacy);
          } catch (e) {}
        }
        Object.assign(_memStore, all);
        this.backend = "indexeddb";
      } else {
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith("satureport")) _memStore[k] = window.localStorage.getItem(k);
          }
          this.backend = "localstorage";
        } catch (e) { this.backend = "memory"; }
      }
      return this.backend;
    },
  };

  global.SatuReport = SatuReport;
})(window);
