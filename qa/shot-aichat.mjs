/**
 * qa/shot-aichat.mjs — tangkapan layar asisten AI untuk preview/.
 * Jalankan: node shot-aichat.mjs   (server harus hidup di :8080)
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
const BASE = 'http://localhost:8080/';
const P = new URL('../preview/', import.meta.url).pathname;
const b = await chromium.launch();

/* 1–2. dashboard: percakapan di mode terang & gelap */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + 'pages/index.html');
  await p.waitForTimeout(1800);
  await p.evaluate(() => window.AIChat.kirim('notifikasi saya'));
  await p.waitForTimeout(1700);
  await p.screenshot({ path: P + 'ai-chat-dashboard.png' });
  await p.evaluate(() => window.I18n.set('en'));
  await p.waitForTimeout(600);
  await p.evaluate(() => window.AIChat.kirim('offline mode'));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: P + 'ai-chat-bahasa-inggris.png' });
  await p.evaluate(() => { window.I18n.set('id'); window.Alpine.store('ui').setTheme('dark'); });
  await p.waitForTimeout(700);
  await p.evaluate(() => window.AIChat.kirim('jadwal otomatis'));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: P + 'ai-chat-gelap.png' });
  await ctx.close();
}

/* 3. aplikasi nasabah (di dalam kerangka ponsel) */
{
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('app.idleMs', '0'));
  const p = await ctx.newPage();
  await p.goto(BASE + 'mobile/index.html');
  await p.waitForTimeout(2200);
  await p.locator('[data-bio-jari]').click();
  await p.waitForTimeout(1600);
  await p.evaluate(() => { document.querySelectorAll('.push-banner').forEach((x) => x.remove()); window.AIChat.kirim('biometric'); });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: P + 'ai-chat-mobile.png' });
  await ctx.close();
}

/* 4. halaman perkenalan (tanpa Alpine) */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: P + 'ai-chat-landing.png' });
  await ctx.close();
}

/* 5. berkas mandiri offline (file://) */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  await p.goto('file://' + PROYEK + 'offline/dashboard.html');
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.AIChat.kirim('mode offline'));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: P + 'ai-chat-offline.png' });
  await ctx.close();
}

await b.close();
console.log('Selesai: 5 tangkapan layar asisten AI');
