# ☕ Contoh Java API untuk SatuReport

Dua implementasi endpoint yang **persis** mengikuti [DOKUMENTASI-DATA.md](../DOKUMENTASI-DATA.md):

| Endpoint | Method | Format dokumen | Isi respons |
|---|---|---|---|
| `/api/penjualan` | GET | **B bentuk 1** | Array polos → Viewer otomatis membungkus `{content:[…]}` |
| `/api/penjualan-objek` | GET | **B bentuk 2** | Objek `{company, title, docNo, content:[…], footer1}` dipakai apa adanya |
| `/api/report-query` | POST | **C (query kustom)** | Body `{query, params}` → array baris hasil filter |

Semua endpoint mengaktifkan **CORS** (+ preflight `OPTIONS`) supaya bisa di-fetch langsung dari browser; bila CORS dimatikan pun SatuReport tetap berhasil lewat fallback proxy `/api-proxy` bawaannya.

## Opsi 1 — Tanpa dependensi (JDK 11+ saja) ✅ *sudah diuji jalan*

`SatuReportApiDemo.java` — server mini pakai `com.sun.net.httpserver` bawaan JDK.

```bash
cd contoh-java-api
java SatuReportApiDemo.java          # listen http://localhost:8080
# atau bila locale bukan UTF-8:
# javac -encoding UTF-8 SatuReportApiDemo.java && java SatuReportApiDemo
```

Uji cepat:

```bash
curl http://localhost:8080/api/penjualan                 # 9 baris (array)
curl http://localhost:8080/api/penjualan-objek           # objek + content
curl -X POST http://localhost:8080/api/report-query \
     -H "Content-Type: application/json" \
     -d '{"query":"select * from penjualan where tahun = {tahun}","params":{"tahun":"2026"}}'
# -> 5 baris, semuanya tahun 2026
```

## Opsi 2 — Spring Boot 3 (produksi) 📦 *referensi*

Folder `spring-boot/`: `SatuApiApplication.java` + `PenjualanController.java` + `pom.xml`.
Endpoint sama, CORS global, DTO `record`, dan contoh **JDBC + PreparedStatement**
(parameter `?` — aman dari SQL injection) dalam komentar siap diaktifkan.

```bash
mvn spring-boot:run      # butuh Maven + koneksi Maven Central
```

## Menyambungkan dari SatuReport

1. **Lewat tombol 🌐 API** (Viewer/Designer):
   isi URL `http://localhost:8080/api/penjualan` (atau `…/penjualan-objek`) → *Muat Data* → langsung ter-render.
2. **Lewat paket query kustom** — edit `contoh-paket-query.json`, ganti endpoint:

   ```json
   {
     "layout": { … },
     "data": { "query": "select * from penjualan where tahun = {tahun}",
               "endpoint": "http://localhost:8080/api/report-query" },
     "params": [ { "name": "tahun", "type": "select", "options": ["2025","2026"], "default": "2026", "field": "tahun" } ]
   }
   ```

   Buka di Viewer → form parameter **Tahun** muncul → pilih 2026 → **Tampilkan Report** → Viewer POST ke Java API → 5 baris tahun 2026.

3. **`field` binding penting**: nama field JSON baris (`tahun`, `city`, `name`, `product`, `qty`, `price`, `total`) harus cocok dengan `binding` item di layout — lihat contoh `param-report` di galeri.

## Bukti hasil pengujian (dijalankan di sandbox ini)

```
GET  /api/penjualan                      -> 9 baris (array)            ✓
GET  /api/penjualan-objek                -> keys: company..content     ✓
POST /api/report-query {tahun:"2026"}    -> 5 baris, tahun = 2026      ✓
OPTIONS preflight                        -> 204 + header CORS          ✓
POST via /api-proxy {tahun:2025,kota:Depok} -> 1 baris Siti Rahayu     ✓
```
