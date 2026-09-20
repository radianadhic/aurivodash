/*
 * i18n engine — penerjemah ringan tanpa dependensi (bagian dari template).
 * Digabung oleh tools/build-i18n.mjs menjadi assets/js/i18n.js bersama kamusnya.
 *
 * Cara kerja: setiap teks dan atribut di halaman dicocokkan PERSIS dengan kamus.
 * Teks sumber (Indonesia) dipakai sebagai kunci — jadi menambah terjemahan cukup
 * menambah satu baris di src/i18n/en.json, tanpa harus menyunting HTML.
 */
(function () {
  "use strict";

  var ATTRS = ["placeholder", "title", "aria-label", "alt", "label"];
  // Elemen yang isinya dikelola Alpine (x-text/x-html) atau bukan teks biasa.
  var SKIP_SEL = "script,style,noscript,code,pre,kbd,samp,textarea,template,[data-i18n-skip],[x-text],[x-html]";
  var EN = (window.I18N_DICT_EN || {});

  /* Pola dinamis (regex) untuk teks yang berulang dengan angka. */
  var PATTERNS = [
    [/^(\d+)\s*menit lalu$/, "$1 minutes ago"],
    [/^(\d+)\s*jam lalu$/, "$1 hours ago"],
    [/^(\d+)\s*hari lalu$/, "$1 days ago"],
    [/^(\d+)\s*menit$/, "$1 minutes"],
    [/^(\d+)\s*jam$/, "$1 hours"],
    [/^(\d+)\s*hari$/, "$1 days"],
    [/^(\d+) detik lalu$/, "$1 seconds ago"],
    [/^Baru saja$/, "Just now"],
    [/^Halaman (\d+)$/, "Page $1"],
    [/^Menampilkan (\d+)–(\d+) dari (\d+) entri$/, "Showing $1–$2 of $3 entries"],
    [/^Menampilkan ([\d.,]+) dari ([\d.,]+) entri \((\d+)%\)$/, "Showing $1 of $2 entries ($3%)"],
    [/^(\d[\d.,]*) baris$/, "$1 rows"],
    [/^(\d+) ikon$/, "$1 icons"],
    [/^(\d+) detik lalu$/, "$1 seconds ago"],
    [/^kemarin(,|$)/, "yesterday$1"],
    [/^Ada (\d+) notifikasi belum dibaca\.$/, "There are $1 unread notifications."],
    [/^(\d+) kartu$/, "$1 cards"],
    [/^(\d+) tugas$/, "$1 tasks"],
    [/^Menampilkan (\d+) dari (\d+) entri$/, "Showing $1 of $2 entries"],
    [/^(\d+) tugas belum selesai dari (\d+) total$/, "$1 of $2 tasks still open"],
    [/^(\d+) ikon ditampilkan dari (\d+) tersedia$/, "$1 of $2 icons shown"],
    [/^Berkas dipilih: (.+)$/, "Selected file: $1"],
    [/^Berkas: (.+)$/, "File: $1"],
    [/^(\d+) lampiran$/, "$1 attachments"],
    [/^(\d+) orang$/, "$1 people"],
    [/^(\d+)[–-](\d+) orang$/, "$1–$2 people"],
    [/^(\d+)[–-](\d+) orang$/, "$1–$2 people"],
    [/^(\d+) pesan$/, "$1 messages"],
    [/^(\d+) notifikasi$/, "$1 notifications"],
    [/^(\d+) berkas$/, "$1 files"],
    [/^(\d+) pelanggan$/, "$1 customers"],
    [/^(\d+) produk$/, "$1 products"],
    [/^Dari tanggal$/, "From date"],
    /* MiniGrid: baris info, pager, dan statistik DOM */
    [/^(\d+)[–-](\d+) dari (\d+) \/ (\d+) · pilih (\d+)$/, "$1–$2 of $3 / $4 · $5 selected"],
    [/^(\d+)[–-](\d+) dari (\d+) \/ (\d+)$/, "$1–$2 of $3 / $4"],
    [/^(\d+)[–-](\d+) dari (\d+) · pilih (\d+)$/, "$1–$2 of $3 · $4 selected"],
    [/^(\d+)[–-](\d+) dari (\d+)$/, "$1–$2 of $3"],
    [/^ms · (\d+) baris di DOM$/, "ms · $1 rows in DOM"],
    [/^(\d+) baris di DOM$/, "$1 rows in DOM"],
    [/^Sampai tanggal$/, "To date"],
    /* Pusat notifikasi (dashboard + mobile) */
    [/^(\d+) dari (\d+) notifikasi ditampilkan$/, "$1 of $2 notifications shown"],
    [/^(\d+) notifikasi ditampilkan$/, "$1 notifications shown"],
    [/^(\d+) notifikasi baru$/, "$1 new notifications"],
    [/^(\d+) notifikasi tersimpan di peramban ini$/, "$1 notifications stored in this browser"],
    [/^(\d+) belum dibaca$/, "$1 unread"],
    [/^(\d+) dipilih$/, "$1 selected"],
    [/^(\d+) notifikasi ditandai dibaca\.$/, "$1 notifications marked as read"],
    [/^(\d+) notifikasi dihapus\.$/, "$1 notifications deleted"],
    [/^(\d+) notifikasi terbaca dihapus\.$/, "$1 read notifications deleted"],
    [/^PIN saat ini: (.+)$/, "Current PIN: $1"],
    [/^Berikutnya (.+)$/, "Next $1"],
    [/^Terakhir: (.+)$/, "Last: $1"],
    [/^(.+) · durasi (.+)$/, "$1 · duration $2"],
    [/^(\d+) mnt (\d+) dtk$/, "$1 min $2 s"],
    [/^(\d+) detik$/, "$1 seconds"],
    [/^durasi (.+)$/, "duration $1"],
    [/^(\d+) menit lagi$/, "$1 minutes left"],
    [/^Hari ini (.+)$/, "Today $1"],
    /* Scheduler (dashboard) */
    [/^(\d+) job dijadwalkan$/, "$1 jobs scheduled"],
    [/^(\d+) job ditampilkan$/, "$1 jobs shown"],
    [/^Hari ini (.+) · (\d+) job dijadwalkan$/, "Today $1 · $2 jobs scheduled"],
    [/^(\d+) notifikasi jadwal$/, "$1 schedule notifications"],
    [/^(\d+) job jatuh tempo$/, "$1 jobs due"],
    /* Aplikasi nasabah: tagihan, top up, jadwal */
    [/^(\d+) tagihan menunggu$/, "$1 bills pending"],
    [/^Total (.+) · jatuh tempo terdekat (.+)$/, "Total $1 · nearest due $2"],
    [/^(.+) · saldo (.+)$/, "$1 · balance $2"],
    [/^(.+) · masa aktif (.+)$/, "$1 · valid for $2"],
    [/^(\d+) jadwal aktif$/, "$1 active schedules"],
    [/^(\d+) total jadwal$/, "$1 schedules total"],
    [/^(\d+) jadwal aktif · berikutnya (.+)$/, "$1 active schedules · next $2"],
    [/^(\d+) belum dibaca dari (\d+) notifikasi$/, "$1 unread of $2 notifications"],
    [/^Setiap hari (.+)$/, "Every day at $1"],
    [/^Setiap (Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu) (.+)$/, "Every $1 at $2"]
  ];

  /* Nama bulan & hari versi Indonesia → Inggris */
  var MONTHS = { Jan: "Jan", Feb: "Feb", Mar: "Mar", Apr: "Apr", Mei: "May", Jun: "Jun", Jul: "Jul", Agu: "Aug", Sep: "Sep", Okt: "Oct", Nov: "Nov", Des: "Dec" };
  var DAYS = { Sen: "Mon", Sel: "Tue", Rab: "Wed", Kam: "Thu", Jum: "Fri", Sab: "Sat", Min: "Sun",
    Senin: "Monday", Selasa: "Tuesday", Rabu: "Wednesday", Kamis: "Thursday", Jumat: "Friday", Sabtu: "Saturday", Minggu: "Sunday" };

  function swapWords(str) {
    return str
      .replace(/\b(Mei|Agu|Okt|Des|Jan|Feb|Mar|Apr|Jun|Jul|Sep|Nov)\b/g, function (m) { return MONTHS[m] || m; })
      .replace(/\b(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Sen|Sel|Rab|Kam|Jum|Sab|Min)\b/g, function (m) { return DAYS[m] || m; })
      .replace(/\bdetik\b/g, "sec").replace(/\bdtk\b/g, "s").replace(/\bmnt\b/g, "min")
      .replace(/\bJatuh tempo\b/g, "Due").replace(/\bjatuh tempo\b/g, "due")
      .replace(/\bmasa aktif\b/g, "valid until").replace(/\bsaldo\b/g, "balance")
      .replace(/\b(Hari ini|Kemarin|Besok)\b/g, function (m) { return ({ "Hari ini": "Today", Kemarin: "Yesterday", Besok: "Tomorrow" })[m]; });
  }

  /* Format angka: 1.284 → 1,284 · 3,42 → 3.42 · Rp → IDR · jt → M · rb → K */
  function swapNumbers(str) {
    var out = str;
    out = out.replace(/^Rp\s/, "IDR ").replace(/(^|[\s(−-])Rp\s/, "$1IDR ");
    if (/(IDR|Rp|%|jt|rb|m³|KB|MB|GB|jam|menit|detik)/.test(out) || /^\d{1,3}(\.\d{3})+$/.test(out) || /^\d+,\d+$/.test(out)) {
      for (var ulang = 0; ulang < 6; ulang++) {              // 3.408.100 → 3,408,100
        var maju = out.replace(/(\d)\.(\d{3})/g, "$1,$2");
        if (maju === out) break;
        out = maju;
      }
      out = out.replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2"); // desimal 3,42 → 3.42
      out = out.replace(/\bjt\b/g, "M").replace(/\brb\b/g, "K");
    }
    return out;
  }

  function lookup(text) {
    var k = text.replace(/\s+/g, " ").trim(); // samakan spasi ganda seperti di kamus
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(EN, k)) return EN[k];
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i][0].test(k)) {
        /* hasil pola ikut dinormalkan: nama hari/bulan + format angka */
        return swapNumbers(swapWords(k.replace(PATTERNS[i][0], PATTERNS[i][1])));
      }
    }
    // pola dinamis: tanggal, jam, angka, mata uang
    var dyn = swapNumbers(swapWords(k));
    if (dyn !== k) return dyn;
    return null;
  }

  function skipped(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    try { return !!el.closest(SKIP_SEL); } catch (e) { return false; }
  }

  /* Simpan teks asli sekali saja supaya bisa kembali ke bahasa Indonesia */
  function remember(node, key, value) {
    if (!node.__i18nSrc) node.__i18nSrc = {};
    if (!(key in node.__i18nSrc)) node.__i18nSrc[key] = value;
    return node.__i18nSrc[key];
  }

  function walk(node, mode) {
    if (node.nodeType === 3) {
      if (skipped(node)) return;
      var raw = node.nodeValue;
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
      if (!m || !m[2]) return;
      var src = remember(node, "text", m[2]);
      var out = mode === "en" ? lookup(src) : src;
      var next = m[1] + (out == null ? src : out) + m[3];
      if (next !== raw) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.matches && node.matches(SKIP_SEL)) return;
    if (mode === "en") {
      for (var i = 0; i < ATTRS.length; i++) {
        var a = ATTRS[i];
        if (node.hasAttribute && node.hasAttribute(a)) {
          var val = node.getAttribute(a);
          var orig = remember(node, "attr:" + a, val);
          var tr = lookup(orig);
          var want = tr == null ? orig : tr;
          if (val !== want) node.setAttribute(a, want);
        }
      }
    } else {
      if (node.__i18nSrc) {
        var keys = Object.keys(node.__i18nSrc);
        for (var j = 0; j < keys.length; j++) {
          var k = keys[j];
          if (k === "text") {
            var mm = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.nodeValue);
            node.nodeValue = (mm ? mm[1] : "") + node.__i18nSrc[k] + (mm ? mm[3] : "");
          } else {
            node.setAttribute(k.slice(5), node.__i18nSrc[k]);
          }
        }
      }
    }
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c, mode);
  }

  /* Judul dokumen: "Dashboard · Aurivo Dash" */
  function translateTitle(mode) {
    var sep = " · ";
    var parts = document.title.split(sep);
    var head = parts[0];
    var tr = mode === "en" ? lookup(head) : (document.__i18nTitle || head);
    if (mode === "en") {
      if (!document.__i18nTitle) document.__i18nTitle = head;
      document.title = (tr == null ? head : tr) + (parts.length > 1 ? sep + parts.slice(1).join(sep) : "");
    } else if (document.__i18nTitle) {
      document.title = document.__i18nTitle + (parts.length > 1 ? sep + parts.slice(1).join(sep) : "");
    }
  }

  var observer = null;

  function apply(locale) {
    var mode = locale === "en" ? "en" : "id";
    document.documentElement.setAttribute("lang", mode);
    if (document.body) walk(document.body, mode);
    translateTitle(mode);
  }

  var I18n = {
    locale: "id",
    available: [
      { id: "id", label: "Bahasa Indonesia", short: "ID" },
      { id: "en", label: "English", short: "EN" }
    ],
    t: function (key, fallback) {
      if (this.locale !== "en") return fallback == null ? key : fallback;
      var tr = lookup(key);
      return tr == null ? (fallback == null ? key : fallback) : tr;
    },
    /* terjemahkan elemen tertentu (dipakai setelah render ulang) */
    apply: function (root) {
      walk(root || document.body, this.locale === "en" ? "en" : "id");
    },
    set: function (locale) {
      this.locale = locale === "en" ? "en" : "id";
      try { localStorage.setItem("app.locale", this.locale); } catch (e) {}
      apply(this.locale);
      window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { locale: this.locale } }));
    },
    toggle: function () { this.set(this.locale === "en" ? "id" : "en"); },
    init: function () {
      try { this.locale = localStorage.getItem("app.locale") === "en" ? "en" : "id"; } catch (e) {}
      apply(this.locale);
      if (window.MutationObserver && !observer) {
        var timer = null;
        observer = new MutationObserver(function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () { apply(I18n.locale); }, 80);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: false });
      }
    }
  };

  window.I18n = I18n;

  /* Store Alpine + registrasi komponen */
  document.addEventListener("alpine:init", function () {
    if (!window.Alpine) return;
    window.Alpine.store("i18n", {
      locale: I18n.locale,
      set: function (l) { I18n.set(l); this.locale = I18n.locale; },
      toggle: function () { this.set(this.locale === "en" ? "id" : "en"); },
      /* dipakai di template: x-text="$store.i18n.t('Teks Indonesia')" */
      t: function (key, fallback) {
        var loc = this.locale; // dibaca agar Alpine ikut memantau perubahan bahasa
        if (loc !== "en") return fallback == null ? key : fallback;
        return I18n.t(key, fallback);
      }
    });
    /* jaga agar $store.i18n.locale selalu sinkron, termasuk bila kode memanggil
       window.I18n.set() langsung (mis. skrip QA atau tombol pintasan keyboard) */
    window.addEventListener("i18n:changed", function (e) {
      var st = window.Alpine.store("i18n");
      if (st && e.detail && st.locale !== e.detail.locale) st.locale = e.detail.locale;
    });
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { I18n.init(); });
  else I18n.init();
})();
