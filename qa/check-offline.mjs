/**
 * qa/check-offline.mjs — menguji berkas mandiri di folder offline/.
 *  A. konteks peramban offline:true via file:// → tidak boleh ada permintaan jaringan
 *  B. di dalam iframe sandbox="allow-scripts" (mirip pratinjau) → tanpa error, aset hidup
 *  C. navbar di semua berkas offline
 * Jalankan: PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright node qa/check-offline.mjs
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const DIR = new URL('../offline', import.meta.url).pathname;
const FILES = ['dashboard', 'tabel', 'grafik', 'komponen', 'formulir', 'analitik', 'login', 'qris', 'kartu-qris', 'mobile-nasabah'];
const browser = await chromium.launch();
let gagal = 0;

/* ---------- A. file:// dengan jaringan dimatikan ---------- */
console.log('A. Berkas mandiri lewat file:// (jaringan dimatikan)');
for (const name of FILES) {
  const ctx = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  const failed = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto(`file://${DIR}/${name}.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  const r = await page.evaluate(() => ({
    judul: document.title,
    ikonKosong: document.querySelectorAll('i[data-icon]:empty').length,
    grafik: document.querySelectorAll('.chart svg').length,
    alpine: typeof window.Alpine,
    store: (() => { try { return typeof window.Alpine.store('ui'); } catch { return 'ERR'; } })(),
    navTautanCepat: document.querySelectorAll('.app-navbar .navbar-link').length,
    navTombol: document.querySelectorAll('.app-navbar .nav-icon-btn').length,
  }));
  const masalah = [];
  if (errs.length) masalah.push(`${errs.length} error JS: ${errs[0].slice(0, 60)}`);
  if (failed.length) masalah.push(`${failed.length} permintaan gagal`);
  if (r.ikonKosong) masalah.push(`${r.ikonKosong} ikon kosong`);
  if (r.navTautanCepat) masalah.push('menu cepat masih ada');
  if (masalah.length) gagal++;
  console.log(' ', name.padEnd(9), `ikon-kosong=${r.ikonKosong} grafik=${r.grafik} alpine=${r.alpine} store=${r.store} tombol-nav=${r.navTombol}`,
    masalah.length ? '❌ ' + masalah.join(' | ') : '✅');
  if (name === 'dashboard') await page.screenshot({ path: PROYEK + 'preview/offline-dashboard.png', fullPage: false });
  await ctx.close();
}

/* ---------- B. iframe sandbox ---------- */
console.log('\nB. Di dalam iframe sandbox="allow-scripts" (kondisi pratinjau)');
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
const errsB = [];
page.on('pageerror', (e) => errsB.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errsB.push(m.text()); });
// iframe file:// hanya bisa dibuka dari dokumen file:// → tulis berkas host dulu
const fsh = await import('node:fs');
const hostPath = PROYEK + 'qa/.host-sandbox.html';
fsh.writeFileSync(hostPath, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>host</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100vh;display:block}</style></head>
<body><iframe id="f" sandbox="allow-scripts" src="../offline/dashboard.html"></iframe></body></html>`);
await page.goto('file://' + hostPath, { waitUntil: 'load' });
await page.waitForTimeout(2000);
const frame = page.frames().find((f) => f.url().includes('dashboard.html'));
const rB = await frame.evaluate(() => ({
  ikon: document.querySelectorAll('i[data-icon] svg').length,
  ikonKosong: document.querySelectorAll('i[data-icon]:empty').length,
  grafik: document.querySelectorAll('.chart svg').length,
  store: (() => { try { return typeof window.Alpine.store('ui'); } catch { return 'ERR'; } })(),
  font: getComputedStyle(document.body).fontFamily.split(',')[0],
  searchLebar: Math.round(document.querySelector('.navbar-search').getBoundingClientRect().width),
  navTautanCepat: document.querySelectorAll('.app-navbar .navbar-link').length,
}));
const rBerr = errsB.filter((e) => !/localStorage|SecurityError|sandbox/i.test(e));
if (rBerr.length) gagal++;
console.log(' ', JSON.stringify(rB), rBerr.length ? '❌ ' + rBerr.slice(0, 2) : '✅ tanpa error');
await page.screenshot({ path: PROYEK + 'preview/sandbox-iframe.png' });
await browser.close();
console.log(gagal === 0 ? '\n✅ Semua berkas mandiri lulus.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
