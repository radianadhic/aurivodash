
/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
/**
 * qa/check-lock-screen.mjs — regresi "kunci layar & animasi memuat" (window.Lock).
 *
 * Diuji:
 *   1. API: show / hide / tulis / jalan / wrap / demo / versi tersedia di semua halaman.
 *   2. Tampilan: overlay, kotak, cincin berputar, gembok, bilah progres, jejak langkah,
 *      atribut role/aria-modal/aria-busy, dan halaman tidak bisa digulir selama kunci.
 *   3. Mode: load / form / screen (data-mode + gembok bergoyang), nada primary/success/danger.
 *   4. Waktu: jalan(ms) menutup otomatis; wrap(Promise) menutup saat selesai maupun gagal.
 *   5. Interaksi: Esc menutup mode load/form, TIDAK menutup mode screen.
 *   6. Dwibahasa: judul & pesan ikut berganti saat bahasa diubah (event i18n:changed).
 *   7. Tema: warna kunci mengikuti aksen preset & mode gelap (token --c-primary).
 *   8. Integrasi nyata: dipakai oleh muat ulang Mini Grid, pengiriman formulir aplikasi
 *      nasabah, dan verifikasi OTP di halaman masuk.
 *   9. Berkas mandiri: offline/mobile-nasabah.html & offline/mini-grid-1.html memuat Lock.
 *
 * Jalankan (dari folder qa/):
 *   node check-lock-screen.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);

async function halaman(url, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  /* asisten AI selalu muncul → mulai tertutup supaya tidak menutupi tombol yang diuji */
  await ctx.addInitScript(() => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}
const info = (page) => page.evaluate(() => {
  const l = document.querySelector('.lock-overlay');
  if (!l) return { ada: false };
  const cs = (sel) => {
    const el = l.querySelector(sel);
    return el ? getComputedStyle(el) : null;
  };
  const box = cs('.lock-box'), ring = cs('.lock-ring-svg'), bar = cs('.lock-bar i');
  return {
    ada: true,
    open: l.getAttribute('data-open'),
    mode: l.getAttribute('data-mode'),
    tone: l.getAttribute('data-tone'),
    role: l.getAttribute('role'),
    modal: l.getAttribute('aria-modal'),
    busy: l.getAttribute('aria-busy'),
    judul: (l.querySelector('[data-lock-title]') || {}).textContent,
    pesan: (l.querySelector('[data-lock-message]') || {}).textContent,
    gembok: !!l.querySelector('.lock-gembok svg'),
    ringAnimasi: ring ? ring.animationName : null,
    barAnimasi: bar ? bar.animationName : null,
    boxBg: box ? box.backgroundColor : null,
    overflow: document.documentElement.style.overflow,
  };
});

/* ---------- 1. API tersedia ---------- */
console.log('1. API window.Lock');
{
  const { ctx, page, errs } = await halaman('pages/index.html');
  const api = await page.evaluate(() => {
    const L = window.Lock || {};
    return { ada: !!window.Lock, versi: L.versi, fn: ['show', 'hide', 'tulis', 'jalan', 'wrap', 'demo', 'segarkan'].filter((k) => typeof L[k] === 'function') };
  });
  if (!api.ada) fail('window.Lock tidak dimuat di halaman dashboard');
  else ok('window.Lock tersedia (versi ' + api.versi + ')');
  if (api.fn.length !== 7) fail('fungsi API tidak lengkap: ' + api.fn.join(', ')); else ok('API lengkap: ' + api.fn.join(' · '));
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90));
  await ctx.close();
}

/* ---------- 2. tampilan overlay ---------- */
console.log('2. Tampilan overlay');
{
  const { ctx, page } = await halaman('pages/index.html');
  await page.evaluate(() => window.Lock.show({ mode: 'load' }));
  await page.waitForTimeout(350);
  const s = await info(page);
  if (s.open !== '1') fail('overlay tidak terbuka'); else ok('overlay terbuka (data-open=1)');
  if (s.role !== 'alertdialog' || s.modal !== 'true' || s.busy !== 'true') fail('atribut aksesibilitas tidak lengkap'); else ok('role=alertdialog · aria-modal · aria-busy');
  if (!s.gembok) fail('gembok SVG tidak dirender'); else ok('gembok SVG dirender');
  if (s.ringAnimasi !== 'lock-spin') fail('cincin tidak berputar (' + s.ringAnimasi + ')'); else ok('cincin berputar (lock-spin)');
  if (s.barAnimasi !== 'lock-slide') fail('bilah progres tidak beranimasi (' + s.barAnimasi + ')'); else ok('bilah progres beranimasi (lock-slide)');
  if (s.overflow !== 'hidden') fail('halaman masih bisa digulir saat terkunci'); else ok('gulir halaman dikunci (html overflow:hidden)');
  const langkah = await page.locator('.lock-jejak i').count();
  if (langkah !== 3) fail('jejak langkah bukan 3 titik: ' + langkah); else ok('3 titik jejak langkah');
  await page.evaluate(() => window.Lock.hide());
  await page.waitForTimeout(320);
  const s2 = await info(page);
  if (s2.open !== '0' || s2.overflow === 'hidden') fail('overlay tidak tertutup / gulir tidak dipulihkan'); else ok('overlay tertutup & gulir dipulihkan');
  await ctx.close();
}

/* ---------- 3. mode & nada ---------- */
console.log('3. Mode (load/form/screen) & nada warna');
{
  const { ctx, page } = await halaman('pages/index.html');
  const hasil = {};
  for (const mode of ['load', 'form', 'screen']) {
    await page.evaluate((m) => window.Lock.show({ mode: m }), mode);
    await page.waitForTimeout(250);
    const s = await info(page);
    const goyang = await page.locator('.lock-overlay[data-mode="form"] .lock-gembok svg').evaluate((el) => getComputedStyle(el).animationName).catch(() => '-');
    hasil[mode] = { mode: s.mode, goyang };
  }
  if (hasil.load.mode !== 'load' || hasil.form.mode !== 'form' || hasil.screen.mode !== 'screen') fail('data-mode tidak sesuai');
  else ok('data-mode load / form / screen diterapkan');
  if (hasil.form.goyang !== 'lock-rock') fail('gembok tidak bergoyang di mode form (' + hasil.form.goyang + ')'); else ok('gembok bergoyang di mode form (lock-rock)');
  const tones = {};
  for (const tone of ['success', 'danger']) {
    await page.evaluate((t) => window.Lock.show({ mode: 'screen', tone: t }), tone);
    await page.waitForTimeout(250);
    tones[tone] = await page.evaluate(() => {
      const g = document.querySelector('.lock-gembok');
      return getComputedStyle(g).color;
    });
  }
  await page.evaluate(() => window.Lock.show({ mode: 'load' }));
  await page.waitForTimeout(200);
  const warnaAksen = await page.evaluate(() => getComputedStyle(document.querySelector('.lock-gembok')).color);
  if (tones.success === tones.danger) fail('nada success & danger tidak berbeda warnanya'); else ok(`nada warna berbeda (success ${tones.success} vs danger ${tones.danger})`);
  await page.evaluate(() => window.Lock.hide());
  await ctx.close();
}

/* ---------- 4. waktu otomatis & Promise ---------- */
console.log('4. Waktu otomatis & Promise');
{
  const { ctx, page } = await halaman('pages/index.html');
  await page.evaluate(() => window.Lock.jalan(700, { mode: 'load', title: 'Menyimpan' }));
  await page.waitForTimeout(250);
  if ((await info(page)).open !== '1') fail('jalan() tidak menampilkan overlay');
  await page.waitForTimeout(800);
  if ((await info(page)).open !== '0') fail('jalan() tidak menutup otomatis'); else ok('jalan(700) menutup otomatis');

  await page.evaluate(() => {
    window.Lock.wrap(new Promise((r) => setTimeout(r, 900)), { mode: 'form', title: 'Mengirim' });
  });
  await page.waitForTimeout(300);
  if ((await info(page)).open !== '1') fail('wrap() tidak menampilkan overlay');
  await page.waitForTimeout(900);
  if ((await info(page)).open !== '0') fail('wrap() tidak menutup saat Promise selesai'); else ok('wrap(Promise selesai) menutup otomatis');

  await page.evaluate(() => {
    const p = Promise.reject(new Error('uji gagal'));
    p.catch(() => {});
    window.Lock.wrap(p, { mode: 'form' });
  });
  await page.waitForTimeout(400);
  if ((await info(page)).open !== '0') fail('wrap() tidak menutup saat Promise gagal'); else ok('wrap(Promise gagal) tetap menutup overlay');

  /* tulis() mengganti pesan, demo() berhitung lalu membuka */
  await page.evaluate(() => window.Lock.show({ mode: 'load' }));
  await page.evaluate(() => window.Lock.tulis('Mengunggah berkas…', 'Unggah'));
  await page.waitForTimeout(250);
  let s = await info(page);
  if (!/Mengunggah berkas/.test(s.pesan) || !/Unggah/.test(s.judul)) fail('tulis() tidak memperbarui teks'); else ok('tulis() memperbarui judul & pesan');
  await page.evaluate(() => window.Lock.demo(2, { mode: 'screen' }));
  await page.waitForTimeout(300);
  s = await info(page);
  const angka = (s.pesan || '').replace(/\D/g, '');
  if (s.mode !== 'screen' || !angka) fail('demo() tidak menampilkan hitung mundur: ' + s.pesan); else ok('demo(2) menampilkan hitung mundur ("' + s.pesan + '")');
  await page.waitForTimeout(3200);
  if ((await info(page)).open !== '0') fail('demo() tidak menutup otomatis'); else ok('demo(2) membuka layar otomatis');
  await ctx.close();
}

/* ---------- 5. tombol Esc ---------- */
console.log('5. Tombol Esc');
{
  const { ctx, page } = await halaman('pages/index.html');
  await page.evaluate(() => window.Lock.show({ mode: 'load' }));
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if ((await info(page)).open !== '0') fail('Esc tidak menutup mode load'); else ok('Esc menutup mode load');
  await page.evaluate(() => window.Lock.show({ mode: 'screen' }));
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if ((await info(page)).open !== '1') fail('Esc menutup mode screen (seharusnya tetap)'); else ok('Esc tidak menutup mode screen (sesuai rancangan)');
  await page.evaluate(() => window.Lock.hide());
  await ctx.close();
}

/* ---------- 6. dwibahasa ---------- */
console.log('6. Dwibahasa');
{
  const { ctx, page } = await halaman('pages/index.html');
  await page.evaluate(() => window.Lock.show({ mode: 'load' }));
  await page.waitForTimeout(250);
  const id = await info(page);
  await page.evaluate(() => window.I18n.set('en'));
  await page.waitForTimeout(400);
  const en = await info(page);
  if (id.judul === en.judul) fail('judul overlay tidak diterjemahkan (' + en.judul + ')');
  else ok(`judul overlay: "${id.judul.trim()}" → "${en.judul.trim()}"`);
  if (id.pesan === en.pesan) fail('pesan overlay tidak diterjemahkan (' + en.pesan + ')');
  else ok(`pesan overlay: "${id.pesan.trim()}" → "${en.pesan.trim()}"`);
  await page.evaluate(() => window.Lock.hide());
  await ctx.close();
}

/* ---------- 7. tema & mode gelap ---------- */
console.log('7. Tema & mode gelap');
{
  const { ctx, page } = await halaman('pages/index.html');
  await page.evaluate(() => window.Lock.show({ mode: 'load' }));
  await page.waitForTimeout(300);
  const biru = await page.evaluate(() => getComputedStyle(document.querySelector('.lock-gembok')).color);
  await page.evaluate(() => { Alpine.store('ui').setSkin ? Alpine.store('ui').setSkin('emerald') : null; });
  const hijau = await page.evaluate(async () => {
    const ui = Alpine.store('ui');
    if (ui.skin !== 'emerald') { ui.skin = 'emerald'; document.documentElement.setAttribute('data-skin', 'emerald'); }
    await new Promise((r) => setTimeout(r, 300));
    return getComputedStyle(document.querySelector('.lock-gembok')).color;
  });
  if (biru === hijau) fail('warna kunci tidak mengikuti preset aksen (' + biru + ')'); else ok(`warna kunci mengikuti aksen (${biru} → ${hijau})`);
  const gelap = await page.evaluate(async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise((r) => setTimeout(r, 300));
    const l = document.querySelector('.lock-box');
    return { bg: getComputedStyle(l).backgroundColor, teks: getComputedStyle(l).color };
  });
  if (!gelap.bg) fail('overlay gelap tidak terhitung'); else ok('mode gelap: kotak ' + gelap.bg + ' · teks ' + gelap.teks);
  await page.evaluate(() => window.Lock.hide());
  await ctx.close();
}

/* ---------- 8. integrasi di halaman nyata ---------- */
console.log('8. Integrasi nyata (Mini Grid · aplikasi nasabah · login)');
{
  const { ctx, page } = await halaman('pages/mini-grid-1.html');
  await page.waitForSelector('#minigrid-1 [data-act="refresh"]');
  await page.click('#minigrid-1 [data-act="refresh"]');
  await page.waitForTimeout(250);
  const s = await info(page);
  if (s.open !== '1' || !/Mini Grid/.test(s.judul)) fail('muat ulang Mini Grid tidak memakai kunci layar');
  else ok('Mini Grid: kunci layar saat muat ulang ("' + s.judul.trim() + '")');
  await page.waitForFunction(() => !document.querySelector('.lock-overlay[data-open="1"]'), null, { timeout: 10000 });
  await page.waitForTimeout(200);
  if ((await info(page)).open !== '0') fail('Mini Grid: kunci layar tidak tertutup');
  else ok('Mini Grid: kunci layar tertutup setelah data masuk');
  await ctx.close();

  /* mobile: ronde 4 menambahkan kunci otomatis → matikan idle dulu, lalu buka
     bila overlay biometric sempat terbuka sebelum klik. */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mctx.addInitScript(() => localStorage.setItem('app.idleMs', '0'));
  await mctx.addInitScript(() => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} });
  const mpage = await mctx.newPage();
  const merrs = [];
  mpage.on('pageerror', (e) => merrs.push(e.message));
  mpage.on('console', (mm) => { if (mm.type() === 'error') merrs.push(mm.text()); });
  await mpage.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await mpage.waitForTimeout(1600);
  if (await mpage.locator('.bio-layar[data-open="1"]').count()) {
    await mpage.locator('[data-bio-jari]').click();
    await mpage.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
  }
  const m = { ctx: mctx, page: mpage, errs: merrs };
  await m.page.click('.mobile-aksi:has-text("Transfer")');
  await m.page.click('.mobile-numpad button:has-text("5")');
  await m.page.click('.mobile-numpad button:has-text("000")');
  await m.page.click('.mobile-sheet button:has-text("Lanjut")');
  await m.page.waitForTimeout(250);
  const sm = await info(m.page);
  if (sm.open !== '1' || sm.mode !== 'form') fail('aplikasi nasabah: kunci layar mode form tidak tampil');
  else ok('Aplikasi nasabah: kunci layar mode "form" saat mengirim ("' + sm.judul.trim() + '")');
  await m.page.waitForSelector('.lock-overlay[data-open="0"]', { timeout: 8000 });
  ok('Aplikasi nasabah: kunci layar tertutup setelah transaksi');
  await m.ctx.close();

  const l = await halaman('login.html');
  await l.page.waitForSelector('#splash', { state: 'detached' });
  await l.page.click('button[type="button"]:has(i[data-icon="person-check"])');
  await l.page.click('button[type="submit"]');
  await l.page.waitForSelector('[data-otp]');
  await l.page.click('button:has-text("Isi otomatis")');
  await l.page.click('button[type="submit"]:has-text("Verifikasi")');
  await l.page.waitForTimeout(300);
  const sl = await info(l.page);
  if (sl.open !== '1' || sl.mode !== 'screen') fail('login: kunci layar tidak dipakai saat verifikasi OTP');
  else ok('Login: kunci layar mode "screen" saat verifikasi OTP');
  await l.ctx.close();
}

/* ---------- 9. berkas mandiri ---------- */
console.log('9. Berkas mandiri offline');
{
  for (const berkas of ['offline/mobile-nasabah.html', 'offline/mini-grid-1.html', 'offline/login.html']) {
    const jalur = PROYEK + '' + berkas;
    if (!fs.existsSync(jalur)) { fail(berkas + ' tidak ada — jalankan npm run offline'); continue; }
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    const errs = []; const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + jalur, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      if (!window.Lock) return { lock: false };
      window.Lock.show({ mode: 'load' });
      const l = document.querySelector('.lock-overlay');
      const hasil = { lock: true, open: l && l.getAttribute('data-open'), gembok: !!(l && l.querySelector('.lock-gembok svg')) };
      window.Lock.hide();
      return hasil;
    });
    const masalah = [];
    if (!r.lock) masalah.push('window.Lock tidak ada');
    if (r.open !== '1') masalah.push('overlay tidak tampil');
    if (!r.gembok) masalah.push('gembok tidak dirender');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 60));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal saat offline');
    if (masalah.length) fail(berkas + ': ' + masalah.join(' | '));
    else ok(berkas + ': kunci layar berfungsi tanpa jaringan');
    await ctx.close();
  }
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Kunci layar & animasi memuat lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
