/**
 * qa/shot-tools.mjs — tangkapan layar untuk menu "Tools" + aplikasi SatuReport.
 *
 * Menghasilkan berkas di preview/:
 *   tools-menu.png              dashboard dengan submenu Tools dibuka
 *   report-design.png           Report Design (ID)
 *   report-viewer.png           Report Viewer (ID)
 *   report-example.png          Report Example (ID)
 *   report-example-inggris.png  Report Example dalam bahasa Inggris
 *   report-viewer-file-server.png  contoh ?url= dari galeri (data-URI, tanpa server)
 *   offline-report-design.png   berkas mandiri offline/report-design.html
 *
 * Widget AI dimatikan (kecuali pada satu tangkapan galeri) supaya isi terlihat jelas.
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const BASE = 'http://localhost:8080/';
const P = new URL('../preview/', import.meta.url).pathname;
const browser = await chromium.launch();

const tanpaAI = async (ctx) => {
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] }));
      sessionStorage.setItem('app.aiChat.teaser', '1');
      localStorage.setItem('app.idleMs', '0');
    } catch (e) {}
  });
};

/* ---------- 1. sidebar dengan menu Tools terbuka ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await tanpaAI(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('li[data-url^="Tools"] button.side-link');
  await page.waitForTimeout(500);
  await page.screenshot({ path: P + 'tools-menu.png' });
  console.log('  ✔ tools-menu.png');
  await ctx.close();
}

/* ---------- 2. tiga halaman Tools (ID) ---------- */
for (const [nama, url] of [
  ['report-design', 'pages/report-design.html'],
  ['report-viewer', 'pages/report-viewer.html'],
  ['report-example', 'pages/report-example.html'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await tanpaAI(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: P + nama + '.png' });
  console.log('  ✔ ' + nama + '.png');
  await ctx.close();
}

/* ---------- 3. galeri dalam bahasa Inggris (dengan widget AI) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '404.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('app.locale', 'en'));
  await page.goto(BASE + 'pages/report-example.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: P + 'report-example-inggris.png' });
  console.log('  ✔ report-example-inggris.png');
  await ctx.close();
}

/* ---------- 4. contoh ?url= dari galeri (berkas mandiri, tanpa server) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await tanpaAI(ctx);
  const page = await ctx.newPage();
  await page.goto('file://' + PROYEK + 'offline/report-example.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const tombol = [];
  for (const t of await page.$$('button')) if ((await t.textContent()).includes('Viewer')) tombol.push(t);
  if (tombol[10]) {
    await tombol[10].click();
    await page.waitForTimeout(3000);
    const tampil = page.locator('button:has-text("Tampilkan Report")').last();
    if (await tampil.count()) { await tampil.click(); await page.waitForTimeout(2200); }
  }
  await page.screenshot({ path: P + 'report-viewer-file-server.png' });
  console.log('  ✔ report-viewer-file-server.png');
  await ctx.close();
}

/* ---------- 4b. contoh Sub Report (master–detail) di berkas mandiri ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await tanpaAI(ctx);
  const page = await ctx.newPage();
  await page.goto('file://' + PROYEK + 'offline/report-viewer.html?example=sales-subreport', { waitUntil: 'load' });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: P + 'report-sub-report.png' });
  console.log('  ✔ report-sub-report.png');
  await ctx.close();
}

/* ---------- 5. berkas mandiri Report Design ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await tanpaAI(ctx);
  const page = await ctx.newPage();
  await page.goto('file://' + PROYEK + 'offline/report-design.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: P + 'offline-report-design.png' });
  console.log('  ✔ offline-report-design.png');
  await ctx.close();
}

await browser.close();
console.log('\nSelesai: tangkapan layar Tools diperbarui.');
