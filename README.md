# Aurivo Dash — Template Dashboard Perbankan (Offline Ready)

> **Aurivo Dash** — *dashboard perbankan yang tetap jalan saat internet mati.*
> Paket: `aurivodash` · Repo: `github.com/aurivodash/aurivodash` · Domain: `aurivodash.com`/`.id`
> Aturan penulisan nama: **`aurivodash`** untuk yang diketik mesin (domain, paket, repo, tagar),
> **`Aurivo Dash`** untuk yang dibaca manusia (judul, logo, dokumen). Alasan lengkap + riset
> ketersediaan nama: [`NAMING.md`](NAMING.md).
>
> Lisensi: **MIT** — bebas dipakai, diubah, dan dijual, termasuk untuk proyek komersial
> (lihat [`LICENSE`](LICENSE)).

Template dashboard perbankan bergaya **AdminLTE v3** yang dibangun ulang dengan
**Tailwind CSS v4** + **Alpine.js 3** + **vanilla JS**. Semua aset (CSS hasil kompilasi,
Alpine, ikon, font) disimpan lokal sehingga template **berjalan penuh tanpa internet / CDN**,
termasuk saat dibuka langsung dari `file://`.

> Ini **bukan** salinan kode AdminLTE. Tata letak, komponen, dan gaya visualnya ditulis ulang
> memakai utility Tailwind + satu layer komponen kecil di `src/input.css`.

**Sorotan isi template**

| Fitur | Berkas kunci |
|---|---|
| 6 preset tema perbankan + 14 aksen, mode terang/gelap, sidebar terang/gelap | `src/input.css`, panel kontrol (⚙) |
| Dwibahasa Indonesia ⇄ English (tanpa muat ulang) | `assets/js/i18n.js`, `src/i18n/en.json` |
| Tabel pintar, AG Grid Community, **Mini Grid 1–6** (termasuk **data dari API** & **mode server-side**) | `pages/tables.html`, `pages/ag-grid.html`, `pages/mini-grid-*.html` |
| Kartu bank 3D + **QRIS** (statis/dinamis, EMVCo + CRC16) | `pages/kartu-qris.html`, `pages/qris.html`, `assets/js/qris.js` |
| **Login dua langkah**: kata sandi → **OTP 6 digit**, plus **splash screen** | `login.html` |
| **Kunci layar & animasi memuat** (`window.Lock`) untuk formulir/data | `assets/js/lock.js`, `src/lock.css` |
| **Aplikasi nasabah mobile** — 9 layar: saldo, QRIS, kartu, riwayat, tagihan/top up, jadwal, notifikasi, keamanan | `mobile/index.html`, `src/mobile.css` |
| **Asisten AI yang selalu muncul** — widget obrolan di semua halaman, jawaban simulasi offline + kait API | `assets/js/aichat.js`, `src/aichat.css` |
| **Layar biometric / PIN** — kunci aplikasi (sidik jari simulasi + PIN 6 digit + kunci otomatis) | `assets/js/biometric.js` |
| **Notifikasi push palsu** — banner meluncur, lonceng navbar, pusat notifikasi penuh | `assets/js/notify.js`, `pages/notifications.html` |
| **Scheduler** — job berkala jalan di peramban, agenda pekan, riwayat eksekusi | `pages/scheduler.html`, `mobile/index.html` |

---

## 1. Mulai cepat

**A. Tanpa Node (langsung pakai)**

```bash
# cukup buka salah satu berkas ini di peramban
pages/index.html      # dashboard
index.html            # halaman perkenalan + daftar halaman
login.html            # halaman masuk
```

**A2. Versi satu berkas (paling aman untuk pratinjau/iframe)**

Folder `offline/` berisi setiap halaman dalam **satu berkas HTML mandiri**: CSS, JS,
ikon, dan font sudah di-inline. Cocok untuk dibuka dari mana saja, termasuk di dalam
iframe pratinjau yang tidak punya akses jaringan.

```bash
offline/index.html      # daftar semua berkas mandiri
offline/dashboard.html  # dashboard (581 KB, mandiri)
offline/tabel.html · offline/grafik.html · offline/komponen.html
offline/formulir.html · offline/analitik.html · offline/login.html
offline/ag-grid.html    # demo AG Grid Community (2,5 MB — pustaka grid ikut di-inline)
offline/mini-grid-1.html … offline/mini-grid-4.html   # 4 demo MiniGrid (± 672 KB/berkas)
offline/kartu-qris.html · offline/qris.html           # kartu 3D + pembangkit QRIS
offline/notifikasi.html · offline/scheduler.html      # pusat notifikasi + penjadwal
offline/mobile-nasabah.html                           # aplikasi nasabah (kunci biometric + 9 layar)
```

Bangun ulang setelah mengubah halaman: `npm run offline`.

**B. Pakai Node (untuk mengubah kode)**

```bash
npm install       # sekali saja (tailwindcss, @tailwindcss/cli, alpinejs, bootstrap-icons, sortablejs, qrcode-generator, terser)
npm run dev       # Tailwind watch → assets/css/app.css
npm run build     # CSS produksi (minified)
npm run pages     # bangun ulang HTML dari src/pages + src/partials
npm run icons     # regenerate ikon lokal → assets/js/icons.js
npm run serve     # server statis di http://localhost:8080
npm run offline   # bangun ulang 18 berkas HTML mandiri → offline/
npm run i18n      # bangun kamus bahasa → assets/js/i18n.js
npm run qrcode    # vendor ulang pustaka QR → assets/js/qrcode-generator.min.js
npm run all       # pages → i18n → build → offline (sekali jalan)
```

> Rekomendasi: jalankan `npm run serve` lalu buka `http://localhost:8080/pages/index.html`.
> Lewat `file://` tampilan tetap normal; hanya `localStorage` (penyimpanan tema & papan kanban)
> yang mungkin dibatasi peramban.

### Kredensial demo (halaman login)

`admin@perusahaan.id` / `admin123` → lanjut ke **verifikasi dua langkah**: masukkan 6 digit
kode OTP. Kode demo ditampilkan di kartu kuning (tombol **Isi otomatis** mengisinya), karena
tidak ada SMS/e-mail sungguhan. Semuanya simulasi di sisi klien, bukan autentikasi asli.

---

## 2. Halaman yang tersedia

| Berkas | Isi |
|---|---|
| `pages/index.html` | Dashboard: small box, info box, grafik, timeline, todo, obrolan, tabel transaksi |
| `pages/analytics.html` | KPI, area chart, funnel konversi, perangkat, sumber pendapatan |
| `pages/tables.html` | Tabel pintar (cari/sortir/paginasi/pilih massal), variasi tabel + demo kepala tabel sticky |
| `pages/forms.html` | Semua elemen formulir + validasi HTML5 + form horizontal |
| `pages/charts.html` | Semua jenis grafik + contoh pemakaian API `Charts` |
| `pages/widgets.html` | Kartu & alat kartu, alert, progress, modal, tabs, accordion, toast |
| `pages/kanban.html` | Papan kanban drag & drop (SortableJS lokal, tersimpan di localStorage) |
| `pages/ag-grid.html` | Demo **AG Grid Community** (MIT) — sortir, filter, paginasi, pilih baris, ekspor CSV |
| `pages/mini-grid-1.html` | **Mini Grid 1** — MiniGrid 50.000 baris: *virtual scroll*, 2 kolom beku, pager 100–50.000, multi-sort |
| `pages/mini-grid-2.html` | **Mini Grid 2** — CRUD lengkap lewat form modal, edit inline, tersimpan di `localStorage` |
| `pages/mini-grid-3.html` | **Mini Grid 3** — alur persetujuan: aksi kustom Setujui/Tolak, form filter terpusat, panel bantuan |
| `pages/mini-grid-4.html` | **Mini Grid 4** — aksi per baris (Detail/Edit/Hapus tanpa checkbox), form tambah 3 kolom, master-detail di Mini Grid 1 |
| `pages/mini-grid-5.html` | **Mini Grid 5** — data diambil dari **API** lewat `onRefresh` (Promise), status muat + sumber/latensi | `onRefresh` yang mengembalikan Promise, `setLoading` |
| `pages/mini-grid-6.html` | **Mini Grid 6** — **mode server-side**: paging/sortir/filter dihitung “server”, 10.000 baris | `server(params) → { rows, total }` |
| `pages/kartu-qris.html` | **Kartu dengan QRIS** — kartu bank 3D (bisa dibalik), QRIS di balik kartu, limit, blokir, riwayat |
| `pages/qris.html` | **QRIS** — pembangkit QR statis/dinamis ala EMVCo + CRC16, struktur payload, simulasi pembayaran & riwayat |
| `pages/icons.html` | Galeri 330 ikon dengan pencarian & klik-untuk-salin |
| `pages/profile.html` | Profil pengguna: statistik, tab aktivitas, biodata, pengaturan |
| `pages/invoice.html` | Invoice siap cetak dengan ringkasan pajak & status kirim |
| `pages/notifications.html` | **Pusat notifikasi** — daftar, penyaring kategori, tandai dibaca, hapus yang terbaca, kirim notifikasi uji |
| `pages/scheduler.html` | **Scheduler** — 7 job berkala, agenda pekan, jalankan/jeda/hapus, riwayat eksekusi, tambah job |
| `pages/report-design.html` | **Tools · Report Design** — desainer laporan visual SatuReport (kanvas mm, band header/content/footer, ekspor PDF & XLSX) |
| `pages/report-viewer.html` | **Tools · Report Viewer** — penampil laporan siap cetak: layout tersimpan, 12 contoh bawaan, atau file paket `.satureport.json` |
| `pages/report-example.html` | **Tools · Report Example** — galeri 12 contoh laporan (invoice, slip gaji, surat jalan, pivot, grafik) yang bisa dibuka/di-sunting |
| `mobile/index.html` | **Aplikasi nasabah (mobile-first)** — 9 layar: saldo, QRIS saya, kartu, riwayat, tagihan/top up, jadwal, notifikasi, keamanan, profil |
| `login.html` | Masuk dua langkah (kata sandi → OTP 6 digit) + splash screen + kunci layar |
| `register.html`, `404.html` | Halaman pendaftaran & error |
| `index.html` | Halaman perkenalan template (landing) |

---

## 3. Struktur proyek

```
aurivodash/
├─ assets/
│  ├─ css/app.css            # HASIL KOMPILASI Tailwind (jangan diubah manual)
│  ├─ fonts/                 # Source Sans 3 (woff2, OFL) — lokal
│  └─ js/
│     ├─ theme-boot.js       # anti-flicker: pasang tema sebelum CSS dilukis
│     ├─ icons.js            # 326 Bootstrap Icons (SVG inline) — di-generate
│     ├─ app.js              # Alpine store, DataTable, kartu, toast, format ID
│     ├─ charts.js           # mesin grafik SVG (line/area/bar/stacked/hbar/donut/radial/sparkline)
│     ├─ i18n.js             # mesin + kamus EN (di-generate oleh tools/build-i18n.mjs)
│     ├─ sortable.min.js     # SortableJS (MIT) untuk kanban
│     ├─ ag-grid-community.min.js  # AG Grid Community 36.2 (MIT) — di-vendor, 2 MB
│     ├─ ag-grid-demo.js     # integrasi grid: tema template + bahasa ID/EN + aksi toolbar
│     ├─ minigrid/            # MiniGrid (vanilla JS, tanpa dependensi) — di-vendor lokal
│     │   ├─ grid.js          #   mesin grid: scroll virtual, sortir, filter, CRUD, ekspor
│     │   └─ export.js        #   ekspor CSV / XLSX / PDF (dimuat SETELAH grid.js)
│     ├─ minigrid-demo.js    # 6 contoh Mini Grid + API window.MiniGridDemo
│     ├─ qrcode-generator.min.js # pustaka QR (MIT) — di-vendor, hanya untuk halaman QRIS
│     ├─ qris.js            # payload QRIS (EMVCo + CRC16), kartu 3D, riwayat (window.Qris)
│     ├─ lock.js            # kunci layar + animasi memuat (window.Lock)
│     ├─ biometric.js       # layar kunci aplikasi nasabah: sidik jari + PIN (window.Bio)
│     ├─ notify.js          # notifikasi push palsu (window.Notify) + data contoh
│     ├─ aichat.js          # asisten AI selalu muncul (window.AIChat) — simulasi + kait API
│     └─ alpine.min.js       # Alpine.js 3.17 (MIT)
│  ├─ satureport/            # APLIKASI SatuReport (di-vendor apa adanya, 2,7 MB)
│  │   ├─ designer.html       #   desainer laporan (Tailwind + Alpine sudah di-inline)
│  │   ├─ viewer.html         #   penampil laporan
│  │   ├─ examples.html       #   galeri 12 contoh
│  │   ├─ js/, examples/, vendor/  # mesin laporan, paket contoh, pustaka bawaan aplikasi
│  │   └─ laporan-penjualan.satureport.json  # contoh paket untuk ?url= (data-URI di offline/)
├─ src/
│  ├─ input.css              # token tema, skin, dark mode, komponen (sumber Tailwind)
│  ├─ minigrid.css           # MiniGrid → token template (--c-*), dark mode, overlay modal
│  ├─ qris.css               # kartu 3D (rotateY) + kotak QR, ikut token tema
│  ├─ lock.css              # kunci layar, splash screen, kartu OTP, animasi
│  ├─ mobile.css            # kerangka aplikasi nasabah (bilah atas, navigasi bawah, sheet)
│  ├─ notify.css            # banner push palsu + pratinjau lonceng navbar
│  ├─ aichat.css            # widget asisten AI (tombol melayang + panel obrolan)
│  ├─ fonts.css              # @font-face lokal (di-generate dari Google Fonts)
│  ├─ i18n/en.json           # kamus Indonesia → Inggris
│  ├─ partials/              # head, shell, sidebar, navbar, footer, panel kontrol, overlay, auth-shell
│  └─ pages/*.html           # isi halaman + front-matter
├─ tools/
│  ├─ build-pages.mjs        # perakit HTML (partial + front-matter → HTML statis)
│  ├─ build-icons.mjs        # generator assets/js/icons.js
│  ├─ build-qrcode.mjs       # vendor pustaka QR → assets/js/qrcode-generator.min.js
│  ├─ build-offline.mjs      # pembungkus 1 halaman → 1 berkas HTML mandiri
│  ├─ build-satureport.mjs   # salinan mandiri aplikasi SatuReport → offline/report-*.html
│  └─ siapkan-repo.sh        # git init + buat org/repo GitHub + push pertama
├─ pages/*.html              # HTML HASIL BUILD (siap dibuka)
├─ mobile/index.html         # aplikasi nasabah (layout "mobile", dibangun dari src/pages/mobile.html)
├─ offline/*.html            # 23 berkas HTML mandiri (19 halaman template + 3 aplikasi laporan + index)
├─ index.html, login.html, register.html, 404.html
├─ preview/*.png             # tangkapan layar
├─ NAMING.md                 # keputusan nama merek + riset ketersediaan (npm/domain/GitHub)
└─ package.json              # "name": "aurivodash"
```

### Cara menambah halaman baru

1. Buat `src/pages/laporan.html`:

   ```html
   ---
   path: pages/laporan.html
   title: Laporan
   pageTitle: Laporan Penjualan
   crumb: Home|index.html, Laporan
   ---
   <!--#actions-->
   <button class="btn btn-primary">Aksi di kanan header</button>
   <!--/#actions-->

   <div class="card">
     <div class="card-header"><h3 class="card-title">Judul</h3></div>
     <div class="card-body">Isi halaman…</div>
   </div>
   ```

2. Jalankan `npm run pages` (atau `npm run dev` bila Tailwind watch aktif).
3. Tambahkan tautan di `src/partials/sidebar.html`.

---

## 4. Menyesuaikan tampilan

Semua warna memakai **CSS variable**, jadi bisa diganti saat runtime (tanpa build ulang).
Buka **panel kanan** (ikon ⚙ di navbar) atau panggil dari konsol:

```js
Alpine.store("ui").setTheme("dark");    // light | dark
Alpine.store("ui").setSkin("green");    // blue | green | purple | red | yellow | navy | black
Alpine.store("ui").toggleCollapsed();   // sidebar mini
Alpine.store("ui").setContainer("boxed");
```

Untuk mengubah warna permanen, edit blok `:root` dan `html[data-skin="…"]`
di `src/input.css`, lalu `npm run build`. Token Tailwind (`bg-primary`, `text-muted`,
`border-line`, dst.) otomatis mengikuti.

**Pintasan keyboard:** `Ctrl/⌘ + K` cari global · `Ctrl/⌘ + B` miniatur sidebar ·
`.` ganti terang/gelap · `Esc` tutup menu/modal/panel.

### Tema perbankan (preset siap pakai)

Buka **panel kanan** (ikon ⚙ di navbar → *Pengaturan tampilan* → **Preset bank**):

| Preset | Kombinasi |
|---|---|
| **Perbankan Klasik** | terang · aksen navy `#16385c` · sidebar putih |
| **Private Banking** | gelap · navy tengah malam + emas · sidebar gelap |
| **Wealth & Syariah** | terang · zamrud + emas |
| **Korporat Marun** | terang · marun + emas |
| **Fintech Modern** | terang · grafit + biru langit · sidebar putih |
| **Gold Premium** | terang · emas · sidebar hitam |

Selain 6 preset ada **14 warna aksen** (`blue, navy, midnight, emerald, teal, burgundy,
gold, graphite, royal, green, purple, red, yellow, black`) dan pilihan **sidebar terang/gelap**.
Semuanya CSS variable, jadi bisa juga lewat konsol:

```js
Alpine.store("ui").applyPreset(Alpine.store("ui").presets[1]);  // Private Banking
Alpine.store("ui").setSkin("emerald");      // warna aksen
Alpine.store("ui").setSidebar("light");     // gaya sidebar
```

### Dual bahasa (Indonesia ⇄ English)

Tombol **🌐 di navbar** (atau panel kanan → *Bahasa / Language*) mengganti seluruh
antarmuka: menu sidebar, judul halaman, breadcrumb, tombol, tabel, formulir, teks bantuan,
notifikasi toast, bahkan nama bulan dan pemisah angka (`1.284` → `1,284`, `Rp` → `IDR`).
Pilihan tersimpan di `localStorage` (`app.locale`) dan dipasang sebelum halaman dilukis.

Yang **tidak** ikut diterjemahkan: `<meta name="description">` (dipakai mesin pencari, bukan
tampilan), isi blok contoh kode, serta **nilai data contoh** di dalam grid (nama orang, nama
kota, kode seperti `ID-100001`) — supaya datanya tetap terlihat realistis.

Cara kerjanya: teks sumber (Indonesia) dipakai sebagai **kunci kamus**, jadi menambah
terjemahan cukup mengisi `src/i18n/en.json`:

```bash
npm run i18n     # menulis assets/js/i18n.js + laporan src/i18n/missing.txt
```

`src/i18n/missing.txt` berisi semua teks yang belum diterjemahkan (urut abjad, siap tempel
ke `en.json`). Untuk teks di dalam JavaScript pakai `I18n.t("teks")`, dan di template Alpine:
`x-text="$store.i18n.t('Judul panel')"` (reaktif — langsung berubah saat bahasa diganti).
Saat ini kamus berisi ± 1.760 entri dan seluruh halaman demo (termasuk 6 halaman Mini Grid,
pemilih bahasa di aplikasi nasabah, sampai dialog kunci layar)
tampil penuh dalam bahasa Inggris — tombol, tooltip (`title`), `aria-label`, isi form modal,
panel bantuan, sampai footer pager grid ikut berganti.

### Menu sidebar (treeview)

Menu utama memakai treeview yang bisa dibuka/tutup (state disimpan per nama menu di
`Alpine.store("ui").menus`). Contoh yang tersedia:

```
Menu Utama
├─ Dashboard
├─ Analitik
├─ Tables            ← induk treeview (badge 5)
│  ├─ Data Table            → pages/tables.html            (tabel pintar + DataTable)
│  ├─ Tabel Sederhana       → pages/tables.html#tabel-sederhana
│  ├─ Kepala Tabel Sticky   → pages/tables.html#tabel-sticky
│  ├─ AG Grid Community     → pages/ag-grid.html           (badge MIT)
│  └─ Mini Grid      ← treeview bersarang (badge 6)
│     ├─ Mini Grid 1        → pages/mini-grid-1.html       (50.000 baris, kolom beku, master-detail)
│     ├─ Mini Grid 2        → pages/mini-grid-2.html       (CRUD + localStorage)
│     ├─ Mini Grid 3        → pages/mini-grid-3.html       (persetujuan Setujui/Tolak)
│     ├─ Mini Grid 4        → pages/mini-grid-4.html       (aksi per baris, 3 kolom)
│     ├─ Mini Grid 5        → pages/mini-grid-5.html       (data dari API + status muat)
│     └─ Mini Grid 6        → pages/mini-grid-6.html       (mode server-side, 10.000 baris)
├─ Kartu             ← induk treeview (badge 3)
│  ├─ Kartu dengan QRIS     → pages/kartu-qris.html
│  ├─ QRIS                  → pages/qris.html
│  └─ Aplikasi Nasabah      → mobile/index.html           (badge Mobile)
├─ Formulir
…
Halaman
└─ Halaman Lain      ← induk treeview (login, daftar, 404, demo)
```

Cara kerja penanda menu aktif (`markActiveNav()` di `assets/js/app.js`):

- tautan **tanpa** anchor → aktif bila berkasnya sama **dan** URL tidak punya anchor,
- tautan **ber-anchor** → aktif hanya bila anchor-nya cocok,
  jadi “Data Table” dan “Kepala Tabel Sticky” tidak menyala bersamaan;
- treeview induknya otomatis terbuka saat halaman/anchor yang cocok dibuka
  (juga saat `hashchange`, mis. setelah mengeklik anak menu);
- treeview boleh **bersarang** — contohnya “Mini Grid” di dalam “Tables”. Membuka halaman
  `mini-grid-3.html` akan membuka rantai “Tables → Mini Grid” sekaligus menandai anaknya aktif.

Kaki sidebar kini berisi tombol **Keluar** (ikon `box-arrow-right`) — kartu profil
pengguna di bagian atas sidebar sudah dihapus. Tombol keluar memakai dialog konfirmasi
bawaan template (`$store.dialog.ask`), lalu mengalihkan ke `login.html`:

```html
<button type="button" class="side-link side-logout w-full text-left" title="Keluar dari sesi ini"
        @click="$store.dialog.ask({ title: 'Keluar dari sesi ini?', tone: 'danger',
                                    confirmText: 'Keluar',
                                    onConfirm: () => { window.location.href = 'login.html'; } })">
  <span class="ico"><i data-icon="box-arrow-right"></i></span>
  <span class="txt">Keluar</span>
</button>
```

Saat sidebar diringkas (mode ikon) tombol ini tetap tampak sebagai ikon saja, dan baris
“Versi / Offline ready” baru muncul ketika sidebar di-hover.

Untuk menambah anak menu baru: tambahkan `<li data-url="kata kunci pencarian">` +
`<a href="halaman.html#bagian" class="side-link">` di dalam `submenu-wrap`
(`src/partials/sidebar.html`), lalu beri `id="bagian"` pada elemen tujuan di halaman
sumber. Atribut `data-url` dipakai kotak “Cari menu” di sidebar.

### Header halaman (judul + breadcrumb + aksi) — menetap saat scroll

Setiap halaman shell punya header standar yang dibangun `tools/build-pages.mjs`:

```html
<nav aria-label="Breadcrumb"><ol class="breadcrumb">…</ol></nav>
<h1 class="page-title">Analitik & Laporan</h1>          <!-- dari front-matter: pageTitle -->
<p class="page-subtitle">Halaman analitik dengan …</p>   <!-- dari description/subtitle -->
<div class="page-actions">…</div>                        <!-- dari blok #actions -->
```

> **Header ini sticky.** Breadcrumb, judul, dan tombol aksi tetap terlihat di bawah navbar
> ketika halaman digulir (`position: sticky; top: var(--navbar-h)`), jadi pengguna selalu tahu
> sedang di halaman mana dan bisa menekan aksinya kapan saja. Detailnya:
>
> - `.content-header` diberi latar **opaque** (`--c-body-bg`) supaya isi halaman tidak menembus;
>   saat benar-benar menempel, `app.js` menambahkan `data-stuck="true"` → muncul garis pemisah
>   + bayangan tipis.
> - Tingginya dibagikan lewat variabel `--header-h` (diperbarui otomatis saat resize, ganti tema,
>   ganti bahasa, atau setelah font selesai dimuat), sehingga elemen sticky lain tidak tertutup.
> - Di layar ≤ 576 px subjudul disembunyikan dan padding dirapatkan → header hanya ± 14% tinggi layar.
> - `scroll-padding-top` disetel, jadi tautan jangkar (`#bagian`) berhenti di bawah header.
> - Saat dicetak (`@media print`) header kembali statis.

Bila punya tabel panjang, ada dua mode kepala tabel yang menempel:

| Kelas | Untuk | Perilaku |
|---|---|---|
| `table-head-fixed` | tabel di dalam wadah bergulir (`.table-wrap` + `max-h-…`) | kepala menempel di tepi atas wadah |
| `table-head-fixed-viewport` | tabel di alur halaman (wadah `table-wrap-static`) | kepala menempel tepat di bawah header halaman |

Aksi khas halaman bisa juga dipasang di **Layout Top**: tulis blok `<!--#navbar-->` di
halaman sumber, misalnya `src/pages/charts.html`:

```html
<!--#navbar-->
<button class="nav-icon-btn" title="Unduh grafik" onclick="window.toast('Grafik diunduh (demo).')">
  <i data-icon="image" data-size="17"></i>
</button>
<!--/#navbar-->
```

Hasilnya tiap halaman punya tombol sendiri di navbar: dashboard (sinkron + ekspor),
analitik (unduh laporan), tabel (tambah + muat ulang), formulir (simpan), grafik (unduh PNG
+ gambar ulang), widget (tambah widget), kanban (kartu baru + reset), ikon (fokus pencarian),
profil (edit), invoice (cetak + salin tautan).

### Tata letak navbar (Layout Top)

Navbar sengaja dibuat tanpa menu cepat (tautan Dashboard/Analitik/Tabel/Komponen sudah
ada di sidebar). Susunannya:

```
[☰ toggle sidebar]  [🔍 pencarian global — mengisi ruang kiri]        [aksi kanan]
                                                                       │
   ✉ pesan · 🔔 notifikasi  ┊  ⛶ layar penuh · ☾ tema · ⚙ panel kontrol  ┊  (AS) Aulia S.
```

- Kelompok tombol dipisah garis tipis `.nav-sep` (muncul di layar ≥ 768 px).
- Pencarian **muncul di semua ukuran ≥ 640 px** dan melebar mengisi ruang kosong
  (maksimal 26rem) — sebelumnya hanya tampil di layar sangat besar.
- Di ponsel (≤ 640 px) pencarian disembunyikan, tombol layar penuh disembunyikan,
  tinggal ☰ + pesan + notifikasi + tema + panel + avatar.

Ubah susunannya di `src/partials/navbar.html`, lalu `npm run pages` (+ `npm run offline`
bila ingin memperbarui berkas mandiri).

---

## 5. Referensi cepat

### Grafik (tanpa library, SVG murni)

```js
Charts.line(el, { labels: ["Jan","Feb"], series: [{ name: "Penjualan", data: [10,20], color: "primary" }] });
Charts.bar(el,  { labels, series, stacked: true });
Charts.hbar(el, { labels, values, color: "info" });
Charts.donut(el,{ data: [{ label: "A", value: 10, color: "primary" }], centerLabel: "Total" });
Charts.radial(el,{ value: 72, max: 100, label: "Kuota" });
Charts.sparkline(el, { data: [1,4,2,6], color: "#fff", type: "area" });  // area | line | bars
Charts.refreshAll();   // gambar ulang (mis. setelah ganti skin)
```

Versi deklaratif:

```html
<div class="chart" data-chart="line" data-height="280" style="height:280px"
     data-labels="Jan,Feb,Mar" data-values="30,45,38"
     data-color="primary" data-formatter="compact" data-legend="true"></div>
```

### Tabel pintar

```html
<input data-dt-search>          <!-- kotak pencarian -->
<select data-dt-length>…</select><!-- baris per halaman -->
<table class="table table-hover table-sortable" data-datatable>
  <thead><tr><th data-sort>Nama</th></tr></thead>
  …
</table>
<span data-dt-info></span><div data-dt-pagination></div>
```

Kolom numerik bisa diberi `data-order="4250000"` agar sortirnya benar meski teksnya berformat.

### AG Grid Community (data grid)

Grid interaktif lengkap (sortir multi-kolom, filter per kolom + *floating filter*,
paginasi, pilih baris massal, ekspor CSV) tanpa CDN — pustakanya di-vendor lokal.

```html
<!-- 1) Muat pustaka + integrasi (keduanya lokal) -->
<script src="assets/js/ag-grid-community.min.js"></script>
<script src="assets/js/ag-grid-demo.js"></script>

<!-- 2) Wadah ber-tinggi tetap -->
<div id="grid-saya" style="height: 420px"></div>

<script>
  const { createGrid, themeQuartz, ModuleRegistry, AllCommunityModule } = agGrid;
  ModuleRegistry.registerModules([AllCommunityModule]);

  const api = createGrid(document.getElementById("grid-saya"), {
    theme: themeQuartz.withParams({ accentColor: "#16385c", fontFamily: "inherit" }),
    columnDefs: [
      { field: "nama",  headerName: "Nama",  sortable: true, filter: true, flex: 1 },
      { field: "saldo", headerName: "Saldo", type: "numericColumn",
        valueFormatter: (p) => "Rp " + p.value.toLocaleString("id-ID") }
    ],
    rowData: dataAnda,
    defaultColDef: { resizable: true, floatingFilter: true },
    pagination: true, paginationPageSize: 10,
    rowSelection: { mode: "multiRow", checkboxes: true }
  });

  api.setGridOption("quickFilterText", "jakarta");   // pencarian cepat
  api.exportDataAsCsv({ fileName: "data.csv" });     // unduh CSV
</script>
```

Poin penting:

- **Tema otomatis ikut template.** `ag-grid-demo.js` membaca CSS variable template
  (`--c-primary`, `--c-card-bg`, …) lalu memanggil `setGridOption("theme", …)` setiap
  event `theme:changed` — jadi grid ikut berubah saat skin perbankan / dark mode diganti.
- **Bahasa ikut ID/EN.** `localeText` diisi ulang dan grid dibangun ulang pada event
  `i18n:changed`, sambil mempertahankan urutan kolom, filter, dan halaman aktif.
- **Fitur Enterprise tidak dipakai.** *Set filter* & *Multi filter*, pengelompokan baris,
  pivot, dan ekspor Excel termasuk paket berbayar. Penyaring “pilih dari daftar”
  karenanya dibuat dari text filter Community (`setFilterModel` dengan `type: "equals"`),
  mis. dropdown **Cabang/Status** di toolbar halaman demo.
- **API siap pakai** (`window.AgGridDemo`): `eksporCsv()`, `autoSize()`, `tambahBaris()`,
  `hapusPilihan()`, `jumlahBaris()`, `pilihan()`, `saringCabang()`, `saringStatus()`,
  `bersihkanSaringan()`.

Halaman contoh: `pages/ag-grid.html` (grid “Portofolio Nasabah” 20 baris + ringkasan per
cabang). Berkas mandirinya `offline/ag-grid.html` ± 2,5 MB karena pustaka grid ikut di-inline.

### Mini Grid (MiniGrid)

MiniGrid adalah pustaka grid **vanilla JS tanpa dependensi** dari
<https://github.com/radianadhic/minigrid>, di-vendor lokal di `assets/js/minigrid/`
sehingga tetap 100% offline. Versi yang dipakai mengikuti **upstream commit `5703470`**
(“javascript grid”: penamaan baru, **i18n ID/EN bawaan**, dan **tombol muat ulang bawaan**).
Enam contoh dipasang di enam halaman terpisah, lengkap dengan kartu “Fitur contoh ini” dan
“Kode inti”:

| Halaman | Isi | Kunci konfigurasi |
|---|---|---|
| `mini-grid-1.html` | 50.000 baris data, hanya ± 20 baris ada di DOM | `frozen: 2`, `pageSize: 500`, `pageSizes: [100 … 50000]`, `detail` |
| `mini-grid-2.html` | CRUD penuh + edit inline + `localStorage` | `crud: true`, `edit: true`, `onSave`, `onEdit`, `onRemove` |
| `mini-grid-3.html` | Persetujuan pengajuan cuti | `actions: [{ id: 'approve' … }]`, `need: 'some'`, `filterForm: true`, `help: true` |
| `mini-grid-4.html` | Daftar proyek, aksi per baris | `select: false`, `rowActions: true`, `formCols: 3` |
| `mini-grid-5.html` | **Data dari API** — grid mulai kosong, diisi `onRefresh` (Promise) | `onRefresh`, `setLoading`, status sumber + latensi |
| `mini-grid-6.html` | **Mode server-side** — satu halaman dari 10.000 baris | `server(params) → { rows, total }`, `pageSize: 10` |

Cara pakainya (lihat `assets/js/minigrid-demo.js` untuk contoh lengkap):

```html
<script defer src="assets/js/minigrid/grid.js"></script>
<script defer src="assets/js/minigrid/export.js"></script> <!-- XLSX & PDF: SETELAH grid.js -->
<script defer src="assets/js/minigrid-demo.js"></script>

<div id="minigrid-1" class="minigrid-host"></div>
<script>
  MiniGrid({
    el: '#minigrid-1',
    columns: [
      { name: 'id', label: 'ID', width: 64, type: 'num', form: false },
      { name: 'nama', label: 'Nama Karyawan', width: 170, required: true }
    ],
    data: rows(50000),
    frozen: 2,            // 2 kolom pertama ikut terlihat saat digeser ke samping
    height: 460, pageSize: 500
  });
</script>
```

**Integrasi dengan template**

- **Tema** — `src/minigrid.css` memetakan palet Tailwind bawaan MiniGrid ke token template
  (`--c-*`), jadi grid otomatis ikut **6 preset perbankan**, 14 warna aksen, dan mode gelap
  tanpa menyentuh kode pustakanya. Overlay modal grid dinaikkan ke `z-index: 92` (di atas
  sidebar 60, di bawah dialog template 95).
- **Bahasa** — pustaka sudah membawa kamus **ID/EN** sendiri (`lang`, `tr()`, `setLang()`);
  `minigrid-demo.js` menyinkronkannya dengan bahasa template (`langSekarang()`), jadi label
  toolbar, modal, pager, filter, panel bantuan, dan `aria-label` tabel ikut berganti saat
  `i18n:changed`. Status sumber pada contoh 5–6 dirangkai ulang dari fungsi teks, bukan
  string beku, supaya tetap benar setelah bahasa diganti.
- **API contoh** — `window.MiniGridDemo`: `init()`, `grid[1..6]`, `muatUlang(n)`,
  `setujuiTerpilih()`, `tolakTerpilih()`, `tambahBaris()`, `hapusTerpilih()`,
  `eksporCsv/Xlsx/Pdf(n)`, `resetContoh2()`, `log(...)`. Tombol di navbar/aksi tiap halaman
  memanggil API ini. Untuk API sungguhan: `MiniGridDemo.sumberAPI = "/api/karyawan"` (contoh 5)
  dan `MiniGridDemo.sumberServer = "/api/halaman"` (contoh 6) — tanpa itu, keduanya memakai
  simulasi berlatensi sehingga template tetap jalan offline.
- **Berkas mandiri** — keenam halaman ikut dibangun ke `offline/` oleh `npm run offline`.

#### Tombol muat ulang data (refresh)

Tombol **Muat ulang** (ikon ↻) ada **bawaan pustaka** di toolbar, dan tiap halaman juga
menaruhnya di navbar/aksi. Kaitkan aksi Anda lewat `onRefresh`:

```js
MiniGrid({
  el: "#minigrid-5",
  columns: kolom,
  data: [],                       // kosong dulu — diisi saat refresh
  refresh: true,                  // bawaan: tombol refresh selalu tersedia
  onRefresh: function (grid) {    // boleh mengembalikan Promise
    return fetch("/api/karyawan")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        grid.data = grid.o.data = data;   // ganti isi
        grid.s.page = 1; grid.render();
        return data;                      // Promise → status muat otomatis
      });
  }
});
```

Begitu `onRefresh` mengembalikan Promise, pustaka memanggil `setLoading(true)`: lapisan
`[data-role="load"]` (ikon berputar + teks “Memuat…”, `aria` tetap terbaca) tampil menutupi
isi grid sampai Promise selesai (`.then` **dan** `.catch` sama-sama menutupnya, jadi status
tidak pernah macet). Halaman contoh menambahkan **kunci layar** template (`window.Lock`) selama
`muatUlang(n)` berjalan supaya data tidak tersentuh. Mode server-side (contoh 6) memakai jalur
yang sama: paging, sortir, dan filter dikirim ke `server(params)`, hanya satu halaman ditahan
di peramban, dan `server` boleh menolak — grid tetap menampilkan halaman terakhir.

> Catatan lisensi: repositori upstream MiniGrid belum menyertakan berkas lisensi. Kode
> pustakanya di-vendor apa adanya, dengan dua penyesuaian kecil untuk template ini: kelas
> `mg-modal` pada empat overlay dialognya (agar `z-index` 92 dari `src/minigrid.css` berlaku)
> dan istilah tombol “Ekspor”/“Muat ulang” pada kamus ID-nya. Sebelum dipakai di proyek
> produksi, konfirmasi lisensinya ke pemilik repo.

### Kartu & QRIS

Dua halaman baru: **`pages/kartu-qris.html`** (Kartu dengan QRIS) dan **`pages/qris.html`**
(QRIS). Keduanya memakai modul `assets/js/qris.js` + pustaka QR lokal
`assets/js/qrcode-generator.min.js` (MIT, di-vendor) sehingga tetap 100% offline.

**Payload QRIS.** `Qris.payload()` menyusun string sesuai **EMVCo Merchant-Presented Mode**
(TLV: tag 2 digit + panjang 2 digit + nilai) lalu menutupnya dengan **CRC16-CCITT**
(polinomial 0x1021; vektor uji `123456789` → `29B1`):

| Tag | Isi | Catatan |
|---|---|---|
| `00` | Versi payload | `01` |
| `01` | Metode inisiasi | `11` statis · `12` dinamis (sekali pakai) |
| `51` | Info merchant (bersarang) | `00` domain acquirer · `02` NMID · `03` kriteria merchant (UMI) |
| `52` | Kategori merchant (MCC) | mis. `5814` restoran |
| `53` | Mata uang | `360` = IDR |
| `54` | Nominal | hanya untuk QR dinamis |
| `58`–`60` | Negara, nama & kota merchant | nama/kota dibersihkan ke huruf besar |
| `62` | Data tambahan | `01` nomor tagihan · `05` referensi · `07` label terminal |
| `63` | CRC16 | 4 karakter terakhir |

```js
// bangun → gambar → verifikasi
const teks = Qris.payload({
  nmid: "ID1024351287941", merchant: "KOPI NUSANTARA", kota: "JAKARTA",
  mcc: "5814", tipe: "dinamis", nominal: 75000, keterangan: "INV-2026-0918"
});
Qris.render(document.querySelector("#qris-qr"), teks, { logo: true }); // { logo } → level H
Qris.crcSah(teks);     // true
Qris.parse(teks);      // [{ tag: "51 · 02", arti: "NMID", panjang: 15, nilai: "ID102…" }, …]
Qris.png(teks, 8, 32); // data URL PNG untuk tombol unduh
```

**Halaman “Kartu dengan QRIS”**

- Tiga kartu contoh (debit, kredit, virtual) dengan **animasi balik 3D** (`rotateY` 180°);
  sisi belakang memuat **kode QRIS** kartu itu plus NMID & CVV.
- Masking nomor kartu (`•••• •••• •••• 4821`) dengan tombol tampilkan & salin nomor.
- **QRIS dinamis per nominal** plus hitung mundur 5 menit; saat kedaluwarsa kotak QR ditutup
  pesan “QR kedaluwarsa”.
- Limit harian / per transaksi / luar negeri (progress bar), saklar **aktifkan QRIS**, dan
  **blokir kartu** lewat dialog konfirmasi bawaan template (QRIS & tombol unduh ikut mati).
- Riwayat transaksi kartu memakai `DataTable` (cari + paginasi), data contoh deterministik.

**Halaman “QRIS”**

- Formulir merchant (nama, NMID, kota, MCC, tipe QR, nominal, nomor tagihan, terminal, kode pos);
  QR dan **tabel struktur payload** diperbarui langsung, dan payload dibaca ulang
  (`Qris.parse`) sebagai bukti string-nya bisa diparsing.
- Ringkasan: transaksi hari ini, volume, estimasi MDR 0,7%, settlement T+1.
- **Simulasi pembayaran** menambah baris transaksi (tabel + ringkasan ikut berubah);
  **Unduh CSV** mengekspor riwayat; QR bisa diunduh PNG atau payload-nya disalin.

**Integrasi template**

- Warna kartu memakai gradien tetap (navy/emas/zamrud) supaya teks putih tetap kontras di mode
  gelap, sedangkan kotak QR selalu putih — kontras QRIS tidak boleh turun.
- Seluruh teks masuk kamus `src/i18n/en.json`; pesan toast memakai `I18n.t()` agar ikut berganti
  bahasa saat tombol 🌐 ditekan.
- `assets/js/qris.js` mengekspos API kecil (`payload`, `parse`, `crc16`, `crcSah`, `bersih`,
  `render`, `png`) yang bisa dipakai halaman lain.

> **Catatan:** QR di halaman ini dibuat untuk demo antarmuka — bukan QRIS terdaftar. Untuk
> produksi, NMID dan domain acquirer harus berasal dari PJP yang bekerja sama.

### Login dua langkah (splash + OTP)

`login.html` kini bertahap:

1. **Splash screen** — muncul saat halaman dibuka (logo, bilah progres, status “Memuat aset
   lokal → Menyiapkan koneksi aman → Menyiapkan formulir masuk”), lalu menutup sendiri setelah
   `window.load` (+ 850 ms). Ada jaring pengaman 3,4 detik dan tombol apa pun/Esc juga menutupnya,
   jadi halaman tidak pernah terkunci karena splash.
2. **Langkah 1 — kredensial**: validasi HTML5 (`was-validated`), kunci layar mode `form`
   selama pemeriksaan, kredensial demo `admin@perusahaan.id / admin123`.
3. **Langkah 2 — OTP**: 6 kotak digit (`[data-otp]`), navigasi panah/backspace, tempel kode
   sekaligus (`Ctrl+V`/paste → langsung verifikasi), hitung mundur kirim ulang 60 detik, dan
   kode demo yang bisa diisi dengan tombol **Isi otomatis** (`[data-otp-demo]`).
   Kode salah → getar + kotak dikosongkan; kode benar → kunci layar “Selamat datang” →
   dialihkan ke `pages/index.html`.

Karena tidak ada backend, kode dibuat acak di peramban (`buatKode()`). Bila nanti disambungkan
ke server, ganti isi `kirim()` / `verifikasiKode()` dengan permintaan `fetch` — tampilan tidak
perlu diubah.

### Kunci layar & animasi memuat (`window.Lock`)

`assets/js/lock.js` (dimuat di semua halaman) menyediakan overlay gembok: cincin berputar,
gembok (bergoyang di mode formulir), bilah progres, dan tiga titik langkah. Warna mengikuti
token tema (`--c-*`) sehingga ikut preset perbankan & mode gelap.

```js
Lock.show({ mode: "load" });                       // load | form | screen
Lock.show({ mode: "form", tone: "success", title: "Menyimpan", message: "…" });
Lock.tulis("Mengunggah 3 dari 5 berkas…");          // ganti pesan saat proses berjalan
Lock.jalan(1200, { mode: "load" });                // tampil lalu tutup otomatis
Lock.wrap(fetch("/api/simpan"), { mode: "form" }); // tutup saat Promise selesai/gagal
Lock.demo(3, { mode: "screen" });                  // contoh hitung mundur 3-2-1
Lock.hide();
```

| Mode | Dipakai untuk | Kelakuan |
|---|---|---|
| `load` | memuat data (mis. muat ulang Mini Grid) | Esc menutup, gembok statis |
| `form` | mengirim formulir/transaksi | Esc menutup, gembok bergoyang |
| `screen` | verifikasi OTP, kartu terkunci | Esc **tidak** menutup, gembok besar |

Sudah dipakai di tiga tempat nyata: muat ulang Mini Grid, pengiriman formulir di aplikasi
nasabah, dan verifikasi OTP di halaman masuk.

### Aplikasi nasabah (`mobile/index.html`)

Gaya aplikasi perbankan ponsel: **satu berkas dengan 9 layar** yang berpindah tanpa muat ulang
(5 tombol navigasi bawah + layar turunan), dan bingkai ponsel otomatis saat dibuka di layar
lebar (≥ 640 px). Kerangka aplikasi dikunci setinggi layar (`100dvh`) sehingga **hanya area isi
yang menggulir** dan bar bawah selalu menempel.

| Layar | Isi |
|---|---|
| **Beranda** | kartu saldo (sembunyikan saldo, poin, level), 4 aksi cepat, pintasan QRIS & kartu, carousel promo, baris **Jadwal otomatis / Pusat notifikasi / Biometric & PIN**, transaksi terbaru |
| **QRIS** | QR “QRIS saya” dari `Qris.payload()` + `Qris.render()`, pilihan nominal (bebas/25 rb/50 rb/100 rb) → tag 54 dinamis, salin payload, unduh PNG (canvas), status CRC16 |
| **Kartu** | 3 kartu (debit/kredit/virtual) dengan masking nomor, tombol tampilkan nomor, blokir kartu (dialog → kunci layar), atur limit |
| **Riwayat** | penyaring Semua / Uang masuk / Uang keluar / QRIS, muat ulang dengan kunci layar |
| **Tagihan & Top up** | segmen **Tagihan** — 6 tagihan (PLN, PDAM, IndiHome, Telkomsel, Netflix, kartu kredit) dengan status jatuh tempo & tombol bayar; segmen **Top up** — dompet digital, pulsa, paket data (nominal cepat + numpad) |
| **Jadwal otomatis** | 4 jadwal transaksi berkala (transfer bulanan, autodebet PLN, top up GoPay, zakat): ringkasan, kalender pekan, sakelar jeda, *Jalankan sekarang*, hapus, dan **riwayat eksekusi** |
| **Notifikasi** | pusat notifikasi nasabah: 8 notifikasi contoh + push palsu, penyaring kategori (Transaksi/Tagihan/Promo/Jadwal/Keamanan), tandai dibaca, hapus |
| **Keamanan** | sakelar **sidik jari & PIN**, uji sidik jari, *Kunci sekarang*, pilihan kunci otomatis (30 detik/1/2 menit/mati), ubah **PIN 6 digit**, sakelar **minta PIN untuk transaksi ≥ Rp 1.000.000** |
| **Profil** | ganti bahasa (ID ⇄ EN), mode gelap, notifikasi, uji kunci layar, keluar (dialog → `../login.html`) |

**Kunci aplikasi (biometric/PIN)** — `assets/js/biometric.js`: overlay `.bio-layar` di dalam
kerangka ponsel. Sidik jari simulasi (animasi pemindaian) dengan fallback **PIN 6 digit**
(demo `123456`, bisa diganti di layar Keamanan), kunci otomatis setelah tidak ada aktivitas
atau setiap kembali dari aplikasi lain, dan alasan kunci yang tampil di layar (`Bio.kunci(alasan)`).

**Alur transfer**: Beranda → *Transfer* → lembar bawah (`.mobile-sheet`) dengan numpad
(minimal Rp 1.000), isi tujuan → *Lanjut & verifikasi* → kunci layar mode `form` → transaksi
masuk riwayat dan saldo berkurang. Nominal ≥ Rp 1.000.000 meminta verifikasi ulang
(`Bio.minta`) lebih dulu. Semuanya di peramban; tidak ada data yang dikirim ke mana pun.

**Push palsu & jadwal** ikut hidup di sini: notifikasi contoh disuntik `assets/js/notify.js`
(lingkup `mobile`, terpisah dari lingkup dashboard) dan jadwal transaksi disimpan di
`localStorage` (`app.jadwal`). Asisten AI juga tampil di dalam kerangka ponsel.

Menu sidebar: **Kartu → Aplikasi Nasabah** (`../mobile/index.html`), bisa juga dibuka langsung
dari `mobile/index.html`. Berkas mandirinya `offline/mobile-nasabah.html`.

### Asisten AI yang selalu muncul (`assets/js/aichat.js`)

Widget obrolan melayang di sudut kanan bawah **setiap halaman** — dashboard, halaman masuk,
halaman 404, halaman perkenalan, sampai aplikasi nasabah (di sana ia duduk **di dalam**
kerangka ponsel, di atas navigasi bawah). Tanpa dependensi: DOM-nya dibangun sendiri
oleh vanilla JS, jadi tetap muncul di `index.html` yang tidak memakai Alpine.

| Perilaku | Keterangan |
|---|---|
| Muncul otomatis | Kunjungan pertama membuka panel berikut 2 gelembung sapaan; setelah itu status panel (terbuka/tertutup) diingat di `localStorage` |
| Selalu bisa diakses | Bila ditutup, tersisa tombol bulat 54 px + balon kecil "Tanya apa saja…" dan lencana jumlah balasan yang belum dibaca |
| Percakapan | Riwayat 60 pesan terakhir disimpan di `app.aiChat` — tidak hilang saat pindah halaman |
| Saran cepat | 6 tombol pertanyaan siap pakai (template, tema, notifikasi, jadwal, QRIS, offline) |
| Nyata, bukan pajangan | Perintah *"ganti mode gelap"* benar-benar mengganti tema; pertanyaan notifikasi menjawab **jumlah belum dibaca** dari `Notify`; tiap balasan menyertakan tautan ke halamannya |
| Dwibahasa | Label, saran, dan seluruh balasan mengikuti ID ⇄ EN; balasan disimpan sebagai kunci template sehingga digambar ulang saat bahasa berganti |
| Tema | Warna mengikuti token `--c-*`, otomatis cocok di mode gelap dan semua preset aksen |

**Menyambungkan model sungguhan** (opsional; template tetap 100% offline):

```js
window.AIChat.setProvider(async function (o) {
  // o = { pesan, riwayat, bahasa, halaman }
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(o)
  });
  const d = await r.json();
  return { teks: d.jawaban, tautan: d.tautan };   // tautan opsional
});
window.AIChat.setProvider(null);   // kembali ke simulasi lokal
```

Bila provider melempar error, widget memberi tahu dan **kembali** ke jawaban simulasi —
halaman tidak pernah macet. API lain: `AIChat.buka()`, `tutup()`, `alihkan()`, `kirim(teks)`,
`tanya(teks)`, `bersihkan()`, `riwayat()`, `terbuka()`, `halaman(nama)`.

> Karena simulasi hanya mencocokkan kata kunci, balasannya bercerita soal template ini
> (halaman, tema, data contoh). Untuk asisten yang benar-benar pintar, pakai `setProvider`.

### Tools — aplikasi laporan (SatuReport)

Menu sidebar **Tools** (3 anak: **Report Design**, **Report Viewer**, **Report Example**)
memuat aplikasi **SatuReport** dari <https://github.com/radianadhic/satureport>, di-vendor
apa adanya di `assets/satureport/`. Tiap halaman Tools adalah halaman template biasa yang
menampilkan aplikasi itu di dalam bingkai (`iframe`) — jadi sidebar, navbar, header, dan
asisten AI tetap berfungsi:

| Halaman | Berkas aplikasi | Isi |
|---|---|---|
| Report Design | `assets/satureport/designer.html` | Desainer laporan visual: kanvas mm, band header/content/footer, data source (JSON/API/query), ekspor PDF & XLSX |
| Report Viewer | `assets/satureport/viewer.html` | Penampil laporan: layout tersimpan, `?example=` (12 contoh), `?url=` (file paket), pratinjau & cetak |
| Report Example | `assets/satureport/examples.html` | Galeri 12 contoh siap pakai dengan thumbnail yang dirender langsung |

Yang perlu diketahui:

- **Jangan lewatkan berkas aplikasi ini ke bundler Tailwind/Alpine** — tiap halaman
  SatuReport sudah memuat Tailwind Play CDN + Alpine-nya sendiri. Cukup tautkan apa adanya
  (seperti `assets/` lain) dan jangan tempel ke dalam partial template.
- **Bahasa ikut template.** SatuReport membaca `localStorage["satureport.lang"]`, template
  menyimpan pilihan di `app.locale`. Halaman Tools menyamakannya sebelum bingkai dimuat,
  dan `assets/js/satureport-tools.js` (window `SatuTools`) memuat ulang bingkai saat
  bahasa diganti — tombol ID/EN di navbar langsung mengubah bahasa aplikasi juga.
- **Berkas mandiri** dibuat oleh `npm run satureport` → `offline/report-design.html`,
  `report-viewer.html`, `report-example.html`. Tautan antar halaman di dalam aplikasi
  dipetakan ke nama berkas itu (`designer.html` → `report-design.html`, dst).
- **Contoh "file server"** (`viewer.html?url=laporan-penjualan.satureport.json`) memakai
  `fetch`, jadi butuh HTTP server di versi multi-berkas; di berkas mandiri `offline/`,
  data contohnya ditanam sebagai **data-URI** sehingga tombol itu tetap bekerja tanpa server.
- **Tampilan aplikasi tidak ikut dark mode/skin template** — SatuReport punya temanya
  sendiri (terang). Ini disengaja: berkas di-vendor apa adanya agar mudah diperbarui.
- Butuh tombol pintas? `window.SatuTools` menyediakan `buka('report-viewer')`,
  `muatUlang(idBingkai)`, `layarPenuh(idKartu)`, dan `samakanBahasa()`.

### Ikon

```html
<i data-icon="cart-check" data-size="18"></i>
```

Nama ikon harus ada di `tools/build-icons.mjs`; tambahkan lalu `npm run icons`.
Daftar lengkap & pencarian: buka `pages/icons.html`.

---

## 6. Offline — bagaimana dijamin?

| Aset | Sumber awal | Sekarang |
|---|---|---|
| Tailwind CSS v4 | npm | dikompilasi → `assets/css/app.css` (satu berkas, ± 67 KB) |
| Alpine.js | npm | `assets/js/alpine.min.js` |
| Bahasa (ID/EN) | — | `assets/js/i18n.js` (mesin + kamus, lokal) |
| Ikon (330 buah) | paket `bootstrap-icons` | di-inline ke `assets/js/icons.js` sebagai SVG |
| Font | Google Fonts | `assets/fonts/*.woff2` + `src/fonts.css` |
| SortableJS | npm | `assets/js/sortable.min.js` (hanya dimuat di halaman kanban) |
| AG Grid Community | npm | `assets/js/ag-grid-community.min.js` (MIT, 2 MB, di-vendor — hanya dimuat di `pages/ag-grid.html`) |
| qrcode-generator | npm | `assets/js/qrcode-generator.min.js` (MIT, 21 KB, di-vendor — hanya dimuat di halaman Kartu/QRIS) |
| Grafik | (Chart.js di AdminLTE) | diganti `assets/js/charts.js` buatan sendiri |

Tidak ada satu pun `href`/`src` yang menunjuk ke domain eksternal — bisa dicek dengan
`grep -rE "https?://" pages/ index.html login.html register.html | grep -v "xmlns\|schema"`.
Favicon pun memakai data-URI.

### Single-file (folder `offline/`)

Setiap halaman juga tersedia sebagai **satu berkas HTML** berisi semuanya (CSS ± 68 KB,
ikon ± 151 KB, Alpine 55 KB, app 30 KB, lock 8 KB, charts 30 KB, font woff2 sebagai data-URI).
Buka `offline/index.html` untuk daftar lengkap. Ada **23 berkas**: 19 halaman template
(pages, login, mobile) + **3 aplikasi laporan mandiri** (`offline/report-design.html`
± 625 KB, `report-viewer.html` ± 530 KB, `report-example.html` ± 497 KB) + satu halaman
daftar. Ukuran halaman template 659–781 KB, kecuali
`offline/ag-grid.html` ± 2,7 MB karena pustaka AG Grid ikut di-inline. Semuanya
**tanpa satu pun permintaan jaringan** — diuji dengan konteks peramban `offline: true`,
termasuk melalui `file://`.

> Tiga berkas laporan (`offline/report-*.html`) adalah **aplikasi SatuReport mandiri** —
> tanpa sidebar/navbar template dan tanpa asisten AI, karena berkas di-vendor apa adanya.
> Versi multi-berkas (`pages/report-*.html`) tetap memakai kerangka template lengkap
> beserta asisten AI, dengan aplikasi ditampilkan di dalam bingkai.

> Catatan teknis untuk pengembang: `tools/build-offline.mjs` memakai `String.replace()`
> dengan **fungsi** sebagai pengganti (bukan string). Bila isi berkas dipakai sebagai
> replacement string, JS menafsirkan `$$` sebagai satu `$` — ini pernah merusak
> `` `$${n}` `` di Alpine.js sehingga semua magic (`$store`, `$refs`, `$nextTick`)
> hilang. Builder kini memverifikasi setiap aset muncul persis sama di berkas keluaran.

---

## 7. Lisensi & kredit

**Aurivo Dash dirilis dengan lisensi MIT** — hak cipta © 2026 **Radian Adhi C.
(radianadhic)**. Berkas [`LICENSE`](LICENSE) ada di akar repositori (juga dinyatakan di
`package.json` → `"license": "MIT"`). Artinya kode template
ini bebas dipakai, diubah, digabung, diterbitkan, dan **dijual** — termasuk untuk proyek
komersial atau tertutup — dengan satu syarat: sertakan salinan lisensi beserta keterangan
hak cipta. Perangkat lunaknya diberikan **apa adanya, tanpa jaminan**.

> **Yang tidak tercakup lisensi MIT di atas:** berkas pihak ketiga di dalam `assets/`
> tetap memakai lisensinya masing-masing (lihat daftar di bawah). Dua komponen vendored
> — **MiniGrid** dan **SatuReport** — berasal dari repositori yang **belum memuat berkas
> lisensi**, jadi keduanya **tidak** termasuk dalam lisensi MIT proyek ini; konfirmasi ke
> pemilik repo sebelum dipakai di produksi.

Komponen pihak ketiga:

- **Tailwind CSS** — MIT
- **Alpine.js** — MIT
- **SortableJS** — MIT
- **AG Grid Community** — MIT (`assets/js/ag-grid-community.min.js`, versi 36.2)
- **qrcode-generator 2.0.4** — MIT, © 2009 Kazuhiko Arase
  (`assets/js/qrcode-generator.min.js`, dibangun ulang dengan `npm run qrcode`)
- **MiniGrid** — `assets/js/minigrid/grid.js` + `export.js` dari
  <https://github.com/radianadhic/minigrid> (di-vendor lokal; repo upstream belum
  menyertakan berkas lisensi — konfirmasi ke pemilik repo bila akan dipakai di produksi)
- **SatuReport** — aplikasi laporan di `assets/satureport/` dari
  <https://github.com/radianadhic/satureport>, disertakan **apa adanya (as-is)**.
  Repo upstream **belum menyertakan berkas lisensi** (`LICENSE`); untuk pemakaian
  komersial, konfirmasi dulu ke pemilik repo. Kredit ini juga tampil di halaman Tools.
- **Bootstrap Icons** — MIT (di-generate ke `assets/js/icons.js`)
- **Source Sans 3** — SIL Open Font License 1.1

Nama "AdminLTE" dipakai semata untuk menyebut gaya visual yang diacu; proyek ini tidak
berafiliasi dengan, dan tidak memuat kode dari, AdminLTE (ColorlibHQ).
