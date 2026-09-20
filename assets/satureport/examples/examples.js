/* ============================================================
 * SatuReport Offline — Kumpulan Contoh Report
 * Setiap contoh: { id, title, desc, tags, layout, data }
 * Dimuat oleh viewer.html / designer.html via ?example=<id>
 * ============================================================ */
(function () {
  const LOGO_DARK =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23ffffff' fill-opacity='0.15'/%3E%3Crect x='4' y='4' width='56' height='56' rx='12' fill='%23ffffff'/%3E%3Ctext x='32' y='41' font-family='Arial,sans-serif' font-size='24' font-weight='bold' text-anchor='middle' fill='%231e293b'%3EAS%3C/text%3E%3C/svg%3E";
  const LOGO_TEAL =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23ffffff' fill-opacity='0.15'/%3E%3Crect x='4' y='4' width='56' height='56' rx='12' fill='%23ffffff'/%3E%3Ctext x='32' y='41' font-family='Arial,sans-serif' font-size='24' font-weight='bold' text-anchor='middle' fill='%230f766e'%3EA%3C/text%3E%3C/svg%3E";

  /* Helper: terbilang bahasa Indonesia */
  function terbilangID(n) {
    const a = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    n = Math.floor(Math.abs(n));
    let t = "";
    if (n < 12) t = a[n];
    else if (n < 20) t = terbilangID(n - 10) + " belas";
    else if (n < 100) t = terbilangID(Math.floor(n / 10)) + " puluh " + a[n % 10];
    else if (n < 200) t = "seratus " + terbilangID(n - 100);
    else if (n < 1000) t = terbilangID(Math.floor(n / 100)) + " ratus " + terbilangID(n % 100);
    else if (n < 2000) t = "seribu " + terbilangID(n - 1000);
    else if (n < 1e6) t = terbilangID(Math.floor(n / 1000)) + " ribu " + terbilangID(n % 1000);
    else if (n < 1e9) t = terbilangID(Math.floor(n / 1e6)) + " juta " + terbilangID(n % 1e6);
    else if (n < 1e12) t = terbilangID(Math.floor(n / 1e9)) + " miliar " + terbilangID(n % 1e9);
    return t.replace(/\s+/g, " ").trim();
  }
  const fmtID = (n) => n.toLocaleString("id-ID");

  // Item invoice di-generate: 5 tahap × 6 layanan = 30 baris (mendemokan paginasi)
  const INV_BASE = [
    ["Jasa Desain Logo & Branding", "paket", 2500000],
    ["Pembuatan Website Company Profile", "paket", 7500000],
    ["Maintenance Server (per bulan)", "bulan", 850000],
    ["Domain .co.id (1 tahun)", "domain", 350000],
    ["SSL Certificate (1 tahun)", "tahun", 1200000],
    ["Training Penggunaan Sistem", "sesi", 500000],
  ];
  const invItems = [];
  let invSub = 0;
  for (let t = 1; t <= 5; t++) {
    INV_BASE.forEach(([d, u, p], i) => {
      const qty = (i % 3) + 1;
      const amt = qty * p;
      invSub += amt;
      invItems.push({
        description: d + (t > 1 ? " — Tahap " + t : ""),
        qty, unit: u,
        price: fmtID(p),
        amount: fmtID(amt),
      });
    });
  }
  const invTax = Math.round(invSub * 0.11);
  const invGrand = invSub + invTax;

  /* ==================== 9-10. LAYOUT BERSAMA: PENJUALAN sederhana ==================== */
  const mkSalesLayout = (bg, judul, subjudul, infoParam) => ({
    version: 2,
    width: 700,
    page: { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: true },
    pageHeaderSection: { height: 26, visible: true, style: {}, items: [
      { type: "text", text: infoParam, binding: "", x: 0, y: 6, width: 420, height: 13, style: { fontSize: 8, color: "#94a3b8" } },
      { type: "text", text: "Dicetak: {Now}", binding: "", x: 470, y: 6, width: 230, height: 13, style: { fontSize: 8, color: "#94a3b8", textAlign: "right" } },
    ] },
    headerSection: {
      height: 80, visible: true, style: { backgroundColor: bg },
      items: [
        { type: "text", text: judul, binding: "", x: 18, y: 14, width: 460, height: 24, style: { color: "#ffffff", fontSize: 16, fontWeight: "bold" } },
        { type: "text", text: subjudul, binding: "", x: 18, y: 40, width: 460, height: 15, style: { color: "#e2e8f0", fontSize: 10 } },
        { type: "text", text: "Periode: {params.tahun}", binding: "", x: 500, y: 14, width: 184, height: 20, style: { color: "#ffffff", fontSize: 13, fontWeight: "bold", textAlign: "right" } },
        { type: "text", text: "Kota: {params.kota}", binding: "", x: 500, y: 38, width: 184, height: 14, style: { color: "#e2e8f0", fontSize: 10, textAlign: "right" } },
      ],
    },
    contentSection: {
      height: 34, binding: "content", visible: true, style: {}, groups: [],
      items: [
        { type: "text", text: "Nama", binding: "name", x: 8, y: 8, width: 120, height: 18, style: { fontSize: 10, fontWeight: "bold" } },
        { type: "text", text: "Kota", binding: "city", x: 132, y: 8, width: 72, height: 18, style: { fontSize: 10, color: "#475569" } },
        { type: "text", text: "Produk", binding: "product", x: 208, y: 8, width: 150, height: 18, style: { fontSize: 10 } },
        { type: "text", text: "Tahun", binding: "tahun", x: 362, y: 8, width: 46, height: 18, style: { fontSize: 10, textAlign: "center", color: "#475569" } },
        { type: "text", text: "Qty", binding: "qty", x: 412, y: 8, width: 44, height: 18, style: { fontSize: 10, textAlign: "right" } },
        { type: "text", text: "Total", binding: "total", x: 540, y: 8, width: 150, height: 18, style: { fontSize: 10, textAlign: "right", fontWeight: "bold" } },
        { type: "line", text: "", binding: "", x: 0, y: 30, width: 700, height: 1, style: { borderColor: "#e2e8f0", borderWidth: 1 } },
      ],
    },
    footerSection: {
      height: 44, visible: true, style: { backgroundColor: "#f8fafc" },
      items: [
        { type: "text", text: "Jumlah: {Count()} baris — Total: {Sum(total)}", binding: "", x: 12, y: 8, width: 440, height: 15, style: { fontSize: 11, fontWeight: "bold", color: "#0f172a" } },
        { type: "text", text: "Periode {params.tahun}", binding: "", x: 12, y: 26, width: 300, height: 12, style: { fontSize: 8, color: "#64748b" } },
      ],
    },
    pageFooterSection: { height: 30, visible: true, style: {}, items: [
      { type: "text", text: "Halaman {PageNo} dari {PageCount}", binding: "", x: 200, y: 8, width: 300, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "center" } },
    ] },
  });

  const salesDemo2025 = [
    { tahun: 2025, city: "Jakarta", name: "Budi Santoso", product: "Laptop Pro 14\"", qty: 1, price: 15500000, total: 15500000 },
    { tahun: 2025, city: "Depok", name: "Siti Rahayu", product: "Mouse Wireless", qty: 7, price: 125000, total: 875000 },
    { tahun: 2025, city: "Bandung", name: "Agus Wijaya", product: "Keyboard Mechanical", qty: 3, price: 750000, total: 2250000 },
    { tahun: 2025, city: "Surabaya", name: "Dewi Lestari", product: "Monitor 27\"", qty: 2, price: 2800000, total: 5600000 },
  ];
  const salesDemo2026 = [
    { tahun: 2026, city: "Jakarta", name: "Budi Santoso", product: "Laptop Pro 14\"", qty: 2, price: 15500000, total: 31000000 },
    { tahun: 2026, city: "Depok", name: "Siti Rahayu", product: "Mouse Wireless", qty: 10, price: 125000, total: 1250000 },
    { tahun: 2026, city: "Bandung", name: "Agus Wijaya", product: "Keyboard Mechanical", qty: 5, price: 750000, total: 3750000 },
    { tahun: 2026, city: "Surabaya", name: "Dewi Lestari", product: "Monitor 27\"", qty: 3, price: 2800000, total: 8400000 },
    { tahun: 2026, city: "Bekasi", name: "Rizki Pratama", product: "Webcam HD", qty: 4, price: 450000, total: 1800000 },
  ];

  window.SATU_EXAMPLES = [
    /* ==================== 1. INVOICE ==================== */
    {
      id: "invoice",
      title: "Invoice / Faktur Penjualan",
      desc: "Faktur MULTI-HALAMAN gaya ActiveReports: Page Header/Footer berulang per halaman, paginasi A4, nomor 'Halaman X dari Y', barcode, subtotal, PPN 11%, dan terbilang.",
      tags: ["📄 Paginasi A4", "Page Header/Footer", "Barcode"],
      layout: {
        version: 2,
        width: 700,
        page: { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: true },
        pageHeaderSection: {
          height: 30,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "PT SATU SEJAHTERA — Faktur Penjualan", binding: "", x: 0, y: 6, width: 340, height: 14, style: { fontSize: 9, color: "#94a3b8" } },
            { type: "text", text: "No. Invoice", binding: "invoice.no", x: 460, y: 6, width: 240, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "right" } },
            { type: "line", text: "", binding: "", x: 0, y: 26, width: 700, height: 2, style: { borderColor: "#e2e8f0", borderWidth: 1 } },
          ],
        },
        headerSection: {
          height: 164,
          visible: true,
          style: { backgroundColor: "#1e293b" },
          items: [
            { type: "image", text: "", binding: "", x: 16, y: 16, width: 60, height: 60, src: LOGO_DARK, style: {} },
            { type: "text", text: "PT SATU SEJAHTERA", binding: "company.name", x: 92, y: 18, width: 300, height: 22, style: { color: "#ffffff", fontSize: 15, fontWeight: "bold" } },
            { type: "text", text: "Alamat", binding: "company.address", x: 92, y: 44, width: 300, height: 15, style: { color: "#94a3b8", fontSize: 10 } },
            { type: "text", text: "Kontak", binding: "company.contact", x: 92, y: 60, width: 300, height: 15, style: { color: "#94a3b8", fontSize: 10 } },
            { type: "text", text: "INVOICE", binding: "", x: 460, y: 16, width: 224, height: 30, style: { color: "#ffffff", fontSize: 24, fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "No. Invoice", binding: "invoice.no", x: 460, y: 48, width: 224, height: 15, style: { color: "#cbd5e1", fontSize: 11, textAlign: "right" } },
            { type: "text", text: "Tanggal", binding: "invoice.date", x: 460, y: 64, width: 224, height: 14, style: { color: "#94a3b8", fontSize: 10, textAlign: "right" } },
            { type: "barcode", text: "INV/2026/09/0042", binding: "invoice.no", x: 520, y: 84, width: 164, height: 30, showText: false, style: { color: "#ffffff" } },
            { type: "text", text: "Kepada Yth.", binding: "", x: 16, y: 90, width: 100, height: 13, style: { color: "#94a3b8", fontSize: 9 } },
            { type: "text", text: "Pelanggan", binding: "customer.name", x: 16, y: 104, width: 260, height: 18, style: { color: "#ffffff", fontSize: 12, fontWeight: "bold" } },
            { type: "text", text: "Alamat pelanggan", binding: "customer.address", x: 16, y: 122, width: 260, height: 14, style: { color: "#94a3b8", fontSize: 10 } },
            { type: "text", text: "", binding: "", x: 0, y: 138, width: 700, height: 26, style: { backgroundColor: "#0f172a" } },
            { type: "text", text: "No", binding: "", x: 8, y: 144, width: 24, height: 14, style: { color: "#cbd5e1", fontSize: 9, textAlign: "center" } },
            { type: "text", text: "DESKRIPSI", binding: "", x: 40, y: 144, width: 290, height: 14, style: { color: "#cbd5e1", fontSize: 9 } },
            { type: "text", text: "QTY", binding: "", x: 335, y: 144, width: 44, height: 14, style: { color: "#cbd5e1", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "SATUAN", binding: "", x: 385, y: 144, width: 52, height: 14, style: { color: "#cbd5e1", fontSize: 9, textAlign: "center" } },
            { type: "text", text: "HARGA (RP)", binding: "", x: 443, y: 144, width: 110, height: 14, style: { color: "#cbd5e1", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "JUMLAH (RP)", binding: "", x: 560, y: 144, width: 124, height: 14, style: { color: "#cbd5e1", fontSize: 9, textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 30,
          binding: "items",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "1", binding: "__row", x: 8, y: 7, width: 24, height: 16, style: { fontSize: 10, textAlign: "center", color: "#64748b" } },
            { type: "text", text: "Deskripsi", binding: "description", x: 40, y: 7, width: 290, height: 16, style: { fontSize: 10 } },
            { type: "text", text: "Qty", binding: "qty", x: 335, y: 7, width: 44, height: 16, style: { fontSize: 10, textAlign: "right" } },
            { type: "text", text: "Satuan", binding: "unit", x: 385, y: 7, width: 52, height: 16, style: { fontSize: 10, textAlign: "center", color: "#64748b" } },
            { type: "text", text: "Harga", binding: "price", x: 443, y: 7, width: 110, height: 16, style: { fontSize: 10, textAlign: "right" } },
            { type: "text", text: "Jumlah", binding: "amount", x: 560, y: 7, width: 124, height: 16, style: { fontSize: 10, textAlign: "right", fontWeight: "bold" } },
            { type: "line", text: "", binding: "", x: 0, y: 29, width: 700, height: 2, style: { borderColor: "#e2e8f0", borderWidth: 1 } },
          ],
          groups: [],
        },
        footerSection: {
          height: 170,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Pembayaran:\nBCA 1234-5678-90\na.n. PT Satu Sejahtera", binding: "", x: 16, y: 14, width: 320, height: 78, style: { backgroundColor: "#f8fafc", borderRadius: 8, padding: 8, fontSize: 10, color: "#475569", lineHeight: 20 } },
            { type: "text", text: "Terbilang:", binding: "", x: 16, y: 100, width: 80, height: 13, style: { fontSize: 9, color: "#94a3b8" } },
            { type: "text", text: "Terbilang", binding: "terbilang", x: 16, y: 114, width: 392, height: 36, style: { fontSize: 10, fontStyle: "italic", color: "#334155" } },
            { type: "text", text: "Subtotal", binding: "", x: 428, y: 14, width: 116, height: 16, style: { fontSize: 10, color: "#64748b", textAlign: "right" } },
            { type: "text", text: "Subtotal", binding: "totals.subtotal", x: 548, y: 14, width: 136, height: 16, style: { fontSize: 10, textAlign: "right" } },
            { type: "text", text: "PPN 11%", binding: "", x: 428, y: 34, width: 116, height: 16, style: { fontSize: 10, color: "#64748b", textAlign: "right" } },
            { type: "text", text: "PPN", binding: "totals.tax", x: 548, y: 34, width: 136, height: 16, style: { fontSize: 10, textAlign: "right" } },
            { type: "line", text: "", binding: "", x: 428, y: 56, width: 256, height: 2, style: { borderColor: "#cbd5e1", borderWidth: 1 } },
            { type: "text", text: "TOTAL", binding: "", x: 428, y: 64, width: 116, height: 20, style: { fontSize: 12, fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "Grand Total", binding: "totals.grand", x: 548, y: 62, width: 136, height: 22, style: { fontSize: 14, fontWeight: "bold", textAlign: "right", color: "#1e293b" } },
            { type: "text", text: "Hormat kami,", binding: "", x: 512, y: 104, width: 172, height: 14, style: { fontSize: 10, color: "#475569", textAlign: "center" } },
            { type: "line", text: "", binding: "", x: 538, y: 148, width: 120, height: 2, style: { borderColor: "#94a3b8", borderWidth: 1 } },
            { type: "text", text: "( Sales Admin )", binding: "", x: 512, y: 152, width: 172, height: 14, style: { fontSize: 10, color: "#475569", textAlign: "center" } },
          ],
        },
        pageFooterSection: {
          height: 30,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Dicetak oleh SatuReport Offline", binding: "", x: 0, y: 6, width: 240, height: 13, style: { fontSize: 8, color: "#94a3b8" } },
            { type: "text", text: "Halaman {PageNo} dari {PageCount}", binding: "", x: 250, y: 6, width: 200, height: 13, style: { fontSize: 9, color: "#64748b", textAlign: "center" } },
            { type: "text", text: "{Now}", binding: "", x: 460, y: 6, width: 240, height: 13, style: { fontSize: 8, color: "#94a3b8", textAlign: "right" } },
          ],
        },
      },
      data: {
        company: { name: "PT SATU SEJAHTERA", address: "Jl. Margonda Raya No. 88, Depok 16431", contact: "Telp: (021) 7788-9900 • satu@example.co.id" },
        invoice: { no: "INV/2026/09/0042", date: "17 September 2026" },
        customer: { name: "CV. Mitra Bangun Persada", address: "Jl. Sudirman Kav. 21, Jakarta Selatan" },
        items: invItems,
        totals: { subtotal: fmtID(invSub), tax: fmtID(invTax), grand: "Rp " + fmtID(invGrand) },
        terbilang: "== " + terbilangID(invGrand).replace(/^./, (c) => c.toUpperCase()) + " rupiah ==",
      },
    },

    /* ==================== 2. SLIP GAJI ==================== */
    {
      id: "payslip",
      title: "Slip Gaji Karyawan",
      desc: "Slip gaji dua kolom: pendapatan dan potongan dalam satu baris berulang, lengkap dengan total dan gaji bersih.",
      tags: ["Dua kolom", "Keuangan", "HRD"],
      layout: {
        version: 1,
        width: 700,
        headerSection: {
          height: 124,
          visible: true,
          style: { backgroundColor: "#0f766e" },
          items: [
            { type: "image", text: "", binding: "", x: 16, y: 14, width: 52, height: 52, src: LOGO_TEAL, style: {} },
            { type: "text", text: "PT SATU SEJAHTERA", binding: "company", x: 84, y: 16, width: 320, height: 20, style: { color: "#ffffff", fontSize: 14, fontWeight: "bold" } },
            { type: "text", text: "Periode", binding: "period", x: 84, y: 40, width: 320, height: 15, style: { color: "#99f6e4", fontSize: 10 } },
            { type: "text", text: "Divisi Operasional", binding: "", x: 84, y: 56, width: 320, height: 14, style: { color: "#99f6e4", fontSize: 10 } },
            { type: "text", text: "SLIP GAJI", binding: "", x: 440, y: 14, width: 244, height: 26, style: { color: "#ffffff", fontSize: 20, fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "Karyawan", binding: "employee.name", x: 440, y: 44, width: 244, height: 16, style: { color: "#ffffff", fontSize: 11, textAlign: "right" } },
            { type: "text", text: "NIP", binding: "employee.id", x: 440, y: 62, width: 244, height: 14, style: { color: "#99f6e4", fontSize: 10, textAlign: "right" } },
            { type: "text", text: "", binding: "", x: 0, y: 98, width: 700, height: 26, style: { backgroundColor: "#115e59" } },
            { type: "text", text: "PENDAPATAN", binding: "", x: 8, y: 104, width: 200, height: 14, style: { color: "#99f6e4", fontSize: 9 } },
            { type: "text", text: "JUMLAH (RP)", binding: "", x: 212, y: 104, width: 110, height: 14, style: { color: "#99f6e4", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "POTONGAN", binding: "", x: 392, y: 104, width: 200, height: 14, style: { color: "#99f6e4", fontSize: 9 } },
            { type: "text", text: "JUMLAH (RP)", binding: "", x: 582, y: 104, width: 110, height: 14, style: { color: "#99f6e4", fontSize: 9, textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 26,
          binding: "rows",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Pendapatan", binding: "earn", x: 8, y: 5, width: 200, height: 16, style: { fontSize: 10 } },
            { type: "text", text: "Jumlah", binding: "earnAmt", x: 212, y: 5, width: 110, height: 16, style: { fontSize: 10, textAlign: "right" } },
            { type: "text", text: "Potongan", binding: "ded", x: 392, y: 5, width: 200, height: 16, style: { fontSize: 10, color: "#0f766e" } },
            { type: "text", text: "Jumlah", binding: "dedAmt", x: 582, y: 5, width: 110, height: 16, style: { fontSize: 10, textAlign: "right", color: "#0f766e" } },
            { type: "line", text: "", binding: "", x: 8, y: 24, width: 684, height: 2, style: { borderColor: "#f1f5f9", borderWidth: 1 } },
          ],
          groups: [],
        },
        footerSection: {
          height: 170,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "", binding: "", x: 8, y: 14, width: 684, height: 66, style: { backgroundColor: "#f0fdfa", borderRadius: 8 } },
            { type: "text", text: "Total Pendapatan", binding: "", x: 24, y: 26, width: 150, height: 14, style: { fontSize: 9, color: "#0f766e", fontWeight: "bold" } },
            { type: "text", text: "Total", binding: "totals.earn", x: 24, y: 42, width: 150, height: 20, style: { fontSize: 13, fontWeight: "bold", color: "#0f172a" } },
            { type: "text", text: "Total Potongan", binding: "", x: 244, y: 26, width: 150, height: 14, style: { fontSize: 9, color: "#0f766e", fontWeight: "bold" } },
            { type: "text", text: "Total", binding: "totals.ded", x: 244, y: 42, width: 150, height: 20, style: { fontSize: 13, fontWeight: "bold", color: "#0f172a" } },
            { type: "text", text: "GAJI BERSIH", binding: "", x: 464, y: 26, width: 210, height: 14, style: { fontSize: 9, color: "#0f766e", fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "Net", binding: "totals.net", x: 464, y: 40, width: 210, height: 24, style: { fontSize: 16, fontWeight: "bold", color: "#0f766e", textAlign: "right" } },
            { type: "text", text: "Slip gaji ini bersifat rahasia dan sah tanpa tanda tangan basah.", binding: "", x: 16, y: 140, width: 360, height: 14, style: { fontSize: 9, fontStyle: "italic", color: "#94a3b8" } },
            { type: "text", text: "Depok, 30 September 2026", binding: "date", x: 460, y: 96, width: 224, height: 14, style: { fontSize: 10, color: "#475569", textAlign: "center" } },
            { type: "text", text: "HRD Manager,", binding: "", x: 460, y: 112, width: 224, height: 14, style: { fontSize: 10, color: "#475569", textAlign: "center" } },
            { type: "line", text: "", binding: "", x: 512, y: 148, width: 120, height: 2, style: { borderColor: "#94a3b8", borderWidth: 1 } },
            { type: "text", text: "( Dewi Anggraini, S.Psi )", binding: "", x: 460, y: 152, width: 224, height: 14, style: { fontSize: 10, color: "#475569", textAlign: "center" } },
          ],
        },
      },
      data: {
        company: "PT SATU SEJAHTERA",
        period: "Periode Gaji: September 2026",
        employee: { name: "Budi Santoso — Staff IT Support", id: "NIP: EMP-0091" },
        rows: [
          { earn: "Gaji Pokok", earnAmt: "4.500.000", ded: "BPJS Kesehatan", dedAmt: "45.000" },
          { earn: "Tunjangan Jabatan", earnAmt: "750.000", ded: "BPJS Ketenagakerjaan", dedAmt: "90.000" },
          { earn: "Tunjangan Transport", earnAmt: "500.000", ded: "PPh 21", dedAmt: "210.000" },
          { earn: "Tunjangan Makan", earnAmt: "440.000", ded: "", dedAmt: "" },
          { earn: "Lembur (8 jam)", earnAmt: "320.000", ded: "", dedAmt: "" },
        ],
        totals: { earn: "6.510.000", ded: "345.000", net: "Rp 6.165.000" },
        date: "Depok, 30 September 2026",
      },
    },

    /* ==================== 3. SURAT JALAN ==================== */
    {
      id: "delivery-order",
      title: "Surat Jalan / Delivery Order",
      desc: "Dokumen pengiriman barang dengan barcode nomor resi, tabel barang, kolom keterangan, dan tiga blok tanda tangan.",
      tags: ["Logistik", "Barcode", "3 tanda tangan"],
      layout: {
        version: 1,
        width: 700,
        headerSection: {
          height: 150,
          visible: true,
          style: { backgroundColor: "#9a3412" },
          items: [
            { type: "text", text: "🚚", binding: "", x: 16, y: 12, width: 44, height: 44, style: { fontSize: 32 } },
            { type: "text", text: "PT SATU SEJAHTERA", binding: "company", x: 68, y: 16, width: 280, height: 20, style: { color: "#ffffff", fontSize: 14, fontWeight: "bold" } },
            { type: "text", text: "Alamat", binding: "companyAddr", x: 68, y: 38, width: 280, height: 15, style: { color: "#fed7aa", fontSize: 10 } },
            { type: "barcode", text: "SJ/2026/0917", binding: "no", x: 16, y: 70, width: 180, height: 42, style: { color: "#ffffff" } },
            { type: "text", text: "SURAT JALAN", binding: "", x: 430, y: 12, width: 254, height: 26, style: { color: "#ffffff", fontSize: 20, fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "No.", binding: "no", x: 430, y: 40, width: 254, height: 15, style: { color: "#ffedd5", fontSize: 11, textAlign: "right" } },
            { type: "text", text: "Tanggal", binding: "date", x: 430, y: 56, width: 254, height: 14, style: { color: "#fed7aa", fontSize: 10, textAlign: "right" } },
            { type: "text", text: "Kepada:", binding: "", x: 430, y: 76, width: 100, height: 12, style: { color: "#fdba74", fontSize: 8 } },
            { type: "text", text: "Penerima", binding: "customer.name", x: 430, y: 88, width: 254, height: 16, style: { color: "#ffffff", fontSize: 11, fontWeight: "bold" } },
            { type: "text", text: "Kota", binding: "customer.city", x: 430, y: 104, width: 254, height: 14, style: { color: "#fed7aa", fontSize: 10 } },
            { type: "text", text: "", binding: "", x: 0, y: 124, width: 700, height: 26, style: { backgroundColor: "#7c2d12" } },
            { type: "text", text: "No", binding: "", x: 8, y: 130, width: 24, height: 14, style: { color: "#fed7aa", fontSize: 9, textAlign: "center" } },
            { type: "text", text: "KODE", binding: "", x: 40, y: 130, width: 90, height: 14, style: { color: "#fed7aa", fontSize: 9 } },
            { type: "text", text: "NAMA BARANG", binding: "", x: 140, y: 130, width: 300, height: 14, style: { color: "#fed7aa", fontSize: 9 } },
            { type: "text", text: "QTY", binding: "", x: 450, y: 130, width: 60, height: 14, style: { color: "#fed7aa", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "SATUAN", binding: "", x: 520, y: 130, width: 80, height: 14, style: { color: "#fed7aa", fontSize: 9, textAlign: "center" } },
            { type: "text", text: "KETERANGAN", binding: "", x: 610, y: 130, width: 82, height: 14, style: { color: "#fed7aa", fontSize: 9, textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 26,
          binding: "items",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "1", binding: "__row", x: 8, y: 5, width: 24, height: 16, style: { fontSize: 10, textAlign: "center", color: "#a8a29e" } },
            { type: "text", text: "Kode", binding: "code", x: 40, y: 5, width: 90, height: 16, style: { fontSize: 10, color: "#64748b", fontFamily: "ui-monospace,monospace" } },
            { type: "text", text: "Nama", binding: "name", x: 140, y: 5, width: 300, height: 16, style: { fontSize: 10 } },
            { type: "text", text: "Qty", binding: "qty", x: 450, y: 5, width: 60, height: 16, style: { fontSize: 10, textAlign: "right" } },
            { type: "text", text: "Satuan", binding: "unit", x: 520, y: 5, width: 80, height: 16, style: { fontSize: 10, textAlign: "center", color: "#64748b" } },
            { type: "text", text: "Ket", binding: "note", x: 610, y: 5, width: 82, height: 16, style: { fontSize: 9, textAlign: "right", color: "#9a3412" } },
            { type: "line", text: "", binding: "", x: 0, y: 24, width: 700, height: 2, style: { borderColor: "#e7e5e4", borderWidth: 1 } },
          ],
          groups: [],
        },
        footerSection: {
          height: 150,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Keterangan:", binding: "", x: 16, y: 12, width: 100, height: 13, style: { fontSize: 9, color: "#9a3412", fontWeight: "bold" } },
            { type: "text", text: "Catatan", binding: "note", x: 16, y: 26, width: 340, height: 44, style: { fontSize: 10, color: "#57534e", backgroundColor: "#fafaf9", borderRadius: 6, padding: 6, lineHeight: 16 } },
            { type: "text", text: "Pengirim,", binding: "", x: 40, y: 88, width: 150, height: 14, style: { fontSize: 10, color: "#44403c", textAlign: "center" } },
            { type: "text", text: "Kurir,", binding: "", x: 275, y: 88, width: 150, height: 14, style: { fontSize: 10, color: "#44403c", textAlign: "center" } },
            { type: "text", text: "Penerima,", binding: "", x: 510, y: 88, width: 150, height: 14, style: { fontSize: 10, color: "#44403c", textAlign: "center" } },
            { type: "line", text: "", binding: "", x: 55, y: 128, width: 120, height: 2, style: { borderColor: "#a8a29e", borderWidth: 1 } },
            { type: "line", text: "", binding: "", x: 290, y: 128, width: 120, height: 2, style: { borderColor: "#a8a29e", borderWidth: 1 } },
            { type: "line", text: "", binding: "", x: 525, y: 128, width: 120, height: 2, style: { borderColor: "#a8a29e", borderWidth: 1 } },
            { type: "text", text: "( Nama jelas & cap )", binding: "", x: 40, y: 132, width: 150, height: 13, style: { fontSize: 9, color: "#a8a29e", textAlign: "center" } },
            { type: "text", text: "( Nama jelas & cap )", binding: "", x: 275, y: 132, width: 150, height: 13, style: { fontSize: 9, color: "#a8a29e", textAlign: "center" } },
            { type: "text", text: "( Nama jelas & cap )", binding: "", x: 510, y: 132, width: 150, height: 13, style: { fontSize: 9, color: "#a8a29e", textAlign: "center" } },
          ],
        },
      },
      data: {
        company: "PT SATU SEJAHTERA",
        companyAddr: "Jl. Raya Sawangan No. 12, Depok",
        no: "SJ/2026/0917-03",
        date: "17 September 2026",
        customer: { name: "Toko Elektronik Barokah", city: "Jakarta Timur" },
        items: [
          { code: "BRG-001", name: "Laptop Pro 14\"", qty: 5, unit: "unit", note: "Baru" },
          { code: "BRG-014", name: "Mouse Wireless M2", qty: 25, unit: "pcs", note: "" },
          { code: "BRG-022", name: "Keyboard Mechanical RGB", qty: 10, unit: "pcs", note: "" },
          { code: "BRG-030", name: "Monitor LED 27\"", qty: 8, unit: "unit", note: "Fragile" },
          { code: "BRG-041", name: "Kabel HDMI 2 meter", qty: 30, unit: "pcs", note: "" },
        ],
        note: "Barang sudah dicek dan dalam kondisi baik saat serah terima. Segel box jangan dibuka sebelum diterima pembeli.",
      },
    },

    /* ==================== 4. LAPORAN STOK (SUB GROUP) ==================== */
    {
      id: "stock-report",
      title: "Laporan Stok per Kategori",
      desc: "Mendemokan SUB GROUP: setiap kategori (content) menampilkan daftar barangnya masing-masing (sub group berulang).",
      tags: ["Sub Group", "Inventori", "Nested data"],
      layout: {
        version: 1,
        width: 700,
        headerSection: {
          height: 92,
          visible: true,
          style: { backgroundColor: "#1d4ed8" },
          items: [
            { type: "text", text: "📦", binding: "", x: 20, y: 16, width: 44, height: 44, style: { fontSize: 30 } },
            { type: "text", text: "LAPORAN STOK BARANG", binding: "", x: 76, y: 16, width: 400, height: 24, style: { color: "#ffffff", fontSize: 17, fontWeight: "bold" } },
            { type: "text", text: "Gudang", binding: "warehouse", x: 76, y: 44, width: 320, height: 16, style: { color: "#bfdbfe", fontSize: 10 } },
            { type: "text", text: "Tanggal", binding: "date", x: 76, y: 62, width: 320, height: 14, style: { color: "#bfdbfe", fontSize: 10 } },
            { type: "text", text: "Ringkasan", binding: "meta.totalSKUs", x: 480, y: 16, width: 200, height: 16, style: { color: "#dbeafe", fontSize: 10, textAlign: "right" } },
            { type: "text", text: "Dicetak", binding: "__now", x: 480, y: 62, width: 200, height: 14, style: { color: "#93c5fd", fontSize: 9, textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 32,
          binding: "categories",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "", binding: "", x: 0, y: 0, width: 700, height: 32, style: { backgroundColor: "#dbeafe" } },
            { type: "text", text: "▸ Kategori", binding: "name", x: 12, y: 8, width: 260, height: 16, style: { fontSize: 11, fontWeight: "bold", color: "#1e3a8a" } },
            { type: "text", text: "Info", binding: "info", x: 280, y: 9, width: 280, height: 14, style: { fontSize: 10, color: "#1e40af", textAlign: "right" } },
            { type: "text", text: "Total", binding: "totalStock", x: 570, y: 8, width: 118, height: 16, style: { fontSize: 10, fontWeight: "bold", color: "#1e3a8a", textAlign: "right" } },
          ],
          groups: [
            {
              height: 24,
              binding: "items",
              visible: true,
              style: { backgroundColor: "#ffffff" },
              items: [
                { type: "text", text: "Kode", binding: "code", x: 24, y: 4, width: 90, height: 15, style: { fontSize: 9, color: "#64748b", fontFamily: "ui-monospace,monospace" } },
                { type: "text", text: "Nama", binding: "name", x: 122, y: 4, width: 300, height: 15, style: { fontSize: 10 } },
                { type: "text", text: "Stok", binding: "stock", x: 486, y: 4, width: 60, height: 15, style: { fontSize: 10, fontWeight: "bold", textAlign: "right" } },
                { type: "text", text: "Satuan", binding: "unit", x: 556, y: 4, width: 56, height: 15, style: { fontSize: 9, color: "#64748b", textAlign: "center" } },
                { type: "text", text: "Status", binding: "status", x: 622, y: 4, width: 66, height: 15, style: { fontSize: 9, color: "#64748b", textAlign: "right" } },
                { type: "line", text: "", binding: "", x: 12, y: 22, width: 676, height: 2, style: { borderColor: "#e2e8f0", borderWidth: 1 } },
              ],
            },
          ],
        },
        footerSection: {
          height: 62,
          visible: true,
          style: { backgroundColor: "#f8fafc" },
          items: [
            { type: "text", text: "TOTAL KESELURUHAN STOK:", binding: "", x: 20, y: 12, width: 210, height: 16, style: { fontSize: 10, fontWeight: "bold", color: "#1e3a8a" } },
            { type: "text", text: "Total", binding: "totals.stock", x: 234, y: 12, width: 160, height: 16, style: { fontSize: 11, fontWeight: "bold" } },
            { type: "text", text: "Catatan", binding: "footer.note", x: 20, y: 34, width: 520, height: 14, style: { fontSize: 9, color: "#94a3b8" } },
            { type: "text", text: "Hal", binding: "__page", x: 560, y: 20, width: 120, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "right" } },
          ],
        },
      },
      data: {
        warehouse: "Gudang Pusat — Depok, Jawa Barat",
        date: "Per 17 September 2026",
        meta: { totalSKUs: "10 SKU • 3 kategori" },
        categories: [
          {
            name: "Elektronik",
            info: "4 jenis item",
            totalStock: "199",
            items: [
              { code: "ELK-001", name: "UPS 1200VA", stock: 4, unit: "unit", status: "⚠ RESTOCK" },
              { code: "ELK-008", name: "Kabel LAN Cat6 (roll)", stock: 145, unit: "roll", status: "OK" },
              { code: "ELK-015", name: "Router WiFi 6", stock: 12, unit: "unit", status: "OK" },
              { code: "ELK-023", name: "SSD 1TB NVMe", stock: 38, unit: "pcs", status: "OK" },
            ],
          },
          {
            name: "Alat Tulis Kantor (ATK)",
            info: "3 jenis item",
            totalStock: "785",
            items: [
              { code: "ATK-002", name: "Kertas A4 80gsm", stock: 210, unit: "rim", status: "OK" },
              { code: "ATK-009", name: "Pulpen Hitam", stock: 480, unit: "pcs", status: "OK" },
              { code: "ATK-017", name: "Map Ordner Bantex", stock: 95, unit: "pcs", status: "OK" },
            ],
          },
          {
            name: "Furnitur",
            info: "3 jenis item",
            totalStock: "41",
            items: [
              { code: "FRN-004", name: "Meja Kerja 120cm", stock: 14, unit: "unit", status: "OK" },
              { code: "FRN-011", name: "Kursi Ergonomis", stock: 21, unit: "unit", status: "OK" },
              { code: "FRN-019", name: "Lemari Arsip Besi", stock: 6, unit: "unit", status: "⚠ RESTOCK" },
            ],
          },
        ],
        totals: { stock: "1.025 unit/rim/pcs" },
        footer: { note: "Item bertanda ⚠ RESTOCK berada di bawah stok minimum dan perlu pengadaan." },
      },
    },

    /* ==================== 5. LABEL PENGIRIMAN ==================== */
    {
      id: "shipping-label",
      title: "Label Pengiriman (Multi-Paket)",
      desc: "Label resi berukuran kecil — content berulang otomatis mencetak satu label per paket, lengkap dengan barcode resi.",
      tags: ["Multi-label", "Logistik", "Kecil"],
      layout: {
        version: 1,
        width: 400,
        headerSection: {
          height: 72,
          visible: true,
          style: { backgroundColor: "#111827" },
          items: [
            { type: "text", text: "🚚 ANKA LOGISTIK", binding: "", x: 14, y: 10, width: 190, height: 20, style: { color: "#ffffff", fontSize: 13, fontWeight: "bold" } },
            { type: "text", text: "Resi", binding: "trackingNo", x: 200, y: 12, width: 186, height: 16, style: { color: "#d1d5db", fontSize: 10, textAlign: "right", fontFamily: "ui-monospace,monospace" } },
            { type: "barcode", text: "ANK-8821-JKT", binding: "trackingNo", x: 100, y: 34, width: 200, height: 32, showText: false, style: { color: "#ffffff" } },
          ],
        },
        contentSection: {
          height: 172,
          binding: "packages",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "PAKET — No.", binding: "__row", x: 14, y: 8, width: 60, height: 13, style: { fontSize: 9, color: "#9ca3af" } },
            { type: "text", text: "dari", binding: "__count", x: 330, y: 8, width: 56, height: 13, style: { fontSize: 9, color: "#9ca3af", textAlign: "right" } },
            { type: "text", text: "KEPADA:", binding: "", x: 14, y: 26, width: 80, height: 12, style: { fontSize: 8, color: "#6b7280" } },
            { type: "text", text: "Penerima", binding: "recipient", x: 14, y: 40, width: 372, height: 20, style: { fontSize: 13, fontWeight: "bold", color: "#111827" } },
            { type: "text", text: "Alamat", binding: "address", x: 14, y: 60, width: 372, height: 30, style: { fontSize: 10, color: "#374151" } },
            { type: "text", text: "📞 Telepon", binding: "phone", x: 14, y: 94, width: 220, height: 15, style: { fontSize: 10, color: "#374151" } },
            { type: "text", text: "Berat", binding: "weight", x: 260, y: 94, width: 126, height: 15, style: { fontSize: 10, color: "#111827", fontWeight: "bold", textAlign: "right" } },
            { type: "line", text: "", binding: "", x: 14, y: 118, width: 372, height: 2, style: { borderColor: "#e5e7eb", borderWidth: 1 } },
            { type: "text", text: "Pengirim:", binding: "", x: 14, y: 128, width: 70, height: 12, style: { fontSize: 8, color: "#6b7280" } },
            { type: "text", text: "PT Satu Sejahtera — Depok", binding: "sender", x: 14, y: 140, width: 260, height: 14, style: { fontSize: 9, color: "#6b7280" } },
            { type: "text", text: "Layanan", binding: "service", x: 280, y: 136, width: 106, height: 18, style: { fontSize: 10, fontWeight: "bold", color: "#111827", textAlign: "right" } },
            { type: "line", text: "", binding: "", x: 0, y: 168, width: 400, height: 2, style: { borderColor: "#9ca3af", borderWidth: 1 } },
          ],
          groups: [],
        },
        footerSection: {
          height: 66,
          visible: true,
          style: { backgroundColor: "#fef2f2" },
          items: [
            { type: "text", text: "⚠ FRAGILE — JANGAN DIBANTING", binding: "", x: 16, y: 10, width: 368, height: 18, style: { fontSize: 12, fontWeight: "bold", color: "#b91c1c", textAlign: "center" } },
            { type: "text", text: "Simpan di tempat kering • Sisi atas menghadap ke atas ↑", binding: "", x: 16, y: 32, width: 368, height: 13, style: { fontSize: 9, color: "#ef4444", textAlign: "center" } },
            { type: "text", text: "Dokumen label sah — dicetak oleh SatuReport Offline", binding: "", x: 16, y: 48, width: 368, height: 12, style: { fontSize: 8, color: "#fca5a5", textAlign: "center" } },
          ],
        },
      },
      data: {
        trackingNo: "ANK-8821-JKT",
        packages: [
          { recipient: "Budi Santoso", address: "Jl. Melati No. 4, Kemang, Jakarta Selatan 12730", phone: "0812-3456-7890", weight: "2,4 kg", sender: "PT Satu Sejahtera — Depok", service: "SAME DAY" },
          { recipient: "Siti Rahayu", address: "Perum Griya Asri Blok C2/9, Pancoran Mas, Depok 16436", phone: "0857-1122-3344", weight: "1,1 kg", sender: "PT Satu Sejahtera — Depok", service: "REGULER" },
          { recipient: "Agus Wijaya", address: "Jl. Asia Afrika No. 65, Bandung 40111", phone: "0821-9988-7766", weight: "3,8 kg", sender: "PT Satu Sejahtera — Depok", service: "KARGO" },
        ],
      },
    },

    /* ==================== 6. KWITANSI ==================== */
    {
      id: "receipt",
      title: "Kwitansi Pembayaran",
      desc: "Kwitansi klasik dengan kotak terbilang, kotak total gelap, area materai, dan tanda tangan penerima.",
      tags: ["Keuangan", "Klasik", "Materai"],
      layout: {
        version: 1,
        width: 700,
        headerSection: {
          height: 102,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "🧾", binding: "", x: 16, y: 14, width: 40, height: 40, style: { fontSize: 30 } },
            { type: "text", text: "PT SATU SEJAHTERA", binding: "company", x: 64, y: 16, width: 280, height: 20, style: { fontSize: 13, fontWeight: "bold", color: "#111827" } },
            { type: "text", text: "Alamat", binding: "companyAddr", x: 64, y: 38, width: 280, height: 14, style: { fontSize: 9, color: "#6b7280" } },
            { type: "text", text: "No.", binding: "no", x: 440, y: 16, width: 244, height: 18, style: { fontSize: 12, fontWeight: "bold", textAlign: "right", fontFamily: "ui-monospace,monospace" } },
            { type: "text", text: "Tanggal", binding: "date", x: 440, y: 38, width: 244, height: 14, style: { fontSize: 9, color: "#6b7280", textAlign: "right" } },
            { type: "text", text: "KWITANSI", binding: "", x: 0, y: 60, width: 700, height: 28, style: { fontSize: 22, fontWeight: "bold", textAlign: "center", color: "#111827" } },
            { type: "text", text: "— BUKTI PEMBAYARAN RESMI —", binding: "", x: 0, y: 88, width: 700, height: 12, style: { fontSize: 8, textAlign: "center", color: "#6b7280" } },
            { type: "line", text: "", binding: "", x: 0, y: 8, width: 700, height: 2, style: { borderColor: "#111827", borderWidth: 2 } },
          ],
        },
        contentSection: {
          height: 30,
          binding: "payments",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "1.", binding: "__row", x: 24, y: 7, width: 26, height: 16, style: { fontSize: 11, color: "#9ca3af" } },
            { type: "text", text: "Uraian", binding: "description", x: 54, y: 7, width: 440, height: 16, style: { fontSize: 11 } },
            { type: "text", text: "Jumlah", binding: "amount", x: 520, y: 7, width: 156, height: 16, style: { fontSize: 11, fontWeight: "bold", textAlign: "right" } },
            { type: "line", text: "", binding: "", x: 24, y: 28, width: 652, height: 2, style: { borderColor: "#e5e7eb", borderWidth: 1 } },
          ],
          groups: [],
        },
        footerSection: {
          height: 186,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Terbilang:", binding: "", x: 24, y: 4, width: 100, height: 12, style: { fontSize: 8, color: "#6b7280" } },
            { type: "text", text: "Terbilang", binding: "terbilang", x: 24, y: 18, width: 420, height: 64, style: { fontSize: 11, fontStyle: "italic", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 8, lineHeight: 18 } },
            { type: "text", text: "", binding: "", x: 476, y: 18, width: 200, height: 64, style: { backgroundColor: "#111827", borderRadius: 8 } },
            { type: "text", text: "TOTAL", binding: "", x: 476, y: 26, width: 200, height: 13, style: { fontSize: 9, color: "#9ca3af", textAlign: "center" } },
            { type: "text", text: "Grand", binding: "totals.grand", x: 476, y: 42, width: 200, height: 24, style: { fontSize: 16, fontWeight: "bold", color: "#ffffff", textAlign: "center" } },
            { type: "text", text: "Materai\n10.000", binding: "", x: 40, y: 104, width: 76, height: 62, style: { fontSize: 8, color: "#9ca3af", textAlign: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, padding: 6 } },
            { type: "text", text: "Depok", binding: "placeDate", x: 480, y: 100, width: 196, height: 14, style: { fontSize: 10, color: "#374151", textAlign: "center" } },
            { type: "text", text: "Yang menerima,", binding: "", x: 480, y: 116, width: 196, height: 14, style: { fontSize: 10, color: "#374151", textAlign: "center" } },
            { type: "line", text: "", binding: "", x: 508, y: 158, width: 140, height: 2, style: { borderColor: "#9ca3af", borderWidth: 1 } },
            { type: "text", text: "( Jane Doe, SE )", binding: "", x: 480, y: 162, width: 196, height: 14, style: { fontSize: 10, color: "#374151", textAlign: "center" } },
          ],
        },
      },
      data: {
        company: "PT SATU SEJAHTERA",
        companyAddr: "Jl. Margonda Raya No. 88, Depok 16431",
        no: "KWT/2026/0917",
        date: "17 September 2026",
        payments: [
          { description: "DP Proyek Renovasi Kantor Tahap 1", amount: "12.500.000" },
          { description: "Termin 2 — Pekerjaan Interior & Partisi", amount: "18.750.000" },
          { description: "Biaya Material Tambahan (sesuai RAB rev. 2)", amount: "3.250.000" },
        ],
        totals: { grand: "Rp 34.500.000" },
        terbilang: "== Tiga puluh empat juta lima ratus ribu rupiah ==",
        placeDate: "Depok, 17 September 2026",
      },
    },
    /* ==================== 7. LAPORAN GRAFIK PENJUALAN ==================== */
    {
      id: "sales-chart",
      title: "Laporan Penjualan + Grafik",
      desc: "Tabel penjualan bulanan dengan GRAFIK: grafik garis tren realisasi dan grafik donat komposisi produk — semua di-render sebagai SVG murni.",
      tags: ["📊 Grafik", "Line & Donut", "Analitik"],
      layout: {
        version: 1,
        width: 700,
        headerSection: {
          height: 104,
          visible: true,
          style: { backgroundColor: "#312e81" },
          items: [
            { type: "text", text: "📈", binding: "", x: 20, y: 14, width: 44, height: 44, style: { fontSize: 30 } },
            { type: "text", text: "LAPORAN PENJUALAN TAHUNAN", binding: "", x: 76, y: 14, width: 400, height: 24, style: { color: "#ffffff", fontSize: 16, fontWeight: "bold" } },
            { type: "text", text: "Periode", binding: "period", x: 76, y: 42, width: 340, height: 15, style: { color: "#c7d2fe", fontSize: 10 } },
            { type: "text", text: "Cabang", binding: "branch", x: 76, y: 58, width: 340, height: 14, style: { color: "#c7d2fe", fontSize: 10 } },
            { type: "text", text: "TOTAL REALISASI", binding: "", x: 460, y: 12, width: 224, height: 13, style: { color: "#a5b4fc", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "Total", binding: "totals.year", x: 460, y: 26, width: 224, height: 26, style: { color: "#ffffff", fontSize: 18, fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "Dicetak", binding: "__now", x: 460, y: 58, width: 224, height: 13, style: { color: "#a5b4fc", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "", binding: "", x: 0, y: 78, width: 700, height: 26, style: { backgroundColor: "#271d63" } },
            { type: "text", text: "BULAN", binding: "", x: 20, y: 84, width: 120, height: 14, style: { color: "#c7d2fe", fontSize: 9 } },
            { type: "text", text: "TARGET (RP)", binding: "", x: 300, y: 84, width: 130, height: 14, style: { color: "#c7d2fe", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "REALISASI (RP)", binding: "", x: 436, y: 84, width: 130, height: 14, style: { color: "#c7d2fe", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "CAPAIAN", binding: "", x: 572, y: 84, width: 112, height: 14, style: { color: "#c7d2fe", fontSize: 9, textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 26,
          binding: "sales",
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Bulan", binding: "bulan", x: 20, y: 5, width: 120, height: 16, style: { fontSize: 10 } },
            { type: "text", text: "Target", binding: "target", x: 300, y: 5, width: 130, height: 16, style: { fontSize: 10, color: "#64748b", textAlign: "right" } },
            { type: "text", text: "Realisasi", binding: "realisasi", x: 436, y: 5, width: 130, height: 16, style: { fontSize: 10, fontWeight: "bold", textAlign: "right" } },
            { type: "text", text: "Pct", binding: "pct", x: 572, y: 5, width: 112, height: 16, style: { fontSize: 10, color: "#4f46e5", textAlign: "right" } },
            { type: "line", text: "", binding: "", x: 20, y: 24, width: 664, height: 2, style: { borderColor: "#eef2ff", borderWidth: 1 } },
          ],
          groups: [],
        },
        footerSection: {
          height: 240,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "VISUALISASI DATA", binding: "", x: 16, y: 10, width: 200, height: 13, style: { fontSize: 9, fontWeight: "bold", color: "#6366f1" } },
            { type: "chart", text: "Tren Realisasi per Bulan", binding: "sales", chartType: "line", labelField: "bulan", valueField: "realisasiNum", showValues: true, showLegend: true, x: 8, y: 26, width: 340, height: 204, style: { color: "#6366f1" } },
            { type: "chart", text: "Komposisi Produk", binding: "byProduct", chartType: "donut", labelField: "product", valueField: "amountNum", showValues: true, showLegend: true, x: 356, y: 26, width: 336, height: 204, style: { color: "#6366f1", backgroundColor: "#ffffff" } },
            { type: "line", text: "", binding: "", x: 350, y: 30, width: 1, height: 2, style: { borderColor: "#e0e7ff", borderWidth: 1 } },
          ],
        },
      },
      data: {
        period: "Tahun Anggaran 2026 • Januari — September",
        branch: "Konsolidasi: Seluruh Cabang Indonesia",
        totals: { year: "Rp 1,285 M" },
        sales: [
          { bulan: "Jan", target: "120 jt", realisasi: "118 jt", realisasiNum: 118000000, pct: "98,3%" },
          { bulan: "Feb", target: "125 jt", realisasi: "131 jt", realisasiNum: 131000000, pct: "104,8%" },
          { bulan: "Mar", target: "125 jt", realisasi: "122 jt", realisasiNum: 122000000, pct: "97,6%" },
          { bulan: "Apr", target: "130 jt", realisasi: "138 jt", realisasiNum: 138000000, pct: "106,2%" },
          { bulan: "Mei", target: "130 jt", realisasi: "127 jt", realisasiNum: 127000000, pct: "97,7%" },
          { bulan: "Jun", target: "135 jt", realisasi: "145 jt", realisasiNum: 145000000, pct: "107,4%" },
          { bulan: "Jul", target: "140 jt", realisasi: "143 jt", realisasiNum: 143000000, pct: "102,1%" },
          { bulan: "Agu", target: "140 jt", realisasi: "152 jt", realisasiNum: 152000000, pct: "108,6%" },
          { bulan: "Sep", target: "145 jt", realisasi: "149 jt", realisasiNum: 149000000, pct: "102,8%" },
        ],
        byProduct: [
          { product: "Laptop & PC", amountNum: 512000000 },
          { product: "Monitor & Display", amountNum: 289000000 },
          { product: "Aksesori", amountNum: 196000000 },
          { product: "Networking", amountNum: 167000000 },
          { product: "Lainnya", amountNum: 121000000 },
        ],
      },
    },
    /* ==================== 8. DIREKTORI PENGGUNA (DATA DARI API) ==================== */
    {
      id: "api-users",
      title: "Direktori Pengguna — Data API Live",
      desc: "Layout siap pakai untuk endpoint JSON API. Buka lewat Viewer lalu klik tombol 🌐 API → Muat Data untuk mengambil data LIVE dari jsonplaceholder.typicode.com (URL sudah terisi otomatis). Data contoh di bawah ini dipakai sebagai cadangan saat offline.",
      tags: ["🌐 API JSON", "Live Data", "Fallback Offline"],
      apiUrl: "https://jsonplaceholder.typicode.com/users",
      layout: {
        version: 2,
        width: 700,
        page: { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: true },
        pageHeaderSection: {
          height: 26,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "SUMBER: https://jsonplaceholder.typicode.com/users", binding: "", x: 0, y: 6, width: 400, height: 13, style: { fontSize: 8, color: "#94a3b8" } },
            { type: "text", text: "Dicetak: {Now}", binding: "", x: 470, y: 6, width: 230, height: 13, style: { fontSize: 8, color: "#94a3b8", textAlign: "right" } },
          ],
        },
        headerSection: {
          height: 78,
          visible: true,
          style: { backgroundColor: "#064e3b" },
          items: [
            { type: "text", text: "🌐", binding: "", x: 18, y: 14, width: 40, height: 40, style: { fontSize: 28 } },
            { type: "text", text: "DIREKTORI PENGGUNA", binding: "", x: 70, y: 16, width: 380, height: 24, style: { color: "#ffffff", fontSize: 17, fontWeight: "bold" } },
            { type: "text", text: "Data dimuat dari API JSON (GET)", binding: "", x: 70, y: 42, width: 380, height: 15, style: { color: "#a7f3d0", fontSize: 10 } },
            { type: "text", text: "TOTAL", binding: "", x: 560, y: 14, width: 124, height: 12, style: { color: "#a7f3d0", fontSize: 9, textAlign: "right" } },
            { type: "text", text: "{Count()} pengguna", binding: "", x: 500, y: 26, width: 184, height: 22, style: { color: "#ffffff", fontSize: 15, fontWeight: "bold", textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 34,
          binding: "content",
          visible: true,
          style: {},
          groups: [],
          items: [
            { type: "text", text: "Nama", binding: "name", x: 8, y: 8, width: 130, height: 18, style: { fontSize: 10, fontWeight: "bold" } },
            { type: "text", text: "Username", binding: "username", x: 142, y: 8, width: 74, height: 18, style: { fontSize: 10, color: "#475569" } },
            { type: "text", text: "Email", binding: "email", x: 220, y: 8, width: 164, height: 18, style: { fontSize: 10, color: "#1d4ed8" } },
            { type: "text", text: "Telepon", binding: "phone", x: 388, y: 8, width: 116, height: 18, style: { fontSize: 9, color: "#475569" } },
            { type: "text", text: "Kota", binding: "address.city", x: 508, y: 8, width: 84, height: 18, style: { fontSize: 10 } },
            { type: "text", text: "Perusahaan", binding: "company.name", x: 596, y: 8, width: 96, height: 18, style: { fontSize: 9, color: "#475569" } },
            { type: "line", text: "", binding: "", x: 0, y: 30, width: 700, height: 1, style: { borderColor: "#e2e8f0", borderWidth: 1 } },
          ],
        },
        footerSection: {
          height: 46,
          visible: true,
          style: { backgroundColor: "#f0fdf4" },
          items: [
            { type: "text", text: "Total data: {Count()} baris", binding: "", x: 12, y: 8, width: 300, height: 15, style: { fontSize: 10, fontWeight: "bold", color: "#065f46" } },
            { type: "text", text: "Bila API tidak bisa dijangkau (offline/CORS), report memakai data cadangan bawaan.", binding: "", x: 12, y: 26, width: 500, height: 13, style: { fontSize: 8, color: "#64748b" } },
          ],
        },
        pageFooterSection: {
          height: 30,
          visible: true,
          style: {},
          items: [
            { type: "text", text: "Halaman {PageNo} dari {PageCount}", binding: "", x: 200, y: 8, width: 300, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "center" } },
          ],
        },
      },
      data: {
        content: [
          { id: 1, name: "Leanne Graham", username: "Bret", email: "Sincere@april.biz", phone: "1-770-736-8031 x56442", address: { city: "Gwenborough" }, company: { name: "Romaguera-Crona" } },
          { id: 2, name: "Ervin Howell", username: "Antonette", email: "Shanna@melissa.tv", phone: "010-692-6593 x09125", address: { city: "Wisokyburgh" }, company: { name: "Deckow-Crist" } },
          { id: 3, name: "Clementine Bauch", username: "Samantha", email: "Nathan@yesenia.net", phone: "1-463-123-4447", address: { city: "McKenziehaven" }, company: { name: "Romaguera-Jacobson" } },
          { id: 4, name: "Patricia Lebsack", username: "Karianne", email: "Julianne.OConner@kory.org", phone: "493-170-9623 x156", address: { city: "South Elvis" }, company: { name: "Robel-Corkery" } },
          { id: 5, name: "Chelsey Dietrich", username: "Kamren", email: "Lucio_Hettinger@annie.ca", phone: "(254)954-1289", address: { city: "Roscoeview" }, company: { name: "Keebler LLC" } },
          { id: 6, name: "Mrs. Dennis Schulist", username: "Leopoldo_Corkery", email: "Karley_Dach@jasper.info", phone: "1-477-935-8478 x6430", address: { city: "South Christy" }, company: { name: "Considine-Lockman" } },
        ],
      },
    },
    /* ==================== 9. QUERY KUSTOM LEWAT API ==================== */
    {
      id: "query-custom",
      title: "Laporan Query Kustom (API SQL)",
      desc: "Paket {layout, data:{query, endpoint}}: Viewer meng-POST query ke endpoint API dan merender hasilnya. Contoh ini memakai endpoint demo server /api-demo-query (lewat live preview) — bila endpoint tak terjangkau, data cadangan di bawah dipakai. Parameter {tahun} di query diganti dari form parameter.",
      tags: ["🛢 Query SQL", "API POST", "Parameter"],
      query: "select * from penjualan where tahun = {tahun}",
      endpoint: "/api-demo-query",
      params: [
        { name: "tahun", label: "Tahun", type: "select", options: ["2025", "2026"], default: "2026", field: "tahun" },
      ],
      layout: mkSalesLayout("#7c2d12", "LAPORAN QUERY KUSTOM", "Sumber: POST /api-demo-query — query SQL lewat API", "QUERY: select * from penjualan where tahun = {tahun}"),
      data: { content: [...salesDemo2025, ...salesDemo2026] },
    },
    /* ==================== 10. REPORT BERPARAMETER (FILTER OFFLINE) ==================== */
    {
      id: "param-report",
      title: "Laporan Berparameter (Form Modal)",
      desc: "Report disembunyikan sampai form PARAMETER diisi: pilih Tahun & Kota lalu klik 'Tampilkan Report'. Baris data difilter di sisi klien (offline), teks {params.xxx} ikut nilai pilihan. Contoh format paket: {layout, params:[...], data:{...}}.",
      tags: ["⚙ Parameter", "Form Modal", "Filter Offline"],
      params: [
        { name: "tahun", label: "Tahun", type: "select", options: ["2025", "2026"], default: "2026", field: "tahun" },
        { name: "kota", label: "Kota", type: "select", options: ["Semua", "Jakarta", "Depok", "Bandung", "Surabaya", "Bekasi"], default: "Semua", field: "city" },
      ],
      layout: mkSalesLayout("#1e3a8a", "LAPORAN PENJUALAN BERPARAMETER", "Baris difilter menurut parameter (offline)", "Parameter: tahun, kota (nilai 'Semua' = tanpa filter)"),
      data: { content: [...salesDemo2025, ...salesDemo2026] },
    },
    /* ==================== 11. VIEWER MEMUAT FILE PAKET DARI SERVER (?url=) ==================== */
    {
      id: "server-file",
      title: "Viewer Memuat File dari Server (?url=)",
      desc: "Viewer mendapatkan SATU file gabungan Layout+Data ({layout, params, data}) langsung dari direktori server lewat query string:  viewer.html?url=laporan-penjualan.satureport.json — ideal untuk menyimpan banyak report sebagai file .json statis di server. Butuh HTTP server (python3 server.py 8000); di pratinjau sandbox tanpa jaringan akan muncul peringatan ⚠.",
      tags: ["🌐 URL Server", "File .json Gabungan", "Layout+Data", "⚙ Parameter"],
      openUrl: "viewer.html?url=laporan-penjualan.satureport.json",
      params: [
        { name: "tahun", label: "Tahun", type: "select", options: ["2025", "2026"], default: "2026", field: "tahun" },
        { name: "kota", label: "Kota", type: "select", options: ["Semua", "Jakarta", "Depok", "Bandung", "Surabaya", "Bekasi"], default: "Semua", field: "city" },
      ],
      layout: mkSalesLayout("#0f766e", "LAPORAN PENJUALAN — FILE SERVER", "Dimuat dari file JSON di direktori server", "Sumber: viewer.html?url=laporan-penjualan.satureport.json • Parameter: tahun, kota"),
      data: { content: [...salesDemo2025, ...salesDemo2026] },
    },
    /* ==================== 12. PIVOT TABLE (CROSSTAB) ==================== */
    {
      id: "pivot-table",
      title: "Pivot Table (Crosstab Penjualan)",
      desc: "Elemen ▦ PIVOT: crosstab otomatis dari data mentah — baris = Kota, kolom = Tahun, nilai = Sum(total), lengkap kolom TOTAL, baris TOTAL & grand total. Dihitung per-render dari 9 baris {tahun, city, name, product, qty, price, total} tanpa query khusus. Agregasi lain: count/avg/min/max — atur lewat tombol ▦ di toolbar designer & panel kanan.",
      tags: ["▦ Pivot Table", "Crosstab", "Agregasi", "Σ Sum"],
      layout: {
        version: 2,
        width: 700,
        page: { paper: "A4", orientation: "portrait", margins: { top: 47, right: 47, bottom: 47, left: 47 }, pagination: true },
        pageHeaderSection: { height: 26, visible: true, style: {}, items: [
          { type: "text", text: "Pivot tabel: baris = city (Kota), kolom = tahun (Tahun), nilai = Sum(total) — sel kosong ditampilkan '–'", binding: "", x: 0, y: 6, width: 480, height: 13, style: { fontSize: 8, color: "#94a3b8" } },
          { type: "text", text: "Dicetak: {Now}", binding: "", x: 500, y: 6, width: 200, height: 13, style: { fontSize: 8, color: "#94a3b8", textAlign: "right" } },
        ] },
        headerSection: {
          height: 74, visible: true, style: { backgroundColor: "#6d28d9" },
          items: [
            { type: "text", text: "▦ PIVOT TABLE PENJUALAN", binding: "", x: 18, y: 14, width: 460, height: 24, style: { color: "#ffffff", fontSize: 16, fontWeight: "bold" } },
            { type: "text", text: "Crosstab Kota × Tahun — nilai mengikuti {Sum(total)} di footer", binding: "", x: 18, y: 40, width: 520, height: 15, style: { color: "#e9d5ff", fontSize: 10 } },
            { type: "text", text: "{Count()} baris data", binding: "", x: 540, y: 14, width: 146, height: 20, style: { color: "#ffffff", fontSize: 12, fontWeight: "bold", textAlign: "right" } },
          ],
        },
        contentSection: {
          height: 200, visible: true, style: {}, groups: [],
          items: [
            { type: "pivot", text: "", binding: "content", pivot: { row: "city", col: "tahun", value: "total", agg: "sum", rowTotal: true, colTotal: true, headerBg: "#6d28d9" }, x: 60, y: 10, width: 580, height: 150, style: { fontSize: 10 } },
            { type: "text", text: "Baris pivot = NULL/— bila field kosong; kolom muncul mengikuti urutan kemunculan di data. Ubah agregasi (sum/count/avg/min/max) di panel kanan designer.", binding: "", x: 60, y: 168, width: 580, height: 24, style: { fontSize: 8, color: "#64748b", fontStyle: "italic" } },
          ],
        },
        footerSection: {
          height: 44, visible: true, style: { backgroundColor: "#f5f3ff" },
          items: [
            { type: "text", text: "Verifikasi — Jumlah: {Count()} baris — Total: {Sum(total)}  (harus sama dengan grand total pivot)", binding: "", x: 12, y: 8, width: 640, height: 15, style: { fontSize: 11, fontWeight: "bold", color: "#0f172a" } },
            { type: "text", text: "Sumber data: 9 baris penjualan 2025–2026 (contoh bawaan)", binding: "", x: 12, y: 26, width: 400, height: 12, style: { fontSize: 8, color: "#64748b" } },
          ],
        },
        pageFooterSection: { height: 30, visible: true, style: {}, items: [
          { type: "text", text: "Halaman {PageNo} dari {PageCount}", binding: "", x: 200, y: 8, width: 300, height: 14, style: { fontSize: 9, color: "#94a3b8", textAlign: "center" } },
        ] },
      },
      data: { content: [...salesDemo2025, ...salesDemo2026] },
    },
  ];

  window.SATU_EXAMPLES.byId = function (id) {
    return this.find((e) => e.id === id) || null;
  };
})();
