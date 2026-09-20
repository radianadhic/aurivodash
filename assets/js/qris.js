/*
 * qris.js — modul QRIS (Quick Response Code Indonesian Standard) untuk template ini.
 *
 * Isi:
 *   1. Pembuat payload QRIS sesuai spesifikasi EMVCo Merchant-Presented Mode (TLV)
 *      lengkap dengan CRC16-CCITT — hasilnya string yang bisa dipindai aplikasi
 *      bank/e-wallet sungguhan, bukan gambar hiasan.
 *   2. Penggambar QR memakai pustaka lokal assets/js/qrcode-generator.min.js
 *      (MIT, di-vendor offline — tidak ada permintaan jaringan).
 *   3. Pengendali dua halaman:
 *        pages/kartu-qris.html → "Kartu dengan QRIS" (kartu 3D + QRIS di balik kartu)
 *        pages/qris.html       → "QRIS" (pembuat QR merchant + riwayat transaksi)
 *
 * Teks antarmuka ditulis dalam bahasa Indonesia (bahasa sumber template); mesin i18n
 * (assets/js/i18n.js) menerjemahkannya ke Inggris lewat kamus src/i18n/en.json.
 */
(function () {
  "use strict";

  var qr = window.qrcode;
  if (!qr) return;

  /* Pustaka bawaan hanya mengenal Latin-1; pakai UTF-8 agar nama merchant
     non-ASCII tetap tersimpan benar di dalam QR. */
  qr.stringToBytes = function (s) {
    var bytes = [], enc = new TextEncoder().encode(String(s));
    for (var i = 0; i < enc.length; i++) bytes.push(enc[i]);
    return bytes;
  };

  /* ============================================================ util kecil */
  function T(s) { return window.I18n && window.I18n.t ? window.I18n.t(s, s) : s; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function isi(el, teks) { if (el) el.textContent = teks; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function rupiah(n) { return "Rp " + Math.round(n || 0).toLocaleString("id-ID"); }
  function dua(n) { return String(n).padStart(2, "0"); }
  function waktu(d) { return dua(d.getHours()) + ":" + dua(d.getMinutes()) + ":" + dua(d.getSeconds()); }
  function tanggal(d) { return dua(d.getDate()) + "/" + dua(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function toast(pesan, jenis, judul) {
    if (window.toast) window.toast(pesan, jenis || "success", judul || T("QRIS"));
  }
  function salin(teks, pesanSukses) {
    function beres() { toast(pesanSukses || T("Tersalin ke papan klip."), "success"); }
    function gagal() { toast(T("Tidak bisa menyalin otomatis — salin manual dari kotak teks."), "warning"); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(teks).then(beres, function () { salinManual(); gagal(); });
    } else { salinManual(); beres(); }
    function salinManual() {
      var ta = document.createElement("textarea");
      ta.value = teks; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* diabaikan */ }
      document.body.removeChild(ta);
    }
  }
  function unduh(nama, url) {
    var a = document.createElement("a");
    a.href = url; a.download = nama;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  /* PRNG deterministik supaya data contoh selalu sama */
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ================================================== EMVCo TLV + CRC16 */
  /* Satu elemen TLV: tag 2 digit + panjang 2 digit + nilai */
  function tlv(tag, nilai) {
    var v = String(nilai == null ? "" : nilai);
    if (v.length > 99) v = v.slice(0, 99);
    return tag + ("0" + v.length).slice(-2) + v;
  }
  /* CRC16-CCITT (FALSE): poly 0x1021, init 0xFFFF — vektor uji "123456789" → 29B1 */
  function crc16(str) {
    var crc = 0xffff;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  /* Bersihkan teks agar sesuai aturan QRIS: huruf besar, alfanumerik & spasi */
  function bersih(v, maks) {
    return String(v == null ? "" : v)
      .toUpperCase()
      .replace(/[^A-Z0-9 .\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maks || 25);
  }

  /* Payload QRIS (EMVCo MPM). Terima objek berisi data merchant & transaksi. */
  function payload(o) {
    o = o || {};
    var nmid = String(o.nmid || "ID1024351287941").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
    var nama = bersih(o.merchant, 25) || "MERCHANT CONTOH";
    var kota = bersih(o.kota, 15) || "JAKARTA";
    var mcc = String(o.mcc || "5411").replace(/[^0-9]/g, "").slice(0, 4).padEnd(4, "0");
    var dinamis = o.tipe === "dinamis";
    var nominal = Math.round(Number(o.nominal) || 0);

    var s = "";
    s += tlv("00", "01");                                  // versi payload
    s += tlv("01", dinamis ? "12" : "11");                 // 11 = statis, 12 = sekali pakai
    s += tlv("51", tlv("00", "ID.CO.QRIS.WWW") +           // domain acquirer
                    tlv("02", nmid) +                      // NMID merchant
                    tlv("03", "UMI"));                     // kriteria merchant (UMI = usaha mikro)
    s += tlv("52", mcc);                                   // kategori merchant
    s += tlv("53", "360");                                 // IDR
    if (dinamis && nominal > 0) s += tlv("54", String(nominal));
    if (o.tip) s += tlv("55", "01");
    s += tlv("58", "ID");
    s += tlv("59", nama);
    s += tlv("60", kota);
    if (o.pos) s += tlv("61", String(o.pos).replace(/[^0-9]/g, "").slice(0, 10));

    var tambahan = "";
    if (o.keterangan) tambahan += tlv("01", bersih(o.keterangan, 25));
    if (o.referensi) tambahan += tlv("05", bersih(o.referensi, 25));
    if (o.terminal) tambahan += tlv("07", bersih(o.terminal, 25));
    if (tambahan) s += tlv("62", tambahan);

    s += "6304";
    return s + crc16(s);
  }

  /* Arti tiap tag — dipakai tabel "Struktur payload" di halaman QRIS */
  var ARTI = {
    "00": "Versi payload", "01": "Metode inisiasi", "51": "Info merchant (QRIS)",
    "52": "Kategori merchant (MCC)", "53": "Mata uang", "54": "Nominal",
    "55": "Tip", "58": "Negara", "59": "Nama merchant", "60": "Kota merchant",
    "61": "Kode pos", "62": "Data tambahan", "63": "CRC16"
  };
  var ARTI_ANAK = {
    "51": { "00": "Domain acquirer", "02": "NMID", "03": "Kriteria merchant" },
    "62": { "01": "Nomor tagihan", "05": "Label referensi", "07": "Label terminal" }
  };

  /* Baca kembali payload → daftar tag (untuk verifikasi & tampilan) */
  function parse(str) {
    var keluar = [];
    function jalan(teks, induk) {
      var i = 0;
      while (i + 4 <= teks.length) {
        var tag = teks.slice(i, i + 2);
        var panjang = parseInt(teks.slice(i + 2, i + 4), 10);
        if (isNaN(panjang)) break;
        var nilai = teks.slice(i + 4, i + 4 + panjang);
        var anak = (tag === "51" || tag === "62") ? [] : null;
        keluar.push({
          tag: (induk ? induk + " · " : "") + tag,
          arti: (induk ? (ARTI_ANAK[induk] || {})[tag] : ARTI[tag]) || "—",
          panjang: panjang,
          nilai: nilai,
          kedalaman: induk ? 1 : 0
        });
        if (anak) jalan(nilai, tag);
        i += 4 + panjang;
      }
    }
    jalan(String(str), null);
    return keluar;
  }
  function crcSah(str) {
    if (String(str).length < 8) return false;
    var isi = String(str).slice(0, -4);
    return crc16(isi) === String(str).slice(-4).toUpperCase();
  }

  /* ============================================== penggambar QR (SVG/PNG) */
  function gambar(el, teks, opsi) {
    if (!el) return null;
    opsi = opsi || {};
    var level = opsi.level || (opsi.logo ? "H" : "M");   // H bila ditutup panel logo
    var q = qr(0, level);
    q.addData(teks, "Byte");
    q.make();
    el.innerHTML = q.createSvgTag({ cellSize: opsi.cellSize || 4, margin: 0, scalable: true });
    var svg = el.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("shape-rendering", "crispEdges");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", T("Kode QR QRIS"));
    }
    el.setAttribute("data-modul", q.getModuleCount());
    el.setAttribute("data-level", level);
    return q;
  }
  /* PNG asli lewat canvas; bila canvas tidak tersedia, jatuh ke GIF pustaka. */
  function pngDataURL(teks, sel, margin) {
    var q = qr(0, "M");
    q.addData(teks, "Byte");
    q.make();
    var sel2 = sel || 8, mar = margin == null ? 32 : margin;
    try {
      if (typeof document !== "undefined" && document.createElement) {
        var n = q.getModuleCount(), sisi = n * sel2 + mar * 2;
        var kanvas = document.createElement("canvas");
        kanvas.width = sisi; kanvas.height = sisi;
        var ctx = kanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sisi, sisi);
          ctx.fillStyle = "#000000";
          for (var r = 0; r < n; r++) {
            for (var c = 0; c < n; c++) {
              if (q.isDark(r, c)) ctx.fillRect(mar + c * sel2, mar + r * sel2, sel2, sel2);
            }
          }
          var url = kanvas.toDataURL("image/png");
          if (String(url).indexOf("data:image/png") === 0) return url;
        }
      }
    } catch (e) { /* canvas diblokir → pakai cadangan di bawah */ }
    return q.createDataURL(sel2, mar);
  }

  /* ================================================== data contoh kartu & QR */
  var KARTU = [
    {
      id: "debit", jenis: "Kartu Debit Utama", tema: "navy", merek: "GPN",
      nomor: "4321 8890 1120 4821", pemilik: "AULIA SAPUTRA", berlaku: "08/29", cvv: "412",
      nmid: "ID1024351287941", merchant: "AULIA SAPUTRA", kota: "JAKARTA",
      limitHarian: 25000000, terpakai: 8420000, limitTransaksi: 10000000, limitLuar: 5000000, terpakaiLuar: 1250000
    },
    {
      id: "kredit", jenis: "Kartu Kredit Platinum", tema: "gold", merek: "VISA",
      nomor: "5211 6634 9087 7712", pemilik: "AULIA SAPUTRA", berlaku: "03/28", cvv: "887",
      nmid: "ID1024351287942", merchant: "AULIA SAPUTRA", kota: "JAKARTA",
      limitHarian: 50000000, terpakai: 21750000, limitTransaksi: 25000000, limitLuar: 15000000, terpakaiLuar: 4300000
    },
    {
      id: "virtual", jenis: "Kartu Virtual QRIS", tema: "emerald", merek: "QRIS",
      nomor: "6013 7781 2204 1290", pemilik: "AULIA SAPUTRA", berlaku: "11/27", cvv: "—",
      nmid: "ID1024351287943", merchant: "AULIA SAPUTRA", kota: "JAKARTA",
      limitHarian: 10000000, terpakai: 2150000, limitTransaksi: 5000000, limitLuar: 0, terpakaiLuar: 0
    }
  ];

  var MERCHANT = {
    nmid: "ID1024351287941", nama: "KOPI NUSANTARA", kota: "JAKARTA",
    mcc: "5814", terminal: "A01", keterangan: "INV-2026-0918", pos: "12190"
  };

  function riwayatQris(n) {
    var acak = prng(20260918);
    var penerbit = ["BCA Mobile", "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "Jenius", "BRImo"];
    var status = ["Berhasil", "Berhasil", "Berhasil", "Berhasil", "Pending", "Gagal", "Refund"];
    var baris = [];
    var dasar = new Date();
    dasar.setHours(20, 45, 0, 0);
    for (var i = 0; i < n; i++) {
      var waktuTrx = new Date(dasar.getTime() - i * (4 + Math.floor(acak() * 26)) * 60000);
      var nominal = (5000 + Math.floor(acak() * 48) * 2500);
      if (acak() > 0.75) nominal = nominal * 2 + 1500;
      var st = status[Math.floor(acak() * status.length)];
      baris.push({
        id: "QR-2026-" + String(1042 - i).padStart(4, "0"),
        waktu: tanggal(waktuTrx) + " " + waktu(waktuTrx),
        penerbit: penerbit[Math.floor(acak() * penerbit.length)],
        metode: acak() > 0.25 ? "QRIS Dinamis" : "QRIS Statis",
        nominal: nominal,
        mdr: Math.round(nominal * 0.007),
        rrn: String(100000000000 + Math.floor(acak() * 899999999999)).slice(0, 12),
        status: st
      });
    }
    return baris;
  }

  function riwayatKartu(n, idKartu) {
    var acak = prng(idKartu === "kredit" ? 77701 : idKartu === "virtual" ? 55501 : 33301);
    var merchant = [
      ["Kopi Nusantara", "Makanan & Minuman"], ["Indomaret", "Belanja"], ["Tokopedia", "E-commerce"],
      ["SPBU Pertamina", "Transportasi"], ["Garuda Indonesia", "Perjalanan"], ["Hypermart", "Belanja"],
      ["Apotek K24", "Kesehatan"], ["Tiket.com", "Perjalanan"], ["PLN Mobile", "Utilitas"], ["Netflix", "Hiburan"]
    ];
    var metode = ["QRIS", "QRIS", "Contactless", "Chip", "Online"];
    var status = ["Berhasil", "Berhasil", "Berhasil", "Berhasil", "Pending", "Gagal"];
    var baris = [];
    var dasar = new Date();
    dasar.setHours(19, 20, 0, 0);
    for (var i = 0; i < n; i++) {
      var m = merchant[Math.floor(acak() * merchant.length)];
      var waktuTrx = new Date(dasar.getTime() - i * (11 + Math.floor(acak() * 90)) * 60000);
      var nominal = 15000 + Math.floor(acak() * 60) * 5000;
      baris.push({
        id: "TRX-" + String(90210 - i),
        waktu: tanggal(waktuTrx) + " " + waktu(waktuTrx),
        merchant: m[0],
        kategori: m[1],
        metode: metode[Math.floor(acak() * metode.length)],
        nominal: nominal,
        status: status[Math.floor(acak() * status.length)]
      });
    }
    return baris;
  }

  function kelasStatus(st) {
    if (st === "Berhasil") return "badge-soft-success";
    if (st === "Pending") return "badge-soft-warning";
    if (st === "Refund") return "badge-soft-info";
    return "badge-soft-danger";
  }

  /* ==================================== halaman 1: Kartu dengan QRIS */
  var Kartu = {
    indeks: 0, balik: false, tampilNomor: false, qrisAktif: true, terkunci: false,
    hitung: null, teksQR: ""
  };

  function initKartu() {
    var panggung = $("#kartu-panggung");
    if (!panggung) return;
    var k = KARTU[Kartu.indeks];

    /* ---- pilihan kartu (chip) ---- */
    $$("#kartu-pilih .kartu-chip-pilih").forEach(function (b, i) {
      b.classList.toggle("aktif", i === Kartu.indeks);
      b.setAttribute("aria-pressed", String(i === Kartu.indeks));
      b.addEventListener("click", function () {
        Kartu.indeks = i;
        Kartu.balik = false;
        gambarKartu();
        gambarRiwayatKartu();
        perbaruiQrKartu(KARTU[i], $("#kartu-nominal") ? $("#kartu-nominal").value : 0);
        toast(T("Beralih ke") + " " + T(KARTU[i].jenis) + ".", "info");
      });
    });

    function nomorTampil() {
      var n = k.nomor;
      return Kartu.tampilNomor ? n : "•••• •••• •••• " + n.slice(-4);
    }
    function gambarKartu() {
      var kartu = KARTU[Kartu.indeks];
      var depan = $("#kartu-depan"), belakang = $("#kartu-belakang");
      if (depan) depan.setAttribute("data-tema", kartu.tema);
      if (belakang) belakang.setAttribute("data-tema", kartu.tema);
      panggung.setAttribute("data-balik", Kartu.balik ? "1" : "0");
      isi($("#kartu-jenis"), kartu.jenis);
      isi($("#kartu-merek"), kartu.merek);
      isi($("#kartu-nomor"), nomorTampil());
      isi($("#kartu-pemilik"), kartu.pemilik);
      isi($("#kartu-berlaku"), kartu.berlaku);
      isi($("#kartu-cvv"), kartu.cvv);
      isi($("#kartu-nmid"), kartu.nmid);
      isi($("#kartu-merchant"), kartu.merchant + " · " + kartu.kota);
      /* balik kartu juga membalik tombolnya */
      var tombolBalik = $("#kartu-balik");
      if (tombolBalik) {
        tombolBalik.setAttribute("aria-pressed", String(Kartu.balik));
        tombolBalik.title = Kartu.balik ? T("Lihat sisi depan") : T("Lihat sisi belakang (QRIS)");
      }
      /* status pill */
      var pill = $("#kartu-status");
      if (pill) {
        pill.className = "badge " + (!Kartu.qrisAktif ? "badge-secondary" : Kartu.terkunci ? "badge-danger" : "badge-success");
        pill.textContent = !Kartu.qrisAktif ? "QRIS nonaktif" : Kartu.terkunci ? "Kartu terkunci" : "QRIS aktif";
      }
      /* limit */
      var bar = $("#kartu-limit-harian");
      if (bar) {
        var persen = kartu.limitHarian ? Math.round((kartu.terpakai / kartu.limitHarian) * 100) : 0;
        bar.style.width = persen + "%";
        bar.setAttribute("aria-valuenow", String(persen));
        isi($("#kartu-limit-harian-nilai"), rupiah(kartu.terpakai) + " / " + rupiah(kartu.limitHarian));
        isi($("#kartu-limit-harian-persen"), persen + "%");
      }
      isi($("#kartu-limit-transaksi-nilai"), rupiah(kartu.limitTransaksi));
      var bar3 = $("#kartu-limit-luar");
      if (bar3) {
        var p3 = kartu.limitLuar ? Math.round((kartu.terpakaiLuar / kartu.limitLuar) * 100) : 0;
        bar3.style.width = p3 + "%";
        isi($("#kartu-limit-luar-nilai"), kartu.limitLuar ? rupiah(kartu.terpakaiLuar) + " / " + rupiah(kartu.limitLuar) : T("Tidak aktif"));
      }
      /* nonaktifkan kontrol QR saat QRIS mati / kartu terkunci */
      var mati = !Kartu.qrisAktif || Kartu.terkunci;
      ["#kartu-qr-buat", "#kartu-qr-unduh", "#kartu-qr-salin"].forEach(function (sel) {
        var el = $(sel); if (el) el.disabled = mati;
      });
      /* ringkasan di kolom samping */
      isi($("#kartu-jenis-ringkas"), kartu.jenis);
      isi($("#kartu-nomor-ringkas"), "•••• " + kartu.nomor.slice(-4));
      isi($("#kartu-pemilik-ringkas"), kartu.pemilik);
      isi($("#kartu-merchant"), kartu.merchant + " · " + kartu.kota);
      var cek = $("#kartu-qris-toggle");
      if (cek) { cek.checked = Kartu.qrisAktif; cek.disabled = Kartu.terkunci; }
      /* kartu di balik kartu: sembunyikan QR bila QRIS nonaktif */
      var qrBelakang = $("#kartu-qr-belakang");
      if (qrBelakang) qrBelakang.hidden = !Kartu.qrisAktif;
      window.I18n && window.I18n.apply && window.I18n.apply();
    }
    Kartu.gambar = gambarKartu;

    /* ---- tombol: balik, tampilkan nomor, salin nomor ---- */
    $$("[data-kartu-balik]").forEach(function (b) {
      b.addEventListener("click", function () {
        Kartu.balik = !Kartu.balik; gambarKartu();
      });
    });
    $$("[data-kartu-tampil]").forEach(function (b) {
      b.addEventListener("click", function () {
        Kartu.tampilNomor = !Kartu.tampilNomor;
        gambarKartu();
        toast(Kartu.tampilNomor ? T("Nomor kartu ditampilkan.") : T("Nomor kartu disembunyikan."), "info");
        window.I18n && window.I18n.apply && window.I18n.apply();
      });
    });
    $$("[data-kartu-salin]").forEach(function (b) {
      b.addEventListener("click", function () { salin(KARTU[Kartu.indeks].nomor, T("Nomor kartu tersalin.")); });
    });

    /* ---- saklar QRIS & kunci kartu ---- */
    var toggle = $("#kartu-qris-toggle");
    if (toggle) toggle.addEventListener("change", function () {
      Kartu.qrisAktif = toggle.checked;
      gambarKartu();
      toast(Kartu.qrisAktif ? T("QRIS diaktifkan untuk kartu ini.") : T("QRIS dinonaktifkan."), Kartu.qrisAktif ? "success" : "warning");
    });
    $$("[data-kartu-kunci]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (Kartu.terkunci) {
          Kartu.terkunci = false; gambarKartu();
          toast(T("Kartu dibuka blokirnya."), "success");
          return;
        }
        if (window.Alpine && window.Alpine.store("dialog")) {
          window.Alpine.store("dialog").ask({
            title: T("Kunci kartu ini?"), tone: "danger",
            confirmText: T("Kunci kartu"), cancelText: T("Batal"),
            message: T("Kartu tidak bisa dipakai untuk pembayaran sampai dibuka blokirnya."),
            onConfirm: function () {
              Kartu.terkunci = true; gambarKartu();
              toast(T("Kartu diblokir sementara."), "warning");
            }
          });
        } else { Kartu.terkunci = true; gambarKartu(); }
      });
    });

    /* ---- QRIS dinamis dari kartu ---- */
    function buat(data, nominal) {
      Kartu.teksQR = payload({
        nmid: data.nmid, merchant: data.merchant, kota: data.kota, mcc: "5814",
        tipe: "dinamis", nominal: nominal, keterangan: MERCHANT.keterangan, terminal: MERCHANT.terminal
      });
      gambar($("#kartu-qr"), Kartu.teksQR, { logo: true });
      gambar($("#kartu-qr-belakang"), Kartu.teksQR, { cellSize: 3 });
      isi($("#kartu-payload"), Kartu.teksQR);
      isi($("#kartu-nominal-tampil"), nominal > 0 ? rupiah(nominal) : T("Nominal bebas"));
      var sah = crcSah(Kartu.teksQR);
      var pill = $("#kartu-crc");
      if (pill) { pill.className = "badge " + (sah ? "badge-soft-success" : "badge-soft-danger"); pill.textContent = "CRC16 " + Kartu.teksQR.slice(-4) + (sah ? " ✓" : " ✗"); }
      return Kartu.teksQR;
    }
    Kartu.buatQR = function () {
      var data = KARTU[Kartu.indeks];
      var nom = Number(($("#kartu-nominal") || {}).value || 0);
      buat(data, nom);
      mulaiHitung($("#kartu-hitung"), 300);
      window.I18n && window.I18n.apply && window.I18n.apply();
    };
    var buatBtn = $("#kartu-qr-buat");
    if (buatBtn) buatBtn.addEventListener("click", function () { Kartu.buatQR(); toast(T("QR dinamis dibuat — berlaku 5 menit."), "success"); });
    function unduhKartu() {
      if (!Kartu.teksQR) return;
      unduh("qris-" + KARTU[Kartu.indeks].id + ".png", pngDataURL(Kartu.teksQR, 8, 32));
      toast(T("Berkas PNG QRIS diunduh."), "success");
    }
    var unduhBtn = $("#kartu-qr-unduh");
    if (unduhBtn) unduhBtn.addEventListener("click", unduhKartu);
    var salinBtn = $("#kartu-qr-salin");
    if (salinBtn) salinBtn.addEventListener("click", function () {
      if (Kartu.teksQR) salin(Kartu.teksQR, T("Payload QRIS tersalin."));
    });
    var nominalIn = $("#kartu-nominal");
    if (nominalIn) nominalIn.addEventListener("change", function () { if (Kartu.qrisAktif && !Kartu.terkunci) Kartu.buatQR(); });

    gambarKartu();
    Kartu.buatQR();
    gambarRiwayatKartu();
  }

  function perbaruiQrKartu(data, nominal) {
    if (!data || !Kartu.qrisAktif) return;
    var n = Number(nominal) || 0;
    var teks = payload({
      nmid: data.nmid, merchant: data.merchant, kota: data.kota, mcc: "5814",
      tipe: "dinamis", nominal: n, keterangan: MERCHANT.keterangan, terminal: MERCHANT.terminal
    });
    Kartu.teksQR = teks;
    gambar($("#kartu-qr"), teks, { logo: true });
    gambar($("#kartu-qr-belakang"), teks, { cellSize: 3 });
    isi($("#kartu-payload"), teks);
    isi($("#kartu-nominal-tampil"), n > 0 ? rupiah(n) : T("Nominal bebas"));
    var pill = $("#kartu-crc");
    if (pill) {
      var sah = crcSah(teks);
      pill.className = "badge " + (sah ? "badge-soft-success" : "badge-soft-danger");
      pill.textContent = "CRC16 " + teks.slice(-4) + (sah ? " ✓" : " ✗");
    }
  }

  function gambarRiwayatKartu() {
    var isi2 = $("#kartu-riwayat");
    if (!isi2) return;
    var data = riwayatKartu(14, KARTU[Kartu.indeks].id);
    isi2.innerHTML = data.map(function (r) {
      return '<tr data-search="' + esc(r.merchant + " " + r.kategori + " " + r.metode + " " + r.status) + '">' +
        "<td><b>" + esc(r.merchant) + "</b><br><span class=\"fs-8 text-muted-2\">" + esc(r.kategori) + "</span></td>" +
        "<td class=\"whitespace-nowrap\">" + esc(r.waktu) + "</td>" +
        "<td>" + esc(r.metode) + "</td>" +
        "<td class=\"text-right tabular-nums\" data-order=\"" + r.nominal + "\">" + rupiah(r.nominal) + "</td>" +
        "<td class=\"text-center\"><span class=\"badge " + kelasStatus(r.status) + "\">" + esc(r.status) + "</span></td>" +
        "</tr>";
    }).join("");
    var t = $("#tabel-kartu");
    if (t && t.__dt) t.__dt.reload();
    window.I18n && window.I18n.apply && window.I18n.apply();
  }

  /* ============================================ halaman 2: QRIS merchant */
  var Qris = { teks: "", hitung: null, baris: [] };

  function hitungRingkas(baris) {
    var berhasil = baris.filter(function (r) { return r.status === "Berhasil"; });
    var volume = berhasil.reduce(function (a, r) { return a + r.nominal; }, 0);
    return {
      jumlah: baris.length, berhasil: berhasil.length, volume: volume, mdr: Math.round(volume * 0.007)
    };
  }

  function initQris() {
    var wadah = $("#qris-buat");
    if (!wadah) return;

    function baca() {
      return {
        nmid: ($("#qris-nmid") || {}).value || MERCHANT.nmid,
        merchant: ($("#qris-nama") || {}).value || MERCHANT.nama,
        kota: ($("#qris-kota") || {}).value || MERCHANT.kota,
        pos: ($("#qris-pos") || {}).value || MERCHANT.pos,
        mcc: ($("#qris-mcc") || {}).value || MERCHANT.mcc,
        tipe: ($("#qris-tipe") || {}).value || "statis",
        nominal: Number(($("#qris-nominal") || {}).value || 0),
        keterangan: ($("#qris-keterangan") || {}).value || "",
        terminal: ($("#qris-terminal") || {}).value || MERCHANT.terminal
      };
    }
    Qris.baca = baca;

    function terapkan() {
      var d = baca();
      var dinamis = d.tipe === "dinamis";
      /* nominal & keterangan hanya relevan untuk QR dinamis */
      [$("#qris-nominal"), $("#qris-keterangan")].forEach(function (el) {
        if (!el) return;
        el.disabled = !dinamis;
        if (!dinamis) el.value = el.id === "qris-nominal" ? "" : "";
      });
      var nominal = dinamis ? d.nominal : 0;
      Qris.teks = payload({
        nmid: d.nmid, merchant: d.merchant, kota: d.kota, pos: d.pos, mcc: d.mcc,
        tipe: d.tipe, nominal: nominal, keterangan: dinamis ? d.keterangan : "",
        terminal: d.terminal, referensi: "REF-" + d.terminal + "-2026"
      });
      gambar($("#qris-qr"), Qris.teks, { logo: true });
      isi($("#qris-payload"), Qris.teks);
      isi($("#qris-panjang"), Qris.teks.length + " " + T("karakter"));
      var sah = crcSah(Qris.teks);
      var crcEl = $("#qris-crc");
      if (crcEl) {
        crcEl.className = "badge " + (sah ? "badge-soft-success" : "badge-soft-danger");
        crcEl.textContent = "CRC16 " + Qris.teks.slice(-4) + (sah ? " ✓" : " ✗");
      }
      isi($("#qris-tipe-tampil"), dinamis ? "QRIS Dinamis" : "QRIS Statis");
      isi($("#qris-nama-tampil"), bersih(d.merchant, 25) || MERCHANT.nama);
      isi($("#qris-kota-tampil"), (bersih(d.kota, 15) || MERCHANT.kota) + " · " + d.mcc);
      isi($("#qris-merchant-ringkas"), bersih(d.merchant, 25) || MERCHANT.nama);
      isi($("#qris-nmid-ringkas"), String(d.nmid).toUpperCase().replace(/[^A-Z0-9]/g, ""));
      isi($("#qris-kota-ringkas"), bersih(d.kota, 15) || MERCHANT.kota);
      isi($("#qris-nominal-tampil"), nominal > 0 ? rupiah(nominal) : T("Nominal bebas"));
      if ($("#qris-hitung")) {
        if (dinamis) mulaiHitung($("#qris-hitung"), 300);
        else { hentikanHitung(); isi($("#qris-hitung"), T("berlaku terus")); }
      }
      /* tabel struktur payload */
      var tb = $("#qris-struktur");
      if (tb) {
        tb.innerHTML = parse(Qris.teks).map(function (x) {
          return '<tr' + (x.kedalaman ? ' class="bg-slate-50"' : "") + '>' +
            '<td class="tabular-nums ' + (x.kedalaman ? "pl-6" : "font-semibold") + '">' + esc(x.tag) + "</td>" +
            "<td>" + esc(x.arti) + "</td>" +
            '<td class="text-right tabular-nums">' + x.panjang + "</td>" +
            '<td class="break-all font-mono text-[11px]">' + esc(x.nilai) + "</td>" +
            "</tr>";
        }).join("");
      }
      window.I18n && window.I18n.apply && window.I18n.apply();
      return Qris.teks;
    }
    Qris.terapkan = terapkan;

    /* kontrol: bangun ulang saat input berubah */
    $$("#qris-form input, #qris-form select").forEach(function (el) {
      el.addEventListener("change", terapkan);
    });
    var debounce = null;
    ["#qris-nama", "#qris-nmid", "#qris-keterangan"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("input", function () {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(terapkan, 250);
      });
    });
    var contoh = $("#qris-contoh");
    if (contoh) contoh.addEventListener("click", function () {
      var acak = prng(20260918);
      var nama = ["KOPI NUSANTARA", "TOKO BUNGA MELATI", "WARUNG SEDERHANA", "APOTEK SEHAT SELALU", "BAKSO PAK HAR"][Math.floor(acak() * 5)];
      var kota = ["JAKARTA", "BANDUNG", "SURABAYA", "YOGYAKARTA", "MEDAN"][Math.floor(acak() * 5)];
      var set = function (sel, val) { var el = $(sel); if (el) el.value = val; };
      set("#qris-nama", nama); set("#qris-kota", kota);
      set("#qris-nmid", "ID1024" + String(Math.floor(acak() * 89999999) + 10000000));
      terapkan();
      toast(T("Data merchant contoh diisi ulang."), "info");
    });
    var buatBtn = $("#qris-buat-ulang");
    if (buatBtn) buatBtn.addEventListener("click", function () { terapkan(); toast(T("QR dibangun ulang."), "success"); });
    function unduhQris() {
      unduh("qris-" + bersih(baca().merchant, 20).replace(/ /g, "-").toLowerCase() + ".png", pngDataURL(Qris.teks, 8, 32));
      toast(T("Berkas PNG QRIS diunduh."), "success");
    }
    function salinQris() { salin(Qris.teks, T("Payload QRIS tersalin.")); }
    $$('[data-qris="unduh"]').forEach(function (b) { b.addEventListener("click", unduhQris); });
    $$('[data-qris="salin"]').forEach(function (b) { b.addEventListener("click", salinQris); });

    /* ---- simulasi pembayaran ---- */
    var nomorUrut = 0;
    function barisBaru() {
      var d = baca();
      var dinamis = d.tipe === "dinamis";
      var d2 = new Date();
      var acak = prng(Date.now() >>> 3);
      var nominal = dinamis && d.nominal > 0 ? d.nominal : 5000 + Math.floor(acak() * 40) * 2500;
      nomorUrut += 1;
      return {
        id: "QR-2026-" + String(1100 + nomorUrut).padStart(4, "0"),
        waktu: tanggal(d2) + " " + waktu(d2),
        penerbit: "Uji Coba",
        metode: dinamis ? "QRIS Dinamis" : "QRIS Statis",
        nominal: nominal,
        mdr: Math.round(nominal * 0.007),
        rrn: String(Math.floor(100000000000 + prng(Date.now())() * 899999999999)).slice(0, 12),
        status: "Berhasil"
      };
    }
    function simpanPembayaran() {
      var r = barisBaru();
      Qris.baris.unshift(r);
      var tb = $("#qris-riwayat");
      if (tb) {
        tb.insertAdjacentHTML("afterbegin", barisHTML(r));
        var t = $("#tabel-qris");
        if (t && t.__dt) t.__dt.reload();
      }
      ringkas(hitungRingkas(Qris.baris));
      toast(T("Pembayaran masuk") + " " + rupiah(r.nominal) + " — " + T("status") + " " + T("Berhasil") + ".", "success");
      window.I18n && window.I18n.apply && window.I18n.apply();
    }
    $$('[data-qris="bayar"]').forEach(function (b) { b.addEventListener("click", simpanPembayaran); });
    var csv = $("#qris-csv");
    if (csv) csv.addEventListener("click", function () {
      var semua = Qris.baris;
      var head = ["ID", "Waktu", "Penerbit", "Metode", "Nominal", "MDR", "RRN", "Status"];
      var teks = head.join(",") + "\n" + semua.map(function (r) {
        return [r.id, r.waktu, r.penerbit, r.metode, r.nominal, r.mdr, r.rrn, r.status].join(",");
      }).join("\n");
      var url = URL.createObjectURL(new Blob(["\ufeff" + teks], { type: "text/csv;charset=utf-8" }));
      unduh("transaksi-qris.csv", url);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(semua.length + " baris transaksi diunduh sebagai CSV.", "success");
    });

    /* ---- tabel riwayat ---- */
    function barisHTML(r) {
      return '<tr data-search="' + esc(r.id + " " + r.penerbit + " " + r.metode + " " + r.status + " " + r.rrn) + '">' +
        '<td class="font-mono text-[11px]">' + esc(r.id) + "</td>" +
        '<td class="whitespace-nowrap">' + esc(r.waktu) + "</td>" +
        "<td>" + esc(r.penerbit) + "</td>" +
        "<td>" + esc(r.metode) + "</td>" +
        '<td class="text-right tabular-nums" data-order="' + r.nominal + '">' + rupiah(r.nominal) + "</td>" +
        '<td class="text-right tabular-nums" data-order="' + r.mdr + '">' + rupiah(r.mdr) + "</td>" +
        '<td class="text-center"><span class="badge ' + kelasStatus(r.status) + '">' + esc(r.status) + "</span></td>" +
        "</tr>";
    }
    function ringkas(rk) {
      isi($("#qris-stat-transaksi"), String(rk.jumlah));
      isi($("#qris-stat-berhasil"), String(rk.berhasil));
      isi($("#qris-stat-volume"), rupiah(rk.volume));
      isi($("#qris-stat-mdr"), rupiah(rk.mdr));
    }

    var riwayatAwal = riwayatQris(26);
    Qris.baris = riwayatAwal.slice();
    var tb = $("#qris-riwayat");
    if (tb) tb.innerHTML = Qris.baris.map(barisHTML).join("");
    ringkas(hitungRingkas(Qris.baris));

    terapkan();
  }

  /* ================================================= penaung hitung mundur */
  function hentikanHitung() {
    if (Qris.hitung) { clearInterval(Qris.hitung); Qris.hitung = null; }
    if (Kartu.hitung) { clearInterval(Kartu.hitung); Kartu.hitung = null; }
  }
  function mulaiHitung(el, detik) {
    if (!el) return;
    hentikanHitung();
    var sisa = detik;
    var kotakQR = el.closest("[data-qr-kotak]") || el.parentElement;
    function gambarWaktu() {
      isi(el, dua(Math.floor(sisa / 60)) + ":" + dua(sisa % 60));
      if (sisa <= 0) {
        clearInterval(Qris.hitung); Qris.hitung = null;
        if (kotakQR) kotakQR.setAttribute("data-kedaluwarsa", "1");
        isi(el, T("kedaluwarsa"));
      }
    }
    if (kotakQR) kotakQR.setAttribute("data-kedaluwarsa", "0");
    gambarWaktu();
    Qris.hitung = setInterval(function () {
      sisa -= 1;
      gambarWaktu();
    }, 1000);
  }

  /* ============================================================ API publik */
  window.Qris = {
    payload: payload,
    parse: parse,
    crc16: crc16,
    crcSah: crcSah,
    bersih: bersih,
    render: gambar,
    png: pngDataURL,
    kartu: KARTU,
    merchant: MERCHANT,
    riwayatQris: riwayatQris,
    riwayatKartu: riwayatKartu,
    state: { Kartu: Kartu, Qris: Qris },
    versi: "1.0.0"
  };
  window.QrisKartu = Kartu;

  function initSemua() {
    initKartu();
    initQris();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSemua);
  else initSemua();
})();
