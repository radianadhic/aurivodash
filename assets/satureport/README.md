# SatuReport

> **Report designer & viewer offline dalam satu file HTML** — tanpa instalasi, tanpa server, tanpa koneksi internet. Buka filenya, rancang laporannya, cetak.

SatuReport adalah aplikasi laporan mandiri: **designer drag-&-drop**, **viewer** dengan pratinjau penuh, dan **mesin render** yang sepenuhnya berjalan di browser. Semua dependensi (Tailwind, Alpine.js, dll.) sudah di-embed — setiap halaman benar-benar satu file HTML yang bisa dibuka dobel klik dari disk.

---

## ⚡ Mulai Tercepat

```bash
# Cara 1 — tanpa perintah apa pun: dobel klik index.html

# Cara 2 — lewat server lokal (disarankan, membuka fitur API/file server/fetch contoh)
python3 server.py 8000
# lalu buka http://localhost:8000
```

| Halaman | Fungsi |
|---|---|
| `index.html` | Hub: pilih Designer / Viewer / Galeri Contoh |
| `designer.html` | **Report Designer** — kanvas drag-&-drop, properti, parameter, export |
| `viewer.html` | **Report Viewer** — render hasil, dialog parameter, zoom, export PDF/XLSX |
| `examples.html` | Galeri 10+ contoh siap-pakai (penjualan, invoice, faktur/antar, kuitansi, slip gaji, label kirim, pivot dinamika) |

---

## ✨ Fitur Utama

**🎨 Designer**
- Elemen: **Teks, Gambar, Barcode (Code128), Grafik (bar/line/pie/donut), Pivot Table, Garis**
- Section: Header / Content / Footer / PageHeader / PageFooter + **sub group** tak terbatas
- Undo/Redo, duplikasi, snap grid, **🪄 Auto Layout** (buat layout penuh dari data JSON sekali klik)
- Kanvas **per-halaman** (A4/Letter/Legal, portrait/landscape, margin) dengan paginasi otomatis

**👁 Viewer**
- **Parameter interaktif** (teks/angka/tanggal/pilihan) — dialog input opsional sebelum render
- Zoom-in/out/Fit/1:1, paginasi, ringkasan baris/halaman, penyimpanan di IndexedDB
- **Export: PDF, XLSX** (plus simpan file paket layout+data)

**🗂 Sumber Data**
- JSON manual (modal `{} Data`)
- **API**: `GET` langsung, atau **query kustom** `POST {query, params}`
- **File server statis**: `viewer.html?url=laporan-penjualan.satureport.json` — satu file paket berisi layout+data+parameter mendefinisikan seluruh report
- Spesifikasi lengkap: [DOKUMENTASI-DATA.md](DOKUMENTASI-DATA.md)

**🧮 Ekspresi ala ActiveReports `{...}`**

```text
{field}                         {params.kota}                    {PageNo}/{PageCount}
{Sum(total)}                    {Avg(price)}                     {Count()}  {CountIf(...)}
{Sum(total,'content','city == params.kota')}   ← agregat berkondisi
contentSection.filter:  "city == params.kota"  ← baris yang dicetak hanya yg lolos kondisi
Operator kondisi: ==  !=  <>  >  <  >=  <=  (numerik otomatis bila dua sisi angka)
```

**🌐 Lainnya**
- dwibahasa: toggle **ID ⇄ EN** di semua halaman
- 100% **offline**: nol permintaan jaringan, nol CDN, data tersimpan di IndexedDB (fallback localStorage → memori)
- migrasi otomatis merek lawas (kunci `ankareport*` → `satureport*`, idempoten — data lama aman)

---

## 🗄 Struktur Proyek

```text
index.html / designer.html / viewer.html / examples.html   # aplikasi final (standalone)
js/
  report-core.js   # mesin render & ekspresi & export (PDF/XLSX/CSV/JPEG/Barcode/Pivot)
  designer.js      # logika designer (dipakai ulang di halaman examples)
  viewer.js        # logika viewer
  i18n.js          # kamus dwibahasa
examples/          # 6 contoh paket JSON siap muat + examples.js pembangun contoh
vendor/            # Tailwind & Alpine tervendor (untuk proses build)
tests/run-all.js   # 235 pengujian — node tests/run-all.js
build.js           # re-inline js/vendor → HTML (node build.js)
server.py          # static server + /api-proxy penolong CORS (python3 server.py 8000)
contoh-java-api/   # demo backend Java tanpa dependensi + contoh Spring Boot
DOKUMENTASI-DATA.md# format JSON paket/layout/data + ekspresi kondisi
```

## 🔧 Siklus Pengembangan

```bash
node tests/run-all.js   # jalankan 235 pengujian (core, export, param, pivot, i18n, dll.)
node build.js           # bangun ulang 4 HTML setelah mengubah js/*
```

## ☕ Demo Java API

```bash
cd contoh-java-api
java SatuReportApiDemo.java            # langsung di JDK 11+, tanpa dependensi
# endpoints: GET /api/penjualan · GET /api/penjualan-objek · POST /api/report-query
```

Contoh Spring Boot lengkap ada di `contoh-java-api/spring-boot/` (lihat `contoh-java-api/README.md`).

## 🌐 Host di GitHub Pages (opsional)

Karena seluruh aplikasi HANYA file HTML statis, repo ini bisa langsung di-host:
**Settings → Pages → Deploy from branch `main` / root** → aplikasi tersedia di
`https://<username>.github.io/satureport/`.
(Fitur API/query butuh backend HTTP — contoh Java siap dipakai.)

---

Terinspirasi dari konsep [github.com/ankareport/ankareport](https://github.com/ankareport/ankareport); ditulis ulang mandiri dari nol dengan cakupan yang jauh lebih luas.
