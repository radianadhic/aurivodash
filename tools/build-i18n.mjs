/**
 * build-i18n.mjs — pembangun berkas terjemahan + pelapor teks yang belum diterjemahkan.
 *
 *  1. Membaca kamus:  src/i18n/en.json      (kunci = teks Indonesia, nilai = teks Inggris)
 *  2. Menggabung  src/i18n/i18n.engine.js + kamus  →  assets/js/i18n.js
 *  3. Memindai seluruh halaman hasil build, lalu menulis laporan
 *     src/i18n/missing.txt berisi teks Indonesia yang belum ada di kamus.
 *
 * Jalankan: npm run i18n
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DICT_FILE = "src/i18n/en.json";
const ENGINE = "src/i18n/i18n.engine.js";
const OUT = "assets/js/i18n.js";
const REPORT = "src/i18n/missing.txt";

const PAGES = [
  ...fs.readdirSync(path.join(ROOT, "pages")).filter((f) => f.endsWith(".html")).map((f) => "pages/" + f),
  "index.html", "login.html", "register.html", "404.html",
].filter((f) => fs.existsSync(path.join(ROOT, f)));

/* ------------------------------------------------------------------ kamus */
if (!fs.existsSync(path.join(ROOT, DICT_FILE))) {
  console.error(`✖ ${DICT_FILE} tidak ditemukan.`);
  process.exit(1);
}
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, DICT_FILE), "utf8"));
const keys = Object.keys(dict);

/* kelompok teks yang tidak perlu diterjemahkan (data, merek, kode) */
const SKIP_RE = [
  /^[\s\d.,%:–—/-]+$/,                       // angka & simbol
  /@/,                                        // email
  /^#/,                                       // kode invoice
  /^(Rp|IDR)/i,                               // mata uang
  /^(AS|RS|BP|NM|LTE|SKU|INV|NIP|PT)$/,       // singkatan
  /Aulia|Rani|Budi|Nadia|Saputra|Setiawati|Prakoso|Maharani|perusahaan\.id/,
  /AdminLTE|Aurivo|Tailwind|Alpine|Bootstrap|Sortable|Source Sans/,
  /^[\w.-]+\.(html|css|js|json|png|woff2)$/i, // nama berkas
  /^Versi \d[\d.]*$/,                        // nomor versi aplikasi (diterjemahkan pola di i18n.engine.js)
];

const textOf = (html) => {
  let s = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  return s;
};

/* --------------------------------------------------------------- ekstraksi */
const found = new Map(); // teks → jumlah kemunculan

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", copy: "©", mdash: "—", ndash: "–", hellip: "…", rarr: "→", check: "✓" };
const decode = (t) => t.replace(/&(#?[\w]+);/g, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(parseInt(e.slice(1).replace("x", ""), e[1] === "x" ? 16 : 10));
  return ENT[e] != null ? ENT[e] : m;
});

function collect(text, where) {
  const t = decode(text).replace(/\s+/g, " ").trim();
  if (!t || t.length < 2 || t.length > 160) return;
  if (SKIP_RE.some((re) => re.test(t))) return;
  if (/[{}<>]|\bx-(text|for|show|if|bind)\b/.test(t)) return;
  const cur = found.get(t) || { n: 0, where: new Set() };
  cur.n++;
  cur.where.add(where);
  found.set(t, cur);
}

for (const f of PAGES) {
  const raw = fs.readFileSync(path.join(ROOT, f), "utf8");
  const html = textOf(raw);
  for (const m of html.matchAll(/>([^<>]+)</g)) collect(m[1], f);
  for (const m of raw.matchAll(/(placeholder|title|aria-label)="([^"]+)"/g)) collect(m[2], f);
}

const missing = [...found.keys()].filter((t) => !(t in dict)).sort((a, b) => a.localeCompare(b, "id"));
const used = new Set([...found.keys()].filter((t) => t in dict));

/* ------------------------------------------------------- berkas terjemahan */
const engine = fs.readFileSync(path.join(ROOT, ENGINE), "utf8");
const out =
  "/* Dibuat otomatis oleh tools/build-i18n.mjs — jangan diubah manual.\n" +
  `   Kamus: ${DICT_FILE} (${keys.length} entri) · sumber mesin: ${ENGINE} */\n` +
  "window.I18N_DICT_EN = " + JSON.stringify(dict, null, 1) + ";\n" +
  engine;
fs.writeFileSync(path.join(ROOT, OUT), out);

const report =
  `# Teks yang BELUM diterjemahkan (${missing.length} dari ${found.size} teks unik yang terdeteksi)\n` +
  `# Tambahkan pasangan "teks Indonesia": "English text" ke ${DICT_FILE} lalu jalankan: npm run i18n\n\n` +
  missing.map((t) => JSON.stringify(t) + ": \"\",").join("\n") + "\n";
fs.writeFileSync(path.join(ROOT, REPORT), report);

/* ------------------------------------------------------------------ ringkas */
console.log(`Kamus        : ${keys.length} entri (${used.size} dipakai di halaman)`);
console.log(`Terdeteksi   : ${found.size} teks unik di ${PAGES.length} halaman`);
console.log(`Belum ada    : ${missing.length} → daftar di ${REPORT}`);
console.log(`Ditulis      : ${OUT} (${(fs.statSync(path.join(ROOT, OUT)).size / 1024).toFixed(0)} KB)`);
const takTerpakai = keys.filter((k) => !(k in Object.fromEntries([...found.keys()].map((t) => [t, 1]))));
if (takTerpakai.length) console.log(`Catatan      : ${takTerpakai.length} entri kamus tidak ditemukan di halaman (mungkin untuk konten dinamis/JS)`);
