/**
 * qa/shot-merek.mjs — segarkan tangkapan layar di preview/ yang menampilkan merek
 * "Aurivo Dash" (wordmark sidebar, judul halaman, footer).
 *
 * Ukuran tiap berkas disalin dari PNG lama supaya tampilan galeri tidak berubah.
 * Widget AI dimatikan dulu supaya tidak menutupi isi (tangkapan khusus widget AI
 * ada di qa/shot-aichat.mjs).
 *
 *   node shot-merek.mjs            # semua
 *   node shot-merek.mjs 00-landing # hanya satu berkas
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const BASE = 'http://localhost:8080/';
const P = new URL('../preview/', import.meta.url).pathname;
const hanya = process.argv[2] || null;

/* ---------- daftar target ----------
 * url   : alamat relatif dari BASE
 * opsi  : dark | en | preset | scroll | lock | klip | full | lewatSplash
 *         modal (buka modal grid), flip (balik kartu), lonceng (dropdown notifikasi),
 *         panel (buka panel kontrol kanan), menuKartu (buka menu kartu di sidebar)
 */
const TARGET = {
  '00-landing':                        { url: 'index.html', vp: [1280, 900] },
  '01-dashboard':                      { url: 'pages/index.html', vp: [1440, 1000] },
  '02-dark-mode':                      { url: 'pages/index.html', vp: [1440, 1000], dark: true },
  '03-komponen':                       { url: 'pages/widgets.html', vp: [1440, 1000] },
  '05-login':                          { url: 'login.html', vp: [1440, 950], lewatSplash: true },
  '06-kanban':                         { url: 'pages/kanban.html', vp: [1440, 1000] },
  '07-charts':                         { url: 'pages/charts.html', vp: [1440, 1000] },
  '08-invoice':                        { url: 'pages/invoice.html', vp: [1440, 1000] },
  '09-icons':                          { url: 'pages/icons.html', vp: [1440, 1000] },
  '10-register':                       { url: 'register.html', vp: [1440, 950] },
  '11-tables':                         { url: 'pages/tables.html', vp: [1280, 900] },
  'ag-grid':                           { url: 'pages/ag-grid.html', vp: [1500, 1000] },
  'ag-grid-private-banking':           { url: 'pages/ag-grid.html', vp: [1500, 1000], dark: true, preset: 'private' },
  'bahasa-inggris':                    { url: 'pages/index.html', vp: [1500, 950], en: true },
  'header-sticky-desktop':             { url: 'pages/analytics.html', vp: [1500, 900], scroll: 600 },
  'header-sticky-ponsel':              { url: 'pages/analytics.html', vp: [430, 900], scroll: 400 },
  'kartu-qris':                        { url: 'pages/kartu-qris.html', vp: [1500, 1050] },
  'kartu-qris-belakang':               { url: 'pages/kartu-qris.html', vp: [1500, 1050], flip: true },
  'kartu-qris-gelap':                  { url: 'pages/kartu-qris.html', vp: [1500, 1050], dark: true },
  'kunci-layar-memuat':                { url: 'pages/index.html', vp: [1440, 950], lock: 'load' },
  'kunci-layar-gelap':                 { url: 'pages/index.html', vp: [1440, 950], dark: true, lock: 'load' },
  'login-splash':                      { url: 'login.html', vp: [1440, 950], splash: true },
  'login-splash-gelap':                { url: 'login.html', vp: [1440, 950], splash: true, dark: true },
  'login-otp':                         { url: 'login.html', vp: [1440, 950], otp: true },
  'login-otp-bahasa-inggris':          { url: 'login.html', vp: [1440, 950], otp: true, en: true },
  'login-kunci-verifikasi':            { url: 'login.html', vp: [1440, 950], otp: true, kunci: true },
  'menu-tables':                       { url: 'pages/tables.html', vp: [250, 620], menu: 'tables' },
  'menu-mini-grid':                    { url: 'pages/mini-grid-1.html', vp: [268, 640], menu: 'minigrid' },
  'menu-kartu':                        { url: 'pages/kartu-qris.html', vp: [250, 620], menu: 'kartu' },
  'mini-grid-2-form':                  { url: 'pages/mini-grid-2.html', vp: [1500, 1000], modal: true },
  'mini-grid-3-bahasa-inggris':        { url: 'pages/mini-grid-3.html', vp: [1500, 1000], en: true },
  'mini-grid-gelap':                   { url: 'pages/mini-grid-1.html', vp: [1500, 950], dark: true },
  'navbar-desktop':                    { url: 'pages/index.html', vp: [1440, 96], klip: [0, 0, 1440, 96] },
  'navbar-gelap':                      { url: 'pages/index.html', vp: [1440, 96], dark: true, klip: [0, 0, 1440, 96] },
  'navbar-ponsel':                     { url: 'pages/index.html', vp: [430, 96], klip: [0, 0, 430, 96] },
  'notifikasi-lonceng':                { url: 'pages/index.html', vp: [1500, 1150], lonceng: true },
  'notifikasi-pusat':                  { url: 'pages/notifications.html', vp: [1500, 1000] },
  'offline-dashboard':                 { url: 'offline/dashboard.html', vp: [1440, 1000], berkas: true },
  'offline-private-banking-en':        { url: 'offline/dashboard.html', vp: [1440, 1000], berkas: true, dark: true, preset: 'private', en: true },
  'panel-tema-bahasa':                 { url: 'pages/index.html', vp: [470, 950], panel: true, klipKanan: 470 },
  'qris':                              { url: 'pages/qris.html', vp: [1500, 1050] },
  'qris-bahasa-inggris':               { url: 'pages/qris.html', vp: [1500, 1050], en: true },
  'sandbox-iframe':                    { url: 'offline/dashboard.html', vp: [1440, 950], iframe: true },
  'scheduler':                         { url: 'pages/scheduler.html', vp: [1500, 1000] },
  'scheduler-gelap':                   { url: 'pages/scheduler.html', vp: [1500, 1000], dark: true },
  'sidebar-terang':                    { url: 'pages/index.html', vp: [1500, 950] },
  'sidebar-footer-keluar':             { url: 'pages/index.html', vp: [250, 420], klipKiriBawah: [0, 530, 250, 420] },
  'tema-perbankan-klasik':             { url: 'pages/index.html', vp: [1500, 950], preset: 'klasik' },
  'tema-private-banking':              { url: 'pages/index.html', vp: [1500, 950], preset: 'private' },
};

const daftar = Object.entries(TARGET).filter(([nama]) => !hanya || nama === hanya);
if (!daftar.length) { console.error('tidak ada target cocok:', hanya); process.exit(1); }

const browser = await chromium.launch();
let sukses = 0, gagal = 0;

for (const [nama, t] of daftar) {
  const berkas = P + nama + '.png';
  let vp = t.vp;
  /* ukuran lama dipakai bila ada, supaya galeri tetap konsisten */
  if (!vp && fs.existsSync(berkas)) {
    const buf = fs.readFileSync(berkas).subarray(16, 24);
    vp = [buf.readUInt32BE(0), buf.readUInt32BE(4)];
  }
  vp = vp || [1440, 950];

  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] } });
  /* widget AI & kunci biometric dimatikan supaya tidak menutupi isi */
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] }));
      sessionStorage.setItem('app.aiChat.teaser', '1');
      localStorage.setItem('app.idleMs', '0');
    } catch (e) {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  try {
    const url = t.berkas ? 'file://' + PROYEK + '' + t.url : BASE + t.url;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(t.splash ? 350 : t.lewatSplash ? 3200 : 1300);

    if (t.dark) { await page.evaluate(() => window.Alpine.store('ui').applyTheme('dark')); await page.waitForTimeout(500); }
    if (t.preset) { await page.evaluate((id) => { const p = window.Alpine.store('ui').presets.find((x) => x.id === id); if (p) window.Alpine.store('ui').applyPreset(p); }, t.preset); await page.waitForTimeout(500); }
    if (t.en) { await page.evaluate(() => window.I18n && window.I18n.set('en')); await page.waitForTimeout(600); }

    if (t.otp) {
      await page.fill('input[type="email"], #email, [name="email"]', 'admin@perusahaan.id').catch(() => {});
      await page.fill('input[type="password"], #password, [name="password"]', 'admin123').catch(() => {});
      await page.click('button[type="submit"], .btn-primary').catch(() => {});
      await page.waitForTimeout(t.kunci ? 500 : 1100);
    }
    if (t.lock) { await page.evaluate((mode) => window.Lock.show({ mode, title: 'Memuat data', message: 'Menyiapkan data terbaru…' }), t.lock); await page.waitForTimeout(600); }
    if (t.menu) {
      await page.click('.sidebar-body button.side-link:has-text("Tables")').catch(() => {});
      await page.waitForTimeout(400);
      if (t.menu === 'minigrid') { await page.click('.sidebar-body button.side-link:has-text("Mini Grid")').catch(() => {}); await page.waitForTimeout(400); }
      if (t.menu === 'kartu') { await page.click('.sidebar-body button.side-link:has-text("Kartu")').catch(() => {}); await page.waitForTimeout(400); }
    }
    if (t.modal) { await page.click('#minigrid-2 [data-act="add"]').catch(() => {}); await page.waitForTimeout(700); }
    if (t.flip) {
      await page.click('button:has-text("Balik"), [data-balik], .kartu-flip button').catch(() => {});
      await page.waitForTimeout(700);
    }
    if (t.lonceng) { await page.click('.nav-icon-btn[title*="otifikasi"], [data-lonceng]').catch(() => {}); await page.waitForTimeout(700); }
    if (t.panel) { await page.click('[data-control-toggle], .nav-icon-btn[title*="ontrol"]').catch(() => {}); await page.waitForTimeout(700); }
    if (t.scroll) { await page.evaluate((y) => window.scrollTo(0, y), t.scroll); await page.waitForTimeout(700); }

    if (t.iframe) {
      await page.setContent(`<body style="margin:0"><iframe src="${BASE}offline/dashboard.html" sandbox="allow-scripts" style="width:1440px;height:950px;border:0"></iframe></body>`);
      await page.waitForTimeout(2600);
    }

    const opsi = { path: berkas };
    if (t.klip) opsi.clip = { x: t.klip[0], y: t.klip[1], width: t.klip[2], height: t.klip[3] };
    if (t.klipKanan) opsi.clip = { x: vp[0] - t.klipKanan + (1500 - vp[0] < 0 ? 0 : 0), y: 0, width: t.klipKanan, height: vp[1] };
    if (t.klipKiriBawah) {
      /* sisi kiri (sidebar) bagian bawah pada halaman 1500×950 */
      await page.setViewportSize({ width: 1500, height: 950 });
      await page.waitForTimeout(400);
      opsi.clip = { x: 0, y: t.klipKiriBawah[1], width: t.klipKiriBawah[2], height: t.klipKiriBawah[3] };
    }
    await page.screenshot(opsi);
    console.log(`✔ ${nama}.png  ${vp[0]}×${vp[1]}${errs.length ? '  (error: ' + errs[0].slice(0, 50) + ')' : ''}`);
    sukses++;
  } catch (e) {
    console.log(`✖ ${nama}.png — ${String(e.message).slice(0, 90)}`);
    gagal++;
  }
  await ctx.close();
}

await browser.close();
console.log(`\nSelesai: ${sukses} berkas diperbarui${gagal ? `, ${gagal} gagal` : ''}.`);
process.exit(gagal ? 1 : 0);
