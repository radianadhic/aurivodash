/**
 * qa/check-sticky-header.mjs — memastikan header halaman (breadcrumb + judul + aksi)
 * TIDAK bergerak saat halaman di-scroll.
 *
 * Diuji: posisi header setelah scroll, navbar tetap di atas, isi halaman lewat di
 * belakang header (opaque), kepala tabel sticky berhenti di bawah header, di ponsel
 * tetap ringkas, serta halaman tanpa shell (login) tidak terpengaruh.
 */
import { chromium } from 'playwright';

/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/

const BASE = 'http://localhost:8080/';
const SHOT = new URL('../preview/', import.meta.url).pathname;
const PAGES = ['pages/index.html', 'pages/analytics.html', 'pages/tables.html', 'pages/forms.html',
  'pages/charts.html', 'pages/widgets.html', 'pages/kanban.html', 'pages/icons.html',
  'pages/profile.html', 'pages/invoice.html'];

const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };

/* ---------- 1. header tidak bergerak saat scroll ---------- */
console.log('1. Posisi header saat halaman di-scroll');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const awal = await page.evaluate(() => ({
    headerTop: Math.round(document.querySelector('.content-header').getBoundingClientRect().top),
    navTop: Math.round(document.querySelector('.app-navbar').getBoundingClientRect().top),
    stuck: document.querySelector('.content-header').getAttribute('data-stuck'),
    tinggiHeader: Math.round(document.querySelector('.content-header').getBoundingClientRect().height),
    varHeaderH: getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim(),
    bayangan: getComputedStyle(document.querySelector('.content-header')).boxShadow,
  }));
  console.log('   sebelum scroll:', JSON.stringify(awal));
  // sebelum di-scroll: header sudah rapi di bawah navbar, tapi tanpa bayangan/pemisah
  if (awal.stuck === 'true') fail('data-stuck sudah aktif sebelum halaman di-scroll (bayangan muncul terlalu dini)');
  if (!/none/.test(awal.bayangan)) fail('bayangan header muncul sebelum di-scroll');
  if (Math.abs(awal.headerTop - 56) > 1) fail('header tidak tepat di bawah navbar pada posisi awal');

  for (const y of [300, 800, 1500, 2500]) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(220);
    const r = await page.evaluate(() => {
      const h = document.querySelector('.content-header');
      const n = document.querySelector('.app-navbar');
      const bt = h.getBoundingClientRect();
      const nb = n.getBoundingClientRect();
      return {
        scrollY: Math.round(window.scrollY),
        headerTop: Math.round(bt.top),
        navTop: Math.round(nb.top),
        navBottom: Math.round(nb.bottom),
        stuck: h.getAttribute('data-stuck'),
        bayangan: getComputedStyle(h).boxShadow,
        borderWarna: getComputedStyle(h).borderBottomColor,
        judulTerlihat: bt.top >= -1 && bt.top < window.innerHeight,
        bgOpaque: getComputedStyle(h).backgroundColor,
        borderBawah: getComputedStyle(h).borderBottomColor,
        bayangan: getComputedStyle(h).boxShadow,
      };
    });
    const sejajar = Math.abs(r.headerTop - r.navBottom) <= 1;
    if (y === 800 && /none/.test(r.bayangan)) fail('bayangan tidak muncul saat header menempel');
    if (y === 800 && r.borderWarna === 'rgba(0, 0, 0, 0)') fail('garis pemisah tidak muncul saat header menempel');
    console.log(`   scrollY=${String(r.scrollY).padStart(4)} headerTop=${String(r.headerTop).padStart(3)} navBottom=${r.navBottom} stuck=${r.stuck} bg=${r.bgOpaque}`,
      sejajar ? '✅ menempel tepat di bawah navbar' : '❌ posisi header salah');
    if (!sejajar) fail(`scrollY=${r.scrollY}: headerTop=${r.headerTop} ≠ navBottom=${r.navBottom}`);
    if (r.stuck !== 'true') fail(`scrollY=${r.scrollY}: penanda data-stuck belum aktif`);
    if (/rgba\(0, 0, 0, 0\)/.test(r.bgOpaque)) fail(`scrollY=${r.scrollY}: latar header transparan (isi akan menembus)`);
  }

  // judul, breadcrumb, dan aksi tetap ada di viewport setelah scroll jauh
  const isi = await page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= window.innerHeight + 1 && b.width > 0;
    };
    return {
      judul: document.querySelector('.page-title').textContent.trim(),
      judulTerlihat: vis('.page-title'),
      crumbTerlihat: vis('.breadcrumb'),
      aksiTerlihat: vis('.page-actions'),
      aksiJumlah: document.querySelectorAll('.page-actions > *').length,
    };
  });
  console.log('   setelah scroll 2500px:', JSON.stringify(isi));
  if (!isi.judulTerlihat || !isi.crumbTerlihat || !isi.aksiTerlihat) fail('sebagian header hilang dari layar saat di-scroll');

  await page.screenshot({ path: SHOT + 'header-sticky-desktop.png' });
  if (errs.length) fail('error JS: ' + errs[0]);
  await ctx.close();
}

/* ---------- 2. semua halaman memakai perilaku yang sama ---------- */
console.log('\n2. Semua halaman (judul/crumb/aksi harus menetap)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const h = document.querySelector('.content-header');
      const posisiAwal = h.getBoundingClientRect().top;
      window.scrollTo(0, 900);
      await new Promise((r) => setTimeout(r, 200));
      const nav = document.querySelector('.app-navbar');
      return {
        posisiAwal: Math.round(posisiAwal),
        topSetelah: Math.round(h.getBoundingClientRect().top),
        navBottom: Math.round(nav.getBoundingClientRect().bottom),
        stuck: h.getAttribute('data-stuck'),
        scrollY: Math.round(window.scrollY),
      };
    });
    const ok = r.scrollY < 900 || Math.abs(r.topSetelah - r.navBottom) <= 1;
    if (!ok) gagal++;
    console.log(' ', p.replace('pages/', '').padEnd(15), `top setelah scroll=${r.topSetelah} (navBottom=${r.navBottom}) stuck=${r.stuck}`, ok ? '✅' : '❌');
  }
  if (errs.length) fail('error JS: ' + errs[0]);
  await ctx.close();
}

/* ---------- 3. kepala tabel: dua mode ---------- */
console.log('\n3. Kepala tabel yang menempel');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/tables.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // 3a. di dalam wadah bergulir sendiri → menempel di tepi atas wadah
  const a = await page.evaluate(async () => {
    const th = document.querySelector('.table-head-fixed thead th');
    const wrap = th.closest('.table-wrap');
    wrap.scrollTop = 160;
    await new Promise((r) => setTimeout(r, 200));
    return {
      topCss: getComputedStyle(th).top,
      gapDariWadah: Math.round(th.getBoundingClientRect().top - wrap.getBoundingClientRect().top),
      wadahBergulir: wrap.scrollTop > 0,
    };
  });
  const okA = parseFloat(a.topCss) === 0 && Math.abs(a.gapDariWadah) <= 1 && a.wadahBergulir;
  console.log('   3a wadah bergulir :', JSON.stringify(a), okA ? '✅ kepala tabel menempel di atas wadah' : '❌ posisi salah');
  if (!okA) gagal++;

  // 3b. di alur halaman → menempel tepat di bawah header halaman
  const b = await page.evaluate(async () => {
    const th = document.querySelector('.table-head-fixed-viewport thead th');
    const nav = document.querySelector('.app-navbar');
    const header = document.querySelector('.content-header');
    const batas = nav.offsetHeight + header.getBoundingClientRect().height;
    let thTop = null;
    for (let y = 300; y <= 8000; y += 150) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 45));
      const t = th.getBoundingClientRect().top;
      if (Math.abs(t - batas) <= 1.5) { thTop = Math.round(t); break; }
      if (t < batas - 1.5) { thTop = Math.round(t); break; } // melewati batas = tertutup
    }
    const hasil = {
      topCss: getComputedStyle(th).top,
      batas: Math.round(batas),
      thTop,
      headerBottom: Math.round(header.getBoundingClientRect().bottom),
      tertutup: thTop !== null && thTop < header.getBoundingClientRect().bottom - 1,
    };
    window.scrollTo(0, 0);
    return hasil;
  });
  const okB = !b.tertutup && b.thTop !== null && Math.abs(b.thTop - b.batas) <= 2;
  console.log('   3b alur halaman   :', JSON.stringify(b), okB ? '✅ kepala tabel berhenti di bawah header' : '❌ tertutup / tidak menempel');
  if (!okB) gagal++;
  await ctx.close();
}

/* ---------- 4. ponsel + halaman tanpa shell ---------- */
console.log('\n4. Ponsel (430px) & halaman tanpa header shell');
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 860 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    window.scrollTo(0, 700);
    await new Promise((r) => setTimeout(r, 250));
    const h = document.querySelector('.content-header');
    const nav = document.querySelector('.app-navbar');
    return {
      top: Math.round(h.getBoundingClientRect().top),
      navBottom: Math.round(nav.getBoundingClientRect().bottom),
      tinggi: Math.round(h.getBoundingClientRect().height),
      bagianLayar: Math.round((h.getBoundingClientRect().height / window.innerHeight) * 100) + '%',
      subtitle: getComputedStyle(document.querySelector('.page-subtitle')).display,
    };
  });
  const ok = Math.abs(r.top - r.navBottom) <= 1 && parseFloat(r.bagianLayar) < 30;
  console.log('  ', JSON.stringify(r), ok ? '✅ ringkas & menempel' : '❌ header terlalu tinggi / tidak menempel');
  if (!ok) gagal++;
  await page.screenshot({ path: SHOT + 'header-sticky-ponsel.png' });

  // halaman auth tidak punya .content-header → tidak boleh error
  await page.goto(BASE + 'login.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const auth = await page.evaluate(() => ({ adaHeader: !!document.querySelector('.content-header'), tinggi: document.body.scrollHeight }));
  console.log('   login.html:', JSON.stringify(auth), auth.adaHeader ? '❌ seharusnya tanpa header shell' : '✅ tidak terpengaruh');
  if (auth.adaHeader) gagal++;
  if (errs.length) fail('error JS: ' + errs[0]);
  await ctx.close();
}

/* ---------- 5. berkas mandiri (offline) ---------- */
console.log('\n5. Berkas mandiri di folder offline/');
{
  const ctx = await browser.newContext({ offline: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + PROYEK + 'offline/dashboard.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(async () => {
    window.scrollTo(0, 1200);
    await new Promise((r) => setTimeout(r, 250));
    const h = document.querySelector('.content-header');
    const nav = document.querySelector('.app-navbar');
    return {
      top: Math.round(h.getBoundingClientRect().top),
      navBottom: Math.round(nav.getBoundingClientRect().bottom),
      stuck: h.getAttribute('data-stuck'),
      judul: document.querySelector('.page-title').textContent.trim(),
    };
  });
  const ok = Math.abs(r.top - r.navBottom) <= 1 && r.stuck === 'true';
  console.log('  ', JSON.stringify(r), ok ? '✅ menempel juga di berkas mandiri' : '❌ tidak menempel');
  if (!ok) gagal++;
  if (errs.length) fail('error JS offline: ' + errs[0]);
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Header halaman menetap saat scroll di semua kondisi.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
