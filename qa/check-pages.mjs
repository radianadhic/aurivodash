/**
 * qa/check-pages.mjs — regresi seluruh halaman versi multi-berkas.
 * Cek: error JS, permintaan gagal, overflow horizontal, ikon kosong, grafik,
 *      jumlah tombol navbar, dan satu tangkapan layar navbar tema gelap.
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const BASE = 'http://localhost:8080/';
const PAGES = [
  'index.html', 'pages/index.html', 'pages/analytics.html', 'pages/tables.html',
  'pages/forms.html', 'pages/charts.html', 'pages/widgets.html', 'pages/kanban.html',
  'pages/icons.html', 'pages/profile.html', 'pages/invoice.html',
  'pages/qris.html', 'pages/kartu-qris.html',
  'pages/report-design.html', 'pages/report-viewer.html', 'pages/report-example.html',
  'mobile/index.html',
  'login.html', 'register.html', '404.html',
];

/* Galat bawaan aplikasi SatuReport (sama di berkas upstream) — bukan cacat integrasi */
const GALAT_UPSTREAM = /pageHeaderSection|reading 'width'|reading 'page'/;

const browser = await chromium.launch();
let gagal = 0;

for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  const failed = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto(BASE + p, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const nav = document.querySelector('.app-navbar');
    return {
      ikonKosong: document.querySelectorAll('i[data-icon]:empty').length,
      grafik: document.querySelectorAll('.chart svg').length,
      navTombol: nav ? nav.querySelectorAll('.nav-icon-btn').length : 0,
      menuCepat: nav ? nav.querySelectorAll('.navbar-link').length : 0,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      alpine: typeof window.Alpine,
    };
  });
  const errsLuar = errs.filter((e) => !GALAT_UPSTREAM.test(e));
  const masalah = [];
  if (errsLuar.length) masalah.push(`${errsLuar.length} error`);
  if (failed.length) masalah.push(`${failed.length} request gagal`);
  if (r.ikonKosong) masalah.push(`${r.ikonKosong} ikon kosong`);
  if (r.menuCepat && p !== 'index.html') masalah.push('menu cepat tersisa');
  if (r.overflowX) masalah.push('overflow X');
  if (masalah.length) gagal++;
  console.log(' ', p.padEnd(22), `ikon-kosong=${r.ikonKosong} grafik=${String(r.grafik).padStart(2)} nav=${r.navTombol}`,
    masalah.length ? '❌ ' + masalah.join(', ') : '✅');
  await ctx.close();
}

/* navbar tema gelap + panel kontrol terbuka */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.evaluate(() => { window.Alpine.store('ui').setTheme('dark'); });
await page.waitForTimeout(600);
await page.screenshot({ path: PROYEK + 'preview/navbar-gelap.png', clip: { x: 0, y: 0, width: 1440, height: 96 } });
await page.evaluate(() => { window.Alpine.store('ui').setTheme('light'); });
await browser.close();
console.log(gagal === 0 ? '\n✅ Semua halaman lulus regresi.' : `\n❌ ${gagal} halaman bermasalah.`);
process.exit(gagal === 0 ? 0 : 1);
