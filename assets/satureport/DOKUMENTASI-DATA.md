# 📘 Standar JSON Data — SatuReport Offline

Dokumen ini merinci format JSON yang diterima aplikasi untuk setiap sumber data:

| # | Sumber data | Dibuka lewat | File contoh |
|---|-------------|--------------|-------------|
| A | **Data lokal** (file JSON) | tombol `{} Data` (Viewer/Designer) | `contoh-data.json` |
| B | **API GET** (URL JSON) | tombol 🌐 API / paket ber-`API` | `contoh-paket-api.json` |
| C | **API + query kustom** (POST) | paket ber-`query`+`endpoint` | `contoh-paket-query.json` |
| D | **Paket satu file** + parameter | tombol 📂 Layout | `contoh-paket.json`, `contoh-paket-param.json` |

Semua pemrosesan dilakukan **di browser pengguna**; server tidak menyimpan apa pun.

---

## A. Data lokal (file `.json` untuk tombol `{} Data`)

**Aturan:**

1. Akar dokumen berupa **objek** `{ ... }`.
2. Field **array** → baris berulang report. Nama array harus sama dengan properti **Binding** pada Content Section (bawaan: `content`).
3. Field skalar (string/angka/boolean) → dipakai di Header/Footer lewat `binding` item.
4. Objek bersarang → field path bertitik: `address.city`, `company.name`.
5. Array di dalam baris (mis. tiap invoice punya `items[]`) → dipakai **Sub Group**.
6. Angka ditulis **polos tanpa pemisah ribuan** (`46200000`, bukan `"46.200.000"`) agar agregat `{Sum(total)}`, `{Avg(qty)}` bekerja.
7. Tanggal ditulis string bebas (`"17 September 2026"` atau ISO `"2026-09-17"`).

```json
{
  "company": "PT Maju Bersama Sejahtera",
  "title": "Laporan Penjualan — September 2026",
  "docNo": "DOC-2026-0917",
  "content": [
    { "name": "Budi Santoso", "city": "Jakarta", "product": "Laptop Pro 14\"", "qty": 2, "price": 15500000, "total": 31000000 },
    { "name": "Siti Rahayu",  "city": "Depok",   "product": "Mouse Wireless", "qty": 10, "price": 125000,  "total": 1250000 }
  ],
  "footer1": "Dicetak otomatis oleh SatuReport Offline",
  "footer2": "Dokumen ini sah tanpa tanda tangan basah"
}
```

> 📎 File lengkap: **`contoh-data.json`** (dipasangkan dengan `contoh-layout.json`).

---

## B. Data dari API (GET)

**Respons API yang diterima** (salin-pel dari server API Anda):

```json
// BENTUK 1 — array polos  ⇒ otomatis dibungkus menjadi {"content": [...]}
[ { "name": "Budi Santoso", "email": "budi@contoh.id" } ]
```

```json
// BENTUK 2 — objek siap pakai (dipakai apa adanya)
{ "company": "PT Maju Bersama", "content": [ { "name": "Siti Rahayu" } ] }
```

**Dua cara memakai:**

1. **Manual** — Viewer/Designer → tombol **🌐 API** → isi URL → *Muat Data*.
2. **Dari file paket** — simpan URL di field `"API"`, buka lewat 📂 Layout; data live diambil otomatis:

```json
{
  "name": "Direktori Pengguna (Paket API)",
  "layout": { "version": 2, "contentSection": { "binding": "content", "items": [] } },
  "API": "https://jsonplaceholder.typicode.com/users",
  "data": { "content": [] }
}
```

- `data` tetap boleh diisi → berperan sebagai **cadangan offline** bila API gagal.
- URL boleh memuat placeholder parameter: `"API": "https://host/api?tahun={tahun}&kota={kota}"` → diganti nilai form parameter.
- API yang memblokir CORS otomatis dicoba lewat proxy server (`/api-proxy?url=…`).

> 📎 File lengkap: **`contoh-paket-api.json`**

---

## C. API dengan query kustom (POST)

Untuk skenario *"kirim SQL/statement ke endpoint, terima hasilnya"*. Viewer mengirim **POST** JSON ke `endpoint`:

**Request yang dikirim Viewer:**

```http
POST /api-demo-query
Content-Type: application/json

{
  "query": "select * from penjualan where tahun = 2026",
  "params": { "tahun": "2026" }
}
```

**Respons yang diharapkan** — sama seperti bagian B (array polos ⇒ dibungkus `content`, atau objek siap pakai):

```json
[
  { "tahun": 2026, "city": "Jakarta", "name": "Budi Santoso", "product": "Laptop Pro 14\"", "qty": 2, "total": 31000000 }
]
```

**Format paketnya (seperti contoh Anda):**

```json
{
  "name": "Laporan Query Kustom",
  "layout": { "version": 2, "contentSection": { "binding": "content", "items": [] } },
  "data":   { "query": "select * from penjualan where tahun = {tahun}", "endpoint": "/api-demo-query" },
  "params": [ { "name": "tahun", "label": "Tahun", "type": "select", "options": ["2025", "2026"], "default": "2026" } ]
}
```

- Endpoint boleh **path relatif** (`/api-demo-query` — dijalankan di server aplikasi) atau **URL penuh** (`http://host/api`, otomatis lewat proxy bila kena CORS).
- Varian setara: letakkan `"query"` dan `"endpoint"` di **akar paket** (bukan di dalam `data`).
- Server demo `/api-demo-query` tersedia & menyaring `params.tahun` — bisa langsung dicoba.

> 📎 File lengkap: **`contoh-paket-query.json`**

---

## D. Paket satu file `{layout, data}` + parameter

Kontainer utama aplikasi — disimpan otomatis dari Designer (📄, centang *"Satu file"*) dan dibuka dari Viewer (📂):

```json
{
  "name": "Laporan Berparameter",
  "layout": { "version": 2, "page": { "paper": "A4" }, "contentSection": { "binding": "content", "items": [] } },
  "params": [
    { "name": "tahun", "label": "Tahun", "type": "select", "options": ["2025", "2026"], "default": "2026", "field": "tahun" },
    { "name": "kota",  "label": "Kota",  "type": "select", "options": ["Semua", "Jakarta", "Depok"], "default": "Semua", "field": "city" }
  ],
  "data": { "content": [ { "tahun": 2026, "city": "Depok", "name": "Siti Rahayu", "total": 1250000 } ] },
  "API": "https://host/api?tahun={tahun}"
}
```

**Field opsional:** `name` (judul), `API` (GET), `query`+`endpoint` (POST kustom), `params` (form parameter).

### Parameter (`params`)

| Properti | Isi |
|---|---|
| `name` | nama parameter — dipakai di ekspresi `{params.tahun}` & placeholder URL/query |
| `label` | label pada form modal |
| `type` | `text` (bawaan) / `number` / `date` / `select` (butuh `options`) |
| `options` | array pilihan untuk `select` |
| `default` | nilai awal terisi di form |
| `field` | field baris data yang difilter (bawaan = `name`); nilai `Semua`/`""`/`"*"` = tanpa filter |

**Alur:** paket dibuka → modal **⚙ Parameter Report** tampil (report tersembunyi) → klik **▶ Tampilkan Report** → baris `content` difilter menurut parameter, ekspresi `{params.xxx}` terisi, dan bila ada `API`/`query` data live diambil. Tombol **⟳ Reload** mengulang alur ini (form tampil lebih dulu).

> 📎 File lengkap: **`contoh-paket-param.json`** • paket polos: **`contoh-paket.json`**

---

## Ringkas: bentuk respons/data yang selalu valid

```text
Array      [ {...}, {...} ]                      ⇒ dibungkus {content:[...]}  ✓
Objek      { "content": [ {...} ], "judul": … }  ⇒ dipakai apa adanya        ✓
Spec API   { "API": "http(s)://…" }               ⇒ GET otomatis              ✓ (di dalam paket)
Spec query { "query": "…",  "endpoint": "…" }    ⇒ POST otomatis             ✓ (di dalam paket / paket.data)
```
## E. Ekspresi kondisi — "data yang keluar = baris dengan field == parameter"

Dua cara menyatakan **baris output hanya yang nilai field-nya sama dengan nilai parameter** (mis. kota = parameter `kota`):

### 1. Filter baris yang dicetak — `contentSection.filter`
Tulis ekspresi kondisi di properti section Content (panel kanan designer → klik section Content → **Filter ekspresi**), atau langsung di JSON layout:

```json
"contentSection": { "binding": "content", "filter": "city == params.kota", "items": [ … ] }
```

Efek: hanya baris `city` yang **sama dengan `params.kota`** yang dirender. Agregat `{Sum(total)}` / `{Count()}` juga ikut baris terfilter.

- Operator: `==` `!=` `<>` `>` `<` `>=` `<=`
- Perbandingan **numerik otomatis** bila kedua sisi angka (`tahun == params.tahun` cocok untuk `2026`), selain itu string (`city == params.kota` cocok untuk `Depok`).
- Sisi kanan boleh **literal**: `city == 'Depok'` / `tahun == 2026` / `city == Depok`, atau **binding** lain: `params.kota`, `tahun`, `qty`.
- Contoh lain: `qty > 5`, `price >= 1000000`, `status != 'Batal'`.

### 2. Filter di dalam FUNGSI agregat — argumen ke-3 (kondisi)
Semua fungsi agregat menerima kondisi opsional:

```text
{Sum(total,'content','city == params.kota')}      → jumlah total HANYA baris kota=pilihan
{Count('','content','tahun == params.tahun')}     → banyak baris untuk tahun terpilih
{CountIf('','content','qty >= 5')}                → alias Count berkondisi
{Avg(price,'content','city == "Jakarta"')}        → rata-rata harga baris Jakarta saja
```

Ilustrasi dengan parameter `{kota: "Depok"}` dan data contoh:

```
text: "Kota dipilih : {params.kota}"
text: "Baris cocok  : {Count('','content','city == params.kota')} dari {RowCount}"
text: "Total Depok  : {Sum(total,'content','city == params.kota')}"
text: "Grand total  : {Sum(total)}"
text: "Syarat baris : city == params.kota"
```
