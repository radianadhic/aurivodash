/**
 * qa/check-sidebar-light.mjs — kontras sidebar putih (light) + tombol keluar.
 *
 * Catatan: kartu sidebar-user sudah dihapus (permintaan pengguna), jadi uji kontras
 * kini memakai elemen yang tersisa: label tombol "Keluar" + baris versi di kaki sidebar.
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
await page.goto('http://localhost:8080/pages/index.html', { waitUntil: 'load' });
await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const ui = window.Alpine.store('ui');
  ui.applyPreset(ui.presets[0]); // Perbankan Klasik: sidebar putih
  await new Promise((r) => setTimeout(r, 500));
  const cs = (el) => getComputedStyle(el);
  const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const rasio = (fg, bg) => { const a = lum(fg), b = lum(bg); return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10; };
  const sidebar = document.querySelector('.app-sidebar');
  const bg = cs(sidebar).backgroundColor;
  const keluar = document.querySelector('.side-logout .txt');
  const meta = document.querySelector('.sidebar-footer .mt-2');
  const input = document.querySelector('.sidebar-input');
  return {
    kartuPenggunaAda: !!document.querySelector('.sidebar-user'),
    labelKeluar: keluar.textContent.trim(),
    warnaKeluar: cs(keluar).color,
    kontrasKeluar: rasio(cs(keluar).color, bg),
    kontrasMeta: rasio(cs(meta).color, bg),
    /* latar input ber-alpha → komposisikan dulu dengan latar sidebar */
    kontrasInput: (() => {
      const n = cs(input).backgroundColor.match(/[\d.]+/g).map(Number);
      const a = n.length > 3 ? n[3] : 1;
      const bgS = cs(document.querySelector('.app-sidebar')).backgroundColor.match(/[\d.]+/g).map(Number);
      const campur = `rgb(${[0, 1, 2].map((i) => Math.round(n[i] * a + bgS[i] * (1 - a))).join(',')})`;
      return rasio(cs(input).color, campur);
    })(),
    inputWarna: cs(input).color,
    inputLatar: cs(input).backgroundColor,
    heading: cs(document.querySelector('.nav-heading')).color,
    aktifBg: cs(document.querySelector('.side-link.active')).backgroundColor,
  };
});
console.log(JSON.stringify(r, null, 1));
const gagal = [];
if (r.kartuPenggunaAda) gagal.push('kartu sidebar-user masih ada');
if (r.kontrasKeluar < 4.5) gagal.push('kontras label Keluar < 4.5 (' + r.kontrasKeluar + ')');
if (r.kontrasMeta < 4.5) gagal.push('kontras baris versi < 4.5 (' + r.kontrasMeta + ')');
if (r.kontrasInput < 4.5) gagal.push('kontras kotak pencarian < 4.5 (' + r.kontrasInput + ')');
await page.screenshot({ path: PROYEK + 'preview/sidebar-terang.png' });
await page.evaluate(() => window.Alpine.store('ui').reset());
await browser.close();
console.log(gagal.length ? '❌ ' + gagal.join('; ') : '✅ Sidebar terang: kontras teks & tombol keluar lulus.');
process.exit(gagal.length ? 1 : 0);
