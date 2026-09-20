package com.contoh.ankaapi;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 *  Endpoint API untuk SatuReport — sesuai DOKUMENTASI-DATA.md
 *
 *    GET  /api/penjualan        -> ARRAY          (Format B bentuk 1: auto {content})
 *    GET  /api/penjualan-objek  -> Objek+content  (Format B bentuk 2)
 *    POST /api/report-query     -> {query,params} (Format C: query kustom)
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // alternatif: konfigurasi global di SatuApiApplication
public class PenjualanController {

    /** DTO baris laporan — bentuk JSON-nya persis field yang di-binding layout. */
    public record Penjualan(int tahun, String city, String name, String product,
                            int qty, long price, long total) {}

    private final JdbcTemplate jdbc; // null-safe di demo (lihat catatan DataSource di bawah)

    public PenjualanController(Optional<JdbcTemplate> jdbc) {
        this.jdbc = jdbc.orElse(null);
    }

    /* ---------- FORMAT B bentuk 1: array polos ---------- */
    @GetMapping("/penjualan")
    public List<Penjualan> penjualan() {
        return demoRows();
        /* Produksi (SELECT tanpa kondisi):
           return jdbc.query("SELECT tahun, city, name, product, qty, price, qty*price AS total FROM penjualan",
               (rs, i) -> new Penjualan(rs.getInt(1), rs.getString(2), rs.getString(3),
                                        rs.getString(4), rs.getInt(5), rs.getLong(6), rs.getLong(7))); */
    }

    /* ---------- FORMAT B bentuk 2: objek siap pakai ---------- */
    @GetMapping("/penjualan-objek")
    public Map<String, Object> penjualanObjek() {
        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("company", "PT Maju Bersama Sejahtera");
        doc.put("title", "Laporan Penjualan — dari Spring Boot");
        doc.put("docNo", "SB-2026-001");
        doc.put("content", penjualan());          // <- nama field = Binding content section
        doc.put("footer1", "Dihasilkan oleh Spring Boot 3");
        return doc;
    }

    /* ---------- FORMAT C: query kustom (POST {query, params}) ---------- */
    @PostMapping("/report-query")
    public List<Penjualan> reportQuery(@RequestBody QueryRequest req) {
        List<Penjualan> rows = new ArrayList<>(demoRows());
        Map<String, Object> p = Optional.ofNullable(req.params()).orElse(Map.of());

        String tahun = str(p.get("tahun"));
        if (tahun != null) rows.removeIf(r -> r.tahun() != Integer.parseInt(tahun));
        String kota = str(p.get("kota"));
        if (kota != null && !"Semua".equalsIgnoreCase(kota))
            rows.removeIf(r -> !r.city().equalsIgnoreCase(kota));
        return rows;

        /* Produksi (AMAN dari SQL injection — pakai '?'):
           return jdbc.query(
               "SELECT tahun, city, name, product, qty, price, qty*price AS total " +
               "FROM penjualan WHERE tahun = ? AND (? = 'Semua' OR city = ?)",
               (rs, i) -> new Penjualan(rs.getInt(1), rs.getString(2), rs.getString(3),
                                        rs.getString(4), rs.getInt(5), rs.getLong(6), rs.getLong(7)),
               Integer.parseInt(tahun), kota, kota); */
    }

    /** Body permintaan dari SatuReport Viewer. */
    public record QueryRequest(String query, Map<String, Object> params) {}

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o);
    }

    /* Data demo pengganti database — hapus setelah JDBC aktif. */
    static List<Penjualan> demoRows() {
        return List.of(
            new Penjualan(2025, "Jakarta",  "Budi Santoso",  "Laptop Pro 14\"",     1,  15500000, 15500000L),
            new Penjualan(2025, "Depok",    "Siti Rahayu",   "Mouse Wireless",      7,  125000,   875000L),
            new Penjualan(2025, "Bandung",  "Agus Wijaya",   "Keyboard Mechanical", 3,  750000,   2250000L),
            new Penjualan(2025, "Surabaya", "Dewi Lestari",  "Monitor 27\"",        2,  2800000,  5600000L),
            new Penjualan(2026, "Jakarta",  "Budi Santoso",  "Laptop Pro 14\"",     2,  15500000, 31000000L),
            new Penjualan(2026, "Depok",    "Siti Rahayu",   "Mouse Wireless",      10, 125000,   1250000L),
            new Penjualan(2026, "Bandung",  "Agus Wijaya",   "Keyboard Mechanical", 5,  750000,   3750000L),
            new Penjualan(2026, "Surabaya", "Dewi Lestari",  "Monitor 27\"",        3,  2800000,  8400000L),
            new Penjualan(2026, "Bekasi",   "Rizki Pratama", "Webcam HD",           4,  450000,   1800000L)
        );
    }
}
