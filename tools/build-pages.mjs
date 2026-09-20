/**
 * build-pages.mjs — perakit halaman statis.
 *
 * Alur:
 *   src/pages/*.html  (punya front-matter + blok <!--#actions-->)  ──┐
 *   src/partials/*.html (shell, navbar, sidebar, …)               ──┴─►  ./index.html & ./pages/*.html
 *
 * Jalankan:  npm run pages
 * Hasilnya HTML statis biasa — bisa dibuka langsung dari filesystem (file://).
 */
import fs from "node:fs";
import path from "node:path";

const SRC_PAGES = "src/pages";
const SRC_PARTIALS = "src/partials";
const ICONS_FILE = "assets/js/icons.js";

/* ------------------------------------------------------------ helpers */
function read(file) { return fs.readFileSync(file, "utf8"); }

function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const mm = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (mm) data[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, "");
  });
  return { data, body: raw.slice(m[0].length) };
}

function resolveIncludes(html, depth = 0) {
  if (depth > 5) return html;
  const re = /<!--\s*@include\s+([\w.\-/]+?)\s*-->/g;
  return html.replace(re, (_, name) => {
    const file = path.join(SRC_PARTIALS, name);
    if (!fs.existsSync(file)) { console.warn(`  ⚠ partial tidak ditemukan: ${name}`); return ""; }
    return resolveIncludes(read(file), depth + 1);
  });
}

function breadcrumb(crumb) {
  const items = (crumb || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!items.length) return '<li>Dashboard</li>';
  return items
    .map((item, i) => {
      const [label, href] = item.split("|").map((s) => s.trim());
      const last = i === items.length - 1;
      const home = i === 0 ? '<i data-icon="house-door" data-size="12"></i> ' : "";
      const text = last
        ? `<span class="breadcrumb-current" aria-current="page">${label}</span>`
        : href ? `<a href="${href}">${home}${label}</a>` : `<span>${home}${label}</span>`;
      return `<li>${text}</li>` + (last ? "" : '<li aria-hidden="true"><i data-icon="chevron-right" data-size="10"></i></li>');
    })
    .join("");
}

/** Skrip tambahan khusus halaman, mis. scripts: sortable.min.js */
function extraScripts(list, depthPrefix) {
  if (!list) return "";
  return list
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => `<script defer src="${depthPrefix}assets/js/${f}"></script>`)
    .join("\n");
}

function extractActions(body) {
  const m = body.match(/<!--#actions-->([\s\S]*?)<!--\/#actions-->/);
  if (!m) return { body, actions: "" };
  return { body: body.replace(m[0], ""), actions: m[1].trim() };
}

/* Blok opsional <!--#navbar-->…<!--/#navbar--> → tombol tambahan khusus halaman
   yang muncul di Layout Top (navbar). */
function extractNavbar(body) {
  const m = body.match(/<!--#navbar-->([\s\S]*?)<!--\/#navbar-->/);
  if (!m) return { body, navExtra: "" };
  return { body: body.replace(m[0], ""), navExtra: m[1].trim() };
}

/* ------------------------------------------------- memuat semua ikon */
function iconNames() {
  if (!fs.existsSync(ICONS_FILE)) return null;
  const src = read(ICONS_FILE);
  const start = src.indexOf("{"), end = src.lastIndexOf("}");
  try { return new Set(Object.keys(JSON.parse(src.slice(start, end + 1)))); } catch { return null; }
}

/* ------------------------------------------------------------- render */
const templates = {
  shell: resolveIncludes(read(path.join(SRC_PARTIALS, "shell.html"))),
  auth: resolveIncludes(read(path.join(SRC_PARTIALS, "auth-shell.html"))),
  /* tata letak aplikasi nasabah (mobile-first, tanpa sidebar dashboard) */
  mobile: resolveIncludes(read(path.join(SRC_PARTIALS, "mobile-shell.html"))),
};

const BUILD_ID = String(Date.now()).slice(-8); // penanda cache-busting aset
/* Versi produk dibaca dari package.json supaya footer tidak pernah tertinggal */
const APP_VERSION = JSON.parse(read("package.json")).version;
const iconSet = iconNames();
const usedIcons = new Set();
const missingIcons = new Set();
const built = [];
const files = fs.readdirSync(SRC_PAGES).filter((f) => f.endsWith(".html"));

for (const file of files) {
  const raw = read(path.join(SRC_PAGES, file));
  const { data, body } = parseFrontMatter(raw);
  const outPath = data.path || `pages/${file}`;
  const layout = data.layout || "shell";
  const tpl = templates[layout] || templates.shell;
  const extracted = extractNavbar(extractActions(body).body);
  extracted.actions = extractActions(body).actions;
  const depthPrefix = outPath.includes("/") ? "../".repeat(outPath.split("/").length - 1) : "";

  // kumpulkan nama ikon untuk validasi
  (tpl + extracted.body + extracted.navExtra + extracted.actions)
    .replace(/(?<![:\w-])data-icon="([\w-]+)"/g, (_, n) => { usedIcons.add(n); return ""; });

  const html = tpl
    .replaceAll("{{TITLE}}", data.title || "Dashboard")
    .replaceAll("{{DESCRIPTION}}", data.description || "Aurivo Dash — template dashboard perbankan bergaya AdminLTE v3 dengan Tailwind CSS v4 + Alpine.js, siap dipakai offline.")
    .replaceAll("{{PAGE_TITLE}}", data.pageTitle || data.title || "")
    .replaceAll("{{CRUMB}}", breadcrumb(data.crumb))
    .replaceAll("{{PAGE_ACTIONS}}", extracted.actions)
    .replaceAll("{{PAGE_SUBTITLE}}", data.subtitle || data.description || "")
    .replaceAll("{{NAVBAR_EXTRA}}", extracted.navExtra
      ? `<div class="navbar-extra hidden items-center gap-1.5 md:flex">${extracted.navExtra}<span class="nav-sep hidden md:block" aria-hidden="true"></span></div>`
      : "")
    .replaceAll("{{VERSION}}", BUILD_ID)
    .replaceAll("{{APP_VERSION}}", APP_VERSION)
    .replaceAll("{{BODY_CLASS}}", data.bodyClass || "")
    .replaceAll("{{ASSETS}}", depthPrefix)
    .replaceAll("{{EXTRA_SCRIPTS}}", extraScripts(data.scripts, depthPrefix))
    .replaceAll("{{CONTENT}}", extracted.body.trim());

  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, "utf8");
  built.push({ file, outPath, layout, size: html.length });
  console.log(`  ✔ ${outPath.padEnd(28)} ${(html.length / 1024).toFixed(1)} KB  (${layout})`);
}

if (iconSet) {
  usedIcons.forEach((n) => { if (!iconSet.has(n)) missingIcons.add(n); });
  if (missingIcons.size) {
    console.warn("\n⚠ Ikon belum tersedia di icons.js (tambahkan ke tools/build-icons.mjs lalu `npm run icons`):");
    console.warn("  " + [...missingIcons].join(" "));
  } else {
    console.log(`\n✔ Semua ${usedIcons.size} nama ikon tersedia di assets/js/icons.js`);
  }
}

console.log(`\nSelesai: ${built.length} halaman dibangun.`);
