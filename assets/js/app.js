/*!
 * app.js — inti template Aurivo Dash
 *  - Renderer ikon lokal (Bootstrap Icons yang dibundel di icons.js)
 *  - State shell (sidebar, tema, skin, panel kontrol) via Alpine store
 *  - Widget Alpine siap pakai: dropdown, tabs, todo, chat, modal, dialog
 *  - Utilitas vanilla: DataTable (cari/sortir/paginasi), kartu (collapse/remove/
 *    fullscreen), animasi angka, progress bar, jam digital, toast
 *  - Semua murni offline: tidak ada request ke CDN mana pun.
 */
(function () {
  "use strict";

  /* ============================================================== storage */
  var LS = {
    get: function (k, fb) {
      try { var v = localStorage.getItem(k); return v === null ? fb : v; } catch (e) { return fb; }
    },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* mode privat */ } }
  };

  /* ================================================================ ikon */
  var ICONS = window.ICONS || {};

  function renderIcons(root) {
    root = root || document;
    var nodes = [];
    if (root.nodeType === 1 && root.matches && root.matches("[data-icon]")) nodes.push(root);
    nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll("i[data-icon], span[data-icon]")));
    nodes.forEach(function (node) {
      var name = node.getAttribute("data-icon");
      var def = ICONS[name];
      if (!def || node.getAttribute("data-icon-done") === name) return;
      var size = node.getAttribute("data-size") || "1em";
      var cls = node.className || "";
      // biarkan kelas utility Tailwind (text-*, h-*, w-*) ikut terbawa ke <svg>
      var keep = cls.split(/\s+/).filter(function (c) { return /^(text-|h-|w-|size-|shrink-|flex-|opacity-|mt-|mb-|ml-|mr-)/.test(c); }).join(" ");
      node.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="' + size + '" height="' + size +
        '" fill="currentColor" aria-hidden="true" focusable="false" class="inline-block align-[-0.125em] ' + keep + '">' + def + "</svg>";
      node.setAttribute("data-icon-done", name);
    });
  }
  window.renderIcons = renderIcons;

  /* Amati DOM agar ikon pada konten dinamis (x-for, DataTable, dsb.) ikut ter-render */
  function watchIcons() {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function (muts) {
      var pending = [];
      muts.forEach(function (m) {
        /* atribut data-icon ikut diamati: Alpine (:data-icon="…") hanya
           mengubah atribut, bukan menambah simpul — tanpa ini ikon dinamis kosong. */
        if (m.type === "attributes") { if (m.target.nodeType === 1) pending.push(m.target); return; }
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1) pending.push(n);
        });
      });
      if (pending.length) pending.forEach(function (n) { renderIcons(n); });
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-icon"] });
  }

  /* ====================================================== Alpine: state UI */
  /* T() — terjemahkan teks JS memakai kamus i18n (fallback: teks aslinya) */
  function T(s) {
    /* Membaca locale lewat store Alpine supaya ekspresi x-text="T(...)"
       ikut dihitung ulang otomatis saat bahasa diganti. */
    try { if (window.Alpine && window.Alpine.store("i18n")) { void window.Alpine.store("i18n").locale; } } catch (e) {}
    return window.I18n && window.I18n.t ? window.I18n.t(s, s) : s;
  }
  window.T = T; // dipakai juga oleh ekspresi Alpine x-text="T(...)" di semua halaman

  document.addEventListener("alpine:init", function () {
    var Alpine = window.Alpine;

    /* ---- store utama: tema, skin, sidebar ---- */
    Alpine.store("ui", {
      collapsed: LS.get("app.collapsed", "false") === "true",
      mobileOpen: false,
      controlPanel: LS.get("app.controlPanel", "false") === "true",
      theme: LS.get("app.theme", "light"),
      skin: LS.get("app.skin", "blue"),
      sidebarMode: LS.get("app.sidebar", "dark"),
      container: LS.get("app.container", "fluid"),
      menus: {},

      init: function () {
        this.applyTheme(this.theme);
        this.applySkin(this.skin);
        this.applySidebar(this.sidebarMode);
      },
      /* sidebar */
      toggleCollapsed: function () {
        this.collapsed = !this.collapsed;
        LS.set("app.collapsed", String(this.collapsed));
      },
      toggleMobile: function () { this.mobileOpen = !this.mobileOpen; },
      closeMobile: function () { this.mobileOpen = false; },
      /* panel kontrol kanan */
      toggleControl: function () {
        this.controlPanel = !this.controlPanel;
        LS.set("app.controlPanel", String(this.controlPanel));
      },
      /* tema */
      applyTheme: function (t) {
        this.theme = t;
        document.documentElement.setAttribute("data-theme", t);
        LS.set("app.theme", t);
        window.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme: t } }));
      },
      setTheme: function (t) { this.applyTheme(t); },
      toggleTheme: function () { this.applyTheme(this.theme === "dark" ? "light" : "dark"); },
      /* skin warna (mengikuti tema AdminLTE) */
      applySkin: function (s) {
        this.skin = s;
        document.documentElement.setAttribute("data-skin", s);
        LS.set("app.skin", s);
        window.dispatchEvent(new CustomEvent("theme:changed", { detail: { skin: s } }));
      },
      setSkin: function (s) { this.applySkin(s); },
      /* sidebar gelap / terang */
      applySidebar: function (mode) {
        this.sidebarMode = mode;
        document.documentElement.setAttribute("data-sidebar", mode);
        LS.set("app.sidebar", mode);
        window.dispatchEvent(new CustomEvent("theme:changed", { detail: { sidebar: mode } }));
      },
      setSidebar: function (mode) { this.applySidebar(mode); },
      /* Preset siap pakai untuk perbankan (kombinasi tema + skin + sidebar) */
      presets: [
        { id: "klasik",   label: "Perbankan Klasik",  desc: "Terang · navy · sidebar putih",  theme: "light", skin: "navy",     sidebar: "light" },
        { id: "private",  label: "Private Banking",   desc: "Gelap · navy malam · emas",      theme: "dark",  skin: "midnight", sidebar: "dark"  },
        { id: "wealth",   label: "Wealth & Syariah",  desc: "Terang · zamrud · emas",         theme: "light", skin: "emerald",  sidebar: "dark"  },
        { id: "korporat", label: "Korporat Marun",    desc: "Terang · marun · emas",          theme: "light", skin: "burgundy", sidebar: "dark"  },
        { id: "fintech",  label: "Fintech Modern",    desc: "Terang · grafit · biru langit",  theme: "light", skin: "graphite", sidebar: "light" },
        { id: "premium",  label: "Gold Premium",      desc: "Terang · emas · hitam",          theme: "light", skin: "gold",     sidebar: "dark"  }
      ],
      applyPreset: function (p) {
        this.applyTheme(p.theme);
        this.applySkin(p.skin);
        this.applySidebar(p.sidebar);
      },
      /* lebar konten */
      setContainer: function (c) {
        this.container = c;
        LS.set("app.container", c);
      },
      /* treeview sidebar */
      menuOpen: function (name) { return !!this.menus[name]; },
      toggleMenu: function (name) { this.menus[name] = !this.menus[name]; },
      openMenu: function (name) { this.menus[name] = true; },
      reset: function () {
        this.applyTheme("light");
        this.applySkin("blue");
        this.applySidebar("dark");
        this.collapsed = false;
        this.container = "fluid";
        LS.set("app.collapsed", "false");
      }
    });

    /* State shell disinkronkan ke atribut <body> supaya CSS bisa memakainya */
    Alpine.effect(function () {
      var ui = Alpine.store("ui");
      document.body.setAttribute("data-collapsed", String(ui.collapsed));
      document.body.setAttribute("data-open", String(ui.mobileOpen));
    });

    /* ---- store toast ---- */
    Alpine.store("toasts", {
      items: [],
      seq: 0,
      push: function (message, type, title) {
        var id = ++this.seq;
        this.items.push({ id: id, message: message, type: type || "primary", title: title || null });
        var self = this;
        setTimeout(function () { self.remove(id); }, 4200);
      },
      remove: function (id) {
        this.items = this.items.filter(function (t) { return t.id !== id; });
      }
    });

    /* ---- store dialog konfirmasi ---- */
    Alpine.store("dialog", {
      open: false, title: "", message: "", confirmText: T("Ya, lanjutkan"), cancelText: "Batal", tone: "danger", _cb: null,
      ask: function (opts) {
        this.title = opts.title || T("Konfirmasi");
        this.message = opts.message || T("Anda yakin?");
        this.confirmText = opts.confirmText || T("Ya, lanjutkan");
        this.cancelText = opts.cancelText || "Batal";
        this.tone = opts.tone || "danger";
        this._cb = opts.onConfirm || null;
        this.open = true;
      },
      confirm: function () { var cb = this._cb; this.open = false; this._cb = null; if (cb) cb(); },
      cancel: function () { this.open = false; this._cb = null; }
    });

    /* ---- komponen Alpine yang bisa dipakai ulang ---- */
    Alpine.data("dropdown", function () {
      return {
        open: false,
        toggle: function () { this.open = !this.open; },
        close: function () { this.open = false; }
      };
    });

    Alpine.data("tabs", function (initial) {
      return {
        active: initial || 0,
        is: function (i) { return this.active === i; },
        select: function (i) {
          this.active = i;
          var self = this;
          this.$nextTick(function () {
            if (window.Charts) { window.Charts.autoInit(self.$el); window.Charts.refreshAll(); }
          });
        }
      };
    });

    Alpine.data("todoList", function (initial) {
      return {
        items: initial || [],
        draft: "",
        add: function () {
          if (!this.draft.trim()) return;
          this.items.unshift({ text: this.draft.trim(), done: false });
          this.draft = "";
        },
        toggle: function (item) { item.done = !item.done; },
        remove: function (i) { this.items.splice(i, 1); },
        get remaining() { return this.items.filter(function (i) { return !i.done; }).length; }
      };
    });

    Alpine.data("chatBox", function (initial) {
      return {
        messages: initial || [],
        draft: "",
        send: function () {
          if (!this.draft.trim()) return;
          this.messages.push({ me: true, text: this.draft.trim(), time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) });
          this.draft = "";
          var self = this;
          setTimeout(function () {
            self.messages.push({ me: false, text: "Terima kasih, pesan Anda sudah kami terima. Tim support akan membalas maksimal 1x24 jam.", time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) });
            self.scroll();
          }, 900);
          this.scroll();
        },
        scroll: function () {
          var self = this;
          this.$nextTick(function () { var b = self.$refs.chatBody; if (b) b.scrollTop = b.scrollHeight; });
        }
      };
    });

    /* counter angka (dipakai small-box & statistik) */
    Alpine.data("counter", function (target, opts) {
      opts = opts || {};
      return {
        value: 0,
        init: function () {
          var self = this;
          var dur = opts.duration || 900, dec = opts.decimals || 0, start = performance.now();
          function step(now) {
            var p = Math.min(1, (now - start) / dur);
            var eased = 1 - Math.pow(1 - p, 3);
            self.value = target * eased;
            if (p < 1) requestAnimationFrame(step);
            else self.value = target;
          }
          requestAnimationFrame(step);
        },
        fmt: function () {
          var v = this.value;
          var en = window.I18n && window.I18n.locale === "en";
          var loc = en ? "en-US" : "id-ID";
          if (opts.currency) return (en ? "IDR " : "Rp ") + Math.round(v).toLocaleString(loc);
          return v.toLocaleString(loc, { minimumFractionDigits: opts.decimals || 0, maximumFractionDigits: opts.decimals || 0 });
        }
      };
    });
  });

  /* =============================================================== toast */
  window.toast = function (message, type, title) {
    if (window.Alpine && window.Alpine.store("toasts")) {
      window.Alpine.store("toasts").push(message, type, title);
    } else {
      console.log("[toast:" + (type || "info") + "]", message);
    }
  };
  window.confirmDialog = function (opts) {
    if (window.Alpine && window.Alpine.store("dialog")) window.Alpine.store("dialog").ask(opts || {});
  };

  /* Mode layar penuh (aman dipanggil di dalam iframe / tanpa izin) */
  window.toggleFullscreen = function () {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      else window.toast(T("Peramban ini tidak mendukung mode layar penuh."), "warning", T("Layar penuh"));
    } catch (e) {
      window.toast(T("Mode layar penuh diblokir oleh peramban/kontainer."), "warning", T("Layar penuh"));
    }
  };

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
        return;
      }
    } catch (e) { /* jatuh ke fallback */ }
    fallbackCopy(text);
  }
  window.copyText = copyText;
  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    } catch (e) { console.log("[copy]", text); }
  }

  /* ============================================================= format */
  window.App = window.App || {};
  Object.assign(window.App, {
    rupiah: function (n, withPrefix) {
      var s = Math.round(n).toLocaleString("id-ID");
      return withPrefix === false ? s : "Rp " + s;
    },
    angka: function (n, dec) {
      return Number(n).toLocaleString("id-ID", { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
    },
    tanggal: function (d, withTime) {
      var dt = d instanceof Date ? d : new Date(d);
      var opt = { day: "2-digit", month: "short", year: "numeric" };
      if (withTime) { opt.hour = "2-digit"; opt.minute = "2-digit"; }
      return dt.toLocaleDateString("id-ID", opt).replace(/\./g, ":");
    },
    debounce: function (fn, ms) {
      var t;
      return function () {
        var a = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, a); }, ms || 200);
      };
    },
    storage: LS
  });

  /* ========================================================== DataTable */
  function DataTable(table, opts) {
    opts = opts || {};
    var card = table.closest(".card");
    var tbody = table.tBodies[0];
    var allRows = Array.prototype.slice.call(tbody.rows).filter(function (r) { return !r.hasAttribute("data-dt-empty"); });
    var self = {
      table: table, page: 1, perPage: opts.perPage || 10, query: "", sortIndex: null, sortDir: 1,
      search: opts.search ? document.querySelector(opts.search) : (card && card.querySelector("[data-dt-search]")),
      length: opts.length ? document.querySelector(opts.length) : (card && card.querySelector("[data-dt-length]")),
      info: opts.info ? document.querySelector(opts.info) : (card && card.querySelector("[data-dt-info]")),
      pager: opts.pagination ? document.querySelector(opts.pagination) : (card && card.querySelector("[data-dt-pagination]")),
      emptyRow: tbody.querySelector("[data-dt-empty]"),
      onRowClick: opts.onRowClick || null
    };

    function cellValue(row, index) {
      var cell = row.cells[index];
      if (!cell) return "";
      return (cell.getAttribute("data-order") || cell.textContent || "").trim();
    }
    function compare(a, b) {
      var va = cellValue(a, self.sortIndex), vb = cellValue(b, self.sortIndex);
      var na = parseFloat(va.replace(/[^0-9,.\-]/g, "").replace(/\./g, "").replace(",", "."));
      var nb = parseFloat(vb.replace(/[^0-9,.\-]/g, "").replace(/\./g, "").replace(",", "."));
      var numeric = !isNaN(na) && !isNaN(nb) && /\d/.test(va);
      if (numeric) return (na - nb) * self.sortDir;
      return va.localeCompare(vb, "id", { sensitivity: "base" }) * self.sortDir;
    }
    function apply() {
      var rows = allRows.slice();
      // pencarian
      if (self.query) {
        var q = self.query.toLowerCase();
        rows = rows.filter(function (r) {
          var hay = r.getAttribute("data-search") || r.textContent;
          return hay.toLowerCase().indexOf(q) !== -1;
        });
      }
      // sortir
      if (self.sortIndex !== null) rows.sort(compare);
      // urutan DOM
      rows.forEach(function (r, i) { tbody.appendChild(r); if (i !== allRows.length - 1) tbody.appendChild(r); });
      // paginasi
      var total = rows.length;
      var maxPage = Math.max(1, Math.ceil(total / self.perPage));
      if (self.page > maxPage) self.page = maxPage;
      var start = (self.page - 1) * self.perPage;
      var end = start + self.perPage;
      allRows.forEach(function (r) { r.style.display = "none"; });
      rows.forEach(function (r, i) { r.style.display = i >= start && i < end ? "" : "none"; });
      if (self.emptyRow) self.emptyRow.style.display = total === 0 ? "" : "none";

      if (self.info) {
        self.info.textContent = total === 0
          ? T("Menampilkan 0 dari 0 entri")
          : T("Menampilkan " + (start + 1) + "–" + Math.min(end, total) + " dari " + total + " entri") +
            (self.query ? " (difilter dari " + allRows.length + " entri)" : "");
      }
      renderPager(maxPage);
      updateSortIcons();
      if (typeof opts.afterRender === "function") opts.afterRender(self, rows.filter(function (r) { return r.style.display !== "none"; }));
    }
    function renderPager(maxPage) {
      if (!self.pager) return;
      self.pager.innerHTML = "";
      function btn(label, page, opts2) {
        opts2 = opts2 || {};
        var b = document.createElement("button");
        b.className = "btn btn-sm " + (opts2.active ? "btn-primary" : "btn-light");
        b.innerHTML = label;
        if (opts2.disabled) { b.disabled = true; }
        else b.addEventListener("click", function () { self.page = page; apply(); });
        return b;
      }
      self.pager.appendChild(btn('<i data-icon="chevron-left" data-size="12"></i>', Math.max(1, self.page - 1), { disabled: self.page === 1 }));
      var from = Math.max(1, self.page - 2), to = Math.min(maxPage, from + 4);
      from = Math.max(1, to - 4);
      for (var p = from; p <= to; p++) self.pager.appendChild(btn(String(p), p, { active: p === self.page }));
      self.pager.appendChild(btn('<i data-icon="chevron-right" data-size="12"></i>', Math.min(maxPage, self.page + 1), { disabled: self.page === maxPage }));
      renderIcons(self.pager);
    }
    function updateSortIcons() {
      table.querySelectorAll("thead th[data-sort]").forEach(function (th, i) {
        var ind = th.querySelector(".sort-indicator");
        if (!ind) {
          ind = document.createElement("i");
          ind.className = "sort-indicator";
          ind.setAttribute("data-icon", "arrow-down-up");
          ind.setAttribute("data-size", "11");
          th.appendChild(ind);
        }
        if (ind.getAttribute("data-icon-done") !== "arrow-down-up") renderIcons(ind);
        ind.classList.toggle("on", self.sortIndex === i);
        if (self.sortIndex === i) {
          ind.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="11" height="11" fill="currentColor" class="inline-block">' +
            (ICONS[self.sortDir === 1 ? "caret-up-fill" : "caret-down-fill"] || ICONS["arrow-down-up"] || "") + "</svg>";
        }
      });
    }

    // header sortir
    table.querySelectorAll("thead th[data-sort]").forEach(function (th, index) {
      th.addEventListener("click", function () {
        if (self.sortIndex === index) self.sortDir = -self.sortDir;
        else { self.sortIndex = index; self.sortDir = 1; }
        apply();
      });
    });
    // cari
    if (self.search) {
      self.search.addEventListener("input", App.debounce(function () {
        self.query = self.search.value.trim();
        self.page = 1;
        apply();
      }, 180));
    }
    // jumlah per halaman
    if (self.length) {
      self.length.addEventListener("change", function () {
        self.perPage = parseInt(self.length.value, 10) || 10;
        self.page = 1;
        apply();
      });
    }
    // checkbox pilih baris
    var checkAll = card && card.querySelector("[data-dt-checkall]");
    if (checkAll) {
      checkAll.addEventListener("change", function () {
        tbody.querySelectorAll("tr").forEach(function (r) {
          if (r.style.display === "none") return;
          var cb = r.querySelector("[data-dt-check]");
          if (cb) { cb.checked = checkAll.checked; r.classList.toggle("selected", checkAll.checked); }
        });
        updateSel();
      });
    }
    tbody.addEventListener("change", function (e) {
      var cb = e.target.closest("[data-dt-check]");
      if (!cb) return;
      cb.closest("tr").classList.toggle("selected", cb.checked);
      updateSel();
    });
    function updateSel() {
      var checked = tbody.querySelectorAll("[data-dt-check]:checked").length;
      var box = card && card.querySelector("[data-dt-selected]");
      if (box) box.textContent = checked;
      var bar = card && card.querySelector("[data-dt-bulkbar]");
      if (bar) bar.style.display = checked > 0 ? "" : "none";
    }
    if (self.onRowClick) {
      tbody.addEventListener("click", function (e) {
        var tr = e.target.closest("tr");
        if (tr && !e.target.closest("a,button,input,select")) self.onRowClick(tr);
      });
    }
    self.reload = function () {
      allRows = Array.prototype.slice.call(tbody.rows).filter(function (r) { return !r.hasAttribute("data-dt-empty"); });
      self.page = 1;
      apply();
    };
    self.apply = apply;
    self.rows = allRows;
    apply();
    return self;
  }
  window.DataTable = DataTable;

  /* ====================================================== fitur kartu */
  function bindCardTools(root) {
    (root || document).addEventListener("click", function (e) {
      var btn = e.target.closest("[data-card-tool]");
      if (!btn) return;
      var card = btn.closest(".card");
      if (!card) return;
      var action = btn.getAttribute("data-card-tool");
      if (action === "collapse") {
        var body = card.querySelector(".card-body"), foot = card.querySelector(".card-footer");
        var collapsed = body && body.hasAttribute("hidden");
        if (body) body.toggleAttribute("hidden", !collapsed);
        if (foot) foot.toggleAttribute("hidden", !collapsed);
        btn.setAttribute("aria-expanded", String(collapsed));
        if (collapsed && window.Charts) { window.Charts.autoInit(card); window.Charts.refreshAll(); }
      } else if (action === "remove") {
        window.confirmDialog({
          title: T("Hapus panel?"), message: T("Panel ini akan dihapus dari halaman (demo, tidak permanen)."),
          confirmText: "Hapus", tone: "danger",
          onConfirm: function () { card.remove(); window.toast(T("Panel dihapus."), "danger"); }
        });
      } else if (action === "fullscreen") {
        card.classList.toggle("card-maximized");
        var on = card.classList.contains("card-maximized");
        btn.setAttribute("data-icon", on ? "fullscreen-exit" : "arrows-fullscreen");
        btn.removeAttribute("data-icon-done");
        renderIcons(btn);
        if (window.Charts) setTimeout(function () { window.Charts.refreshAll(); }, 120);
      } else if (action === "refresh") {
        var panel = card.querySelector("[data-refresh-target]") || card.querySelector(".card-body");
        if (!panel) return;
        var ov = document.createElement("div");
        ov.className = "overlay";
        ov.innerHTML = '<div class="spinner"></div>';
        card.style.position = "relative";
        card.appendChild(ov);
        setTimeout(function () {
          ov.remove();
          if (window.Charts) { window.Charts.autoInit(card); window.Charts.refreshAll(); }
          window.toast(T("Data diperbarui."), "success", "Berhasil");
        }, 900);
      }
    });
    // tombol generik
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-print]");
      if (t) window.print();
      var btt = e.target.closest("[data-back-to-top]");
      if (btt) window.scrollTo({ top: 0, behavior: "smooth" });
      var conf = e.target.closest("[data-confirm]");
      if (conf) {
        e.preventDefault();
        window.confirmDialog({
          title: conf.getAttribute("data-confirm-title") || T("Konfirmasi"),
          message: conf.getAttribute("data-confirm") || T("Lanjutkan aksi ini?"),
          tone: conf.getAttribute("data-confirm-tone") || "danger",
          confirmText: conf.getAttribute("data-confirm-ok") || T("Ya, lanjutkan"),
          onConfirm: function () {
            window.toast(T("Aksi dijalankan (demo)."), "success");
            if (window.Alpine && window.Alpine.store("dialog")) { /* hapus baris tabel bila diminta */ }
            var tr = null; // baris tabel dihapus bila tombol berada di dalam tabel
            if (tr) tr.remove();
          }
        });
      }
      var copy = e.target.closest("[data-copy]");
      if (copy) {
        var text = copy.getAttribute("data-copy");
        copyText(text);
        window.toast(T("Disalin ke clipboard."), "info", "Salin");
      }
    });
  }

  /* ============================================ animasi kecil saat render */
  /* saat mencetak: pastikan semua progress bar terisi penuh */
  window.addEventListener("beforeprint", function () {
    document.querySelectorAll("[data-progress]").forEach(function (b) {
      b.style.width = b.getAttribute("data-progress") + "%";
    });
  });

  function bindAnimations() {
    // progress bar: isi saat terlihat
    var bars = document.querySelectorAll("[data-progress]");
    if (bars.length && window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.style.width = en.target.getAttribute("data-progress") + "%";
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.2 });
      bars.forEach(function (b) { b.style.width = "0%"; io.observe(b); });
    }
  }

  /* ======================================================== jam digital */
  function bindClock() {
    var nodes = document.querySelectorAll("[data-clock]");
    if (!nodes.length) return;
    function tick() {
      var d = new Date();
      var time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":");
      var date = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      nodes.forEach(function (n) {
        n.textContent = n.hasAttribute("data-clock-date") ? date : time;
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ======================================== tombol lihat mode tabel dsb. */
  function bindToolbars() {
    // group tombol toggle (mis. tampilan tabel/grid)
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-toggle-group]");
      if (!b) return;
      var group = b.getAttribute("data-toggle-group");
      var target = b.getAttribute("data-toggle-target");
      document.querySelectorAll('[data-toggle-group="' + group + '"]').forEach(function (x) { x.classList.toggle("active", x === b); });
      if (target) {
        var t = document.querySelector(target);
        if (t) {
          t.classList.toggle("hidden", b.getAttribute("data-toggle-value") !== "grid");
        }
      }
    });
  }

  /* ============================================ navigasi: tandai aktif */
  function markActiveNav() {
    var here = location.pathname.split("/").pop() || "index.html";
    var hash = location.hash || "";

    document.querySelectorAll(".side-link[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var i = href.indexOf("#");
      var bagian = i > -1 ? href.slice(i) : "";              // "#tabel-sticky"
      if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      /* Bandingkan jalur penuh, bukan hanya nama berkas: halaman di subfolder
         (mis. ../mobile/index.html) tidak boleh ikut menyala di pages/index.html. */
      var halamanSama = false;
      try {
        var tujuan = new URL(href, location.href);
        var kini = new URL(location.href);
        halamanSama = tujuan.origin === kini.origin && tujuan.pathname === kini.pathname;
      } catch (e) {
        halamanSama = href.split("/").pop().split("#")[0] === here;
      }

      /* Aturan aktif:
         - tautan tanpa anchor  → aktif bila berkasnya sama DAN tidak ada anchor di URL
         - tautan ber-anchor    → aktif hanya bila anchor-nya cocok
         Jadi "Data Table" dan "Kepala Tabel Sticky" tidak menyala bersamaan. */
      var match = bagian ? (halamanSama && bagian === hash) : (halamanSama && !hash);
      a.classList.toggle("active", match);

      if (halamanSama) {
        // buka semua treeview induknya (dipakai mis. menu Tables)
        var wrap = a.closest(".submenu-wrap");
        while (wrap) {
          var name = wrap.getAttribute("data-menu");
          if (name && window.Alpine && window.Alpine.store("ui")) window.Alpine.store("ui").openMenu(name);
          wrap = wrap.parentElement ? wrap.parentElement.closest(".submenu-wrap") : null;
        }
      }
    });

    // navbar (menu atas) juga
    document.querySelectorAll("[data-nav-match]").forEach(function (a) {
      var file = (a.getAttribute("href") || "").split("/").pop();
      a.classList.toggle("active", file === here);
    });
  }
  window.markActiveNav = markActiveNav;

  /* ================================================= shortcut keyboard */
  function bindShortcuts() {
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        var s = document.querySelector("[data-global-search]");
        if (s) s.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        var ui = window.Alpine && window.Alpine.store("ui");
        if (ui) ui.toggleCollapsed();
      }
      if (!typing && e.key === ".") {
        var ui2 = window.Alpine && window.Alpine.store("ui");
        if (ui2) ui2.toggleTheme();
      }
    });
  }

  /* ============================================== DataTable & inisialisasi */
  function initTables(root) {
    (root || document).querySelectorAll("table[data-datatable]").forEach(function (t) {
      if (t.__dt) return;
      t.__dt = new DataTable(t);
    });
  }
  window.initTables = initTables;

  /* ============================================== header halaman yang menempel
     Header (breadcrumb + judul + aksi) memakai position:sticky di CSS. Di sini
     kita hanya (a) menandai kapan ia benar-benar menempel supaya bisa diberi
     bayangan/pemisah, dan (b) membagikan tingginya lewat --header-h agar
     elemen sticky lain (mis. kepala tabel) berhenti di bawahnya, bukan di
     belakangnya. */
  function bindStickyHeader() {
    var header = document.querySelector("[data-sticky-header]");
    if (!header) return;
    var navbar = document.querySelector(".app-navbar");
    var root = document.documentElement;
    var ticking = false;

    function measure() {
      ticking = false;
      var navH = navbar ? navbar.offsetHeight : 0;
      var h = Math.round(header.getBoundingClientRect().height);
      if (root.style.getPropertyValue("--header-h") !== h + "px") {
        root.style.setProperty("--header-h", h + "px");
      }
      // "menempel" = sedang di-scroll DAN sudah mentok di bawah navbar
      var stuck = window.scrollY > 1 && header.getBoundingClientRect().top <= navH + 1;
      var now = stuck ? "true" : "false";
      if (header.getAttribute("data-stuck") !== now) header.setAttribute("data-stuck", now);
    }
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("theme:changed", schedule);
    window.addEventListener("i18n:changed", schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
    // tinggi header bisa berubah setelah font & ikon selesai dimuat
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    setTimeout(schedule, 300);
  }

  /* ============================================================ bootstrap */
  function boot() {
    renderIcons(document);
    watchIcons();
    bindCardTools(document);
    bindAnimations();
    bindClock();
    bindToolbars();
    bindShortcuts();
    bindStickyHeader();
    window.addEventListener("hashchange", markActiveNav);
    initTables(document);
    if (window.Charts) window.Charts.autoInit(document);
    document.addEventListener("alpine:initialized", function () {
      markActiveNav();
      renderIcons(document);
    });
    window.addEventListener("app:refresh", function () {
      renderIcons(document); initTables(document); bindAnimations();
      if (window.Charts) window.Charts.autoInit(document);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
