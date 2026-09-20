/* ============================================================
 * Build: jadikan tiap HTML standalone (semua <script src> di-inline).
 * Dua mode sekaligus (idempotent):
 *  1) <script src="...">                 -> di-inline pertama kali
 *  2) blok "inlined from: X" (hasil build)-> di-refresh dari file X terbaru
 * Jalankan setelah mengubah file di js/ atau vendor/ atau examples/:
 *     node build.js
 * Catatan: hasil build MENULIS ULANG file html di root folder.
 * Sumber tetap di js/, vendor/, examples/examples.js.
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const root = __dirname;

function readSrc(src, pageName) {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) throw new Error(`${pageName}: file tidak ditemukan: ${src}`);
  // amankan penutup tag script di dalam konten
  return fs.readFileSync(file, "utf8").replace(/<\/script>/g, "<\\/script>");
}
const wrap = (src, code) => `<script>/* ===== inlined from: ${src} ===== */\n${code}\n</script>`;

function processPage(html, pageName) {
  let countInline = 0, countRefresh = 0;
  // mode 1: script src baru
  html = html.replace(/<script(?:\s+defer)?\s+src="([^"]+)"><\/script>/g, (m, src) => {
    countInline++;
    return wrap(src, readSrc(src, pageName));
  });
  // mode 2: refresh blok hasil inline sebelumnya
  html = html.replace(/<script>\/\* ===== inlined from: (.+?) ===== \*\/[\s\S]*?\n<\/script>/g, (m, src) => {
    countRefresh++;
    return wrap(src, readSrc(src, pageName));
  });
  return { html, countInline, countRefresh };
}

const pages = ["index.html", "designer.html", "viewer.html", "examples.html"];
for (const page of pages) {
  const before = fs.readFileSync(path.join(root, page), "utf8");
  const { html, countInline, countRefresh } = processPage(before, page);
  fs.writeFileSync(path.join(root, page), html);
  console.log(`${page}: ${countInline} di-inline, ${countRefresh} di-refresh (${Math.round(html.length / 1024)} KB)`);
}
console.log("SELESAI ✓ — semua halaman standalone & up-to-date");
