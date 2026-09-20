/**
 * qa/check-i18n-offline.mjs — memastikan tema & bahasa juga jalan di berkas mandiri
 * (termasuk di dalam iframe sandbox tanpa localStorage).
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
const browser = await chromium.launch();
const ctx = await browser.newContext({ offline: true, viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + PROYEK + 'offline/dashboard.html', { waitUntil: 'load' });
await page.waitForTimeout(1000);
const r = await page.evaluate(async () => {
  window.Alpine.store('ui').applyPreset(window.Alpine.store('ui').presets[1]); // Private Banking
  window.Alpine.store('i18n').set('en');
  await new Promise((r) => setTimeout(r, 400));
  return {
    tema: document.documentElement.getAttribute('data-theme'),
    skin: document.documentElement.getAttribute('data-skin'),
    lang: document.documentElement.lang,
    sidebar: [...document.querySelectorAll('.side-link .txt')].slice(0, 4).map((n) => n.textContent.trim()),
    judul: document.querySelector('.page-title').textContent.trim(),
    pusatDonat: (document.querySelector('.chart svg text') || {}).textContent,
    panelBahasa: document.querySelector('.control-sidebar h3').textContent.trim(),
  };
});
console.log('OFFLINE EN + Private Banking:', JSON.stringify(r, null, 1));
console.log('error:', errs.length ? errs.slice(0, 3) : 'tidak ada');
await page.screenshot({ path: PROYEK + 'preview/offline-private-banking-en.png' });
// kembalikan ke default supaya berkas offline tidak menyimpan preferensi
await page.evaluate(() => { window.Alpine.store('ui').reset(); window.Alpine.store('i18n').set('id'); });
await browser.close();
