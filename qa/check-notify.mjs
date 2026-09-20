
/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
/**
 * qa/check-notify.mjs — regresi notifikasi push palsu (ronde 4).
 *
 * Diuji:
 *   1. Kontrak window.Notify + Alpine store $store.notif (lingkup admin & mobile).
 *   2. Lonceng navbar: lencana jumlah belum dibaca, dropdown 6 terakhir, aksi
 *      "Tandai dibaca", tombol "Kirim uji" (lencana + banner bertambah).
 *   3. Halaman pages/notifications.html: small box ringkasan, tabel, penyaring
 *      kategori/status/pencarian, tandai dibaca & hapus (massal), footer hitungan.
 *   4. Banner push: tampil, bisa ditutup, klik banner → event notify:open.
 *   5. Menu sidebar "Notifikasi" berfungsi + badge mengikuti belum dibaca.
 *   6. Aplikasi nasabah: banner di dalam bingkai ponsel, pusat notifikasi mobile,
 *      tandai semua dibaca, hapus satu notifikasi.
 *   7. Terjemahan EN: halaman & lonceng berganti bahasa tanpa sisa teks ID.
 *   8. Berkas mandiri offline/notifikasi.html.
 *
 * Jalankan (dari folder qa/):
 *   node check-notify.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);

async function buka(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, ...opts });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const store = (page, expr) => page.evaluate((e) => {
  const s = Alpine.store('notif');
  return new Function('s', 'return (' + e + ')')(s);
}, expr);

/* ---------- 1. kontrak API ---------- */
console.log('1. Kontrak Notify + $store.notif');
{
  const { ctx, page, errs } = await buka('pages/index.html');
  const api = await page.evaluate(() => {
    const n = window.Notify || {};
    const s = Alpine.store('notif');
    return {
      push: typeof n.push, banner: typeof n.banner, uji: typeof n.uji, waktu: typeof n.waktu,
      fungsi: ['lingkup', 'belum', 'tambah', 'baca', 'belumBacaToggle', 'bacaSemua', 'hapus', 'hapusSemua', 'hapusTerbaca', 'uji', 'waktu', 'segarkan']
        .filter((f) => typeof s[f] !== 'function'),
      admin: s.lingkup('admin').length, mobile: s.lingkup('mobile').length,
      belum: s.belum('admin'),
      kunci: localStorage.getItem('notif.v1') ? 'ada' : 'tidak ada',
    };
  });
  if (!['push', 'banner', 'uji', 'waktu'].every((k) => api[k] === 'function')) fail('window.Notify tidak lengkap: ' + JSON.stringify(api));
  else ok('window.Notify.push/banner/uji/waktu tersedia');
  if (api.fungsi.length) fail('metode store hilang: ' + api.fungsi.join(', '));
  else ok('12 metode $store.notif lengkap');
  if (api.admin < 5 || api.mobile < 5) fail(`benih notifikasi kurang (admin ${api.admin}, mobile ${api.mobile})`);
  else ok(`benih notifikasi: ${api.admin} admin + ${api.mobile} mobile`);
  if (api.belum < 1) fail('tidak ada notifikasi belum dibaca'); else ok(api.belum + ' notifikasi admin belum dibaca');
  if (api.kunci !== 'ada') fail('localStorage notif.v1 tidak ditulis'); else ok('tersimpan di localStorage notif.v1');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 80));
  await ctx.close();
}

/* ---------- 2. lonceng navbar ---------- */
console.log('2. Lonceng navbar');
{
  const { ctx, page } = await buka('pages/index.html');
  const lencana = page.locator('button[aria-label="Notifikasi"] .navbar-badge');
  const awal = parseInt(await lencana.innerText(), 10);
  if (!(awal > 0)) fail('lencana belum dibaca tidak tampil'); else ok('lencana menampilkan ' + awal + ' belum dibaca');
  await page.click('button[aria-label="Notifikasi"]');
  await page.waitForTimeout(350);
  const baris = await page.locator('.notif-tinjau li button').count();
  if (baris > 6) fail('dropdown menampilkan lebih dari 6 baris: ' + baris); else ok('dropdown menampilkan ' + baris + ' notifikasi terakhir');
  const teratas = (await page.locator('.notif-tinjau li').first().innerText()).replace(/\n+/g, ' · ');
  ok('baris teratas: ' + teratas.slice(0, 80));
  await page.locator('.notif-tinjau li button').first().click();
  await page.waitForTimeout(300);
  const sesudahBaca = parseInt(await lencana.innerText(), 10);
  if (sesudahBaca !== awal - 1) fail(`tandai dibaca tidak menurunkan lencana (${awal} → ${sesudahBaca})`);
  else ok(`tandai dibaca: lencana ${awal} → ${sesudahBaca}`);
  /* Asisten AI selalu muncul (panel terbuka di kunjungan pertama) → tutup dulu
     supaya tidak menutupi panel dropdown lonceng di sudut kanan atas. */
  await page.evaluate(() => { if (window.AIChat) window.AIChat.tutup(); });
  await page.waitForTimeout(300);
  await page.locator('.dropdown-menu:visible button:has-text("Kirim uji")').click();
  await page.waitForTimeout(700);
  const sesudahUji = parseInt(await lencana.innerText(), 10);
  if (sesudahUji <= sesudahBaca) fail('kirim uji tidak menambah notifikasi'); else ok(`kirim uji: lencana ${sesudahBaca} → ${sesudahUji}`);
  if (!(await page.locator('.push-banner').count())) fail('banner push tidak muncul dari lonceng'); else ok('banner push muncul (notifikasi palsu)');
  const badgeSide = await page.locator('.side-link:has-text("Notifikasi") .badge').innerText();
  if (parseInt(badgeSide, 10) !== sesudahUji) fail(`badge sidebar (${badgeSide}) ≠ lencana (${sesudahUji})`); else ok('badge sidebar sinkron (' + badgeSide + ')');
  const href = await page.locator('.dropdown-menu:visible a:has-text("pusat notifikasi")').getAttribute('href');
  if (href !== 'notifications.html') fail('tautan pusat notifikasi salah: ' + href); else ok('tautan "Buka pusat notifikasi" → ' + href);
  await ctx.close();
}

/* ---------- 3. halaman pusat notifikasi ---------- */
console.log('3. Halaman Pusat Notifikasi');
{
  const { ctx, page, errs } = await buka('pages/notifications.html');
  const total = await store(page, 's.lingkup("admin").length');
  const kotak = await page.locator('.small-box .description-header').allInnerTexts();
  if (parseInt(kotak[0], 10) !== total) fail(`small box total (${kotak[0]}) ≠ data (${total})`); else ok(`small box: total ${kotak[0]} · belum dibaca ${kotak[1]} · penting ${kotak[2]} · hari ini ${kotak[3]}`);
  const baris = await page.locator('tbody tr').count();
  if (baris !== total) fail(`baris tabel (${baris}) ≠ data (${total})`); else ok('tabel menampilkan ' + baris + ' notifikasi');
  const judulHalaman = await page.locator('.page-title').innerText();
  ok('judul halaman: ' + judulHalaman.trim());
  const crumb = (await page.locator('.breadcrumb').innerText()).replace(/\s+/g, ' ').replace(/\n/g, '');
  if (!/Notifikasi/i.test(crumb)) fail('breadcrumb tidak memuat halaman aktif: ' + crumb); else ok('breadcrumb: ' + crumb.trim().slice(0, 70));
  /* penyaring kategori */
  const sebelum = await page.locator('tbody tr').count();
  await page.click('.card-body button[data-peran="kategori"]:has-text("Peringatan")');
  await page.waitForTimeout(350);
  const sesudah = await page.locator('tbody tr').count();
  const benar = await store(page, 's.lingkup("admin").filter(function (n) { return n.kategori === "Peringatan"; }).length');
  if (sesudah !== benar) fail(`penyaring kategori (${sesudah}) ≠ data (${benar})`); else ok(`penyaring kategori "Peringatan": ${sebelum} → ${sesudah} baris`);
  await page.click('.card-body button[data-peran="kategori"]:has-text("Semua")');
  await page.waitForTimeout(250);
  /* penyaring status + pencarian */
  await page.click('.card-body button[data-peran="status"]:has-text("Belum dibaca")');
  await page.waitForTimeout(250);
  const belumDibaca = await page.locator('tbody tr').count();
  const benarBelum = await store(page, 's.belum("admin")');
  if (belumDibaca !== benarBelum) fail(`penyaring "Belum dibaca" (${belumDibaca}) ≠ data (${benarBelum})`); else ok('penyaring status: ' + belumDibaca + ' baris belum dibaca');
  await page.click('.card-body button[data-peran="status"]:has-text("Semua")');
  await page.waitForTimeout(200);
  await page.fill('.card-tools input[type="search"]', 'percobaan');
  await page.waitForTimeout(350);
  const cari = await page.locator('tbody tr').count();
  if (cari !== 1) fail('pencarian "percobaan" tidak menyisakan 1 baris: ' + cari); else ok('pencarian teks bekerja (1 baris cocok)');
  await page.fill('.card-tools input[type="search"]', '');
  await page.waitForTimeout(250);
  /* tandai dibaca + hapus satu baris */
  const jumlahAwal = await store(page, 's.lingkup("admin").length');
  await page.locator('tbody tr').first().locator('button[title="Tandai dibaca"]').click();
  await page.waitForTimeout(300);
  const selesaiBaca = await store(page, 's.lingkup("admin").filter(function (n) { return n.baca; }).length');
  if (!selesaiBaca) fail('tombol tandai dibaca per baris tidak bekerja'); else ok('tandai dibaca per baris (' + selesaiBaca + ' terbaca)');
  await page.locator('tbody tr').first().locator('button[title="Hapus"]').click();
  await page.waitForTimeout(300);
  const sisa = await store(page, 's.lingkup("admin").length');
  if (sisa !== jumlahAwal - 1) fail(`hapus baris gagal (${jumlahAwal} → ${sisa})`); else ok(`hapus baris: ${jumlahAwal} → ${sisa}`);
  /* hapus massal: pilih semua lalu tandai + hapus */
  await page.locator('thead input[type="checkbox"]').check();
  await page.waitForTimeout(200);
  const dipilih = await page.locator('.card-footer').innerText();
  if (!/\d+ dipilih/.test(dipilih)) fail('hitungan "dipilih" tidak muncul: ' + dipilih.replace(/\n/g, ' ')); else ok('footer: ' + dipilih.split('\n')[0].trim());
  await page.click('.card-footer button:has-text("Hapus terpilih")');
  await page.waitForTimeout(400);
  const kosong = await store(page, 's.lingkup("admin").length');
  if (kosong !== 0) fail('hapus terpilih menyisakan ' + kosong + ' notifikasi'); else ok('hapus terpilih → pusat notifikasi kosong');
  if (!(await page.locator('text=Tidak ada notifikasi yang cocok dengan penyaring.').count())) fail('pesan kosong tidak tampil'); else ok('pesan kosong tampil setelah semua dihapus');
  /* tombol aksi di header halaman & navbar (di luar cakupan x-data) */
  await page.click('.page-actions button:has-text("Kirim notifikasi uji")');
  await page.waitForTimeout(600);
  const setelahUjiHeader = await store(page, 's.lingkup("admin").length');
  if (setelahUjiHeader !== 1) fail('tombol header "Kirim notifikasi uji" tidak bekerja (total ' + setelahUjiHeader + ')');
  else ok('tombol header "Kirim notifikasi uji" → 1 notifikasi baru');
  await page.click('button[aria-label="Kirim notifikasi uji"]');
  await page.waitForTimeout(600);
  const setelahUjiNavbar = await store(page, 's.lingkup("admin").length');
  if (setelahUjiNavbar !== 2) fail('ikon navbar "Kirim notifikasi uji" tidak bekerja (total ' + setelahUjiNavbar + ')');
  else ok('ikon navbar "Kirim notifikasi uji" → 2 notifikasi');
  await page.click('.page-actions button:has-text("Tandai semua dibaca")');
  await page.waitForTimeout(500);
  const belumSetelah = await store(page, 's.belum("admin")');
  if (belumSetelah !== 0) fail('tombol header "Tandai semua dibaca" tidak bekerja (' + belumSetelah + ' tersisa)');
  else ok('tombol header "Tandai semua dibaca" → 0 belum dibaca');
  await page.click('.page-actions button:has-text("Hapus yang terbaca")');
  await page.waitForTimeout(500);
  const kosong2 = await store(page, 's.lingkup("admin").length');
  if (kosong2 !== 0) fail('tombol header "Hapus yang terbaca" tidak bekerja (' + kosong2 + ' tersisa)');
  else ok('tombol header "Hapus yang terbaca" → daftar kosong');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 80));
  await ctx.close();
}

/* ---------- 4. banner push ---------- */
console.log('4. Banner push');
{
  const { ctx, page } = await buka('pages/index.html');
  await page.evaluate(() => window.Notify.banner({ judul: 'Uji banner', pesan: 'Notifikasi palsu dari skrip QA.', tone: 'info', ikon: 'bell-fill' }));
  await page.waitForTimeout(600);
  const banner = await page.locator('.push-banner.masuk').count();
  if (!banner) fail('banner tidak tampil setelah Notify.banner()'); else ok('Notify.banner() menampilkan banner (tanpa menambah daftar)');
  const daftarSebelum = await store(page, 's.lingkup("admin").length');
  if (daftarSebelum !== 6) fail('banner seharusnya tidak menambah daftar (kini ' + daftarSebelum + ')'); else ok('daftar tetap ' + daftarSebelum + ' (banner saja)');
  const teks = (await page.locator('.push-banner.masuk').innerText()).replace(/\n+/g, ' · ');
  ok('isi banner: ' + teks.slice(0, 80));
  await page.locator('.push-banner.masuk .push-tutup').click({ timeout: 4000 }).catch(() => fail('tombol tutup banner tidak bisa diklik'));
  await page.waitForTimeout(500);
  if (await page.locator('.push-banner.masuk').count()) fail('banner tidak bisa ditutup'); else ok('banner bisa ditutup');
  /* klik banner memicu event notify:open */
  await page.evaluate(() => {
    window.__buka = 0;
    window.addEventListener('notify:open', () => { window.__buka++; });
    window.Notify.banner({ judul: 'Klik saya', pesan: 'Membuka pusat notifikasi.' });
  });
  await page.waitForTimeout(500);
  await page.locator('.push-banner.masuk').click();
  await page.waitForTimeout(400);
  const jumlahBuka = await page.evaluate(() => window.__buka);
  if (!jumlahBuka) fail('klik banner tidak memicu event notify:open'); else ok('klik banner → event notify:open');
  await ctx.close();
}

/* ---------- 5. menu sidebar ---------- */
console.log('5. Menu sidebar');
{
  const { ctx, page } = await buka('pages/index.html');
  const menu = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.side-link')].map((x) => ({ t: x.textContent.trim().replace(/\s+/g, ' '), href: x.getAttribute('href') }));
    return a.filter((x) => /Notifikasi|Scheduler/.test(x.t));
  });
  if (menu.length !== 2) fail('menu Notifikasi/Scheduler tidak lengkap: ' + JSON.stringify(menu));
  else ok('menu sidebar: ' + menu.map((m) => m.t + ' → ' + m.href).join(' · '));
  await page.click('.side-link:has-text("Scheduler")');
  await page.waitForURL('**/scheduler.html', { timeout: 6000 }).then(() => ok('menu Scheduler membuka scheduler.html')).catch(() => fail('menu Scheduler tidak membuka halaman'));
  await ctx.close();
}

/* ---------- 6. aplikasi nasabah ---------- */
console.log('6. Aplikasi nasabah');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.mobile-app');
  await page.waitForTimeout(1500);
  await page.click('[data-bio-jari]');
  await page.waitForTimeout(1600);
  const badgeLonceng = await page.locator('.mobile-bar-btn[aria-label="Notifikasi"] .badge').innerText().catch(() => '0');
  ok('lencana lonceng mobile: ' + badgeLonceng.trim());
  await page.click('.mobile-bar-btn[aria-label="Notifikasi"]');
  await page.waitForTimeout(600);
  const tabNow = await page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).tab);
  if (tabNow !== 'notif') fail('lonceng mobile tidak membuka layar notifikasi (tab=' + tabNow + ')'); else ok('lonceng mobile → layar notifikasi');
  const baris = await page.locator('.mobile-layar.aktif .mobile-baris[data-baca]').count();
  const data = await page.evaluate(() => Alpine.store('notif').lingkup('mobile').length);
  if (baris !== data) fail(`baris notifikasi (${baris}) ≠ data (${data})`); else ok(`${baris} notifikasi mobile tampil`);
  /* banner di dalam bingkai ponsel */
  await page.evaluate(() => window.Notify.push({ lingkup: 'mobile', judul: 'Promo QRIS', pesan: 'Cashback 20% akhir pekan ini.', tone: 'success', ikon: 'gift', kategori: 'Transaksi' }));
  await page.waitForTimeout(700);
  if (!(await page.locator('.mobile-app .push-banner.masuk').count())) fail('banner mobile tidak muncul di dalam bingkai ponsel'); else ok('banner push tampil di dalam bingkai ponsel');
  const naik = await page.evaluate(() => Alpine.store('notif').lingkup('mobile').length);
  if (naik !== data + 1) fail('notifikasi mobile tidak bertambah (' + data + ' → ' + naik + ')'); else ok(`daftar mobile ${data} → ${naik}`);
  /* hapus satu */
  await page.locator('.mobile-layar.aktif .mobile-baris[data-baca] button[aria-label="Hapus notifikasi"]').first().click();
  await page.waitForTimeout(400);
  const sesudahHapus = await page.evaluate(() => Alpine.store('notif').lingkup('mobile').length);
  if (sesudahHapus !== naik - 1) fail('hapus notifikasi mobile gagal (' + naik + ' → ' + sesudahHapus + ')'); else ok(`hapus satu notifikasi: ${naik} → ${sesudahHapus}`);
  /* tandai semua dibaca */
  const belumSebelum = await page.evaluate(() => Alpine.store('notif').belum('mobile'));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.mobile-layar.aktif button')].find((x) => /Tandai semua dibaca/.test(x.textContent));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
  });
  await page.waitForTimeout(400);
  const belumSesudah = await page.evaluate(() => Alpine.store('notif').belum('mobile'));
  if (belumSesudah !== 0 || belumSebelum === 0) fail(`tandai semua dibaca mobile gagal (${belumSebelum} → ${belumSesudah})`);
  else ok(`tandai semua dibaca: ${belumSebelum} → 0 belum dibaca`);
  /* kedua lingkup tidak saling bocor */
  const lingkup = await page.evaluate(() => ({ a: Alpine.store('notif').lingkup('admin').length, m: Alpine.store('notif').lingkup('mobile').length }));
  if (!lingkup.a) fail('lingkup admin kosong di aplikasi mobile'); else ok(`lingkup terpisah: admin ${lingkup.a} · mobile ${lingkup.m}`);
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 80));
  await ctx.close();
}

/* ---------- 7. dwibahasa ---------- */
console.log('7. Dwibahasa (EN)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('app.locale', 'en'));
  for (const url of ['pages/notifications.html', 'pages/scheduler.html']) {
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.waitForTimeout(1100);
    const r = await page.evaluate(() => {
      const teks = [];
      const walk = (n) => {
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) teks.push(t); return; }
        if (n.nodeType !== 1 || n.closest('script,style,code')) return;
        for (const c of n.childNodes) walk(c);
      };
      walk(document.body);
      return { judul: document.title.split(' · ')[0], teks: [...new Set(teks)], lang: document.documentElement.lang };
    });
    const ID = /\b(dan|atau|yang|untuk|dengan|dari|tidak|halaman|notifikasi|jadwal|daftar|semua|kirim|tutup|buka|simpan|hapus|pekan|minggu|hari|aksi|riwayat|jalankan|eksekusi|bersihkan|jenis|terakhir|berikutnya|jeda|aktifkan|pusat|penting|belum|sudah|dibaca)\b/i;
    /* data contoh (benih notifikasi, nama job, target) dikecualikan — bukan teks antarmuka */
    const DATA = [/^Transfer/, /^Rekonsiliasi/, /^Autodebet/, /^Laporan/, /^Sinkronisasi/, /^Cadangkan/, /^Kirim promosi/, /^Pembersihan/, /^Uji laporan/, /^Pesanan #/, /^Rp /, /^IDR /, /^Stok /, /^Sisa /, /^Akun /, /^—/, /^[A-Za-z.]+@/, /^admin@/, /^Snapshot/, /^PDF/, /^BI JISDOR/, /^1\.284/, /^Segmen/, /^Token/, /^Hari ini|^Kemarin|^Besok|^\d/,
      /^Pengguna baru/, /^Jadwal autodebet/, /^Percobaan masuk/, /^Semua kanal/, /^2 menit|^1 jam|^3 jam|^5 jam|^18 menit|^7 jam/, /^Sisa 12/, /^Transaksi$|^Sistem$|^Jadwal$/];
    const residu = r.teks.filter((t) => t.length > 3 && ID.test(t) && !DATA.some((rx) => rx.test(t)));
    if (r.lang !== 'en') fail(url + ': <html lang> bukan en');
    else if (residu.length) fail(url + ': sisa bahasa Indonesia → ' + residu.slice(0, 4).join(' | '));
    else ok(`${url}: ${r.judul} · antarmuka EN bersih (data contoh dikecualikan)`);
  }
  await ctx.close();
}

/* ---------- 8. berkas mandiri ---------- */
console.log('8. Berkas mandiri offline/notifikasi.html');
{
  const berkas = PROYEK + 'offline/notifikasi.html';
  if (!fs.existsSync(berkas)) fail('offline/notifikasi.html tidak ada — jalankan npm run offline');
  else {
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    const errs = []; const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(1400);
    const r = await page.evaluate(() => ({
      baris: document.querySelectorAll('tbody tr').length,
      ikon: document.querySelectorAll('i[data-icon] svg').length,
      banner: (window.Notify && typeof window.Notify.banner === 'function'),
      notif: !!window.Alpine && !!window.Alpine.store('notif'),
      tautan: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join(' '),
    }));
    const masalah = [];
    if (!r.baris) masalah.push('tabel kosong');
    if (!r.ikon) masalah.push('ikon tidak dirender');
    if (!r.notif) masalah.push('store notif tidak ada');
    if (!r.banner) masalah.push('Notify tidak dimuat');
    if (/\.\.\//.test(r.tautan)) masalah.push('tautan relatif ke luar berkas');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 70));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal');
    if (masalah.length) fail('offline/notifikasi.html: ' + masalah.join(' | '));
    else ok(`offline/notifikasi.html: ${r.baris} baris · ${r.ikon} ikon · tanpa jaringan`);
    await ctx.close();
  }
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Pusat notifikasi & push palsu lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
