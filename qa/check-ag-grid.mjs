/**
 * qa/check-ag-grid.mjs — menguji halaman AG Grid Community + perubahan sidebar.
 *
 * Diuji: grid tergambar, sortir, filter kolom, floating filter, pencarian cepat,
 * paginasi, pilih baris massal + ringkasan, tambah baris, ekspor CSV,
 * tema mengikuti skin/dark mode, label ikut bahasa ID/EN, sidebar tanpa kartu
 * pengguna + tombol keluar, dan berkas mandiri offline/ag-grid.html.
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

/* ---------- 1. sidebar: kartu pengguna hilang, tombol keluar ada ---------- */
console.log('1. Sidebar: sidebar-user hilang + tombol keluar di footer');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const aside = document.querySelector('.app-sidebar');
    const btn = aside.querySelector('.sidebar-footer .side-logout');
    return {
      adaKartuPengguna: !!aside.querySelector('.sidebar-user'),
      namaMasihAda: /Aulia Saputra/.test(aside.querySelector('.sidebar-footer') ? '' : ''),
      adaTombol: !!btn,
      label: btn ? btn.querySelector('.txt').textContent.trim() : null,
      ikon: btn ? !!btn.querySelector('i[data-icon] svg') : false,
      diFooter: btn ? btn.closest('.sidebar-footer') !== null : false,
      klikMemunculkanDialog: false,
    };
  });
  console.log('   ', JSON.stringify(r));
  if (r.adaKartuPengguna) fail('sidebar-user masih ada');
  if (!r.adaTombol) fail('tombol keluar tidak ditemukan');
  if (r.label !== 'Keluar') fail('label tombol keluar salah: ' + r.label);
  if (!r.diFooter) fail('tombol keluar tidak berada di sidebar-footer');

  // tombol harus benar-benar memicu dialog konfirmasi (bukan mati)
  const dlg = await page.evaluate(async () => {
    document.querySelector('.sidebar-footer .side-logout').click();
    await new Promise((r) => setTimeout(r, 400));
    const modal = document.querySelector('[data-dialog], .modal, [x-show*="dialog"]');
    const dialogStore = window.Alpine.store('dialog');
    return {
      judul: dialogStore && dialogStore.open ? (dialogStore.title || '') : '',
      terbuka: !!(dialogStore && dialogStore.open),
      adaModalTerlihat: modal ? getComputedStyle(modal).display !== 'none' : false,
      aksi: dialogStore && dialogStore.onConfirm ? typeof dialogStore.onConfirm : 'none',
    };
  });
  console.log('   dialog:', JSON.stringify(dlg));
  if (!dlg.terbuka) fail('klik tombol keluar tidak membuka dialog konfirmasi');
  await page.evaluate(() => window.Alpine.store('dialog').close && window.Alpine.store('dialog').close());

  // mode sidebar mengecil: tombol tetap terlihat (ikon)
  const collapse = await page.evaluate(async () => {
    window.Alpine.store('ui').toggleCollapsed();
    await new Promise((r) => setTimeout(r, 550));
    const btn = document.querySelector('.sidebar-footer .side-logout');
    const ikonTerlihat = !!btn.querySelector('.ico') && btn.querySelector('.ico').getBoundingClientRect().width > 0;
    const lebar = Math.round(btn.getBoundingClientRect().width);
    window.Alpine.store('ui').toggleCollapsed();
    await new Promise((r) => setTimeout(r, 400));
    return { ikonTerlihat, lebar };
  });
  console.log('   sidebar mini:', JSON.stringify(collapse), collapse.ikonTerlihat ? '✅ ikon tetap tampak' : '❌');
  if (!collapse.ikonTerlihat) fail('ikon tombol keluar hilang saat sidebar mengecil');
  if (errs.length) fail('error JS: ' + errs[0]);
  await page.screenshot({ path: SHOT + 'sidebar-footer-keluar.png', clip: { x: 0, y: 500, width: 250, height: 420 } });
  await ctx.close();
}

/* ---------- 2. menu AG Grid Community di dalam Tables ---------- */
console.log('\n2. Menu "AG Grid Community" di dalam Tables');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/ag-grid.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.sidebar-body li')].find((l) => (l.dataset.url || '').includes('AG Grid'));
    const wrap = document.querySelector('.submenu-wrap[data-menu="tables"]');
    return {
      induk: wrap ? wrap.parentElement.querySelector('button .txt').textContent.trim() : null,
      label: li ? li.querySelector('.txt').textContent.trim() : null,
      href: li ? li.querySelector('a').getAttribute('href') : null,
      badgeInduk: wrap ? wrap.parentElement.querySelector('button .badge').textContent.trim() : null,
      treeTerbuka: wrap ? !wrap.classList.contains('closed') : null,
      aktif: li ? li.querySelector('a').classList.contains('active') : null,
    };
  });
  console.log('   ', JSON.stringify(r));
  if (r.induk !== 'Tables') fail('AG Grid bukan di dalam menu Tables');
  if (r.label !== 'AG Grid Community') fail('label menu salah: ' + r.label);
  if (r.href !== 'ag-grid.html') fail('href salah: ' + r.href);
  if (r.badgeInduk !== '5') fail('badge induk Tables salah (harus 5, termasuk Mini Grid): ' + r.badgeInduk);
  if (!r.treeTerbuka) fail('treeview Tables tidak terbuka di halaman AG Grid');
  if (!r.aktif) fail('menu AG Grid Community tidak ditandai aktif');
  await ctx.close();
}

/* ---------- 3. fungsi grid ---------- */
console.log('\n3. Fungsi AG Grid (sortir, filter, cari, paginasi, pilih, tambah, ekspor)');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(BASE + 'pages/ag-grid.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const dasar = await page.evaluate(() => {
    const host = document.querySelector('#ag-grid-nasabah');
    return {
      adaGrid: !!host.querySelector('.ag-root-wrapper'),
      judulKolom: [...document.querySelectorAll('#ag-grid-nasabah .ag-header-cell-text')].map((n) => n.textContent.trim()),
      barisTampil: document.querySelectorAll('#ag-grid-nasabah .ag-row').length,
      floatingFilter: document.querySelectorAll('#ag-grid-nasabah .ag-floating-filter').length,
      rootPinned: !!document.querySelector('#ag-grid-nasabah .ag-root.ag-has-left-pinned-cols'),
      selPinned: document.querySelectorAll('#ag-grid-nasabah .ag-cell-last-left-pinned').length,
      headerPinned: document.querySelectorAll('#ag-grid-nasabah .ag-header-cell-last-left-pinned').length,
      paginasiAda: !!document.querySelector('#ag-grid-nasabah .ag-paging-panel'),
      infoHalaman: (document.querySelector('#ag-grid-nasabah .ag-paging-description') || {}).textContent || '',
      gridKedua: !!document.querySelector('#ag-grid-cabang .ag-root-wrapper'),
      barisKedua: document.querySelectorAll('#ag-grid-cabang .ag-row').length,
      temaDiterapkan: getComputedStyle(document.querySelector('#ag-grid-nasabah .ag-root-wrapper')).getPropertyValue('--ag-accent-color').trim(),
    };
  });
  console.log('   dasar:', JSON.stringify(dasar, null, 1).replace(/\n/g, '\n   '));
  if (!dasar.adaGrid) fail('grid tidak tergambar');
  if (dasar.barisTampil !== 10) fail('jumlah baris halaman pertama bukan 10: ' + dasar.barisTampil);
  if (dasar.floatingFilter < 5) fail('floating filter tidak muncul');
  if (!dasar.rootPinned) fail('grid tidak melaporkan kolom pinned kiri');
  if (dasar.selPinned !== 10 || dasar.headerPinned < 1) fail('kolom ID tidak tergambar sebagai pinned: ' + dasar.selPinned + '/' + dasar.headerPinned);
  if (!dasar.paginasiAda) fail('panel paginasi tidak ada');
  if (!dasar.gridKedua || dasar.barisKedua !== 6) fail('grid kedua (per cabang) tidak benar: ' + dasar.barisKedua);
  if (!dasar.judulKolom.includes('Saldo')) fail('judul kolom Indonesia tidak muncul: ' + dasar.judulKolom.join(', '));

  // sortir: klik judul kolom "Saldo" dua kali → urut menurun
  const urut = await page.evaluate(async () => {
    const ambil = () => [...document.querySelectorAll('#ag-grid-nasabah .ag-row')]
      .map((r) => r.querySelector('[col-id="saldo"]')?.textContent.trim() || '');
    const angka = (t) => parseInt(t.replace(/[^\d]/g, ''), 10);
    const th = [...document.querySelectorAll('#ag-grid-nasabah .ag-header-cell')].find((c) => c.textContent.includes('Saldo'));
    th.querySelector('.ag-header-cell-label').click();
    await new Promise((r) => setTimeout(r, 500));
    th.querySelector('.ag-header-cell-label').click();
    await new Promise((r) => setTimeout(r, 600));
    const nilai = ambil().map(angka);
    return { pertama: nilai[0], urutMenurun: nilai.every((v, i) => i === 0 || nilai[i - 1] >= v), kelas: th.className.includes('asc') || th.className.includes('desc') };
  });
  console.log('   sortir Saldo:', JSON.stringify(urut), urut.urutMenurun ? '✅ menurun' : '❌');
  if (!urut.urutMenurun) fail('sortir kolom Saldo tidak bekerja');

  // pencarian cepat
  const cari = await page.evaluate(async () => {
    const input = document.querySelector('#ag-quick-filter');
    input.value = 'jakarta';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    const baris = [...document.querySelectorAll('#ag-grid-nasabah .ag-row')];
    return { jumlah: baris.length, semuaJakarta: baris.every((b) => /jakarta/i.test(b.textContent)) };
  });
  console.log('   cari "jakarta":', JSON.stringify(cari), cari.semuaJakarta && cari.jumlah > 0 ? '✅' : '❌');
  if (!cari.semuaJakarta || cari.jumlah === 0) fail('pencarian cepat tidak menyaring dengan benar');
  await page.evaluate(() => { const i = document.querySelector('#ag-quick-filter'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(600);

  // dropdown penyaring pilihan di toolbar (Community: text filter "sama dengan")
  const dropdown = await page.evaluate(async () => {
    const r = { ada: {} };
    r.ada.cabang = !!document.querySelector('#ag-filter-cabang');
    r.ada.status = !!document.querySelector('#ag-filter-status');
    r.ada.reset = !!document.querySelector('#ag-filter-reset');
    const sc = document.querySelector('#ag-filter-cabang');
    sc.value = 'Jakarta';
    sc.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 800));
    const baris = [...document.querySelectorAll('#ag-grid-nasabah .ag-row')];
    r.jumlah = baris.length;
    r.semuaJakarta = baris.length > 0 && baris.every((b) => /jakarta/i.test(b.textContent));
    r.sinkronFloating = (document.querySelector('#ag-grid-nasabah .ag-floating-filter[col-id="cabang"] input') || {}).value || '';
    // bersihkan lewat tombol
    document.querySelector('#ag-filter-reset').click();
    await new Promise((r2) => setTimeout(r2, 700));
    r.setelahReset = document.querySelectorAll('#ag-grid-nasabah .ag-row').length;
    return r;
  });
  console.log('   penyaring toolbar:', JSON.stringify(dropdown));
  if (!dropdown.ada.cabang || !dropdown.ada.status || !dropdown.ada.reset) fail('dropdown penyaring di toolbar tidak lengkap');
  if (!dropdown.semuaJakarta) fail('penyaring Cabang di toolbar tidak menyaring (jumlah: ' + dropdown.jumlah + ')');
  if (dropdown.sinkronFloating !== 'Jakarta') fail('nilai dropdown tidak tersinkron ke floating filter: ' + dropdown.sinkronFloating);
  if (dropdown.setelahReset !== 10) fail('tombol bersihkan saringan tidak mengembalikan 10 baris: ' + dropdown.setelahReset);

  // filter kolom (floating filter teks pada kolom Cabang) — aksi asli seperti pengguna
  const ffInput = '#ag-grid-nasabah .ag-floating-filter[col-id="cabang"] input';
  const adaFf = (await page.$$(ffInput)).length > 0;
  let filter = { ada: adaFf };
  if (adaFf) {
    await page.fill(ffInput, 'Surabaya');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('#ag-grid-nasabah .ag-row').length === 2, null, { timeout: 5000 }).catch(() => {});
    filter = await page.evaluate(() => {
      const baris = [...document.querySelectorAll('#ag-grid-nasabah .ag-row')];
      return { ada: true, jumlah: baris.length, semuaSurabaya: baris.length > 0 && baris.every((b) => /surabaya/i.test(b.textContent)) };
    });
  }
  console.log('   filter Cabang=Surabaya:', JSON.stringify(filter));
  if (!filter.ada) fail('kolom Cabang tidak punya floating filter');
  else if (filter.jumlah !== 2 || !filter.semuaSurabaya) fail('filter kolom tidak bekerja (jumlah: ' + filter.jumlah + ')');

  // bersihkan saringan lewat tombol toolbar sebelum uji berikutnya
  const bersih = await (async () => {
    await page.click('#ag-filter-reset');
    await page.waitForFunction(() => document.querySelectorAll('#ag-grid-nasabah .ag-row').length === 10, null, { timeout: 5000 }).catch(() => {});
    return page.evaluate(() => ({
      baris: document.querySelectorAll('#ag-grid-nasabah .ag-row').length,
      quick: document.querySelector('#ag-filter-cabang').value,
      floating: (document.querySelector('#ag-grid-nasabah .ag-floating-filter[col-id="cabang"] input') || {}).value || '',
    }));
  })();
  console.log('   bersihkan saringan:', JSON.stringify(bersih));
  if (bersih.baris !== 10 || bersih.quick !== '' || bersih.floating !== '') fail('bersihkan saringan tidak menuntaskan semua filter');

  // pilih baris massal + ringkasan saldo
  const pilih = await page.evaluate(async () => {
    document.querySelector('.ag-header-select-all .ag-checkbox-input')?.click();
    await new Promise((r) => setTimeout(r, 600));
    const info = document.querySelector('#ag-selection-info').textContent.trim();
    window.AgGridDemo.hapusPilihan();
    await new Promise((r) => setTimeout(r, 400));
    return { info, setelahBersih: document.querySelector('#ag-selection-info').textContent.trim(), terpilih: window.AgGridDemo.pilihan() };
  });
  console.log('   pilih semua:', JSON.stringify(pilih));
  if (!/Terpilih:/.test(pilih.info)) fail('ringkasan pilihan tidak dihitung: ' + pilih.info);
  if (!/Belum ada/.test(pilih.setelahBersih)) fail('tombol bersihkan pilihan tidak bekerja');

  // tambah baris + ekspor CSV
  const tambah = await page.evaluate(async () => {
    const sebelum = window.AgGridDemo.jumlahBaris();   // grid sudah tanpa filter
    window.AgGridDemo.tambahBaris();
    await new Promise((r) => setTimeout(r, 700));
    return { sebelum, sesudah: window.AgGridDemo.jumlahBaris() };
  });
  console.log('   tambah baris:', JSON.stringify(tambah), tambah.sesudah === tambah.sebelum + 1 ? '✅' : '❌');
  if (tambah.sesudah !== tambah.sebelum + 1) fail('tambah baris tidak menambah data');

  // ekspor CSV — listener unduhan dipasang sebelum pemicu diklik
  const unduhan = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  const dipicu = await page.evaluate(async () => {
    window.AgGridDemo.eksporCsv();
    await new Promise((r) => setTimeout(r, 300));
    return document.querySelectorAll('#ag-nasabah, .ag-grid-host').length;
  });
  const file = await unduhan;
  let isiCsv = '';
  if (file) { try { isiCsv = fs.readFileSync(await file.path(), 'utf8'); } catch (e) { isiCsv = ''; } }
  console.log('   ekspor CSV   :', file ? file.suggestedFilename() + ' (' + isiCsv.length + ' byte)' : '(tidak tertangkap unduhan)');
  if (!file) fail('ekspor CSV tidak menghasilkan berkas unduhan');
  else {
    if (!/NB-1001/.test(isiCsv)) fail('isi CSV tidak memuat data grid');
    if (!/Tanggal bergabung|Bergabung/.test(isiCsv)) fail('header CSV tidak lengkap');
    if (/\b[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4}\b/.test(isiCsv)) fail('tanggal di CSV tidak berformat ISO');
  }
  if (errs.length) fail('error di konsol: ' + errs[0].slice(0, 120));
  await page.screenshot({ path: SHOT + 'ag-grid.png' });
  await ctx.close();
}

/* ---------- 4. tema & bahasa ---------- */
console.log('\n4. Tema perbankan, dark mode, dan bahasa');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/ag-grid.html', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  const ambilTema = () => page.evaluate(() => {
    const w = document.querySelector('#ag-grid-nasabah .ag-root-wrapper');
    const cs = getComputedStyle(w);
    const api = window.agGrid; // hanya untuk memastikan library hidup
    return {
      accent: cs.getPropertyValue('--ag-accent-color').trim(),
      bg: cs.getPropertyValue('--ag-background-color').trim(),
      font: cs.getPropertyValue('--ag-font-family').trim().slice(0, 30),
      akar: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim(),
      barisTerlihat: document.querySelectorAll('#ag-grid-nasabah .ag-row').length,
    };
  });
  const sebelum = await ambilTema();
  console.log('   default  :', JSON.stringify(sebelum));

  const setelah = await page.evaluate(async () => {
    const ui = window.Alpine.store('ui');
    ui.applyPreset(ui.presets[1]); // Private Banking (gelap + emas)
    await new Promise((r) => setTimeout(r, 900));
    const w = document.querySelector('#ag-grid-nasabah .ag-root-wrapper');
    const cs = getComputedStyle(w);
    return {
      tema: document.documentElement.getAttribute('data-theme'),
      accent: cs.getPropertyValue('--ag-accent-color').trim(),
      bg: cs.getPropertyValue('--ag-background-color').trim(),
      akar: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim(),
    };
  });
  console.log('   Private  :', JSON.stringify(setelah));
  if (setelah.tema !== 'dark') fail('preset Private Banking tidak mengaktifkan dark mode');
  if (sebelum.accent === setelah.accent) fail('warna aksen grid tidak ikut berubah saat skin diganti');
  await page.screenshot({ path: SHOT + 'ag-grid-private-banking.png' });

  const inggris = await page.evaluate(async () => {
    window.Alpine.store('i18n').set('en');
    await new Promise((r) => setTimeout(r, 1200));
    return {
      judulKolom: [...document.querySelectorAll('#ag-grid-nasabah .ag-header-cell-text')].map((n) => n.textContent.trim()),
      paginasi: (document.querySelector('#ag-grid-nasabah .ag-paging-description') || {}).textContent || '',
      baris: document.querySelectorAll('#ag-grid-nasabah .ag-row').length,
      filterInput: [...document.querySelectorAll('#ag-grid-nasabah .ag-floating-filter input')].map((i) => i.placeholder)[0] || '',
      optCabang: (document.querySelector('#ag-filter-cabang option[value=""]') || {}).textContent || '',
      optStatus: (document.querySelector('#ag-filter-status option[value=""]') || {}).textContent || '',
      tombolReset: (document.querySelector('#ag-filter-reset') || {}).textContent.trim(),
      ariaCabang: (document.querySelector('#ag-filter-cabang') || {}).getAttribute('aria-label'),
    };
  });
  console.log('   EN:', JSON.stringify(inggris));
  if (!inggris.judulKolom.includes('Balance')) fail('judul kolom tidak diterjemahkan: ' + inggris.judulKolom.join(', '));
  if (!/Page/.test(inggris.paginasi)) fail('label paginasi tidak diterjemahkan: ' + inggris.paginasi);
  if (inggris.baris === 0) fail('grid kosong setelah ganti bahasa');
  if (inggris.optCabang !== 'All branches') fail('opsi penyaring cabang tidak diterjemahkan: ' + inggris.optCabang);
  if (inggris.optStatus !== 'All statuses') fail('opsi penyaring status tidak diterjemahkan: ' + inggris.optStatus);
  if (!/Clear filters/.test(inggris.tombolReset)) fail('tombol bersihkan saringan tidak diterjemahkan: ' + inggris.tombolReset);
  if (inggris.ariaCabang !== 'Branch filter') fail('aria-label penyaring tidak diterjemahkan: ' + inggris.ariaCabang);
  await ctx.close();
}

/* ---------- 5. berkas mandiri offline/ag-grid.html ---------- */
console.log('\n5. Berkas mandiri offline/ag-grid.html (tanpa jaringan)');
{
  const ctx = await browser.newContext({ offline: true, viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  const gagalReq = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('requestfailed', (r) => gagalReq.push(r.url()));
  await page.goto('file://' + PROYEK + 'offline/ag-grid.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    gridUtama: document.querySelectorAll('#ag-grid-nasabah .ag-row').length,
    gridKedua: document.querySelectorAll('#ag-grid-cabang .ag-row').length,
    adaAgGrid: typeof window.agGrid,
    ikonKosong: document.querySelectorAll('i[data-icon]:empty').length,
    judul: document.querySelector('.page-title').textContent.trim(),
    sidebarUser: !!document.querySelector('.sidebar-user'),
    tombolKeluar: !!document.querySelector('.sidebar-footer .side-logout'),
  }));
  console.log('  ', JSON.stringify(r));
  if (r.adaAgGrid !== 'object') fail('agGrid tidak termuat di berkas mandiri');
  if (r.gridUtama !== 10) fail('grid utama tidak tergambar di berkas mandiri: ' + r.gridUtama);
  if (r.gridKedua !== 6) fail('grid kedua tidak tergambar di berkas mandiri: ' + r.gridKedua);
  if (r.ikonKosong) fail(r.ikonKosong + ' ikon kosong');
  if (r.sidebarUser) fail('sidebar-user masih ada di berkas mandiri');
  if (!r.tombolKeluar) fail('tombol keluar tidak ada di berkas mandiri');
  if (gagalReq.length) fail(gagalReq.length + ' permintaan gagal (harus nol saat offline)');
  if (errs.length) fail('error JS offline: ' + errs[0].slice(0, 120));
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ AG Grid Community lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
