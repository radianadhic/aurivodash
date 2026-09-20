/**
 * build-satureport.mjs — menyiapkan berkas mandiri (single-file) SatuReport.
 *
 * Aplikasi SatuReport di-vendor apa adanya di assets/satureport/ (designer, viewer,
 * examples — masing-masing sudah satu berkas HTML dengan Tailwind & Alpine di-inline).
 * Skrip ini menurunkan tiga salinan untuk folder offline/ dengan dua penyesuaian:
 *
 *   1. tautan antar-halaman di dalam aplikasi dipetakan ke nama berkas offline
 *      (designer.html → report-design.html, dst) supaya tombol "Galeri",
 *      "Designer", dan window.open("viewer.html") tetap bekerja dari file://
 *   2. contoh "file server" (viewer.html?url=laporan-penjualan.satureport.json)
 *      memakai data-URI dari berkas JSON yang di-vendor, sehingga contoh itu
 *      tetap berjalan tanpa server (fetch data: diizinkan peramban)
 *
 * Jalankan: npm run satureport   (otomatis ikut "npm run all")
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = "assets/satureport";
const OUT = "offline";

/** [berkas aplikasi di assets/satureport, nama berkas offline, judul dokumen] */
const TARGETS = [
  ["designer.html", "report-design.html", "Report Designer · Aurivo Dash"],
  ["viewer.html", "report-viewer.html", "Report Viewer · Aurivo Dash"],
  ["examples.html", "report-example.html", "Galeri Contoh Laporan · Aurivo Dash"],
];

/* Peta tautan internal aplikasi → nama berkas offline */
const PETA = {
  "designer.html": "report-design.html",
  "viewer.html": "report-viewer.html",
  "examples.html": "report-example.html",
};

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** Contoh "file server": ganti URL JSON dengan data-URI supaya jalan dari file:// */
function sumberJsonDataUri() {
  const berkas = path.join(ROOT, SRC, "laporan-penjualan.satureport.json");
  if (!fs.existsSync(berkas)) return null;
  const b64 = fs.readFileSync(berkas).toString("base64");
  /* encodeURIComponent menjaga '+', '/', dan '=' tetap utuh saat jadi query string */
  return "data:application/json;base64," + encodeURIComponent(b64);
}

if (!fs.existsSync(path.join(ROOT, SRC))) {
  console.log("⚠ assets/satureport/ tidak ada — lewati pembuatan berkas mandiri laporan.");
  process.exit(0);
}

fs.mkdirSync(path.join(ROOT, OUT), { recursive: true });
console.log("Menyiapkan berkas mandiri SatuReport…");
const dataUri = sumberJsonDataUri();

for (const [dari, ke, judul] of TARGETS) {
  let html = read(path.join(SRC, dari));
  const asal = html.length;

  /* 1) tautan antar-halaman → nama berkas offline (hanya yang berkutip) */
  let diubah = 0;
  for (const [lama, baru] of Object.entries(PETA)) {
    const pola = new RegExp('(["\'])' + lama.replace(".", "\\."), "g");
    html = html.replace(pola, (m, q) => { diubah++; return q + baru; });
  }

  /* 2) contoh "file server" memakai data-URI (bila berkas JSON tersedia).
        HANYA tautan openUrl yang diubah — teks penjelasan & komentar kode
        dibiarkan apa adanya supaya tetap terbaca manusia. */
  var contoh = 0;
  if (dataUri) {
    const cari = 'openUrl: "report-viewer.html?url=laporan-penjualan.satureport.json"';
    const ganti = 'openUrl: "report-viewer.html?url=' + dataUri + '"';
    if (html.includes(cari)) { html = html.split(cari).join(ganti); contoh = 1; }
    /* keterangan di kartu contoh disesuaikan: tanpa server pun jalan */
    const ketLama = "Butuh HTTP server (python3 server.py 8000); di pratinjau sandbox tanpa jaringan akan muncul peringatan ⚠.";
    const ketBaru = "Di berkas mandiri ini data contohnya ditanam sebagai data-URI, jadi tombolnya tetap membuka laporan tanpa server.";
    html = html.split(ketLama).join(ketBaru);
    /* label di layar jangan menampilkan data-URI raksasa — pakai nama berkasnya */
    const label = '(url.indexOf("data:") === 0 ? "laporan-penjualan.satureport.json (data-URI)" : url)';
    html = html.split('"⏳ Memuat file dari server: " + url + " …"').join('"⏳ Memuat file dari server: " + ' + label + ' + " …"');
    html = html.split('this._applyPackage(pkg, "File server: " + url)').join('this._applyPackage(pkg, "File server: " + ' + label + ')');
  }

  /* 3) judul + penanda berkas turunan */
  const judulLama = html.match(/<title>([^<]*)<\/title>/);
  if (judulLama) html = html.replace(judulLama[0], `<title>${judul}</title>`);
  /* jembatan bahasa: SatuReport membaca localStorage "satureport.lang",
     template menyimpan pilihan bahasa di "app.locale" — samakan agar
     bahasa aplikasi mengikuti bahasa template saat halaman dibuka. */
  const jembatan =
    `<script>(function(){try{var l=localStorage.getItem("app.locale");` +
    `localStorage.setItem("satureport.lang", l === "en" ? "en" : "id");}catch(e){}})();</script>\n`;
  html = html.replace(
    /<title>/,
    () =>
      `<!-- Berkas mandiri (single-file) — aplikasi SatuReport (github.com/radianadhic/satureport)\n     yang di-vendor di assets/satureport/. Dibuat oleh tools/build-satureport.mjs — jangan diubah manual. -->\n` +
      jembatan + `<title>`
  );

  fs.writeFileSync(path.join(ROOT, OUT, ke), html);

  /* verifikasi: tidak boleh ada acuan berkas aplikasi yang tertinggal */
  const sisa = Object.keys(PETA).filter((f) => new RegExp('["\']' + f.replace(".", "\\.")).test(html));
  const kb = (fs.statSync(path.join(ROOT, OUT, ke)).size / 1024).toFixed(0);
  console.log(`  ✔ offline/${ke.padEnd(20)} ${kb.padStart(5)} KB  ← ${SRC}/${dari}`);
  if (diubah) console.log(`      · ${diubah} tautan dipetakan ke berkas offline`);
  if (contoh) console.log(`      · contoh file-server memakai data-URI (${contoh} rujukan)`);
  if (sisa.length) console.warn(`      ⚠ acuan tertinggal: ${sisa.join(", ")}`);
  if (html.length < asal * 0.5) console.warn("      ⚠ ukuran berkas turun drastis — periksa hasilnya");
}

console.log("\nSelesai: berkas mandiri SatuReport siap di folder ./offline/");
