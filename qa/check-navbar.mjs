/**
 * qa/check-navbar.mjs — memeriksa susunan navbar di berbagai lebar layar.
 * Jalankan: PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright node qa/check-navbar.mjs
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const HALAMAN = 'http://localhost:8080/pages/index.html';
const sizes = [
  [1920, 900, 'desktop besar'],
  [1440, 900, 'desktop'],
  [1180, 800, 'laptop'],
  [900, 800, 'tablet'],
  [430, 860, 'ponsel'],
];

const browser = await chromium.launch();
let gagal = 0;

for (const [w, h, label] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(HALAMAN, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const nav = document.querySelector('.app-navbar');
    const search = nav.querySelector('.navbar-search');
    const icons = [...nav.querySelectorAll('.nav-icon-btn')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => Math.round(b.getBoundingClientRect().left));
    const seps = [...nav.querySelectorAll('.nav-sep')].filter((s) => getComputedStyle(s).display !== 'none').length;
    const avatar = [...nav.querySelectorAll('button .avatar')].pop();
    return {
      tautanMenuCepat: nav.querySelectorAll('.navbar-link').length,
      searchTampak: search ? getComputedStyle(search).display !== 'none' : false,
      searchLebar: search ? Math.round(search.getBoundingClientRect().width) : 0,
      jumlahTombolIkon: icons.length,
      posisiIkon: icons,
      ikonRapat: icons.some((x, i) => i && x - icons[i - 1] < 30),
      pemisah: seps,
      avatarKanan: avatar ? Math.round(avatar.getBoundingClientRect().right) : 0,
      lebarJendela: window.innerWidth,
      tinggiNavbar: Math.round(nav.getBoundingClientRect().height),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  const masalah = [];
  if (r.tautanMenuCepat !== 0) masalah.push('menu cepat masih ada');
  if (r.ikonRapat) masalah.push('ikon bertumpuk');
  if (r.overflowX) masalah.push('overflow horizontal');
  if (r.avatarKanan > r.lebarJendela) masalah.push('avatar keluar layar');
  if (r.searchTampak !== (w >= 640)) masalah.push(`status search tak sesuai (${r.searchTampak})`);
  if (errs.length) masalah.push('error JS: ' + errs[0].slice(0, 40));
  if (masalah.length) gagal++;

  console.log(
    label.padEnd(13),
    `search=${r.searchTampak ? r.searchLebar + 'px' : 'sembunyi'} tombol=${r.jumlahTombolIkon} pemisah=${r.pemisah} avatar=${r.avatarKanan}/${r.lebarJendela} ikon=${r.posisiIkon.join(',')}`,
    masalah.length ? '❌ ' + masalah.join(', ') : '✅'
  );
  if (w === 1440) await page.screenshot({ path: PROYEK + 'preview/navbar-desktop.png', clip: { x: 0, y: 0, width: w, height: 96 } });
  if (w === 430) await page.screenshot({ path: PROYEK + 'preview/navbar-ponsel.png', clip: { x: 0, y: 0, width: w, height: 96 } });
  await ctx.close();
}

// fungsi tombol: tema, panel kontrol, dropdown notifikasi
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(HALAMAN, { waitUntil: 'load' });
await page.waitForTimeout(900);
const fn = await page.evaluate(async () => {
  const nav = document.querySelector('.app-navbar');
  const byTitle = (t) => [...nav.querySelectorAll('button')].find((b) => (b.getAttribute('title') || '').includes(t));
  const tema = byTitle('Ganti tema');
  tema.click();
  await new Promise((r) => setTimeout(r, 350));
  const setelahTema = document.documentElement.getAttribute('data-theme');
  tema.click();
  await new Promise((r) => setTimeout(r, 300));
  byTitle('Pengaturan tampilan').click();
  await new Promise((r) => setTimeout(r, 400));
  const panel = !!document.querySelector('.control-sidebar[data-open="true"], .control-sidebar.open') || getComputedStyle(document.querySelector('.control-sidebar')).visibility !== 'hidden';
  const notif = nav.querySelector('[aria-label="Notifikasi"]');
  notif.click();
  await new Promise((r) => setTimeout(r, 350));
  const dropdown = notif.parentElement.querySelector('.dropdown-menu');
  return {
    temaBerubah: setelahTema,
    panelKontrolTerbuka: panel,
    dropdownNotifikasi: dropdown ? getComputedStyle(dropdown).display !== 'none' : false,
    searchTerfokus: (document.querySelector('[data-global-search]').focus(), document.activeElement === document.querySelector('[data-global-search]'))
  };
});
console.log('\nFungsi tombol:', JSON.stringify(fn), errs.length ? '❌ ' + errs[0] : '✅ tanpa error');

await browser.close();
console.log(gagal === 0 ? '\n✅ Navbar lulus semua lebar layar.' : `\n❌ ${gagal} lebar layar bermasalah.`);
process.exit(gagal === 0 ? 0 : 1);
