#!/usr/bin/env python3
"""SatuReport Offline — server statis + proxy GET /api-proxy?url=...
Proxy dipakai aplikasi saat fetch langsung ke API gagal karena CORS.
Jalankan:  python3 server.py  (listen 0.0.0.0:8000)
"""
import json
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

MAX_BYTES = 8 * 1024 * 1024  # batasi respons 8 MB


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api-proxy":
            return self._proxy(parsed)
        if parsed.path == "/api-demo-query":
            return self._demo_query({})
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api-demo-query":
            body = self._read_body()
            try:
                spec = json.loads(body or b"{}")
            except Exception:
                spec = {}
            return self._demo_query(spec)
        if parsed.path == "/api-proxy":
            return self._proxy(parsed, self._read_body())
        self.send_error(404)

    def _read_body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(min(n, MAX_BYTES)) if n else b""
        except Exception:
            return b""

    # ---- endpoint demo untuk contoh "query kustom" ----
    # POST/GET {query, params:{tahun?}} -> array baris penjualan (JSON)
    _DEMO_ROWS = [
        {"tahun": 2025, "city": "Jakarta",  "name": "Budi Santoso",  "product": "Laptop Pro 14\"",     "qty": 1, "price": 15500000, "total": 15500000},
        {"tahun": 2025, "city": "Depok",    "name": "Siti Rahayu",   "product": "Mouse Wireless",      "qty": 7, "price": 125000,   "total": 875000},
        {"tahun": 2025, "city": "Bandung",  "name": "Agus Wijaya",   "product": "Keyboard Mechanical", "qty": 3, "price": 750000,   "total": 2250000},
        {"tahun": 2025, "city": "Surabaya", "name": "Dewi Lestari",  "product": "Monitor 27\"",        "qty": 2, "price": 2800000,  "total": 5600000},
        {"tahun": 2026, "city": "Jakarta",  "name": "Budi Santoso",  "product": "Laptop Pro 14\"",     "qty": 2, "price": 15500000, "total": 31000000},
        {"tahun": 2026, "city": "Depok",    "name": "Siti Rahayu",   "product": "Mouse Wireless",      "qty": 10,"price": 125000,   "total": 1250000},
        {"tahun": 2026, "city": "Bandung",  "name": "Agus Wijaya",   "product": "Keyboard Mechanical", "qty": 5, "price": 750000,   "total": 3750000},
        {"tahun": 2026, "city": "Surabaya", "name": "Dewi Lestari",  "product": "Monitor 27\"",        "qty": 3, "price": 2800000,  "total": 8400000},
        {"tahun": 2026, "city": "Bekasi",   "name": "Rizki Pratama", "product": "Webcam HD",           "qty": 4, "price": 450000,   "total": 1800000},
    ]

    def _demo_query(self, spec):
        rows = list(self._DEMO_ROWS)
        params = spec.get("params") if isinstance(spec, dict) else None
        if isinstance(params, dict) and params.get("tahun") not in (None, "", "Semua", "*"):
            try:
                th = int(params["tahun"])
                rows = [r for r in rows if r["tahun"] == th]
            except (TypeError, ValueError):
                pass
        body = json.dumps(rows).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, parsed, post_body=None):
        target = (urllib.parse.parse_qs(parsed.query).get("url") or [""])[0].strip()
        if not target.lower().startswith(("http://", "https://")):
            return self._send_json(400, {"error": "parameter ?url= harus URL http(s)"})
        try:
            headers = {"Accept": "application/json", "User-Agent": "SatuReport-Offline/1.0 (+api-proxy)"}
            if post_body:
                headers["Content-Type"] = "application/json"
            req = urllib.request.Request(target, data=post_body or None, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as res:
                body = res.read(MAX_BYTES)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:  # timeout, DNS, HTTP 4xx/5xx upstream, dsb.
            return self._send_json(502, {"error": f"proxy gagal memuat {target[:120]}: {e}"})

    def _send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # kurangi noise log
        pass


if __name__ == "__main__":
    import os, sys

    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"SatuReport server + api-proxy di http://0.0.0.0:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
