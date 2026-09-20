/**
 * qa/check-login-otp.mjs — regresi halaman masuk: splash screen + OTP dua langkah.
 *
 * Diuji:
 *   1. Splash screen: tampil saat halaman dibuka, berganti status, hilang otomatis
 *      tanpa mengunci halaman (jaring pengaman 3,4 detik), dan tidak ada di <body> lagi.
 *   2. Langkah 1: validasi email/kata sandi, kredensial demo, kunci layar saat memeriksa.
 *   3. Langkah 2 (OTP): 6 kotak digit, kode demo 6 digit, hitung mundur 60 detik,
 *      kirim ulang, tempel (paste), navigasi panah/backspace, tombol nonaktif sebelum lengkap.
 *   4. Kode salah → dialog kunci layar merah + getar + kotak dikosongkan + toast.
 *   5. Kode benar → kunci layar "Selamat datang" lalu redirect ke pages/index.html.
 *   6. Kembali ke langkah kata sandi, dan kernel overlay (gerbang) tidak saling menutup.
 *   7. Dwibahasa: mode EN bersih dari teks antarmuka Indonesia.
 *   8. Berkas mandiri offline/login.html (jaringan dimatikan).
 *
 * Jalankan (dari folder qa/):
 *   node check-login-otp.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);

/* buka halaman login dalam keadaan bersih */
async function buka(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + 'login.html', { waitUntil: 'load' });
  return { ctx, page, errs };
}
const state = (page) => page.evaluate(() => {
  const d = Alpine.$data(document.querySelector('.auth-card'));
  const l = document.querySelector('.lock-overlay');
  return {
    langkah: d.langkah, kode: d.kode, kodeOTP: d.kodeOTP, salah: d.salah,
    verifikasi: d.verifikasi, hitung: d.hitung,
    lock: !!l && l.getAttribute('data-open') === '1',
    lockJudul: l ? (l.querySelector('[data-lock-title]') || {}).textContent : null,
    lockMode: l ? l.getAttribute('data-mode') : null,
    lockTone: l ? l.getAttribute('data-tone') : null,
  };
});

/* ---------- 1. splash screen ---------- */
console.log('1. Splash screen');
{
  const { ctx, page, errs } = await buka();
  const adaAwal = await page.locator('#splash[data-open="1"]').count();
  const status = await page.locator('[data-splash-status]').innerText().catch(() => '');
  const logo = await page.locator('#splash .splash-logo svg').count();
  const nama = await page.locator('#splash .splash-nama').innerText().catch(() => '');
  if (!adaAwal) fail('splash tidak tampil saat halaman dibuka'); else ok('splash tampil saat halaman dibuka');
  if (!logo) fail('logo splash tidak dirender'); else ok('logo splash dirender (' + nama.trim() + ')');
  if (!/memuat|menyiapkan/i.test(status)) fail('status splash tidak informatif: ' + status); else ok('status splash: "' + status.trim() + '"');
  // halaman tidak boleh terkunci: form harus bisa diisi walau splash masih ada
  await page.click('button:has-text("Isi demo")');
  const email = await page.inputValue('#email');
  if (email !== 'admin@perusahaan.id') fail('halaman terkunci oleh splash (form tidak bisa diisi)'); else ok('halaman tetap bisa dipakai selama splash');
  await page.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
  const sisa = await page.locator('#splash').count();
  if (sisa) fail('splash tidak hilang otomatis'); else ok('splash hilang otomatis dan dilepas dari DOM');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90)); else ok('tanpa error konsol');
  await ctx.close();
}

/* ---------- 2. langkah 1: validasi + kunci layar ---------- */
console.log('2. Langkah 1 — kredensial & kunci layar');
{
  const { ctx, page, errs } = await buka();
  await page.waitForSelector('#splash', { state: 'detached' });
  await page.fill('#email', 'salah@contoh.id');
  await page.fill('#password', 'salah123');
  await page.click('button[type="submit"]:has-text("Masuk")');
  await page.waitForTimeout(300);
  let s = await state(page);
  if (!s.lock || s.lockMode !== 'form') fail('kunci layar tidak tampil saat memeriksa kredensial'); else ok('kunci layar mode "form" tampil saat memeriksa kredensial (gerbang aktif)');
  await page.waitForTimeout(1200);
  s = await state(page);
  if (s.langkah !== 1 || s.lock) fail('kredensial salah tetap lanjut ke OTP'); else ok('kredensial salah ditolak, kunci layar ditutup');
  // validasi HTML5: email kosong
  await page.fill('#email', '');
  await page.fill('#password', 'x');
  await page.click('button[type="submit"]:has-text("Masuk")');
  await page.waitForTimeout(200);
  const wasValidated = await page.locator('form.was-validated, .was-validated').count();
  s = await state(page);
  if (!wasValidated || s.langkah !== 1) fail('validasi formulir tidak berjalan untuk email kosong'); else ok('validasi formulir berjalan (kelas was-validated)');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90)); else ok('tanpa error konsol');
  await ctx.close();
}

/* ---------- 3. langkah 2: OTP ---------- */
console.log('3. Langkah 2 — OTP 6 digit');
{
  const { ctx, page, errs } = await buka();
  await page.waitForSelector('#splash', { state: 'detached' });
  await page.click('button:has-text("Isi demo")');
  await page.click('button[type="submit"]:has-text("Masuk")');
  await page.waitForSelector('[data-otp]', { timeout: 6000 });
  ok('langkah OTP muncul setelah kredensial demo');
  const kotak = await page.locator('[data-otp]').count();
  if (kotak !== 6) fail('kotak OTP bukan 6: ' + kotak); else ok('6 kotak digit OTP');
  const s0 = await state(page);
  if (!/^\d{6}$/.test(s0.kodeOTP)) fail('kode demo bukan 6 digit: ' + s0.kodeOTP); else ok('kode demo 6 digit tersedia (' + s0.kodeOTP + ')');
  if (s0.hitung < 55 || s0.hitung > 60) fail('hitung mundur kirim ulang tidak mulai dari 60: ' + s0.hitung); else ok('hitung mundur kirim ulang berjalan (' + s0.hitung + ' s)');
  const nonaktif = await page.locator('button[type="submit"]:has-text("Verifikasi")').isDisabled();
  if (!nonaktif) fail('tombol verifikasi aktif sebelum 6 digit lengkap'); else ok('tombol verifikasi nonaktif sebelum kode lengkap');
  // isi 3 digit → masih nonaktif
  for (let i = 0; i < 3; i++) await page.fill(`[data-otp="${i}"]`, String(i + 1));
  if (!(await page.locator('button[type="submit"]:has-text("Verifikasi")').isDisabled())) fail('tombol verifikasi aktif dengan 3 digit'); else ok('tombol tetap nonaktif dengan 3 digit');
  // backspace & panah
  await page.focus('[data-otp="3"]');
  await page.keyboard.press('ArrowLeft');
  const fokus = await page.evaluate(() => document.activeElement.getAttribute('data-otp'));
  if (fokus !== '2') fail('panah kiri tidak memindah fokus (di ' + fokus + ')'); else ok('navigasi panah antar kotak OTP');
  // tempel 6 digit sekaligus
  await page.fill('[data-otp="0"]', '');
  await page.evaluate(() => {
    const el = document.querySelector('[data-otp="0"]');
    const dt = new DataTransfer();
    dt.setData('text', ' 987 654 ');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  const sPaste = await state(page);
  if (sPaste.kode !== '987654') fail('tempel 6 digit gagal: ' + sPaste.kode); else ok('tempel 6 digit sekaligus (spasi diabaikan)');
  if (!sPaste.verifikasi) fail('tempel 6 digit tidak langsung memverifikasi'); else ok('tempel 6 digit → langsung verifikasi (satu langkah)');
  await page.waitForTimeout(2200);
  // kirim ulang setelah dimatikan hitung mundurnya
  await page.evaluate(() => { const d = Alpine.$data(document.querySelector('.auth-card')); d.hitung = 0; });
  await page.click('button:has-text("Kirim ulang")');
  await page.waitForTimeout(200);
  const sUlang = await state(page);
  if (sUlang.kodeOTP === s0.kodeOTP && sUlang.hitung === 0) fail('kirim ulang tidak membuat kode baru'); else ok('kirim ulang membuat kode baru + hitung mundur ulang');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90)); else ok('tanpa error konsol');
  await ctx.close();
}

/* ---------- 4. kode salah ---------- */
console.log('4. Kode OTP salah');
{
  const { ctx, page, errs } = await buka();
  await page.waitForSelector('#splash', { state: 'detached' });
  await page.click('button:has-text("Isi demo")');
  await page.click('button[type="submit"]:has-text("Masuk")');
  await page.waitForSelector('[data-otp]');
  const salah = (await page.locator('[data-otp-demo]').innerText()).trim() === '111111' ? '222222' : '111111';
  for (let i = 0; i < 6; i++) await page.fill(`[data-otp="${i}"]`, salah[i]);
  await page.waitForTimeout(300);
  let s = await state(page);
  if (!s.lock || s.lockMode !== 'screen') fail('kunci layar tidak muncul saat memverifikasi kode'); else ok('kunci layar mode "screen" saat memverifikasi kode');
  await page.waitForTimeout(1800);
  s = await state(page);
  if (!s.salah) fail('kode salah tidak ditandai'); else ok('kode salah ditandai (kotak bergetar)');
  if (s.kode !== '') fail('kotak OTP tidak dikosongkan setelah gagal'); else ok('kotak OTP dikosongkan setelah gagal');
  const getar = await page.locator('.otp-digit[data-salah="1"]').count();
  if (getar !== 6) fail('penanda data-salah tidak diterapkan ke semua kotak'); else ok('penanda data-salah diterapkan (' + getar + ' kotak)');
  const toast = await page.locator('.toast').filter({ hasText: /tidak cocok/i }).count();
  if (!toast) fail('toast "tidak cocok" tidak muncul'); else ok('toast penolakan tampil');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90)); else ok('tanpa error konsol');
  await ctx.close();
}

/* ---------- 5. kode benar → masuk ---------- */
console.log('5. Kode OTP benar → dashboard');
{
  const { ctx, page, errs } = await buka();
  await page.waitForSelector('#splash', { state: 'detached' });
  await page.click('button:has-text("Isi demo")');
  await page.click('button[type="submit"]:has-text("Masuk")');
  await page.waitForSelector('[data-otp]');
  await page.click('button:has-text("Isi otomatis")');
  await page.waitForTimeout(150);
  await page.click('button[type="submit"]:has-text("Verifikasi")');
  await page.waitForTimeout(400);
  const s = await state(page);
  if (!s.lock || s.lockTone !== 'primary') fail('kunci layar verifikasi tidak tampil'); else ok('kunci layar verifikasi tampil (' + String(s.lockJudul).trim() + ')');
  await page.waitForTimeout(1000);
  const s2 = await state(page);
  if (!/Selamat datang|Welcome/.test(String(s2.lockJudul))) fail('kunci layar tidak berganti ke "Selamat datang": ' + s2.lockJudul);
  else ok('kunci layar berganti ke "' + String(s2.lockJudul).trim() + '" sebelum dialihkan');
  await page.waitForURL('**/pages/index.html', { timeout: 9000 });
  ok('dialihkan ke pages/index.html setelah verifikasi');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90)); else ok('tanpa error konsol');
  await ctx.close();
}

/* ---------- 6. kembali ke langkah kata sandi ---------- */
console.log('6. Tombol kembali');
{
  const { ctx, page } = await buka();
  await page.waitForSelector('#splash', { state: 'detached' });
  await page.click('button:has-text("Isi demo")');
  await page.click('button[type="submit"]:has-text("Masuk")');
  await page.waitForSelector('[data-otp]');
  await page.click('button[aria-label="Kembali ke langkah kata sandi"]');
  await page.waitForTimeout(250);
  const s = await state(page);
  if (s.langkah !== 1) fail('tombol kembali tidak mengembalikan ke langkah 1'); else ok('tombol kembali → langkah kata sandi');
  const nilai = await page.inputValue('#email');
  if (nilai !== 'admin@perusahaan.id') fail('email hilang setelah kembali'); else ok('email tetap terisi setelah kembali');
  const terlihat = await page.locator('form:has(#password)').isVisible();
  if (!terlihat) fail('formulir kata sandi tidak tampil lagi'); else ok('formulir kata sandi tampil lagi');
  await ctx.close();
}

/* ---------- 7. dwibahasa ---------- */
console.log('7. Dwibahasa (EN)');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('app.locale', 'en'));
  await page.goto(BASE + 'login.html', { waitUntil: 'load' });
  await page.waitForSelector('#splash', { state: 'detached' });
  await page.locator('button[type="button"]:has(i[data-icon="person-check"])').click();
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-otp]', { timeout: 6000 });
  const teks = await page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) out.push(t); return; }
      if (n.nodeType !== 1 || n.closest('script,style')) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return out;
  });
  const ID = /\b(kode|kirim ulang|belum|menit|detik|masukkan|aman|sandi|perangkat|percayai|silahkan|aplikasi|verifikasi dua langkah|nomor|nasabah|rekening)\b/i;
  const BOLEH = ['admin@perusahaan.id', 'admin123', 'AdminLTE', 'Tailwind', 'OTP', 'Admin', 'BankNusantara'];
  const residu = [...new Set(teks)].filter((t) => t.length > 3 && ID.test(t) && !BOLEH.some((b) => t.includes(b)));
  if (residu.length) fail('sisa bahasa Indonesia di mode EN: ' + residu.slice(0, 4).join(' | '));
  else ok('antarmuka EN bersih (judul: "' + (await page.locator('section').nth(1).locator('.font-semibold').first().innerText()) + '")');
  if (/Verifikasi dua langkah/.test(teks.join(' | '))) fail('judul langkah OTP belum diterjemahkan');
  else ok('judul & label langkah OTP diterjemahkan');
  await ctx.close();
}

/* ---------- 8. berkas mandiri offline ---------- */
console.log('8. Berkas mandiri offline/login.html');
{
  const berkas = PROYEK + 'offline/login.html';
  if (!fs.existsSync(berkas)) { fail('offline/login.html tidak ada — jalankan npm run offline'); }
  else {
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errs = []; const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      splash: !!document.getElementById('splash'),
      ikon: document.querySelectorAll('i[data-icon] svg').length,
      lock: !!window.Lock,
      form: !!document.querySelector('#email'),
    }));
    const masalah = [];
    if (!r.splash) masalah.push('splash hilang di berkas mandiri');
    if (!r.lock) masalah.push('Lock tidak dimuat');
    if (!r.ikon) masalah.push('ikon tidak dirender');
    if (!r.form) masalah.push('formulir tidak ada');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 70));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal (harus 0 saat offline)');
    if (masalah.length) fail('offline/login.html: ' + masalah.join(' | '));
    else ok(`offline/login.html: splash + ${r.ikon} ikon + Lock siap, tanpa jaringan`);
    await ctx.close();
  }
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Login (splash + OTP) lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
