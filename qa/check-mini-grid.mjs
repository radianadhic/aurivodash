/**
 * qa/check-mini-grid.mjs — regresi menu "Mini Grid" (6 contoh MiniGrid).
 *
 * Diuji:
 *   1. Render 6 halaman (pages/mini-grid-1..6.html): grid, chip jumlah baris,
 *      info, footer, tombol toolbar, log, tanpa error konsol.
 *   2. Mini Grid 1 — virtual scroll 50.000 baris, 2 kolom beku, pager, sortir
 *      (termasuk multi-sort Shift+klik), pencarian global, bersihkan filter.
 *   3. Mini Grid 2 — CRUD form modal (tambah → tersimpan di localStorage),
 *      edit inline (klik ganda + Enter), reset contoh, ekspor CSV.
 *   4. Mini Grid 3 — alur persetujuan (Approve / Reject baris terpilih),
 *      form filter terpusat.
 *   5. Mini Grid 4 — tanpa checkbox + aksi per baris (Detail/Edit/Hapus),
 *      formulir 3 kolom.
 *   6. Mini Grid 5 — data dari API (onRefresh → Promise) + status sumber & latensi.
 *   7. Mini Grid 6 — mode server-side: paging/sort/filter dikirim ke server(params)
 *      dan hanya satu halaman (dari 10.000 baris) yang ditahan di peramban.
 *   8. Dwibahasa — mode EN tidak menyisakan teks antarmuka berbahasa Indonesia
 *      (nilai data contoh dikecualikan) + atribut title/aria-label ikut berganti.
 *   9. Tema — grid mengikuti mode gelap/preset (warna dari token template).
 *  10. Berkas mandiri offline/mini-grid-N.html jalan tanpa jaringan.
 *
 *  11. Tombol muat ulang (refresh) di toolbar + tombol navbar tiap halaman:
 *      lapisan [data-role=load] tampil (dengan ikon berputar) sementara kunci
 *      layar template juga aktif, lalu keduanya tertutup lagi; jumlah data
 *      wajar per contoh dan kata kunci pencarian tetap dipertahankan.
 *
 * Jalankan (dari folder qa/):
 *   PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright node check-mini-grid.mjs
 * Prasyarat: server statis di http://localhost:8080 (dari akar proyek)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const ROOT = new URL('../', import.meta.url).pathname;
const HAL = [1, 2, 3, 4, 5, 6];
/* contoh 5 (seed acak) & 1/4 (segarkan contoh) memang berubah isi tiap muat ulang */
const HAL_ISI_BERUBAH = [1, 4, 5];
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);
/* MiniGrid menutup modal lewat tombol ✕ / klik latar (bukan tombol Escape) */
const tutupModal = async (page) => {
  const x = await page.$('.mg-modal [data-x]');
  if (x) await x.click({ force: true }).catch(() => {});
  await page.waitForTimeout(350);
};

/* ---------- daftar pengecualian untuk uji bahasa ----------
 * Kamus i18n memakai teks Indonesia sebagai kunci, jadi yang dicari hanyalah
 * teks ANTARMUKA. Nilai data contoh (nama orang, kota, kode, judul proyek)
 * memang dibiarkan apa adanya — daftar di bawah ini yang dikecualikan. */
const KOTA = ['Jakarta', 'Bandung', 'Bekasi', 'Bogor', 'Denpasar', 'Depok', 'Makassar', 'Medan',
  'Semarang', 'Surabaya', 'Tangerang', 'Yogyakarta', 'Malang', 'Palembang'];
const JUDUL_DATA = ['Audit Akses', 'Datamart Sales', 'Fase integrasi payroll', 'Finalisasi tanda tangan',
  'Kampanye Q4', 'Materi kreatif direview', 'Menunggu anggaran cair', 'Menunggu sumber data', 'Migrasi ERP',
  'Modul GL selesai', 'Portal HR', 'Rekrutmen Massal', 'Renovasi Gudang', 'Review izin trimestral', 'SOP Keselamatan'];
const SAMA_DI_EN = ['Approve', 'Reject', 'Edit', 'View', 'Detail', 'help', 'Legal', 'Shift', 'Mode', 'Mobile', 'Mini Grid',
  'Callback', 'localStorage', 'MiniGrid', 'Filter', 'Status', 'NIK', 'CSV', 'XLSX', 'PDF', 'AND', 'OR',
  /* merek/menu/istilah yang memang sama di kedua bahasa */
  'Dashboard', 'Tables', 'Home', 'Invoice', 'Admin', 'English', 'MIT', 'AG Grid Community',
  'Breadcrumb', 'Mini Grid 1', 'Mini Grid 2', 'Mini Grid 3', 'Mini Grid 4', 'Mini Grid 5', 'Mini Grid 6',
  'Filter+sort', 'filter+sort', 'Keyboard',
  'virtual scroll', 'aulia@perusahaan.id', 'Approved', 'Pending', 'Rejected', 'Probation', 'Supervisor',
  'SDM', 'IT', 'HRD', 'Keuangan', 'Operasional', 'QRIS', 'Scheduler', 'Notifikasi', 'Notifications',
  /* menu Tools + anaknya (label sengaja sama di kedua bahasa) */
  'Tools', 'Report Design', 'Report Viewer', 'Report Example'];
const POLA_DINAMIS = [/^\d+[–-]\d+ dari \d+/, /^ms · \d+ baris di DOM$/, /^\d+ baris di DOM$/,
  /^\d+ pelamar masuk$/, /^ID-\d+$/, /^#/, /^[A-Z][a-z]+ ([A-Z][a-z]+|[A-Z]\.)$/,
  /^[\d\s.,%:–—/()+\-]+$/, /^\d{2}\.\d{2}\.\d{2}$/, /^\d{2}:\d{2}:\d{2}$/,
  /* isi notifikasi tiruan (data contoh pada lonceng navbar ronde 4) */
  /^Pesanan #/, /^Rp \d/, /^Stok /, /^Sisa \d/, /^Pengguna baru/, /^Nadia Maharani/, /^Sinkronisasi data/,
  /^1\.284 baris/, /^Jadwal autodebet/, /^Autodebet tagihan/, /^Percobaan masuk/, /^Akun admin@/];
const DILEWATI = (isi) => !isi || isi.length < 3
  || KOTA.includes(isi) || JUDUL_DATA.includes(isi) || SAMA_DI_EN.includes(isi)
  || POLA_DINAMIS.some((r) => r.test(isi));

/* ---------- 1. render 4 halaman ---------- */
console.log('1. Render 4 halaman Mini Grid');
const ringkas = {};
for (const no of HAL) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${BASE}pages/mini-grid-${no}.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1700);
  const r = await page.evaluate((n) => {
    const host = document.getElementById('minigrid-' + n);
    const chip = document.querySelector('[data-mg-count]');
    const info = host && host.querySelector('[data-role=info]');
    const pager = host && host.querySelector('[data-role=pager]');
    return {
      ada: !!host,
      baris: host ? host.querySelectorAll('.mg-body tr').length : 0,
      chip: chip ? chip.textContent.trim() : null,
      info: info ? info.textContent.trim() : null,
      pager: pager ? pager.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      tools: host ? [...host.querySelectorAll('[data-role=tools] [data-act]')].map((b) => b.dataset.act) : [],
      log: (document.getElementById('mg-log') || {}).textContent || '',
      crumb: (document.querySelector('.breadcrumb') || {}).textContent || '',
      kolom: host ? [...host.querySelectorAll('.mg-head th')].map((th) => th.textContent.trim()) : [],
    };
  }, no);
  ringkas[no] = r;
  const masalah = [];
  if (!r.ada) masalah.push('host #minigrid-' + no + ' tidak ada');
  if (r.baris < 5) masalah.push('baris DOM hanya ' + r.baris);
  if (!r.info || !/dari/.test(r.info)) masalah.push('baris info tidak wajar: ' + r.info);
  if (!r.pager || !/filter\+sort/.test(r.pager)) masalah.push('footer pager tidak wajar: ' + r.pager);
  if (!r.tools.length) masalah.push('toolbar kosong');
  if (!/Mini Grid/.test(r.crumb)) masalah.push('breadcrumb tidak menyebut Mini Grid: ' + r.crumb.trim());
  if (errs.length) masalah.push('error JS: ' + errs[0].slice(0, 90));
  if (masalah.length) fail(`halaman ${no}: ` + masalah.join(' | '));
  else ok(`halaman ${no}: ${r.baris} baris DOM · chip ${r.chip} · ${r.info} · tools [${r.tools.join(', ')}]`);
  await ctx.close();
}
if (ringkas[1].chip !== '50000') fail('chip halaman 1 bukan 50000: ' + ringkas[1].chip);
if (!/50000/.test(ringkas[1].info)) fail('info halaman 1 tidak menyebut 50000: ' + ringkas[1].info);
if (ringkas[1].baris > 60) fail('virtual scroll gagal — ' + ringkas[1].baris + ' baris ada di DOM');
for (const a of ['add', 'edit', 'view', 'remove', 'export', 'cols']) {
  if (!ringkas[2].tools.includes(a)) fail('toolbar halaman 2 tanpa tombol ' + a);
}
for (const a of ['approve', 'reject', 'ffilter']) {
  if (!ringkas[3].tools.includes(a)) fail('toolbar halaman 3 tanpa tombol ' + a);
}
if (ringkas[4].tools.includes('remove')) fail('halaman 4 seharusnya tanpa hapus massal (select:false)');
/* contoh 5 & 6: tombol refresh bawaan + status sumber data */
for (const no of [5, 6]) {
  if (!ringkas[no].tools.includes('refresh')) fail(`toolbar halaman ${no} tanpa tombol refresh`);
  if (!ringkas[no].kolom.length) fail(`halaman ${no} tanpa kolom`);
}
if (ringkas[5].chip !== '500') fail('chip halaman 5 bukan 500: ' + ringkas[5].chip);
if (ringkas[6].chip !== '10') fail('chip halaman 6 bukan 10 (baris per halaman): ' + ringkas[6].chip);
if (!/10000/.test(ringkas[6].info)) fail('info halaman 6 tidak menyebut total 10000: ' + ringkas[6].info);
if (!/siap/i.test(ringkas[2].log)) fail('log halaman 2 kosong: ' + ringkas[2].log);

/* ---------- 2. Mini Grid 1: skala besar, kolom beku, sortir, cari ---------- */
console.log('\n2. Mini Grid 1 — virtual scroll, kolom beku, sortir, pencarian');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/mini-grid-1.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);

  const awal = await page.evaluate(() => {
    const host = document.getElementById('minigrid-1');
    const th = [...host.querySelectorAll('.mg-head th')];
    const frz = th.filter((t) => getComputedStyle(t).position === 'sticky')
      .map((t) => t.textContent.trim().replace(/[↕=≠∋^$>≥<≤adakosong]+$/, '').trim())
      .filter(Boolean);
    return { jumlahKolom: th.length, beku: frz, pilihanBaris: [...host.querySelectorAll('[data-role=size] option, [data-role=pager] option')].map((o) => o.value) };
  });
  console.log('   kolom:', awal.jumlahKolom, '| beku:', JSON.stringify(awal.beku));
  if (awal.beku.length !== 2) fail('kolom beku bukan 2 (ID & Nama Karyawan): ' + JSON.stringify(awal.beku));
  if (!/^ID/.test(awal.beku[0] || '') || !/^Nama/.test(awal.beku[1] || '')) fail('kolom beku bukan ID & Nama Karyawan: ' + JSON.stringify(awal.beku));

  const kunciSort = () => page.evaluate(() => window.MiniGridDemo.grid[1].s.sort.map((x) => x.n + ':' + x.d));
  await page.click('#minigrid-1 .mg-head div[data-sort="nama"]');
  await page.waitForTimeout(500);
  const kunci1 = await kunciSort();
  await page.click('#minigrid-1 .mg-head div[data-sort="kota"]', { modifiers: ['Shift'] });
  await page.waitForTimeout(500);
  const kunci2 = await kunciSort();
  await page.click('#minigrid-1 .mg-head div[data-sort="nama"]');
  await page.waitForTimeout(400);
  const kunci3 = await kunciSort();
  console.log('   sortir 1 kolom:', JSON.stringify(kunci1), '| +Shift:', JSON.stringify(kunci2), '| klik ulang (balik arah):', JSON.stringify(kunci3));
  if (kunci1.length !== 1 || kunci1[0] !== 'nama:1') fail('sortir 1 kolom gagal: ' + JSON.stringify(kunci1));
  if (kunci2.length !== 2) fail('multi-sort Shift+klik gagal: ' + JSON.stringify(kunci2));
  if (kunci3.length !== 1 || kunci3[0] !== 'nama:-1') fail('klik ulang tidak membalik arah sortir: ' + JSON.stringify(kunci3));

  const cari = await page.evaluate(async () => {
    const host = document.getElementById('minigrid-1');
    const q = host.querySelector('[data-role=q]');
    const sebelum = host.querySelector('[data-role=info]').textContent.trim();
    q.value = 'Wijaya';
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const sesudah = host.querySelector('[data-role=info]').textContent.trim();
    host.querySelector('[data-act=clear]').click();
    await new Promise((r) => setTimeout(r, 500));
    const bersih = host.querySelector('[data-role=info]').textContent.trim();
    return { sebelum, sesudah, bersih };
  });
  console.log('   cari "Wijaya":', cari.sebelum, '→', cari.sesudah, '→ reset:', cari.bersih);
  if (!/pilih|dari/.test(cari.sesudah)) fail('info setelah pencarian tidak wajar');
  if (cari.sesudah === cari.sebelum) fail('pencarian global tidak menyaring data');
  if (cari.bersih !== cari.sebelum) fail('tombol bersihkan filter tidak mengembalikan hasil: ' + cari.bersih);
  if (errs.length) fail('error JS halaman 1: ' + errs[0]);
  await ctx.close();
}

/* ---------- 3. Mini Grid 2: edit inline, CRUD, reset, ekspor ---------- */
console.log('\n3. Mini Grid 2 — edit inline, CRUD form modal, reset, ekspor CSV');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/mini-grid-2.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);

  /* edit inline: klik ganda sel Nama Karyawan baris pertama → ketik → Enter */
  const editInline = () => page.evaluate(async () => {
    const g = window.MiniGridDemo.grid[2];
    const host = document.getElementById('minigrid-2');
    const tr = host.querySelector('.mg-body tr');
    const td = [...tr.querySelectorAll('td[data-c]')].find((c) => c.dataset.c === 'nama');
    if (!td) return { error: 'sel "nama" tidak ditemukan' };
    td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    const inp = td.querySelector('input');
    if (!inp) return { error: 'editor inline tidak muncul' };
    inp.focus();
    inp.value = 'Uji Inline QA';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    const ls = JSON.parse(localStorage.getItem('template-minigrid-2') || 'null');
    return { nilai: g.data[0] && g.data[0].nama, lsNilai: ls && ls[0] && ls[0].nama, sel: td.textContent.trim() };
  });
  let inline = await editInline();
  if (!inline.error && inline.nilai !== 'Uji Inline QA') inline = await editInline(); /* sekali ulang bila fokus berebut */
  console.log('   edit inline:', JSON.stringify(inline));
  if (inline.error) fail('edit inline gagal: ' + inline.error);
  else if (inline.nilai !== 'Uji Inline QA') fail('nilai tidak berubah setelah edit inline: ' + inline.nilai);
  else if (inline.lsNilai !== 'Uji Inline QA') fail('hasil edit inline tidak tersimpan di localStorage: ' + inline.lsNilai);
  else ok('nilai berubah & tersimpan di localStorage (onEdit jalan)');

  /* CRUD: tambah baris lewat form modal */
  const sebelum = await page.evaluate(() => window.MiniGridDemo.grid[2].data.length);
  await page.click('#minigrid-2 [data-act=add]');
  await page.waitForTimeout(500);
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.mg-modal');
    if (!m) return null;
    const inp = [...m.querySelectorAll('input,select,textarea')];
    return { judul: m.querySelector('.text-sm.font-semibold').textContent.trim(), input: inp.length,
      wajib: inp.filter((i) => i.hasAttribute('required') || i.dataset.req != null).length };
  });
  console.log('   modal tambah:', JSON.stringify(modal));
  if (!modal || modal.input < 5) fail('form modal tambah tidak lengkap: ' + JSON.stringify(modal));
  await page.fill('.mg-modal input:not([disabled]):not([readonly])', 'Nama Uji QA');
  await page.click('.mg-modal [data-save]');
  await page.waitForTimeout(800);
  const sesudahTambah = await page.evaluate(() => {
    const g = window.MiniGridDemo.grid[2];
    return { jumlah: g.data.length, ada: g.data.some((r) => String(r.nama || '').includes('Nama Uji QA')),
      ls: (JSON.parse(localStorage.getItem('template-minigrid-2') || 'null') || []).length };
  });
  console.log('   setelah simpan:', JSON.stringify(sesudahTambah));
  if (sesudahTambah.jumlah !== sebelum + 1) fail('baris tidak bertambah (' + sebelum + ' → ' + sesudahTambah.jumlah + ')');
  if (!sesudahTambah.ada) fail('data baru tidak ada di grid');
  if (sesudahTambah.ls !== sesudahTambah.jumlah) fail('localStorage tidak sinkron (' + sesudahTambah.ls + ' vs ' + sesudahTambah.jumlah + ') — onSave gagal');
  else ok('baris baru tersimpan ke localStorage (onSave jalan)');
  await tutupModal(page);

  /* reset contoh */
  const reset = await page.evaluate(async () => {
    const hasil = window.MiniGridDemo.resetContoh2();
    await new Promise((r) => setTimeout(r, 500));
    return { hasil, jumlah: window.MiniGridDemo.grid[2].data.length };
  });
  console.log('   reset contoh:', JSON.stringify(reset));
  if (reset.jumlah !== 12) fail('reset contoh tidak mengembalikan 12 baris: ' + reset.jumlah);

  /* ekspor CSV dari menu Export */
  const unduh = await Promise.all([
    page.waitForEvent('download', { timeout: 9000 }).catch(() => null),
    (async () => {
      await page.click('#minigrid-2 [data-act=export]');
      await page.waitForTimeout(400);
      const csv = await page.$('[data-x="csv"]');
      if (csv) await csv.click();
    })(),
  ]).then(([d]) => d);
  if (!unduh) fail('ekspor CSV tidak menghasilkan unduhan');
  else {
    const nama = unduh.suggestedFilename();
    const isi = fs.readFileSync(await unduh.path(), 'utf8').split('\n');
    console.log('   ekspor CSV:', nama, '·', isi.length - 1, 'baris ·', isi[0].slice(0, 64));
    if (!/\.csv$/i.test(nama)) fail('nama berkas ekspor bukan CSV: ' + nama);
    if (!/Nama Karyawan/.test(isi[0])) fail('header CSV tidak sesuai: ' + isi[0].slice(0, 60));
    if (isi.length - 1 < 12) fail('CSV hanya berisi ' + (isi.length - 1) + ' baris data');
  }
  if (errs.length) fail('error JS halaman 2: ' + errs[0].slice(0, 120));
  await ctx.close();
}

/* ---------- 4. Mini Grid 3: alur persetujuan + form filter ---------- */
console.log('\n4. Mini Grid 3 — persetujuan baris terpilih + form filter terpusat');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/mini-grid-3.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);

  const nonaktif = await page.evaluate(() => {
    const t = document.getElementById('minigrid-3').querySelector('[data-role=tools]');
    return { approve: t.querySelector('[data-act=approve]').disabled, reject: t.querySelector('[data-act=reject]').disabled };
  });
  console.log('   tanpa pilihan → tombol mati:', JSON.stringify(nonaktif));
  if (!nonaktif.approve || !nonaktif.reject) fail('tombol Approve/Reject seharusnya mati tanpa baris terpilih');

  await page.evaluate(() => {
    const host = document.getElementById('minigrid-3');
    host.querySelector('.mg-body tr td input[data-ck]').click();
  });
  await page.waitForTimeout(400);
  const aktif = await page.evaluate(() => {
    const t = document.getElementById('minigrid-3').querySelector('[data-role=tools]');
    return { approve: !t.querySelector('[data-act=approve]').disabled, info: t.parentElement.parentElement.querySelector('[data-role=info]') ? null : null };
  });
  if (!aktif.approve) fail('tombol Approve tidak aktif setelah memilih baris');
  await page.click('#minigrid-3 [data-act=approve]');
  await page.waitForTimeout(600);
  const hasil = await page.evaluate(() => {
    const d = window.MiniGridDemo.grid[3].data;
    return { approved: d.filter((r) => r.status === 'Approved').length, log: document.getElementById('mg-log').textContent.trim() };
  });
  console.log('   setelah Approve:', JSON.stringify(hasil));
  if (!hasil.approved) fail('Approve tidak mengubah status baris terpilih');

  // Reject pada baris lain
  await page.evaluate(() => {
    const host = document.getElementById('minigrid-3');
    const ck = [...host.querySelectorAll('.mg-body tr td input[data-ck]')][1];
    if (ck) ck.click();
  });
  await page.waitForTimeout(300);
  await page.click('#minigrid-3 [data-act=reject]');
  await page.waitForTimeout(600);
  const tolak = await page.evaluate(() => window.MiniGridDemo.grid[3].data.filter((r) => r.status === 'Rejected').length);
  console.log('   setelah Reject:', tolak, 'baris');
  if (!tolak) fail('Reject tidak mengubah status baris');

  await page.click('#minigrid-3 [data-act=ffilter]');
  await page.waitForTimeout(500);
  const ff = await page.evaluate(() => {
    const m = document.querySelector('.mg-modal');
    return m ? { judul: m.querySelector('.text-sm.font-semibold').textContent.trim(), aturan: m.querySelectorAll('input,select').length } : null;
  });
  console.log('   form filter:', JSON.stringify(ff));
  if (!ff || ff.aturan < 6) fail('form filter terpusat tidak tampil lengkap: ' + JSON.stringify(ff));
  await tutupModal(page);
  if (errs.length) fail('error JS halaman 3: ' + errs[0]);
  await ctx.close();
}

/* ---------- 5. Mini Grid 4: aksi per baris & 3 kolom ---------- */
console.log('\n5. Mini Grid 4 — tanpa checkbox, aksi per baris, form 3 kolom');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/mini-grid-4.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);

  const r = await page.evaluate(() => {
    const host = document.getElementById('minigrid-4');
    const baris = [...host.querySelectorAll('.mg-body tr')];
    return {
      checkbox: host.querySelectorAll('.mg-body input[type=checkbox], .mg-head input[type=checkbox]').length,
      tombolBaris: baris.map((tr) => tr.querySelectorAll('td:last-child button').length),
      aksi: [...new Set(baris.flatMap((tr) => [...tr.querySelectorAll('td:last-child button')].map((b) => (b.title || b.dataset.act || b.textContent).trim())))],
    };
  });
  console.log('   checkbox:', r.checkbox, '| tombol/baris:', JSON.stringify([...new Set(r.tombolBaris)]), '| aksi:', JSON.stringify(r.aksi));
  if (r.checkbox !== 0) fail('halaman 4 masih punya checkbox (' + r.checkbox + ')');
  if (r.tombolBaris.some((n) => n !== 3)) fail('jumlah tombol aksi per baris bukan 3: ' + JSON.stringify(r.tombolBaris));

  await page.click('#minigrid-4 .mg-body tr td:last-child button:nth-child(1)');
  await page.waitForTimeout(500);
  const detail = await page.evaluate(() => {
    const m = document.querySelector('.mg-modal');
    if (!m) return null;
    const body = m.querySelector('.max-h-\\[65vh\\]');
    return {
      judul: m.querySelector('.text-sm.font-semibold').textContent.trim(),
      inputAktif: [...body.querySelectorAll('input,select,textarea')].filter((i) => !i.disabled && !i.readOnly).length,
      bidang: body.querySelectorAll('.rounded.bg-slate-50, .rounded-md.bg-slate-50').length,
    };
  });
  console.log('   modal detail:', JSON.stringify(detail));
  if (!detail) fail('modal Detail tidak terbuka');
  else {
    if (detail.inputAktif) fail('form Detail seharusnya hanya-baca, ada ' + detail.inputAktif + ' input aktif');
    if (detail.bidang < 6) fail('form Detail tidak menampilkan seluruh kolom: ' + detail.bidang + ' bidang');
  }
  await tutupModal(page);
  await page.waitForTimeout(300);

  await page.click('#minigrid-4 [data-act=add]');
  await page.waitForTimeout(500);
  const tambah = await page.evaluate(() => {
    const m = document.querySelector('.mg-modal');
    if (!m) return null;
    const tiga = [...m.querySelectorAll('*')].filter((el) => {
      const t = getComputedStyle(el).gridTemplateColumns;
      return t && t.split(' ').length === 3;
    });
    return { jumlahKontainer3Kolom: tiga.length, track: tiga[0] ? getComputedStyle(tiga[0]).gridTemplateColumns : null,
      jumlahInput: m.querySelectorAll('input,select,textarea').length };
  });
  console.log('   tata letak form tambah:', JSON.stringify(tambah));
  if (!tambah) fail('form tambah halaman 4 tidak ditemukan');
  else if (!tambah.jumlahKontainer3Kolom) fail('form tambah tidak memakai tata letak 3 kolom');
  else ok('form tambah 3 kolom (' + tambah.track + ')');
  await tutupModal(page);
  if (errs.length) fail('error JS halaman 4: ' + errs[0]);
  await ctx.close();
}

/* ---------- 6. dwibahasa ---------- */
console.log('\n6. Dwibahasa — mode EN bersih dari teks UI Indonesia');
{
  /* Kumpulkan semua teks + atribut yang terlihat (halaman, sidebar, grid, modal). */
  const kumpul = (page) => page.evaluate(() => {
    const keluar = [];
    const akar = [...document.querySelectorAll('.content-wrapper, .content-header, .sidebar-body, .app-navbar, .mg-modal, #minigrid-page-1, #minigrid-page-2, #minigrid-page-3, #minigrid-page-4')];
    akar.forEach((r) => r.querySelectorAll('*').forEach((el) => {
      if (el.closest('code,pre,script,style')) return;
      [...el.childNodes].forEach((n) => {
        if (n.nodeType === 3 && n.nodeValue.trim()) keluar.push(n.nodeValue.replace(/\s+/g, ' ').trim());
      });
      ['placeholder', 'title', 'aria-label'].forEach((a) => {
        if (el.hasAttribute(a) && el.getAttribute(a).trim()) keluar.push(el.getAttribute(a).trim());
      });
    }));
    return [...new Set(keluar)];
  });
  const bukaModal = async (page, no) => {
    const keluar = [];
    for (const act of ['ffilter', 'help', 'cols', 'export', 'add']) {
      const b = await page.$(`#minigrid-${no} [data-act="${act}"]`);
      if (!b) continue;
      await b.click({ force: true }).catch(() => {});
      await page.waitForTimeout(380);
      await page.evaluate(() => window.I18n.apply());
      await page.waitForTimeout(180);
      keluar.push(...(await kumpul(page)));
      await tutupModal(page);
    }
    return keluar;
  };

  const sisa = new Set();
  for (const no of HAL) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}pages/mini-grid-${no}.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1700);
    const idSet = new Set([...(await kumpul(page)), ...(await bukaModal(page, no))]);

    await page.evaluate(() => window.I18n.set('en'));
    await page.waitForTimeout(600);
    const enSet = new Set([...(await kumpul(page)), ...(await bukaModal(page, no))]);

    /* teks yang TIDAK berubah setelah bahasa diganti = belum ada padanannya */
    for (const t of idSet) if (enSet.has(t) && !DILEWATI(t)) sisa.add(t);

    /* atribut penting harus ikut berganti */
    const atr = await page.evaluate((n) => {
      const host = document.getElementById('minigrid-' + n);
      const add = host.querySelector('[data-act=add]');
      const all = host.querySelector('[data-role=all]');
      return { add: add ? add.title || add.getAttribute('aria-label') : null, all: all ? all.getAttribute('aria-label') : null };
    }, no);
    if (atr.all && /Pilih semua baris/.test(atr.all)) fail(`page ${no}: aria-label checkbox header belum diterjemahkan: ` + atr.all);
    if (errs.length) fail(`page ${no} (EN): error JS ` + errs[0]);
    await ctx.close();
  }
  const daftar = [...sisa].sort();
  if (daftar.length) {
    console.log('   teks yang belum diterjemahkan (' + daftar.length + '):');
    daftar.slice(0, 40).forEach((t) => console.log('     · ' + t));
    fail(daftar.length + ' teks antarmuka belum diterjemahkan di mode EN');
  } else ok('tidak ada teks/atribut antarmuka yang tertinggal di mode EN');

  /* kembali ke ID harus memulihkan teks Indonesia */
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/mini-grid-3.html', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  const balik = await page.evaluate(async () => {
    const t = () => document.querySelector('#minigrid-3 [data-act=approve]').title;
    window.I18n.set('en');
    await new Promise((r) => setTimeout(r, 500));
    const en = t();
    window.I18n.set('id');
    await new Promise((r) => setTimeout(r, 500));
    return { en, id: t() };
  });
  console.log('   title tombol Approve: EN =', JSON.stringify(balik.en), '· ID =', JSON.stringify(balik.id));
  if (balik.en === balik.id) fail('atribut title tidak berganti bahasa');
  if (!/Setujui/i.test(balik.id)) fail('kembali ke ID tidak memulihkan teks asli: ' + balik.id);
  await ctx.close();
}

/* ---------- 7. tema ---------- */
console.log('\n7. Integrasi tema (mode gelap & preset perbankan)');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/mini-grid-2.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);
  const ambil = () => page.evaluate(() => {
    const host = document.getElementById('minigrid-2');
    return {
      scroller: getComputedStyle(host.querySelector('[data-role=scroller]')).backgroundColor,
      head: getComputedStyle(host.querySelector('.mg-head th')).backgroundColor,
      teks: getComputedStyle(host.querySelector('.mg-body td')).color,
      aksen: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim(),
    };
  });
  const terang = await ambil();
  await page.evaluate(async () => {
    Alpine.store('ui').applyTheme('dark');
    await new Promise((r) => setTimeout(r, 500));
  });
  const gelap = await ambil();
  console.log('   terang:', JSON.stringify(terang));
  console.log('   gelap :', JSON.stringify(gelap));
  if (gelap.head === terang.head) fail('warna kepala tabel tidak berubah saat mode gelap');
  if (gelap.scroller === terang.scroller) fail('latar grid tidak berubah saat mode gelap');
  if (gelap.teks === terang.teks) fail('warna teks grid tidak berubah saat mode gelap');
  await page.evaluate(async () => {
    Alpine.store('ui').applyTheme('light');
    await new Promise((r) => setTimeout(r, 400));
  });
  const terangBaru = await ambil();
  if (terangBaru.head !== terang.head) fail('mode terang tidak memulihkan warna kepala tabel: ' + terangBaru.head + ' vs ' + terang.head);
  const preset = await page.evaluate(async () => {
    const ui = Alpine.store('ui');
    ui.applyPreset(ui.presets.find((p) => p.id === 'wealth'));
    await new Promise((r) => setTimeout(r, 500));
    const host = document.getElementById('minigrid-2');
    return {
      aksen: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim(),
      skin: document.documentElement.getAttribute('data-skin'),
      head: getComputedStyle(host.querySelector('.mg-head th')).backgroundColor,
    };
  });
  console.log('   preset wealth → skin', preset.skin, '· aksen', JSON.stringify(preset.aksen), '(sebelumnya', JSON.stringify(terang.aksen) + ')');
  if (!preset.aksen || preset.aksen.trim() === terang.aksen.trim()) fail('preset tidak mengganti token aksen: ' + preset.aksen);
  if (!preset.head) fail('grid kehilangan warna setelah preset berganti');
  await ctx.close();
}

/* ---------- 8. berkas mandiri offline ---------- */
console.log('\n8. Berkas mandiri (offline/mini-grid-N.html)');
{
  for (const no of HAL) {
    const berkas = `${ROOT}offline/mini-grid-${no}.html`;
    if (!fs.existsSync(berkas)) { fail('offline/mini-grid-' + no + '.html tidak ada'); continue; }
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    const r = await page.evaluate((n) => {
      const host = document.getElementById('minigrid-' + n);
      return {
        baris: host ? host.querySelectorAll('.mg-body tr').length : 0,
        ikon: document.querySelectorAll('i[data-icon] svg').length,
        chip: (document.querySelector('[data-mg-count]') || {}).textContent || null,
      };
    }, no);
    const masalah = [];
    if (r.baris < 5) masalah.push('baris DOM ' + r.baris);
    if (!r.ikon) masalah.push('ikon tidak dirender');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 80));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal (harusnya 0 saat offline)');
    if (masalah.length) fail(`offline mini-grid-${no}: ` + masalah.join(' | '));
    else ok(`offline mini-grid-${no}: ${r.baris} baris · chip ${r.chip} · ${r.ikon} ikon`);
    await ctx.close();
  }
}


/* ---------- 9. tombol muat ulang (refresh) ---------- */
console.log('9. Tombol muat ulang data (refresh)');
{
  for (const no of HAL) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}pages/mini-grid-${no}.html`, { waitUntil: 'load' });
    await page.waitForSelector(`#minigrid-${no} [data-act="refresh"]`, { timeout: 8000 });
    /* contoh 5 & 6 mengambil datanya secara asinkron saat halaman dibuka —
       tunggu sampai benar-benar diam agar tidak menabrak permintaan pertama */
    await page.waitForFunction((n) => {
      const g = window.MiniGridDemo.grid[n];
      const siap = n === 6 ? g.s.total > 0 : g.data.length > 0;
      const lapis = document.querySelector('#minigrid-' + n + ' [data-role=load]');
      return siap && lapis.classList.contains('hidden');
    }, no, { timeout: 9000 });
    await page.waitForTimeout(400);

    const tombolToolbar = await page.locator(`#minigrid-${no} [data-act="refresh"]`).count();
    const tombolNavbar = await page.locator('.nav-icon-btn[title*="Muat ulang"]').count();
    if (!tombolToolbar) fail(`Mini Grid ${no}: tombol refresh tidak ada di toolbar`);
    if (await page.locator(`#minigrid-${no} [data-act="reload"]`).count()) fail(`Mini Grid ${no}: tombol toolbar lama (data-act="reload") masih ada`);
    if (!tombolNavbar) fail(`Mini Grid ${no}: tombol refresh tidak ada di navbar`);

    const sebelum = await page.evaluate((n) => {
      const g = window.MiniGridDemo.grid[n];
      const tampil = g.view || g.pageRows || [];
      return { baris: document.getElementById('minigrid-' + n).querySelectorAll('.mg-body tr').length,
        data: g.data.length, tampil: tampil.length,
        cuplikan: JSON.stringify((tampil.length ? tampil : g.data).slice(0, 2)) };
    }, no);

    await page.click(`#minigrid-${no} [data-act="refresh"]`);
    await page.waitForTimeout(250);
    const saat = await page.evaluate((n) => {
      const host = document.getElementById('minigrid-' + n);
      const lapis = host.querySelector('[data-role=load]');
      const spin = lapis ? lapis.querySelector('.animate-spin') : null;
      const l = document.querySelector('.lock-overlay');
      return {
        lapisTampil: !!lapis && !lapis.classList.contains('hidden') && lapis.offsetHeight > 0,
        teksLapis: lapis ? (lapis.querySelector('[data-role=loadtxt]') || {}).textContent : '',
        putar: !!spin && getComputedStyle(spin).animationName !== 'none',
        kunci: !!l && l.getAttribute('data-open') === '1',
        judulKunci: l ? (l.querySelector('[data-lock-title]') || {}).textContent : '',
      };
    }, no);
    if (!saat.lapisTampil) fail(`Mini Grid ${no}: lapisan [data-role=load] tidak tampil selama memuat`);
    if (!saat.putar) fail(`Mini Grid ${no}: ikon status muat tidak berputar`);
    if (!saat.kunci) fail(`Mini Grid ${no}: kunci layar tidak tampil selama memuat`);
    if (!/Mini Grid/.test(saat.judulKunci)) fail(`Mini Grid ${no}: judul kunci layar tidak menyebut contohnya: ${saat.judulKunci}`);

    await page.waitForSelector(`#minigrid-${no} [data-role=load].hidden`, { state: 'attached', timeout: 10000 });
    /* kunci layar template menutup setelah pekerjaannya benar-benar selesai */
    await page.waitForFunction(() => !document.querySelector('.lock-overlay[data-open="1"]'), null, { timeout: 10000 });
    await page.waitForTimeout(150);
    const sesudah = await page.evaluate((n) => {
      const g = window.MiniGridDemo.grid[n];
      const tampil = g.view || g.pageRows || [];
      return { baris: document.getElementById('minigrid-' + n).querySelectorAll('.mg-body tr').length,
        data: g.data.length, tampil: tampil.length,
        cuplikan: JSON.stringify((tampil.length ? tampil : g.data).slice(0, 2)), halaman: g.s ? g.s.page : null,
        kunci: !!document.querySelector('.lock-overlay[data-open="1"]') };
    }, no);
    if (sesudah.kunci) fail(`Mini Grid ${no}: kunci layar tidak tertutup setelah selesai`);
    if (sesudah.data !== sebelum.data) fail(`Mini Grid ${no}: jumlah data berubah (${sebelum.data} → ${sesudah.data})`);
    if (!sesudah.halaman) fail(`Mini Grid ${no}: penomoran halaman rusak setelah muat ulang`);
    /* mode server-side: satu halaman saja yang ditahan di peramban */
    if (no === 6) {
      if (sesudah.data !== 0) fail(`Mini Grid 6: baris ditahan di peramban (data=${sesudah.data}, seharusnya 0)`);
      if (sesudah.tampil !== 10) fail(`Mini Grid 6: satu halaman seharusnya 10 baris, bukan ${sesudah.tampil}`);
    }
    const berubah = sesudah.cuplikan !== sebelum.cuplikan;
    if (HAL_ISI_BERUBAH.includes(no)) {
      if (!berubah) fail(`Mini Grid ${no}: data tidak diperbarui (isi baris sama persis)`);
      else ok(`Mini Grid ${no}: toolbar + navbar · ${sesudah.data} data · isi baris diperbarui · kunci layar tertutup`);
    } else if (no === 6) {
      ok(`Mini Grid 6: toolbar + navbar · 1 halaman (${sesudah.tampil} dari ${sesudah.halaman ? 'total' : ''} baris) di peramban · ${sesudah.data} baris ditahan · kunci layar tertutup`);
    } else {
      if (sesudah.data !== sebelum.data) fail(`Mini Grid ${no}: jumlah data berubah tak terduga (${sebelum.data} → ${sesudah.data})`);
      ok(`Mini Grid ${no}: toolbar + navbar · ${sesudah.data} data · halaman tetap ${sesudah.halaman} · kunci layar tertutup`);
    }
    if (errs.length) fail(`Mini Grid ${no}: error konsol — ${errs[0].slice(0, 80)}`);
    await ctx.close();
  }

  /* keadaan pencarian dipertahankan setelah muat ulang (Mini Grid 1) */
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}pages/mini-grid-1.html`, { waitUntil: 'load' });
  await page.waitForSelector('#minigrid-1 [data-act="refresh"]');
  const selektorCari = '#minigrid-1 [data-role="q"]';
  await page.fill(selektorCari, 'Wijaya');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const cariSebelum = await page.evaluate(() => window.MiniGridDemo.grid[1].view.length);
  await page.click('#minigrid-1 [data-act="refresh"]');
  await page.waitForSelector('#minigrid-1 [data-role=load].hidden', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(200);
  const pasca = await page.evaluate(() => ({
    data: window.MiniGridDemo.grid[1].data.length,
    tersaring: window.MiniGridDemo.grid[1].view.length,
    isiCari: (document.querySelector('#minigrid-1 [data-role="q"]') || {}).value,
  }));
  const cocok = await page.evaluate(() => window.MiniGridDemo.grid[1].view.every((r) => JSON.stringify(r).toLowerCase().includes('wijaya')));
  if (pasca.isiCari !== 'Wijaya') fail(`kata kunci pencarian hilang setelah muat ulang ("${pasca.isiCari}")`);
  else if (!(pasca.tersaring < pasca.data)) fail(`penyaring tidak lagi berlaku setelah muat ulang (${pasca.tersaring} dari ${pasca.data})`);
  else if (!cocok) fail('hasil setelah muat ulang tidak lagi cocok dengan kata kunci');
  else ok(`muat ulang setelah pencarian: kata kunci "${pasca.isiCari}" tetap, ${pasca.tersaring} dari ${pasca.data} baris tetap tersaring (data ${cariSebelum} → ${pasca.tersaring})`);
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Mini Grid lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
