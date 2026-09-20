/**
 * qa/shot-minigrid.mjs — tangkapan layar contoh Mini Grid (1–6) ke preview/.
 *
 *   node shot-minigrid.mjs
 * Prasyarat: server statis di http://localhost:8080 (dari akar proyek)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8080/';
const P = new URL('../preview/', import.meta.url).pathname;
const browser = await chromium.launch();

/* widget AI ditutup supaya grid terlihat penuh di tangkapan layar */
const tanpaWidget = (ctx) => ctx.addInitScript(() => {
  try {
    localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] }));
    sessionStorage.setItem('app.aiChat.teaser', '1');
  } catch (e) {}
});

for (const no of [1, 2, 3, 4, 5, 6]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await tanpaWidget(ctx);
  await page.goto(`${BASE}pages/mini-grid-${no}.html`, { waitUntil: 'load' });
  await page.waitForFunction((n) => {
    const g = window.MiniGridDemo.grid[n];
    return g && (n === 6 ? g.s.total > 0 : g.data.length > 0);
  }, no);
  await page.waitForTimeout(1400);                       /* status sumber & animasi selesai */
  await page.screenshot({ path: `${P}mini-grid-${no}.png` });
  console.log('✔ mini-grid-' + no + '.png');
  await ctx.close();
}

/* contoh 1: potongan header + toolbar grid (dokumentasi tombol Muat ulang) */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  await tanpaWidget(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}pages/mini-grid-1.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MiniGridDemo.grid[1].data.length > 0);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${P}minigrid-refresh.png`, clip: { x: 265, y: 0, width: 1175, height: 405 } });
  console.log('✔ minigrid-refresh.png');
  await ctx.close();
}

/* contoh 5: keadaan saat memuat (lapisan status + kunci layar) */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  await tanpaWidget(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}pages/mini-grid-5.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MiniGridDemo.grid[5].data.length > 0);
  await page.waitForTimeout(600);
  await page.click('#minigrid-5 [data-act="refresh"]');
  await page.waitForTimeout(300);                        /* status muat masih tampil */
  await page.screenshot({ path: `${P}minigrid-5-memuat.png` });
  console.log('✔ minigrid-5-memuat.png');
  await ctx.close();
}

/* contoh 6: mode gelap */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  await tanpaWidget(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}pages/mini-grid-6.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MiniGridDemo.grid[6].s.total > 0);
  await page.evaluate(() => window.Alpine.store('ui').applyTheme('dark'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${P}minigrid-6-gelap.png` });
  console.log('✔ minigrid-6-gelap.png');
  await ctx.close();
}

await browser.close();
console.log('\nSelesai: tangkapan layar Mini Grid diperbarui.');
