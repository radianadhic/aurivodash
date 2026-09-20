/**
 * build-offline.mjs — membungkus satu halaman menjadi SATU berkas HTML mandiri.
 *
 * Semua aset di-inline: CSS Tailwind (dengan font woff2 sebagai data-URI),
 * Alpine.js, ikon SVG, app.js, charts.js, dan SortableJS bila dipakai.
 * Hasilnya bisa dibuka di mana saja tanpa server dan tanpa jaringan —
 * termasuk di dalam iframe preview yang tidak punya akses internet.
 *
 * Jalankan: npm run offline
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = "offline";

/** [halaman sumber, berkas keluaran] */
const TARGETS = [
  ["pages/index.html", "dashboard.html"],
  ["pages/tables.html", "tabel.html"],
  ["pages/ag-grid.html", "ag-grid.html"],
  ["pages/mini-grid-1.html", "mini-grid-1.html"],
  ["pages/mini-grid-2.html", "mini-grid-2.html"],
  ["pages/mini-grid-3.html", "mini-grid-3.html"],
  ["pages/mini-grid-4.html", "mini-grid-4.html"],
  ["pages/mini-grid-5.html", "mini-grid-5.html"],
  ["pages/mini-grid-6.html", "mini-grid-6.html"],
  ["pages/kartu-qris.html", "kartu-qris.html"],
  ["pages/qris.html", "qris.html"],
  ["pages/charts.html", "grafik.html"],
  ["pages/widgets.html", "komponen.html"],
  ["pages/forms.html", "formulir.html"],
  ["pages/analytics.html", "analitik.html"],
  ["login.html", "login.html"],
  ["mobile/index.html", "mobile-nasabah.html"],
  ["pages/notifications.html", "notifikasi.html"],
  ["pages/scheduler.html", "scheduler.html"],
];

/** Tautan halaman Tools → berkas mandiri buatan tools/build-satureport.mjs */
const ALIAS_LUAR = {
  "pages/report-design.html": "report-design.html",
  "pages/report-viewer.html": "report-viewer.html",
  "pages/report-example.html": "report-example.html",
};

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const mime = { ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };

/** Ubah berkas lokal jadi data-URI */
function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(path.join(ROOT, file));
  return `data:${mime[ext] || "application/octet-stream"};base64,${buf.toString("base64")}`;
}

/** Inline CSS + font */
function inlineCss(css, baseDir) {
  return css.replace(/url\(\s*['"]?([^'")]+?\.(?:woff2|woff|ttf|png|svg|jpg))['"]?\s*\)/gi, (m, url) => {
    const file = path.normalize(path.join(baseDir, url));
    if (!fs.existsSync(path.join(ROOT, file))) return m;
    return `url("${dataUri(file)}")`;
  });
}

/**
 * Kumpulan potongan yang HARUS muncul apa adanya di berkas keluaran.
 * Dipakai untuk mendeteksi penyuntingan tak sengaja oleh String.replace.
 */
function inlinePage(srcFile, outFile) {
  const pageDir = path.dirname(srcFile); // relatif terhadap ROOT
  let html = read(srcFile);
  const notes = [];
  // Daftar aset yang di-inline PADA HALAMAN INI, untuk verifikasi di akhir fungsi.
  const assertions = [];

  // 1) stylesheet lokal → <style>
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const m = tag.match(/href=["']([^"']+)["']/i);
    if (m) m[1] = m[1].split("?")[0]; // buang penanda versi (?v=…)
    if (!m || /^https?:/i.test(m[1])) return tag;
    const file = path.normalize(path.join(pageDir, m[1]));
    if (!fs.existsSync(path.join(ROOT, file))) { notes.push(`CSS tidak ditemukan: ${m[1]}`); return tag; }
    notes.push(`CSS di-inline: ${m[1]} (${(fs.statSync(path.join(ROOT, file)).size / 1024).toFixed(0)} KB)`);
    const css = inlineCss(read(file), path.dirname(file));
    assertions.push(css);
    return `<style>\n${css}\n</style>`;
  });

  // 2) skrip lokal → kumpulkan isinya
  const scripts = [];
  html = html.replace(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, src) => {
    if (/^https?:/i.test(src)) return tag;
    const file = path.normalize(path.join(pageDir, src.split("?")[0])); // buang ?v=…
    if (!fs.existsSync(path.join(ROOT, file))) { notes.push(`JS tidak ditemukan: ${src}`); return tag; }
    notes.push(`JS di-inline: ${src} (${(fs.statSync(path.join(ROOT, file)).size / 1024).toFixed(0)} KB)`);
    const code = read(file);
    assertions.push(code);
    scripts.push(code);
    return `<!-- di-inline: ${path.basename(src)} -->`;
  });

  // 3) sisipkan skrip tepat sebelum </body> agar urutannya tetap terjaga
  // PENTING: pengganti WAJIB berupa fungsi. Bila isi berkas dipakai sebagai
  // replacement string, JS akan menafsirkan "$$" sebagai satu "$" dan merusak
  // kode (mis. `$${n}` di Alpine.js berubah jadi `${n}` → semua magic hilang).
  const block = scripts.map((code) => `<script>\n${code}\n</script>`).join("\n");
  if (html.includes("</body>")) html = html.replace("</body>", () => `${block}\n</body>`);
  else html += block;

  // 4) rapikan tautan antar halaman agar tetap berfungsi di folder offline/
  //    Peta: halaman sumber → berkas keluaran (mis. pages/tables.html → tabel.html)
  const alias = new Map(
    TARGETS.map(([src2, out2]) => [path.normalize(src2), out2])
      // Halaman Tools dibangun tools/build-satureport.mjs (aplikasi SatuReport sudah
      // mandiri apa adanya), jadi hanya dipetakan supaya tautan sidebar ikut benar.
      .concat(Object.entries(ALIAS_LUAR).map(([src2, out2]) => [path.normalize(src2), out2]))
  );
  // PENTING: pengganti berupa fungsi dan kutip aslinya dipertahankan — ekspresi
  // Alpine bisa memuat href='…' di dalam atribut berkutip ganda.
  html = html.replace(/(href|src)=(["'])([^"']+\.html)(#[^"']*)?\2/gi, (m, attr, quote, target, hash) => {
    const resolved = path.normalize(path.join(pageDir, target));      // relatif terhadap ROOT
    const out = alias.get(resolved);
    const nama = out || "index.html";   // berkas mandiri lain boleh memiliki #bagian
    return `${attr}=${quote}${nama}${hash || ""}${quote}`;
  });

  // 5) penanda di header komentar (fungsi juga, demi keamanan)
  html = html.replace(/<title>/, () => `<!-- Berkas mandiri (single-file). Dibuat oleh tools/build-offline.mjs — jangan diubah manual. -->\n<title>`);

  // 6) verifikasi: setiap aset harus muncul PERSIS seperti berkas aslinya
  const broken = assertions.filter((code) => !html.includes(code));
  if (broken.length) throw new Error(`Aset berubah saat di-inline (${broken.length} blok) — periksa String.replace di builder.`);

  fs.mkdirSync(path.join(ROOT, OUT_DIR), { recursive: true });
  const out = path.join(ROOT, OUT_DIR, outFile);
  fs.writeFileSync(out, html);
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`  ✔ offline/${outFile.padEnd(16)} ${kb.padStart(5)} KB  ← ${srcFile}`);
  notes.forEach((n) => console.log(`      · ${n}`));
  const leftover = [...html.matchAll(/(?:href|src)=["'](\.\.?\/[^"']+)["']/gi)].map((m) => m[1]);
  if (leftover.length) console.warn(`      ⚠ masih ada acuan berkas lokal: ${[...new Set(leftover)].join(", ")}`);
  return { out, kb };
}

console.log("Membangun berkas HTML mandiri (semua aset di-inline)…\n");
const built = [];
for (const [src, out] of TARGETS) {
  if (!fs.existsSync(path.join(ROOT, src))) { console.warn(`  ⚠ dilewati (tidak ada): ${src}`); continue; }
  built.push(inlinePage(src, out));
}

/* Aplikasi Tools (SatuReport) — dibangun tools/build-satureport.mjs */
const ALAT = [
  ["report-design.html", "Report Design — desainer laporan visual"],
  ["report-viewer.html", "Report Viewer — penampil laporan"],
  ["report-example.html", "Report Example — galeri 12 contoh"],
].filter(([out]) => fs.existsSync(path.join(ROOT, OUT_DIR, out)));

// indeks sederhana untuk memudahkan navigasi antar berkas mandiri
const index = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard Mandiri — Aurivo Dash</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f4f6f9;color:#212529;margin:0;padding:2.5rem 1rem}
  .wrap{max-width:44rem;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .35rem}
  p{color:#7a8794;margin:.2rem 0 1.5rem}
  ul{list-style:none;padding:0;margin:0;display:grid;gap:.6rem}
  a{display:flex;gap:.75rem;align-items:center;padding:.85rem 1rem;background:#fff;border:1px solid #dee2e6;border-radius:.25rem;text-decoration:none;color:#212529;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  a:hover{border-color:#007bff;color:#007bff}
  b{display:block}
  small{color:#7a8794}
  code{background:#f1f3f5;padding:.1rem .3rem;border-radius:.2rem}
</style></head>
<body><div class="wrap">
<h1>Berkas HTML mandiri</h1>
<p>Setiap halaman di bawah ini adalah <b>satu berkas tunggal</b> — CSS, JS, ikon, dan font sudah di-inline,
jadi bisa dibuka tanpa server, tanpa jaringan, dan aman di dalam iframe preview.</p>
<ul>
${built.map(({ out }) => {
  const name = path.basename(out, ".html");
  return `  <li><a href="${path.basename(out)}"><span><b>${name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</b><small>${path.basename(out)}</small></span></a></li>`;
}).join("\n")}
</ul>
${ALAT.length ? `<h2 style="font-size:1.05rem;margin:1.75rem 0 .5rem">Aplikasi tools (laporan)</h2>
<p style="margin:0 0 1rem">Aplikasi SatuReport (github.com/radianadhic/satureport) — tiap berkas tetap mandiri dan bisa dibuka sendiri.</p>
<ul>
${ALAT.map(([out, judul]) => `  <li><a href="${out}"><span><b>${judul}</b><small>${out}</small></span></a></li>`).join("\n")}
</ul>` : ""}
<p style="margin-top:1.5rem">Buka juga <code>index.html</code> dan <code>preview/</code> di folder utama untuk versi multi-berkas.</p>
</div></body></html>`;
fs.writeFileSync(path.join(ROOT, OUT_DIR, "index.html"), index);
console.log(`  ✔ offline/index.html     daftar semua berkas mandiri`);
console.log(`\nSelesai: ${fs.readdirSync(path.join(ROOT, OUT_DIR)).length} berkas di folder ./${OUT_DIR}/`);
