/**
 * qa/check-menu-tables.mjs — menguji menu sidebar "Tables" (treeview) + anak "Data Table".
 *
 * Diuji: struktur menu, buka/tutup treeview, penanda menu aktif, anak ber-anchor,
 * auto-buka saat membuka halaman tabel, pencarian menu sidebar, mode bahasa Inggris,
 * dan berkas mandiri di folder offline/.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const BASE = 'http://localhost:8080/';
const SHOT = new URL('../preview/', import.meta.url).pathname;
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };

const ANAK = ['Data Table', 'Tabel Sederhana', 'Kepala Tabel Sticky', 'AG Grid Community', 'Mini Grid'];
const ANAK_MG = ['Mini Grid 1', 'Mini Grid 2', 'Mini Grid 3', 'Mini Grid 4', 'Mini Grid 5', 'Mini Grid 6'];

/* ---------- 1. struktur & interaksi treeview ---------- */
console.log('1. Menu Tables: struktur & buka/tutup');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const struktur = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.sidebar-body li')].find((l) => (l.dataset.url || '').includes('Data Table'));
    if (!li) return { ada: false };
    const btn = li.querySelector('button.side-link');
    const wrap = li.querySelector('.submenu-wrap');
    return {
      ada: true,
      induk: btn.querySelector('.txt').textContent.trim(),
      badge: (btn.querySelector('.badge') || {}).textContent,
      caret: !!btn.querySelector('.caret'),
      ariaExpanded: btn.getAttribute('aria-expanded'),
      dataMenu: wrap.getAttribute('data-menu'),
      anak: [...li.querySelectorAll(':scope > .submenu-wrap > .side-submenu > li')].map((x) => ({
        label: x.querySelector('button .txt, a .txt').textContent.trim(),
        href: (x.querySelector('a') || { getAttribute: () => null }).getAttribute('href'),
        dataUrl: x.dataset.url,
        treeview: !!x.querySelector(':scope > button.side-link'),
      })),
      miniGrid: (() => {
        const mg = li.querySelector('.submenu-wrap[data-menu="minigrid"]');
        if (!mg) return null;
        return {
          induk: mg.parentElement.querySelector('button .txt').textContent.trim(),
          badge: (mg.parentElement.querySelector('button .badge') || {}).textContent,
          dataMenu: mg.getAttribute('data-menu'),
          anak: [...mg.querySelectorAll(':scope > .side-submenu > li')].map((x) => ({
            label: x.querySelector('.txt').textContent.trim(),
            href: x.querySelector('a').getAttribute('href'),
            icon: (x.querySelector('i[data-icon]') || {}).dataset ? x.querySelector('i[data-icon]').dataset.icon : null,
          })),
          tertutup: mg.classList.contains('closed'),
        };
      })(),
      terbuka: !wrap.classList.contains('closed'),
    };
  });
  console.log('   struktur:', JSON.stringify(struktur, null, 1).replace(/\n/g, '\n   '));
  if (!struktur.ada) fail('menu Tables tidak ditemukan');
  else {
    if (struktur.induk !== 'Tables') fail('label induk bukan "Tables": ' + struktur.induk);
    if (!struktur.caret) fail('induk tanpa panah (caret)');
    if (struktur.dataMenu !== 'tables') fail('data-menu bukan "tables"');
    const label = struktur.anak.map((a) => a.label);
    if (label.join('|') !== ANAK.join('|')) fail('daftar anak tidak sesuai: ' + label.join(', '));
    if (struktur.badge.trim() !== '5') fail('badge Tables bukan 5: ' + struktur.badge);
    if (!struktur.anak[4].treeview) fail('anak "Mini Grid" bukan treeview bersarang');
    const mg = struktur.miniGrid;
    if (!mg) fail('submenu bersarang "Mini Grid" tidak ada');
    else {
      if (mg.induk !== 'Mini Grid') fail('label bersarang bukan "Mini Grid": ' + mg.induk);
      if (mg.dataMenu !== 'minigrid') fail('data-menu bersarang bukan "minigrid"');
      if (mg.badge.trim() !== '6') fail('badge Mini Grid bukan 6: ' + mg.badge);
      if (mg.anak.map((a) => a.label).join('|') !== ANAK_MG.join('|')) fail('anak Mini Grid tidak sesuai: ' + mg.anak.map((a) => a.label).join(', '));
      const harapHref = ['mini-grid-1.html', 'mini-grid-2.html', 'mini-grid-3.html', 'mini-grid-4.html',
        'mini-grid-5.html', 'mini-grid-6.html'];
      if (mg.anak.map((a) => a.href).join('|') !== harapHref.join('|')) fail('href Mini Grid salah: ' + mg.anak.map((a) => a.href).join(', '));
      if (mg.anak.some((a) => !a.icon)) fail('ada anak Mini Grid tanpa ikon');
      if (!mg.tertutup) fail('submenu Mini Grid seharusnya tertutup di dashboard');
    }
    const hrefAnak = struktur.anak.map((a) => a.href);
    if (hrefAnak[0] !== 'tables.html') fail('href Data Table salah: ' + hrefAnak[0]);
    if (hrefAnak[1] !== 'tables.html#tabel-sederhana') fail('href Tabel Sederhana salah: ' + hrefAnak[1]);
    if (hrefAnak[2] !== 'tables.html#tabel-sticky') fail('href Kepala Tabel Sticky salah: ' + hrefAnak[2]);
    if (hrefAnak[3] !== 'ag-grid.html') fail('href AG Grid Community salah: ' + hrefAnak[3]);
    if (struktur.anak.some((a) => !a.dataUrl)) fail('ada anak tanpa data-url (tidak bisa dicari)');
    if (struktur.terbuka) fail('treeview seharusnya tertutup saat masih di halaman dashboard');
  }

  // klik untuk membuka, klik lagi untuk menutup
  const toggle = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('.sidebar-body button.side-link')].find((b) => b.textContent.trim().startsWith('Tables'));
    const wrap = btn.parentElement.querySelector('.submenu-wrap');
    btn.click();
    await new Promise((r) => setTimeout(r, 450));
    const setelahBuka = { closed: wrap.classList.contains('closed'), aria: btn.getAttribute('aria-expanded'), tinggi: Math.round(wrap.getBoundingClientRect().height) };
    btn.click();
    await new Promise((r) => setTimeout(r, 450));
    const setelahTutup = { closed: wrap.classList.contains('closed'), aria: btn.getAttribute('aria-expanded') };
    btn.click(); // biarkan terbuka untuk tangkapan layar
    await new Promise((r) => setTimeout(r, 400));
    return { setelahBuka, setelahTutup, ariaTerakhir: btn.getAttribute('aria-expanded') };
  });
  console.log('   buka  :', JSON.stringify(toggle.setelahBuka), toggle.setelahBuka.closed === false ? '✅' : '❌');
  console.log('   tutup :', JSON.stringify(toggle.setelahTutup), toggle.setelahTutup.closed === true ? '✅' : '❌');
  if (toggle.setelahBuka.closed !== false || toggle.setelahBuka.aria !== 'true') fail('treeview tidak terbuka saat diklik');
  if (toggle.setelahTutup.closed !== true || toggle.setelahTutup.aria !== 'false') fail('treeview tidak tertutup saat diklik ulang');
  if (toggle.setelahBuka.tinggi < 40) fail('submenu tidak punya tinggi saat terbuka');

  await page.screenshot({ path: SHOT + 'menu-tables.png', clip: { x: 0, y: 0, width: 250, height: 620 } });
  if (errs.length) fail('error JS: ' + errs[0]);
  await ctx.close();
}

/* ---------- 2. penanda aktif & anak ber-anchor ---------- */
console.log('\n2. Penanda menu aktif di halaman tabel');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto(BASE + 'pages/tables.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const awal = await page.evaluate(() => {
    const aktif = [...document.querySelectorAll('.side-link.active')].map((a) => a.querySelector('.txt, span')?.textContent.trim() || a.textContent.trim());
    const wrap = document.querySelector('.submenu-wrap[data-menu="tables"]');
    return { aktif, treeTerbuka: wrap ? !wrap.classList.contains('closed') : null };
  });
  console.log('   buka tables.html :', JSON.stringify(awal));
  if (!awal.treeTerbuka) fail('treeview Tables tidak otomatis terbuka di halaman tabel');
  if (!awal.aktif.includes('Data Table')) fail('"Data Table" tidak ditandai aktif: ' + awal.aktif.join(', '));
  if (awal.aktif.length !== 1) fail('penanda aktif ganda: ' + awal.aktif.join(', '));

  // klik anak ber-anchor → halaman bergulir ke bagian & penanda pindah
  await page.click('.side-submenu a[href="tables.html#tabel-sticky"]');
  await page.waitForTimeout(1200);
  const setelah = await page.evaluate(() => {
    const aktif = [...document.querySelectorAll('.side-submenu .side-link.active')].map((a) => a.querySelector('.txt').textContent.trim());
    const bagian = document.getElementById('tabel-sticky');
    const header = document.querySelector('.content-header');
    return {
      aktif,
      hash: location.hash,
      scrollY: Math.round(window.scrollY),
      bagianTerlihat: bagian ? baguanTampak(bagian, header) : false,
      tertutupHeader: bagian ? bagian.getBoundingClientRect().top < header.getBoundingClientRect().bottom - 40 : null,
    };
    function baguanTampak(el, hd) {
      const b = el.getBoundingClientRect();
      return b.top >= hd.getBoundingClientRect().bottom - 2 && b.top < window.innerHeight;
    }
  });
  console.log('   klik #tabel-sticky:', JSON.stringify(setelah));
  if (setelah.hash !== '#tabel-sticky') fail('hash tidak berubah');
  if (!setelah.aktif.includes('Kepala Tabel Sticky')) fail('anak ber-anchor tidak ditandai aktif: ' + setelah.aktif.join(', '));
  if (setelah.aktif.includes('Data Table')) fail('"Data Table" masih aktif padahal anchor lain dipilih');
  if (setelah.tertutupHeader) fail('bagian tujuan tertutup header halaman (scroll-padding gagal)');

  // kembali ke tabel sederhana
  await page.click('.side-submenu a[href="tables.html#tabel-sederhana"]');
  await page.waitForTimeout(1100);
  const kedua = await page.evaluate(() => ({
    aktif: [...document.querySelectorAll('.side-submenu .side-link.active')].map((a) => a.querySelector('.txt').textContent.trim()),
    hash: location.hash,
  }));
  console.log('   klik #tabel-sederhana:', JSON.stringify(kedua), kedua.aktif.includes('Tabel Sederhana') ? '✅' : '❌');
  if (!kedua.aktif.includes('Tabel Sederhana')) fail('penanda tidak berpindah ke Tabel Sederhana');

  // klik "Data Table" (tanpa anchor) → kembali ke puncak & hanya dia yang aktif
  await page.click('.side-submenu a[href="tables.html"]');
  await page.waitForTimeout(900);
  const ketiga = await page.evaluate(() => ({
    aktif: [...document.querySelectorAll('.side-submenu .side-link.active')].map((a) => a.querySelector('.txt').textContent.trim()),
    judul: document.querySelector('.page-title').textContent.trim(),
  }));
  console.log('   klik Data Table   :', JSON.stringify(ketiga), ketiga.aktif.length === 1 && ketiga.aktif[0] === 'Data Table' ? '✅' : '❌');
  if (!(ketiga.aktif.length === 1 && ketiga.aktif[0] === 'Data Table')) fail('penanda ganda setelah kembali ke Data Table');
  if (errs.length) fail('error JS: ' + errs[0]);
  await ctx.close();
}

/* ---------- 3. pencarian menu sidebar ---------- */
console.log('\n3. Pencarian menu sidebar (anak menu ikut ditemukan)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const input = document.querySelector('.sidebar-input');
    input.value = 'sticky';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const li = [...document.querySelectorAll('.sidebar-body li')];
    const tampil = li.filter((l) => l.style.display !== 'none').map((l) => (l.querySelector('.txt') || {}).textContent || '');
    return { tampil: tampil.slice(0, 5), jumlah: tampil.length };
  });
  console.log('   cari "sticky" →', JSON.stringify(r));
  if (!r.tampil.some((t) => /Kepala Tabel Sticky/.test(t))) fail('anak menu tidak muncul di hasil pencarian');
  const r2 = await page.evaluate(async () => {
    const input = document.querySelector('.sidebar-input');
    input.value = 'Mini Grid 3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const li = [...document.querySelectorAll('.sidebar-body li')];
    return li.filter((l) => l.style.display !== 'none').map((l) => (l.querySelector('.txt') || {}).textContent || '');
  });
  console.log('   cari "Mini Grid 3" →', JSON.stringify(r2.filter((t) => t)));
  if (!r2.some((t) => /Mini Grid 3/.test(t))) fail('anak bersarang Mini Grid tidak muncul di hasil pencarian');
  await ctx.close();
}

/* ---------- 4. mode bahasa Inggris ---------- */
console.log('\n4. Mode bahasa Inggris');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/tables.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.I18n.set('en'));
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const li = document.querySelector('.submenu-wrap[data-menu="tables"]').parentElement;
    return {
      induk: li.querySelector('button .txt').textContent.trim(),
      anak: [...li.querySelectorAll('.side-submenu .txt')].map((n) => n.textContent.trim()),
      judul: document.querySelector('.page-title').textContent.trim(),
    };
  });
  console.log('   EN:', JSON.stringify(r));
  if (r.induk !== 'Tables') fail('label induk berubah di EN: ' + r.induk);
  if (r.anak[1] !== 'Simple Table' || r.anak[2] !== 'Sticky Table Head') fail('anak menu tidak diterjemahkan: ' + r.anak.join(', '));
  if (!r.anak.includes('Mini Grid') || !r.anak.includes('Mini Grid 4') || !r.anak.includes('Mini Grid 6'))
    fail('anak Mini Grid hilang di mode EN: ' + r.anak.join(', '));
  await ctx.close();
}

/* ---------- 5. berkas mandiri (offline) ---------- */
console.log('\n5. Berkas mandiri di folder offline/');
{
  const ctx = await browser.newContext({ offline: true, viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + PROYEK + 'offline/dashboard.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.sidebar-body li')].find((l) => (l.dataset.url || '').includes('Data Table'));
    return {
      induk: li.querySelector('button .txt').textContent.trim(),
      anak: [...li.querySelectorAll('.side-submenu a')].map((a) => ({ t: a.querySelector('.txt').textContent.trim(), h: a.getAttribute('href') })),
    };
  });
  console.log('  ', JSON.stringify(r));
  /* di berkas mandiri, tautan harus menunjuk berkas offline hasil remap
     (tiga anak pertama = tabel.html, anak AG Grid = ag-grid.html) */
  const tautan = r.anak.map((a) => a.h);
  const harap = ['tabel.html', 'tabel.html#tabel-sederhana', 'tabel.html#tabel-sticky', 'ag-grid.html',
                 'mini-grid-1.html', 'mini-grid-2.html', 'mini-grid-3.html', 'mini-grid-4.html',
                 'mini-grid-5.html', 'mini-grid-6.html'];
  if (tautan.join('|') !== harap.join('|')) fail('tautan anak menu belum di-remap ke berkas offline: ' + tautan.join(', '));
  const berkasAgGrid = fs.existsSync(PROYEK + 'offline/ag-grid.html');
  if (!berkasAgGrid) fail('offline/ag-grid.html tidak ada (tautan anak AG Grid akan mati)');
  for (const n of [1, 2, 3, 4, 5, 6]) {
    if (!fs.existsSync(`${PROYEK}offline/mini-grid-${n}.html`)) fail(`offline/mini-grid-${n}.html tidak ada`);
  }
  if (r.anak[1].h !== 'tabel.html#tabel-sederhana') fail('anchor hilang saat remap: ' + r.anak[1].h);

  // buka treeview dulu (di dashboard posisinya tertutup), lalu klik anak menu
  await page.click('.sidebar-body button.side-link:has-text("Tables")');
  await page.waitForTimeout(500);
  const tautanTerlihat = await page.evaluate(() => {
    const a = document.querySelector('.submenu-wrap[data-menu="tables"] a[href="tabel.html#tabel-sticky"]');
    const b = a.getBoundingClientRect();
    return { tinggi: Math.round(b.height), terlihat: b.height > 0 };
  });
  console.log('   anak menu setelah treeview dibuka:', JSON.stringify(tautanTerlihat));
  if (!tautanTerlihat.terlihat) fail('anak menu tidak terlihat setelah treeview dibuka');

  const popup = page.waitForEvent('popup', { timeout: 4000 }).catch(() => null);
  await page.click('.submenu-wrap[data-menu="tables"] a[href="tabel.html#tabel-sticky"]');
  const tabBaru = await popup;
  if (tabBaru) { await tabBaru.waitForLoadState(); await tabBaru.waitForTimeout(800); }
  else { await page.waitForTimeout(900); }
  const tujuan = tabBaru ? tabBaru.url() : page.url();
  console.log('   klik anak menu →', tujuan);
  if (!/offline\/tabel\.html/.test(tujuan)) fail('klik anak menu tidak menuju tabel.html');
  if (!/#tabel-sticky/.test(tujuan)) fail('anchor tidak ikut terbawa: ' + tujuan);

  if (errs.length) fail('error JS offline: ' + errs[0]);
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Menu Tables lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
