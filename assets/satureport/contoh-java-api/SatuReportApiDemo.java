/*
 * ============================================================================
 *  SatuReport — Contoh API Java TANPA dependensi (bawaan JDK 11+)
 *  Sesuai DOKUMENTASI-DATA.md:
 *    GET  /api/penjualan        -> ARRAY polos          (Format B, bentuk 1)
 *    GET  /api/penjualan-objek  -> Objek {.., content}  (Format B, bentuk 2)
 *    POST /api/report-query     -> {query, params}      (Format C/custom query)
 *  CORS diaktifkan (termasuk preflight OPTIONS) agar bisa di-fetch dari browser.
 *
 *  Jalankan:  java SatuReportApiDemo.java        (listen http://localhost:8080)
 *  Lalu di SatuReport Viewer:
 *    - tombol 🌐 API  ->  http://localhost:8080/api/penjualan
 *    - paket query    ->  "endpoint": "http://localhost:8080/api/report-query"
 * ============================================================================
 */
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SatuReportApiDemo {

    /* ---------------- Data demo (pengganti tabel DB) ---------------- */
    static List<Map<String, Object>> demoRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(row(2025, "Jakarta",  "Budi Santoso",  "Laptop Pro 14\"",     1,  15500000));
        rows.add(row(2025, "Depok",    "Siti Rahayu",   "Mouse Wireless",      7,  125000));
        rows.add(row(2025, "Bandung",  "Agus Wijaya",   "Keyboard Mechanical", 3,  750000));
        rows.add(row(2025, "Surabaya", "Dewi Lestari",  "Monitor 27\"",        2,  2800000));
        rows.add(row(2026, "Jakarta",  "Budi Santoso",  "Laptop Pro 14\"",     2,  15500000));
        rows.add(row(2026, "Depok",    "Siti Rahayu",   "Mouse Wireless",      10, 125000));
        rows.add(row(2026, "Bandung",  "Agus Wijaya",   "Keyboard Mechanical", 5,  750000));
        rows.add(row(2026, "Surabaya", "Dewi Lestari",  "Monitor 27\"",        3,  2800000));
        rows.add(row(2026, "Bekasi",   "Rizki Pratama", "Webcam HD",           4,  450000));
        return rows;
    }
    static Map<String, Object> row(int tahun, String city, String name, String product, int qty, long price) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tahun", tahun);
        m.put("city", city);
        m.put("name", name);
        m.put("product", product);
        m.put("qty", qty);
        m.put("price", price);
        m.put("total", (long) qty * price);
        return m;
    }

    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        /* FORMAT B bentuk 1 — ARRAY polos: Viewer otomatis membungkusnya
           menjadi {"content": [...]}. */
        server.createContext("/api/penjualan", ex -> {
            if (preflight(ex)) return;
            if (!"GET".equals(ex.getRequestMethod())) { sendJson(ex, 405, "{\"error\":\"GET saja\"}"); return; }
            sendJson(ex, 200, toJsonArray(demoRows()));
        });

        /* FORMAT B bentuk 2 — OBJEK siap pakai: field skalar utk header/footer,
           field array "content" utk baris berulang. */
        server.createContext("/api/penjualan-objek", ex -> {
            if (preflight(ex)) return;
            if (!"GET".equals(ex.getRequestMethod())) { sendJson(ex, 405, "{\"error\":\"GET saja\"}"); return; }
            Map<String, Object> doc = new LinkedHashMap<>();
            doc.put("company", "PT Maju Bersama Sejahtera");
            doc.put("title", "Laporan Penjualan — dari Java API");
            doc.put("docNo", "JAVA-2026-001");
            doc.put("content", demoRows());
            doc.put("footer1", "Dihasilkan oleh SatuReportApiDemo.java");
            sendJson(ex, 200, toJson(doc));
        });

        /* FORMAT C — QUERY KUSTOM: Viewer mengirim POST
           { "query": "select * from penjualan where tahun = 2026",
             "params": { "tahun": "2026" } }
           -> respons berupa ARRAY baris (sama seperti GET). */
        server.createContext("/api/report-query", ex -> {
            if (preflight(ex)) return;
            if (!"POST".equals(ex.getRequestMethod())) { sendJson(ex, 405, "{\"error\":\"POST saja\"}"); return; }
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Map<String, String> params = extractParams(body);

            List<Map<String, Object>> rows = demoRows();
            // terapkan filter param "tahun" bila diisi (setara WHERE tahun = X)
            String tahun = params.get("tahun");
            if (tahun != null && !tahun.isEmpty() && !"Semua".equals(tahun)) {
                int th = Integer.parseInt(tahun.trim());
                List<Map<String, Object>> filtered = new ArrayList<>();
                for (Map<String, Object> r : rows) if (Objects.equals(r.get("tahun"), th)) filtered.add(r);
                rows = filtered;
            }
            // filter param "kota" (contoh param tambahan)
            String kota = params.get("kota");
            if (kota != null && !kota.isEmpty() && !"Semua".equals(kota)) {
                List<Map<String, Object>> filtered = new ArrayList<>();
                for (Map<String, Object> r : rows) if (kota.equalsIgnoreCase(String.valueOf(r.get("city")))) filtered.add(r);
                rows = filtered;
            }
            sendJson(ex, 200, toJsonArray(rows));
        });

        server.start();
        System.out.println("✔ SatuReport Java API demo jalan di http://localhost:8080");
        System.out.println("  GET  /api/penjualan        (array)");
        System.out.println("  GET  /api/penjualan-objek  (objek + content)");
        System.out.println("  POST /api/report-query     (query kustom)");
    }

    /* ---------------- CORS ---------------- */
    /** true = preflight sudah dijawab, handler boleh berhenti */
    static boolean preflight(HttpExchange ex) throws IOException {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Accept");
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return true;
        }
        return false;
    }

    static void sendJson(HttpExchange ex, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(bytes); }
        ex.close();
    }

    /* ---------------- util: JSON tanpa library ---------------- */
    static String esc(String s) {
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    static String toJson(Object v) {
        if (v == null) return "null";
        if (v instanceof Number || v instanceof Boolean) return v.toString();
        if (v instanceof Map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : ((Map<String, Object>) v).entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append('"').append(esc(e.getKey())).append("\":").append(toJson(e.getValue()));
            }
            return sb.append('}').toString();
        }
        if (v instanceof Iterable) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object o : (Iterable<Object>) v) {
                if (!first) sb.append(',');
                first = false;
                sb.append(toJson(o));
            }
            return sb.append(']').toString();
        }
        return '"' + esc(String.valueOf(v)) + '"';
    }

    static String toJsonArray(List<Map<String, Object>> rows) { return toJson(rows); }

    /* Ekstraksi params sederhana dari body {"query": "...", "params": {...}}
       Cukup untuk demo. Di produksi pakai Jackson/Gson:
           ObjectMapper mapper = new ObjectMapper();
           JsonNode root = mapper.readTree(body);
           String query = root.path("query").asText();
           JsonNode params = root.path("params"); */
    static Map<String, String> extractParams(String body) {
        Map<String, String> out = new HashMap<>();
        if (body == null) return out;
        Matcher mBlock = Pattern.compile("\"params\"\\s*:\\s*\\{([^}]*)\\}").matcher(body);
        if (!mBlock.find()) return out;
        Matcher mPair = Pattern.compile("\"([^\"]+)\"\\s*:\\s*(\"([^\"]*)\"|[-0-9.]+)").matcher(mBlock.group(1));
        while (mPair.find()) out.put(mPair.group(1), mPair.group(3) != null ? mPair.group(3) : mPair.group(2));
        return out;
    }
}

/*
 * ============================================================================
 *  CATATAN PRODUKSI — database sungguhan (PostgreSQL/MySQL) dengan JDBC:
 *
 *    String url  = "jdbc:postgresql://localhost:5432/penjualan";
 *    try (Connection conn = DriverManager.getConnection(url, "user", "pass");
 *         PreparedStatement ps = conn.prepareStatement(
 *                 "SELECT tahun, city, name, product, qty, price, total " +
 *                 "FROM penjualan WHERE tahun = ?")) {
 *        ps.setInt(1, Integer.parseInt(params.get("tahun")));   // AMAN dari SQL injection
 *        try (ResultSet rs = ps.executeQuery()) {
 *            while (rs.next()) rows.add(Map.of(
 *                "tahun",   rs.getInt("tahun"),
 *                "city",    rs.getString("city"),
 *                "name",    rs.getString("name"),
 *                "product", rs.getString("product"),
 *                "qty",     rs.getInt("qty"),
 *                "price",   rs.getLong("price"),
 *                "total",   rs.getLong("total")));
 *        }
 *    }
 *  JANGAN menyambung input user langsung ke string SQL — selalu pakai '?'.
 * ============================================================================
 */
