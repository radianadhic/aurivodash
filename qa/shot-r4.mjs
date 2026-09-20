import { chromium } from 'playwright';
const P = new URL('../preview/', import.meta.url).pathname;
const b = await chromium.launch();

/* ---------- dashboard: pusat notifikasi + scheduler ---------- */
const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8080/pages/notifications.html');
await p.waitForTimeout(1400);
await p.screenshot({ path: P + 'notifikasi-pusat.png' });
await p.goto('http://127.0.0.1:8080/pages/scheduler.html');
await p.waitForTimeout(1400);
await p.screenshot({ path: P + 'scheduler.png' });
await p.evaluate(() => { window.Alpine.store('ui').setTheme('dark'); });
await p.waitForTimeout(600);
await p.screenshot({ path: P + 'scheduler-gelap.png' });
await p.evaluate(() => { window.Alpine.store('ui').setTheme('light'); });
await p.waitForTimeout(400);
/* lonceng navbar terbuka + banner push */
await p.goto('http://127.0.0.1:8080/pages/index.html');
await p.waitForTimeout(1200);
await p.evaluate(() => window.Notify.banner({ judul: 'Rekonsiliasi selesai', pesan: '12.480 transaksi cocok dengan mutasi bank.', ikon: 'arrow-repeat', tone: 'success', kategori: 'Sistem' }));
await p.waitForTimeout(500);
await p.click('button[aria-label="Notifikasi"]');
await p.waitForTimeout(500);
await p.screenshot({ path: P + 'notifikasi-lonceng.png' });
await ctx.close();

/* ---------- mobile ---------- */
const hp = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await hp.newPage();
await m.goto('http://127.0.0.1:8080/mobile/index.html');
await m.waitForTimeout(2000);
await m.screenshot({ path: P + 'mobile-kunci.png' });          // layar kunci sidik jari
await m.locator('[data-bio-pin-pilih]').click();
await m.waitForTimeout(400);
for (const a of ['1', '2', '3']) { await m.locator(`[data-bio-angka="${a}"]`).click(); await m.waitForTimeout(120); }
await m.screenshot({ path: P + 'mobile-pin.png' });             // papan PIN
await m.locator('[data-bio-jari-kembali]').click().catch(() => {});
await m.locator('[data-bio-jari]').click();
await m.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 8000 });
await m.waitForTimeout(5200);   // biarkan toast sambutan (auto-tutup 4,2 s) hilang dulu
/* push banner (bersihkan banner lama dulu supaya tidak bertumpuk) */
await m.evaluate(() => {
  document.querySelectorAll('.push-banner').forEach((b) => b.remove());
  window.Notify.push({ lingkup: 'mobile', judul: 'Pembayaran berhasil', pesan: 'Tagihan PLN Rp 245.600 sudah dibayar.', ikon: 'receipt', tone: 'success', kategori: 'Tagihan' });
});
await m.waitForTimeout(1400);
await m.screenshot({ path: P + 'mobile-push.png' });
await m.locator('.push-tutup').first().click();   // bersihkan banner utk tangkapan berikutnya
await m.waitForTimeout(500);
const pindah = async (id) => {
  await m.evaluate((i) => Alpine.$data(document.querySelector('.mobile-app')).pindah(i), id);
  await m.waitForTimeout(900);
  await m.evaluate(() => { const i = document.getElementById('mobile-isi'); if (i) i.scrollTop = 0; });
  await m.waitForTimeout(350);
};
await pindah('bayar');
await pindah('tagihan');
await m.screenshot({ path: P + 'mobile-tagihan.png' });
await m.click('.mobile-segmen button:has-text("Top up")');
await m.waitForTimeout(700);
await m.screenshot({ path: P + 'mobile-topup.png' });
await pindah('jadwal');
await m.screenshot({ path: P + 'mobile-jadwal.png' });
await pindah('notif');
await m.screenshot({ path: P + 'mobile-notif.png' });
await pindah('keamanan');
await m.screenshot({ path: P + 'mobile-keamanan.png' });
await m.click('.mobile-segmen button:has-text("Tagihan")').catch(() => {});
await hp.close();
await b.close();
console.log('Selesai: 11 tangkapan layar ronde 4');
