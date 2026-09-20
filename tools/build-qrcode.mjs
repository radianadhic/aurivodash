/**
 * tools/build-qrcode.mjs — mem-vendor pustaka QR ke assets/js/qrcode-generator.min.js
 *
 * Sumber: paket npm `qrcode-generator` (MIT, © 2009 Kazuhiko Arase) —
 * https://github.com/kazuhikoarase/qrcode-generator
 *
 * Yang dilakukan:
 *   1. membaca node_modules/qrcode-generator/dist/qrcode.js (UMD),
 *   2. meminifikasi dengan terser (opsional — dilewati bila terser tidak ada),
 *   3. menulisnya ke assets/js/qrcode-generator.min.js beserta header versi MIT.
 *
 * Pustaka hasil vendor dipakai halaman pages/qris.html & pages/kartu-qris.html
 * (lewat assets/js/qris.js) sehingga template tetap 100% offline.
 *
 * Jalankan: npm run qrcode        (butuh `npm install` lebih dulu)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "node_modules/qrcode-generator/dist/qrcode.js");
const OUT = path.join(ROOT, "assets/js/qrcode-generator.min.js");

if (!fs.existsSync(SRC)) {
  console.error("✖ node_modules/qrcode-generator tidak ditemukan — jalankan `npm install` dulu.");
  process.exit(1);
}

const versi = JSON.parse(
  fs.readFileSync(path.join(ROOT, "node_modules/qrcode-generator/package.json"), "utf8")
).version;

let kode = fs.readFileSync(SRC, "utf8");
let cara = "apa adanya (belum diminifikasi)";

try {
  const require = createRequire(import.meta.url);
  const { minify } = require("terser");
  const hasil = await minify(kode, {
    compress: true,
    mangle: true,
    format: { comments: /^!/ },
  });
  if (hasil && hasil.code) {
    kode = hasil.code;
    cara = "terser (minified)";
  }
} catch (e) {
  console.warn("  ⚠ terser tidak tersedia — berkas ditulis tanpa minifikasi.");
}

const header = `/*! qrcode-generator ${versi} — MIT, (c) 2009 Kazuhiko Arase · https://github.com/kazuhikoarase/qrcode-generator
 *  Di-vendor lokal supaya template tetap 100% offline (tanpa CDN).
 *  Dipakai oleh assets/js/qris.js untuk menggambar QR QRIS. Jangan diubah manual —
 *  jalankan \`npm run qrcode\` untuk membangun ulang berkas ini.
 */
`;

fs.writeFileSync(OUT, header + kode, "utf8");
console.log(`✔ assets/js/qrcode-generator.min.js — v${versi}, ${cara}, ${(header + kode).length} byte`);
