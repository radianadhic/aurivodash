# NAMING.md — Keputusan Nama & Riset Ketersediaan

Dokumen ini mencatat **mengapa** produk ini bernama **Aurivo Dash**, nama-nama apa yang
ditolak beserta buktinya, dan langkah apa yang masih harus dilakukan untuk mengamankan
identitasnya. Semua data diperiksa **20 Sep 2026** lewat: registry npm, pencarian merek web,
DNS (Google DoH), GitHub API (repo + akun), dan RDAP Verisign (data resmi domain).
Skor lengkap 14 kandidat ada di [`naming-skor.md`](naming-skor.md) dan diringkas di §3.

---

## 1. Keputusan

| Perkara | Nilai |
|---|---|
| Nama produk (dibaca manusia) | **Aurivo Dash** |
| Identitas mesin (domain, npm, repo, tagar) | **`aurivodash`** |
| Tagline | *Dashboard perbankan yang tetap jalan saat internet mati.* |
| Tagline EN | *Banking dashboards that keep working when the internet dies.* |
| Paket npm | `aurivodash` |
| Repo | `github.com/aurivodash/aurivodash` |
| Domain utama | `aurivodash.com` (+ `.id`, `.co.id`, `.dev`, `.io`, `.app`, `.net`, `.ai`) |
| Merek dagang | ajukan **AURIVO** lebih dulu, lalu **AURIVO DASH** |

**Aturan penulisan** (jangan dilanggar supaya merek tetap konsisten):

| Konteks | Bentuk | Contoh |
|---|---|---|
| Domain & URL | satu kata | `aurivodash.com`, `aurivodash.id` |
| Paket npm / import | satu kata | `npm i aurivodash` |
| Organisasi & repo GitHub | satu kata | `github.com/aurivodash` |
| Tagar & handle sosial | satu kata | `#AurivoDash`, `@aurivodash` |
| Judul halaman, logo, dokumen, README | dua kata | "Aurivo Dash — dashboard perbankan" |

> Huruf kapital "D" hanya hidup di prosa dan logotype: URL serta nama paket tidak
> *case-sensitive*, dan tagar biasanya ditulis huruf kecil. Karena itu pada logo, bedakan
> "Dash" lewat **warna atau ketebalan**, bukan hanya lewat huruf kapital.

## 2. Arsitektur nama (payung + sub-produk)

```
Aurivo              → merek payung (perusahaan / portofolio)
Aurivo Dash         → dashboard operator (25 halaman)          ← produk ini
Aurivo Nasabah      → aplikasi mobile nasabah (9 layar)
Aurivo Grid         → modul MiniGrid / AG Grid
Auri                → persona asisten AI
```

Catatan merek: pada "Aurivo Dash", kata **"Dash"** bersifat deskriptif sehingga dalam
pendaftaran merek biasanya di-*disclaimer*. Kekuatan perlindungan praktis bertumpu pada
**"Aurivo"** — karena itu amankan dulu kata merek **AURIVO**, baru varian "AURIVO DASH".

## 3. Skor 14 kandidat (rubrik berbobot)

Bobot: eja & ucap global 20 · daya pembeda merek 20 · ketersediaan nyata 20 ·
risiko bentrok 15 · kesesuaian makna 15 · fleksibilitas payung 10.

| # | Nama | Skor | Putusan |
|---|---|---|---|
| 1 | **Aurivo Dash** | **8,55** | **DIPILIH** — bentuk tampilan (dua kata) |
| 2 | **AurivoDash** | **8,45** | Bentuk mesin (satu kata) — dipakai untuk domain/npm/repo |
| 3 | Plaindash | 7,85 | Terbaik di keluarga "dash" murni; cadangan terkuat |
| 4 | Aurivo | 7,80 | Payung merek; `.com`/`.io`/`.net`/`.app` dan GitHub sudah dipegang pihak lain |
| 5 | AuroDash | 7,55 | Sangat bersih, tapi pengucapan ambigu |
| 6 | Dashdeck | 7,05 | `.com` dijual USD 8.399 + penghuni di dunia dashboard |
| 7 | Aurivo UI | 6,95 | Sufiks "UI" generik & membatasi |
| 8 | SeaDash | 6,80 | "sea" = laut; homofon SeeDash |
| 9 | SeeDash | 6,40 | Homofon SeaDash + Seedash (BI software) sudah ada |
| 10 | AuriDash | 6,15 | `auridash.com` = merek aktif "Auridash™" |
| 11 | DashSed | 6,10 | Terbaca seperti salah ketik "dashed" |
| 12 | SimpleDash | 5,45 | Namespace padat (271 repo) |
| 13 | Dashna | 4,65 | `dashna.com` = SaaS analitik berbayar yang aktif |
| 14 | Dashmin | 4,10 | Sudah jadi paket npm dashboard React |

## 4. Data ketersediaan yang mendasari keputusan

| Kanal | Aurivo Dash / `aurivodash` |
|---|---|
| npm | **bebas** (`aurivodash`) |
| `.com` `.io` `.dev` `.id` `.co.id` `.app` `.net` `.ai` | **semua bebas** |
| GitHub (repo & akun) | **bebas** (0 repo) |
| Pencarian merek | nol produk/perusahaan bernama sama |

Satu-satunya pemakai kata "Aurivo" adalah **Aurivo Co-operative Society** (koperasi
agribisnis Irlandia) di kelas **pangan** — bukan perangkat lunak — dan mereka hanya memakai
bentuk **tunggal**: `aurivo.com`, `aurivo.io`, `aurivo.net`, `aurivo.app`, serta organisasi
GitHub `Aurivo` (dibuka 16 Jun 2023, 0 repo publik). Itulah alasan memakai bentuk gabungan.

**Jangan** mengklaim scope npm `@aurivo` walau secara teknis bisa: itu memakai nama
perusahaan lain. Pakai nama paket polos `aurivodash`.

## 5. Temuan yang mengubah pilihan (jangan diulang)

1. **Nama "cantik" sudah dipakai di kategori yang sama.** `Tabella` = software perencanaan
   keuangan (Finlandia); `Sextant` = firma analitik & dashboard; `Numera` ≈ `Numeral`
   (fintech pajak, pendanaan USD 57 M); `Kanso` = Kanso Software; `Ledgerwise` = firma
   akuntansi + LedgerWise AI.
2. **Menambah deskriptor justru membebaskan domain.** `aurivo.com` terpakai, tetapi
   `aurivodash.com` bebas — begitu juga npm & GitHub. Nama tunggal sekarang hampir selalu
   sudah dipegang; "Nama + Kata Kategori" jauh lebih mudah diamankan.
3. **Homofon mematikan.** SeaDash ≡ SeeDash dalam pengucapan; AuriDash ≈ AuroDash berbeda
   satu huruf. Merek yang tidak bisa dibedakan saat didengar tidak akan menyebar.
4. **Deskriptif murni lemah secara hukum.** "Dashboard Sederhana" tidak bisa dilindungi
   sebagai merek — tempatnya di tagline, bukan di nama.
5. **Ketersediaan npm lebih menentukan daripada `.com`** untuk produk JavaScript, karena
   pembelinya developer dan `npm i <nama>` yang bertabrakan langsung terasa.

## 6. Nama yang ditolak karena sudah dipakai (bukti)

`Artha` (Bank Artha Graha, Koperasi Artha Niaga, PT Nusa Satu Inti Artha) ·
`Meridian` (Meridian Bank, Meridian Treasury Management) ·
`Sagara` (PT Sagara Asia Teknologi) ·
`dashgrid` ("a high performance javascript grid") · `dashbase` · `dashkit` · `dashpad` ·
`dashify` · `dashlight` · `dashed` · `dashmin` · `dashna` ·
`kirana` (bebas di npm; lazim dipakai sebagai nama orang & berarti "toko kelontong" di India) ·
`ledgerwise` · `northline` · `plinth` · `folio` · `sextant` · `astrolabe` · `numera` ·
`tabella` · `auridash` (merek aktif, ™).

## 7. Langkah mengamankan identitas (checklist)

- [ ] **Domain** — daftarkan `aurivodash.com` (utama) + `aurivodash.id` & `aurivodash.co.id`
      (pasar Indonesia) + opsional `.dev` untuk dokumentasi.
- [ ] **npm** — klaim paket `aurivodash` (walau belum dipublikasikan, klaim lebih awal
      mencegah klaim pihak lain).
- [ ] **GitHub** — buat organisasi `aurivodash`, lalu repo `aurivodash` (publik).
      Jalankan `bash tools/siapkan-repo.sh` untuk menyiapkannya otomatis.
- [ ] **Sosial & tagar** — `@aurivodash` di X/IG/LinkedIn; pakai tagar `#AurivoDash`.
- [ ] **Merek dagang** — cek DJKI (kelas **9** perangkat lunak terunduh, **42** SaaS,
      **35** bila masuk wilayah layanan bisnis), lalu USPTO/EUIPO sebelum jualan ke luar
      Indonesia. Ajukan **AURIVO** dulu, baru **AURIVO DASH**.
- [ ] **Materi** — logo: huruf "D" dibedakan warna, bukan hanya kapital (§1).

## 8. Catatan teknis di repo ini

Sengaja **tidak** diubah saat rebranding, supaya build & QA tetap hijau:

| Hal | Nilai sekarang | Sebab |
|---|---|---|
| Nama folder kerja | ~~`adminlte-tailwind/`~~ → **`aurivodash/`** | diganti pada round 9 atas permintaan pemilik proyek; path di skrip QA (`/home/user/qa/*.mjs`) dan server pratinjau ikut disesuaikan |
| Kunci `localStorage` | `template-columns`, `template-minigrid-2`, `app.*` | mengubahnya menghapus setelan pengguna yang sudah ada |
| Sebutan "AdminLTE" pada komponen, `src/input.css`, dan halaman "Komponen" | tetap | itu **rujukan gaya visual**, bukan nama produk (§Lihat README) |
| Nama bank contoh di aplikasi nasabah | "Bank Nusantara" | data demo fiktif, bukan merek template |

Yang **sudah** memakai nama baru: `package.json`, `src/partials/head.html` (judul dokumen),
`src/partials/footer.html`, wordmark sidebar & landing, judul landing + meta description,
asisten AI (sapaan, saran "Apa itu Aurivo Dash?", deskripsi produk), serta kamus ID/EN.

## 9. Batas riset

Skor dan checklist di atas **tidak** menyertakan pencarian merek terdaftar: **DJKI tidak dapat
diakses** dari lingkungan kerja ini, begitu pula **USPTO/EUIPO** dan katalog marketplace
template. Marketplace domain pun menyatakan listing-nya tidak menyertakan merek dagang atau
pendaftaran usaha. Untuk peluncuran komersial, tiga sumber itu wajib dicek.
