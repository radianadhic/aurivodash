import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
await page.goto('http://localhost:8080/pages/index.html', { waitUntil: 'load' });
await page.waitForTimeout(900);
await page.evaluate(() => window.Alpine.store('ui').toggleControl());
await page.waitForTimeout(700);
await page.screenshot({ path: PROYEK + 'preview/panel-tema-bahasa.png', clip: { x: 1030, y: 0, width: 470, height: 950 } });
const info = await page.evaluate(() => ({
  preset: document.querySelectorAll('.preset-card').length,
  swatch: document.querySelectorAll('.skin-swatch').length,
  tombolBahasa: [...document.querySelectorAll('.control-sidebar button')].map((b) => b.textContent.trim()).filter((t) => /Indonesia|English/.test(t)),
}));
console.log(JSON.stringify(info));
await browser.close();
