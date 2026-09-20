/*!
 * charts.js — mini chart engine berbasis SVG murni (tanpa library, tanpa CDN).
 * Bagian dari template Aurivo Dash. Ringan, offline, dan otomatis
 * mengikuti warna tema/skin karena membaca CSS variable.
 *
 * Pemakaian deklaratif:
 *   <div class="chart h-64" data-chart="line" data-labels="Jan,Feb,Mar"
 *        data-values="30,45,38" data-height="260"></div>
 *
 * Atau lewat API:
 *   Charts.line(document.getElementById('x'), { labels:[...], series:[...] })
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  /* ---------------------------------------------------------------- utils */
  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  /* Terjemahan teks grafik (label sumbu, nama seri, legenda) memakai I18n bila ada.
     Teks sumber tetap ada di HTML, jadi mengganti bahasa tinggal memicu gambar ulang. */
  function tr(s) {
    if (typeof s !== "string" || !s) return s;
    return window.I18n && typeof window.I18n.t === "function" ? window.I18n.t(s, s) : s;
  }

  function cssVar(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }
  function palette() {
    return {
      primary: cssVar("--c-primary", "#007bff"),
      secondary: cssVar("--c-secondary", "#6c757d"),
      success: cssVar("--c-success", "#28a745"),
      info: cssVar("--c-info", "#17a2b8"),
      warning: cssVar("--c-warning", "#ffc107"),
      danger: cssVar("--c-danger", "#dc3545"),
      dark: cssVar("--c-fg", "#343a40"),
      muted: cssVar("--c-muted", "#7a8794"),
      border: cssVar("--c-border", "#dee2e6"),
      surface: cssVar("--c-card-bg", "#ffffff"),
      fg: cssVar("--c-fg", "#212529")
    };
  }
  function color(name, P) {
    P = P || palette();
    if (!name) return P.primary;
    return P[name] || name;
  }
  function resolveColor(c) {
    if (typeof c === "string" && c.indexOf("var(") === 0) {
      var name = c.slice(4, c.indexOf(")")).trim();
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#007bff";
    }
    return c;
  }
  function toRGBA(col, alpha) {
    var P = palette();
    col = resolveColor(color(col, P));
    var c = document.createElement("canvas").getContext("2d");
    c.fillStyle = col;
    var hex = c.fillStyle; // menormalkan ke #rrggbb
    if (hex.charAt(0) !== "#") return col;
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function tween(host, duration, draw) {
    if (host.__chartCancel) host.__chartCancel();
    var start = performance.now(), raf = 0, cancelled = false;
    function step(now) {
      if (cancelled) return;
      var p = Math.min(1, Math.max(0, (now - start) / duration));  // rAF timestamp bisa sedikit lebih awal dari performance.now()
      draw(easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    host.__chartCancel = function () { cancelled = true; cancelAnimationFrame(raf); };
  }
  function markers() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function niceMax(v) {
    if (v <= 0) return 10;
    var exp = Math.floor(Math.log10(v)), base = Math.pow(10, exp), n = v / base;
    var mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mult * base;
  }
  function fmtNum(v, mode) {
    if (mode === "compact") {
      if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1).replace(".0", "") + "M";
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(".0", "") + "jt";
      if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1).replace(".0", "") + "rb";
      return String(v);
    }
    if (mode === "idr") {
      if (Math.abs(v) >= 1e9) return "Rp " + (v / 1e9).toFixed(1) + " M";
      if (Math.abs(v) >= 1e6) return "Rp " + (v / 1e6).toFixed(1) + " jt";
      if (Math.abs(v) >= 1e3) return "Rp " + (v / 1e3).toFixed(0) + " rb";
      return "Rp " + v;
    }
    if (mode === "percent") return v + "%";
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(2) + "," + c1y.toFixed(2) + " " + c2x.toFixed(2) + "," + c2y.toFixed(2) + " " + p2[0].toFixed(2) + "," + p2[1].toFixed(2);
    }
    return d;
  }
  function linePath(pts) {
    return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ");
  }
  function ensureHost(host) {
    if (typeof host === "string") host = document.querySelector(host);
    if (!host) return null;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    return host;
  }
  function tooltipEl(host) {
    var t = host.querySelector(".chart-tooltip");
    if (!t) { t = document.createElement("div"); t.className = "chart-tooltip"; host.appendChild(t); }
    return t;
  }

  /* ------------------------------------------------------------- registry */
  var REG = new WeakMap(); // host -> {type, cfg, draw}

  function register(host, type, cfg) {
    REG.set(host, { type: type, cfg: cfg });
    draw(host);
  }
  function draw(host) {
    var rec = REG.get(host);
    if (!rec || typeof rec.cfg.render !== "function") return;
    var dur = markers() || rec.cfg.animate === false ? 0 : (rec.cfg.duration || 750);
    if (dur === 0) { rec.cfg.render(host, 1); return; }
    tween(host, dur, function (p) { rec.cfg.render(host, p); });
  }
  function rerenderAll() { document.querySelectorAll(".chart[data-chart]").forEach(function (h) { if (REG.has(h)) draw(h); }); }

  /* ================================================================== LINE */
  function lineChart(host, cfg) {
    host = ensureHost(host);
    if (!host) return null;
    cfg = Object.assign({ labels: [], series: [], smooth: true, height: 260, area: true, ySteps: 4, formatter: null, legend: false, max: null, min: 0 }, cfg);
    var P = palette();
    var state = { guide: null };

    function render(h, progress) {
      clear(h);
      var W = Math.max(160, h.clientWidth || 600);
      var H = cfg.height;
      var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img" });
      var legendOn = cfg.legend;
      var legendH = legendOn ? 26 : 0;
      var pad = { t: 14, r: 14, b: 26 + legendH, l: 46 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var series = cfg.series.filter(function (x) { return x && x.data; });

      var all = [];
      series.forEach(function (x) { all = all.concat(x.data.filter(function (v) { return typeof v === "number"; })); });
      var maxV = cfg.max != null ? cfg.max : niceMax(Math.max.apply(null, all.concat([1])));
      var minV = cfg.min != null ? cfg.min : Math.min(0, Math.min.apply(null, all));
      var steps = cfg.ySteps;
      var n = Math.max.apply(null, series.map(function (x) { return x.data.length; }).concat([1]));
      function px(i) { return pad.l + (n === 1 ? iw / 2 : iw * i / (n - 1)); }
      function py(v) { return pad.t + ih - ih * ((v - minV) / (maxV - minV || 1)); }
      function valLabels(i) { return tr(cfg.labels[i] != null ? cfg.labels[i] : String(i + 1)); }

      // grid + sumbu Y
      var grid = el("g", { class: "chart-grid" });
      for (var g = 0; g <= steps; g++) {
        var y = pad.t + ih * g / steps;
        grid.appendChild(el("line", { x1: pad.l, y1: y, x2: W - pad.r, y2: y }));
      }
      s.appendChild(grid);
      var axis = el("g", { class: "chart-axis" });
      for (var g2 = 0; g2 <= steps; g2++) {
        var yv = maxV - (maxV - minV) * g2 / steps;
        var yt = el("text", { x: pad.l - 8, y: pad.t + ih * g2 / steps + 3.5, "text-anchor": "end" });
        yt.textContent = cfg.formatter ? fmtNum(Math.round(yv), cfg.formatter) : fmtNum(Math.round(yv), "number");
        axis.appendChild(yt);
      }
      // label sumbu X (dibuat jarang bila terlalu padat)
      var stepX = Math.ceil(n / Math.max(2, Math.floor(W / 70)));
      for (var i = 0; i < n; i++) {
        if (i % stepX === 0 || i === n - 1) {
          var xt = el("text", { x: px(i), y: H - legendH - 8, "text-anchor": "middle" });
          xt.textContent = valLabels(i);
          axis.appendChild(xt);
        }
      }
      s.appendChild(axis);

      // deret
      series.forEach(function (sr, si) {
        var col = color(sr.color, P) || P.primary;
        var pts = sr.data.map(function (v, i) { return [px(i), py(minV + (v - minV) * progress)]; });
        var d = cfg.smooth ? smoothPath(pts) : linePath(pts);
        if (sr.area !== false && cfg.area) {
          var gid = "grad-" + Math.random().toString(36).slice(2, 8);
          var defs = el("defs");
          var lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
          lg.appendChild(el("stop", { offset: "0%", "stop-color": toRGBA(col, sr.fill != null ? sr.fill : 0.32) }));
          lg.appendChild(el("stop", { offset: "100%", "stop-color": toRGBA(col, 0) }));
          defs.appendChild(lg); s.appendChild(defs);
          s.appendChild(el("path", {
            d: d + " L" + px(n - 1) + "," + (pad.t + ih) + " L" + px(0) + "," + (pad.t + ih) + " Z",
            fill: "url(#{id})".replace("{id}", gid), stroke: "none"
          }));
        }
        s.appendChild(el("path", {
          d: d, fill: "none", stroke: col, "stroke-width": sr.width || 2.4,
          "stroke-linecap": "round", "stroke-linejoin": "round",
          "stroke-dasharray": sr.dashed ? "6 5" : null
        }));
        if (sr.dots) {
          pts.forEach(function (p) {
            s.appendChild(el("circle", { cx: p[0], cy: p[1], r: 3, fill: P.surface, stroke: col, "stroke-width": 2 }));
          });
        }
      });

      // interaksi hover
      if (series.length) {
        var guide = el("line", { x1: 0, y1: pad.t, x2: 0, y2: pad.t + ih, stroke: P.muted, "stroke-width": 1, "stroke-dasharray": "4 3", opacity: 0 });
        s.appendChild(guide);
        var dots = series.map(function (sr) {
          var c = el("circle", { r: 4.5, fill: color(sr.color, P) || P.primary, stroke: P.surface, "stroke-width": 2, opacity: 0 });
          s.appendChild(c); return c;
        });
        var hit = el("rect", { x: pad.l, y: pad.t, width: Math.max(1, iw), height: ih, fill: "transparent", style: "cursor:crosshair" });
        s.appendChild(hit);
        var tip = tooltipEl(h);
        function move(ev) {
          var rect = s.getBoundingClientRect();
          var x = (ev.clientX - rect.left) * (W / rect.width);
          var idx = Math.round((x - pad.l) / (iw / (n - 1 || 1)));
          idx = Math.max(0, Math.min(n - 1, idx));
          guide.setAttribute("x1", px(idx)); guide.setAttribute("x2", px(idx)); guide.setAttribute("opacity", 0.7);
          var html = "<b>" + valLabels(idx) + "</b>";
          series.forEach(function (sr, i) {
            var v = sr.data[idx];
            if (v == null) { dots[i].setAttribute("opacity", 0); return; }
            dots[i].setAttribute("opacity", 1);
            dots[i].setAttribute("cx", px(idx)); dots[i].setAttribute("cy", py(v));
            html += "<br><span style='opacity:.8'>" + tr(sr.name || "Series " + (i + 1)) + ":</span> " + (cfg.formatter ? fmtNum(v, cfg.formatter) : v);
          });
          tip.innerHTML = html;
          tip.style.left = (px(idx) * (rect.width / W)) + "px";
          tip.style.top = (py(series[0].data[idx] == null ? 0 : series[0].data[idx]) * (rect.height / H)) + "px";
          tip.style.opacity = 1;
        }
        hit.addEventListener("mousemove", move);
        hit.addEventListener("touchmove", function (e) { if (e.touches[0]) move(e.touches[0]); }, { passive: true });
        s.addEventListener("mouseleave", function () {
          tip.style.opacity = 0; guide.setAttribute("opacity", 0);
          dots.forEach(function (d) { d.setAttribute("opacity", 0); });
        });
      }

      // legenda
      if (legendOn) {
        var lx = pad.l, ly = H - 6;
        series.forEach(function (sr) {
          var col = color(sr.color, P) || P.primary;
          s.appendChild(el("rect", { x: lx, y: ly - 8, width: 9, height: 9, rx: 2, fill: col }));
          var t = el("text", { x: lx + 14, y: ly, class: "chart-axis" });
          t.setAttribute("fill", P.muted); t.setAttribute("font-size", "11");
          t.textContent = tr(sr.name || "");
          s.appendChild(t);
          lx += 18 + (sr.name || "").length * 6.4;
        });
      }
      h.appendChild(s);
    }
    register(host, "line", Object.assign({}, cfg, { render: render }));
    return host;
  }

  /* =================================================================== BAR */
  function barChart(host, cfg) {
    host = ensureHost(host);
    if (!host) return null;
    cfg = Object.assign({ labels: [], series: [], height: 260, stacked: false, horizontal: false, ySteps: 4, formatter: null, max: null, radius: 3 }, cfg);

    function render(h, progress) {
      clear(h);
      var P = palette();
      var W = Math.max(160, h.clientWidth || 600), H = cfg.height;
      var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img" });
      var pad = { t: 14, r: 14, b: 28, l: 46 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var series = cfg.series.filter(function (x) { return x && x.data; });
      var labels = cfg.labels;
      var n = labels.length || Math.max.apply(null, series.map(function (x) { return x.data.length; }).concat([1]));
      var maxV = cfg.max != null ? cfg.max : niceMax(cfg.stacked
        ? Math.max.apply(null, labels.map(function (_, i) { return series.reduce(function (a, sr) { return a + (sr.data[i] || 0); }, 0); }).concat([1]))
        : Math.max.apply(null, series.reduce(function (a, sr) { return a.concat(sr.data); }, []).concat([1])));

      var axis = el("g", { class: "chart-axis" });
      var grid = el("g", { class: "chart-grid" });
      for (var g = 0; g <= cfg.ySteps; g++) {
        var y = pad.t + ih * g / cfg.ySteps;
        grid.appendChild(el("line", { x1: pad.l, y1: y, x2: W - pad.r, y2: y }));
        var t = el("text", { x: pad.l - 8, y: y + 3.5, "text-anchor": "end" });
        t.textContent = fmtNum(Math.round(maxV - maxV * g / cfg.ySteps), cfg.formatter || "number");
        axis.appendChild(t);
      }
      s.appendChild(grid); s.appendChild(axis);

      var stepX = Math.ceil(n / Math.max(2, Math.floor(W / 64)));
      for (var i = 0; i < n; i++) {
        if (i % stepX !== 0 && i !== n - 1) continue;
        var xt = el("text", { x: pad.l + iw * (i + 0.5) / n, y: H - 9, "text-anchor": "middle" });
        xt.textContent = tr(labels[i] != null ? labels[i] : i + 1);
        s.appendChild(xt);
      }

      var slot = iw / n;
      for (var k = 0; k < n; k++) {
        var x0 = pad.l + slot * k;
        if (cfg.stacked) {
          var acc = 0;
          var bw = Math.min(34, slot * 0.6);
          series.forEach(function (sr, si) {
            var v = (sr.data[k] || 0) * progress, bh = ih * v / maxV;
            var yy = pad.t + ih - bh - ih * acc / maxV;
            var col = color(sr.color, P);
            s.appendChild(el("rect", {
              class: "chart-bar", x: x0 + (slot - bw) / 2, y: yy, width: bw, height: Math.max(0, bh),
              rx: si === series.length - 1 ? cfg.radius : 0, fill: col, opacity: 0.9
            }));
            acc += v;
          });
        } else {
          var cw = Math.min(26, (slot * 0.68) / series.length);
          var groupW = cw * series.length;
          series.forEach(function (sr, si) {
            var v = (sr.data[k] || 0) * progress;
            var bh2 = ih * v / maxV;
            s.appendChild(el("rect", {
              class: "chart-bar", x: x0 + (slot - groupW) / 2 + si * cw, y: pad.t + ih - bh2,
              width: cw - 2, height: Math.max(0, bh2), rx: cfg.radius, fill: color(sr.color, P), opacity: 0.92
            }));
          });
        }
      }
      h.appendChild(s);
    }
    register(host, "bar", Object.assign({}, cfg, { render: render }));
    return host;
  }

  /* ============================================================== H-BAR */
  function hbarChart(host, cfg) {
    host = ensureHost(host);
    if (!host) return null;
    cfg = Object.assign({ labels: [], values: [], color: "primary", height: null, formatter: "number", showValue: true }, cfg);
    function render(h, progress) {
      clear(h);
      var P = palette();
      var W = Math.max(160, h.clientWidth || 600);
      var rowH = 30, H = cfg.height || (cfg.labels.length * rowH + 8);
      var labelW = 0;
      var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });
      cfg.labels.forEach(function (l) { labelW = Math.max(labelW, Math.min(140, String(l).length * 6.6)); });
      var maxV = niceMax(Math.max.apply(null, cfg.values.concat([1])));
      var barX = labelW + 10, barW = W - barX - 58;
      cfg.labels.forEach(function (lab, i) {
        var y = 4 + i * rowH;
        var t = el("text", { x: 0, y: y + rowH / 2 + 3, "fill": P.fg, "font-size": "11.5" });
        t.textContent = lab;
        s.appendChild(t);
        s.appendChild(el("rect", { x: barX, y: y + 6, width: Math.max(0, barW), height: rowH - 14, rx: 4, fill: color(cfg.color, P), opacity: 0.13 }));
        var v = (cfg.values[i] || 0) * progress;
        s.appendChild(el("rect", { x: barX, y: y + 6, width: Math.max(0, barW * v / maxV), height: rowH - 14, rx: 4, fill: color(cfg.color, P) }));
        if (cfg.showValue) {
          var vt = el("text", { x: barX + barW + 8, y: y + rowH / 2 + 3, "fill": P.muted, "font-size": "11.5" });
          vt.textContent = fmtNum(cfg.values[i] || 0, cfg.formatter);
          s.appendChild(vt);
        }
      });
      h.appendChild(s);
    }
    register(host, "hbar", Object.assign({}, cfg, { render: render }));
    return host;
  }

  /* ================================================================ DONUT */
  function donutChart(host, cfg) {
    host = ensureHost(host);
    if (!host) return null;
    cfg = Object.assign({ data: [], height: 240, thickness: 16, centerValue: null, centerLabel: "Total", formatter: null, legend: true }, cfg);
    function render(h, progress) {
      clear(h);
      var P = palette();
      var W = Math.max(160, h.clientWidth || 320), H = cfg.height;
      var total = cfg.data.reduce(function (a, d) { return a + d.value; }, 0) || 1;
      var R = Math.min(W, H) / 2 - 6, cx = W / 2, cy = H / 2;
      var r = R - cfg.thickness / 2;
      var C = 2 * Math.PI * r;
      var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });
      s.appendChild(el("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: P.border, "stroke-width": cfg.thickness, opacity: 0.5 }));
      var off = 0;
      cfg.data.forEach(function (d) {
        var frac = d.value / total * progress;
        var arc = el("circle", {
          cx: cx, cy: cy, r: r, fill: "none", stroke: color(d.color, P) || P.primary,
          "stroke-width": cfg.thickness, "stroke-dasharray": (C * frac).toFixed(2) + " " + C.toFixed(2),
          "stroke-dashoffset": (-C * off).toFixed(2), "stroke-linecap": "butt",
          transform: "rotate(-90 " + cx + " " + cy + ")", style: "transition: stroke-width .15s"
        });
        arc.addEventListener("mouseenter", function () { arc.setAttribute("stroke-width", cfg.thickness + 5); });
        arc.addEventListener("mouseleave", function () { arc.setAttribute("stroke-width", cfg.thickness); });
        var title = el("title"); title.textContent = tr(d.label) + ": " + (cfg.formatter ? fmtNum(d.value, cfg.formatter) : d.value);
        arc.appendChild(title);
        s.appendChild(arc);
        off += d.value / total;
      });
      var cv = el("text", { x: cx, y: cy + 2, "text-anchor": "middle", class: "donut-center", "font-size": "22" });
      cv.textContent = cfg.centerValue != null ? (cfg.formatter ? fmtNum(cfg.centerValue, cfg.formatter) : cfg.centerValue) : fmtNum(Math.round(total), cfg.formatter || "number");
      s.appendChild(cv);
      if (cfg.centerLabel) {
        var cl = el("text", { x: cx, y: cy + 20, "text-anchor": "middle", fill: P.muted, "font-size": "11" });
        cl.textContent = tr(cfg.centerLabel);
        s.appendChild(cl);
      }
      h.appendChild(s);
    }
    register(host, "donut", Object.assign({}, cfg, { render: render }));
    // legenda berbasis HTML bila diminta
    if (cfg.legend) {
      var lg = document.createElement("div");
      lg.className = "chart-legend mt-3 justify-center";
      lg.innerHTML = cfg.data.map(function (d) {
        return '<span class="lg-item"><span class="swatch" style="background:' + cssVar("--c-" + (d.color || "primary"), d.color || "#007bff") + '"></span>' +
          tr(d.label) + ' <b class="text-fg">' + (cfg.formatter ? fmtNum(d.value, cfg.formatter) : d.value) + "</b></span>";
      }).join("");
      host.appendChild(lg);
    }
    return host;
  }

  /* =============================================================== RADIAL */
  function radialChart(host, cfg) {
    host = ensureHost(host);
    if (!host) return null;
    cfg = Object.assign({ value: 0, max: 100, color: "success", size: 150, thickness: 12, label: "", formatter: "percent" }, cfg);
    function render(h, progress) {
      clear(h);
      var P = palette();
      var S = cfg.size, cx = S / 2, cy = S / 2, r = S / 2 - cfg.thickness / 2 - 2;
      var C = 2 * Math.PI * r;
      var sv = el("svg", { width: S, height: S, viewBox: "0 0 " + S + " " + S });
      sv.appendChild(el("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: P.border, "stroke-width": cfg.thickness, opacity: 0.55 }));
      var frac = Math.max(0, Math.min(1, cfg.value / cfg.max)) * progress;
      sv.appendChild(el("circle", {
        cx: cx, cy: cy, r: r, fill: "none", stroke: color(cfg.color, P),
        "stroke-width": cfg.thickness, "stroke-linecap": "round",
        "stroke-dasharray": (C * frac).toFixed(2) + " " + C.toFixed(2),
        transform: "rotate(-90 " + cx + " " + cy + ")"
      }));
      var t = el("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-size": "20", "font-weight": "700", fill: P.fg });
      t.textContent = cfg.formatter === "percent"
        ? Math.round(cfg.value * progress) + "%"
        : fmtNum(Math.round(cfg.value * progress), cfg.formatter);
      sv.appendChild(t);
      if (cfg.label) {
        var l = el("text", { x: cx, y: cy + 22, "text-anchor": "middle", "font-size": "11", fill: P.muted });
        l.textContent = tr(cfg.label);
        sv.appendChild(l);
      }
      h.style.display = "flex"; h.style.justifyContent = "center";
      h.appendChild(sv);
    }
    register(host, "radial", Object.assign({}, cfg, { render: render }));
    return host;
  }

  /* ============================================================ SPARKLINE */
  function sparklineChart(host, cfg) {
    host = ensureHost(host);
    if (!host) return null;
    cfg = Object.assign({ data: [], color: "#ffffff", type: "area", height: null, lineWidth: 2, showLast: true }, cfg);
    function render(h, progress) {
      clear(h);
      var W = Math.max(60, h.clientWidth || 160);
      var H = cfg.height || Math.max(28, h.clientHeight || 40);
      var data = cfg.data;
      if (!data.length) return;
      var max = Math.max.apply(null, data), min = Math.min.apply(null, data);
      var span = (max - min) || 1;
      var pts = data.map(function (v, i) {
        var x = (data.length === 1 ? W / 2 : W * i / (data.length - 1));
        var y = H - 4 - (H - 8) * ((v - min) / span);
        return [x, H - 4 - (H - 8) * ((min + (v - min) * progress - min) / span)];
      });
      var sv = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
      var d = smoothPath(pts);
      if (cfg.type !== "bars" && cfg.type !== "line") {
        sv.appendChild(el("path", { d: d + " L" + W + "," + H + " L0," + H + " Z", fill: toRGBA(cfg.color, 0.28), stroke: "none" }));
      }
      if (cfg.type === "bars") {
        clear(sv);
        var bw = W / data.length;
        data.forEach(function (v, i) {
          var bh = Math.max(0, (H - 4) * ((v - min) / span) * progress);
          sv.appendChild(el("rect", { x: i * bw + 1, y: H - bh, width: Math.max(1, bw - 2), height: bh, rx: 2, fill: cfg.color, opacity: 0.85 }));
        });
      } else {
        sv.appendChild(el("path", { d: d, fill: "none", stroke: cfg.color, "stroke-width": cfg.lineWidth, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      }
      if (cfg.showLast) {
        var last = pts[pts.length - 1];
        sv.appendChild(el("circle", { cx: last[0], cy: last[1], r: 2.6, fill: "#fff", stroke: cfg.color, "stroke-width": 1.6 }));
      }
      h.appendChild(sv);
    }
    register(host, "sparkline", Object.assign({}, cfg, { render: render }));
    return host;
  }

  /* ============================================================ AUTO-INIT */
  function numList(str) {
    return String(str).split(",").map(function (x) { return parseFloat(String(x).trim()); }).filter(function (v) { return !isNaN(v); });
  }
  function strList(str) { return String(str).split(",").map(function (x) { return x.trim(); }); }
  function autoInitElement(h) {
    if (REG.has(h)) return;
    if (h.clientWidth < 40) { observeVisibility(h); return; }
    var type = h.getAttribute("data-chart");
    var d = h.dataset;
    var labels = d.labels ? strList(d.labels) : [];
    var height = d.height ? parseInt(d.height, 10) : undefined;
    var colors = d.colors ? strList(d.colors) : null;
    var formatter = d.formatter || null;
    var common = { height: height, formatter: formatter, labels: labels };
    try {
      if (type === "line" || type === "area") {
        var series;
        if (d.series) series = JSON.parse(d.series);
        else {
          var vals = numList(d.values);
          series = [{ name: d.name || "Total", data: vals, color: (colors && colors[0]) || d.color || "primary", area: type === "area" || d.area === "true" }];
        }
        series.forEach(function (s, i) { if (!s.color) s.color = (colors && colors[i]) || "primary"; });
        lineChart(h, Object.assign({}, common, {
          series: series, smooth: d.smooth !== "false", legend: d.legend === "true",
          max: d.max ? parseFloat(d.max) : null, min: d.min !== undefined ? parseFloat(d.min) : 0,
          ySteps: d.steps ? parseInt(d.steps, 10) : 4, duration: d.duration ? parseInt(d.duration, 10) : 750
        }));
      } else if (type === "bar" || type === "stacked-bar") {
        var s2;
        if (d.series) s2 = JSON.parse(d.series);
        else s2 = [{ name: d.name || "Total", data: numList(d.values), color: (colors && colors[0]) || d.color || "primary" }];
        s2.forEach(function (s, i) { if (!s.color) s.color = (colors && colors[i]) || "primary"; });
        barChart(h, Object.assign({}, common, { series: s2, stacked: type === "stacked-bar" || d.stacked === "true" }));
      } else if (type === "hbar") {
        hbarChart(h, Object.assign({}, common, { values: numList(d.values), color: (colors && colors[0]) || d.color || "primary" }));
      } else if (type === "donut") {
        var vals2 = numList(d.values);
        var data = (labels.length ? labels : vals2.map(function (_, i) { return "Item " + (i + 1); })).map(function (l, i) {
          return { label: l, value: vals2[i] || 0, color: (colors && colors[i]) || ["primary", "info", "success", "warning", "danger", "secondary"][i % 6] };
        });
        donutChart(h, Object.assign({}, common, { data: data, thickness: d.thickness ? parseInt(d.thickness, 10) : 16, centerLabel: d.centerLabel || null, legend: d.legend === "true" }));
      } else if (type === "radial") {
        radialChart(h, Object.assign({}, common, {
          value: parseFloat(d.value || 0), max: parseFloat(d.max || 100),
          color: d.color || "success", size: d.size ? parseInt(d.size, 10) : 150,
          thickness: d.thickness ? parseInt(d.thickness, 10) : 12, label: d.label || ""
        }));
      } else if (type === "sparkline") {
        sparklineChart(h, Object.assign({}, common, {
          data: numList(d.values), color: d.color || "#ffffff",
          type: d.mode || "area", height: height, lineWidth: d.width ? parseFloat(d.width) : 2
        }));
      }
    } catch (err) {
      console.warn("[charts] gagal memuat grafik:", h, err);
    }
  }

  /* Elemen yang belum punya ukuran (mis. di dalam tab tersembunyi) ditunda
     sampai benar-benar terlihat, lalu digambar — jadi tidak ada grafik gepeng. */
  var pendingIO = null;
  function observeVisibility(h) {
    if (!window.IntersectionObserver) return;
    if (!pendingIO) {
      pendingIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.target.clientWidth >= 40) {
            pendingIO.unobserve(en.target);
            autoInitElement(en.target);
          }
        });
      }, { threshold: 0.01 });
    }
    pendingIO.observe(h);
  }

  function autoInit(root) {
    (root || document).querySelectorAll("[data-chart]").forEach(function (h) { autoInitElement(h); });
  }

  /* ============================================================== EXPORTS */
  window.Charts = {
    line: lineChart, bar: barChart, hbar: hbarChart, donut: donutChart,
    radial: radialChart, sparkline: sparklineChart,
    autoInit: autoInit, refreshAll: rerenderAll, fmtNum: fmtNum, palette: palette
  };

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { autoInit(); rerenderAll(); }, 160);
  });
  window.addEventListener("theme:changed", function () { rerenderAll(); });
  window.addEventListener("i18n:changed", function () { rerenderAll(); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { autoInit(); });
  else autoInit();

  // grafik yang di-render belakangan (mis. setelah tab ditampilkan)
  window.Charts.observe = function (root) { autoInit(root || document); };
})();
