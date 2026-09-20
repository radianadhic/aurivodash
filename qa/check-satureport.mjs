/**
 * qa/check-satureport.mjs — menguji menu sidebar "Tools" + tiga aplikasi SatuReport
 * (Report Design, Report Viewer, Report Example).
 *
 * Diuji: struktur menu Tools, buka/tutup + menu aktif + breadcrumb, pencarian menu,
 * bingkai (iframe) tiap aplikasi benar-benar memuat SatuReport, sinkron bahasa ID/EN,
 * layar penuh kartu, header tetap menempel saat di-scroll, widget AI tetap terlihat,
 * serta berkas mandiri di folder offline/ (tanpa permintaan jaringan).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const PROYEK = new URL('../', import.meta.url).pathname;
const SHOT = PROYEK + 'preview/';
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };

/* Galat bawaan aplikasi SatuReport (ada juga di berkas upstream aslinya — diuji
   langsung pada assets/satureport/designer.html). Bukan akibat integrasi template. */
const GALAT_UPSTREAM = /pageHeaderSection|reading 'width'|reading 'page'/;

const ANAK = [
  { label: 'Report Design', href: 'pages/report-design.html', frame: 'sr-frame-design', app: 'designer.html' },
  { label: 'Report Viewer', href: 'pages/report-viewer.html', frame: 'sr-frame-viewer', app: 'viewer.html' },
  { label: 'Report Example', href: 'pages/report-example.html', frame: 'sr-frame-example', app: 'examples.html' },
];

/* ---------- 1. struktur menu Tools ---------- */
console.log('1. Menu Tools: struktur & buka/tutup');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const s = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.sidebar-body li')].find((l) => (l.dataset.url || '').includes('Tools'));
    if (!li) return { ada: false };
    const btn = li.querySelector('button.side-link');
    const wrap = li.querySelector('.submenu-wrap');
    return {
      ada: true,
      induk: btn.querySelector('.txt').textContent.trim(),
      badge: (btn.querySelector('.badge') || {}).textContent,
      caret: !!btn.querySelector('.caret'),
      dataMenu: wrap.getAttribute('data-menu'),
      anak: [...wrap.querySelectorAll(':scope > .side-submenu > li')].map((x) => ({
        label: x.querySelector('a .txt').textContent.trim(),
        href: x.querySelector('a').getAttribute('href'),
        dataUrl: x.dataset.url,
      })),
    };
  });
  console.log('   struktur:', JSON.stringify(s));
  if (!s.ada) fail('menu Tools tidak ditemukan di sidebar');
  else {
    if (s.induk !== 'Tools') fail('label menu bukan "Tools": ' + s.induk);
    if (!s.caret) fail('menu Tools tidak punya caret');
    if (s.dataMenu !== 'tools') fail('submenu-wrap bukan data-menu="tools"');
    const label = s.anak.map((a) => a.label);
    const harap = ANAK.map((a) => a.label);
    if (JSON.stringify(label) !== JSON.stringify(harap)) fail('anak menu tidak sesuai: ' + label.join(' · '));
    ANAK.forEach((a, i) => {
      if (s.anak[i] && s.anak[i].href !== a.href.replace('pages/', '')) fail(a.label + ' href salah: ' + s.anak[i].href);
    });
  }

  // buka/tutup
  const sebelum = await page.$eval('.submenu-wrap[data-menu="tools"]', (el) => el.classList.contains('closed'));
  await page.click('li[data-url^="Tools"] button.side-link');
  await page.waitForTimeout(400);
  const sesudah = await page.$eval('.submenu-wrap[data-menu="tools"]', (el) => el.classList.contains('closed'));
  console.log('   closed sebelum:', sebelum, '→ sesudah klik:', sesudah);
  if (sebelum === sesudah) fail('klik menu Tools tidak mengubah keadaan submenu');
  const terlihat = await page.isVisible('.submenu-wrap[data-menu="tools"] a:has-text("Report Design")');
  if (!terlihat) fail('anak menu Tools tidak terlihat setelah dibuka');

  // pencarian menu
  await page.fill('.sidebar-input', 'report');
  await page.waitForTimeout(300);
  const tersaring = await page.$$eval('.sidebar-body li[data-url]', (ls) =>
    ls.filter((l) => l.style.display !== 'none').map((l) => (l.dataset.url || '').slice(0, 24))
  );
  const adaTools = tersaring.some((t) => /Tools/.test(t));
  console.log('   hasil pencarian "report":', JSON.stringify(tersaring.slice(0, 6)));
  if (!adaTools) fail('pencarian "report" tidak menyisakan menu Tools');
  await page.fill('.sidebar-input', '');
  await page.waitForTimeout(200);

  if (errs.length) fail('error JS di dashboard: ' + errs[0]);
  await ctx.close();
}

/* ---------- 2. halaman Tools: menu aktif, breadcrumb, bingkai, bahasa ---------- */
console.log('\n2. Tiga halaman Tools (bingkai aplikasi + bahasa)');
for (const a of ANAK) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  /* mulai dalam bahasa Inggris untuk menguji sinkronisasi bahasa */
  await page.goto(BASE + '404.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('app.locale', 'en'));
  await page.goto(BASE + a.href, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const r = await page.evaluate(({ label, frame, app }) => {
    const f = document.getElementById(frame);
    const li = [...document.querySelectorAll('.sidebar-body li')].find((l) => (l.dataset.url || '').includes(label.split(' ')[1]));
    const wrap = document.querySelector('.submenu-wrap[data-menu="tools"]');
    return {
      frameAda: !!f,
      src: f ? f.getAttribute('src') : null,
      tinggi: f ? Math.round(f.getBoundingClientRect().height) : 0,
      submenuTerbuka: wrap ? !wrap.classList.contains('closed') : null,
      aktif: li && li.querySelector('a') ? li.querySelector('a').classList.contains('active') : null,
      breadcrumb: [...document.querySelectorAll('.breadcrumb li')].map((x) => x.textContent.trim()).join(' › '),
      h1: document.querySelector('.page-title') ? document.querySelector('.page-title').textContent.trim() : '',
      aiTerlihat: (() => {
        const t = document.querySelector('#aichat .aichat-tombol');
        if (!t) return false;
        const rect = t.getBoundingClientRect();
        return rect.width > 20 && getComputedStyle(t).display !== 'none';
      })(),
      sticky: !!document.querySelector('[data-sticky-header]'),
      app: app,
    };
  }, a);
  console.log('   ' + a.label + ':', JSON.stringify({ ...r, src: (r.src || '').slice(-26) }));

  if (!r.frameAda) fail(a.label + ': iframe tidak ada');
  if (!/assets\/satureport\//.test(r.src || '')) fail(a.label + ': src iframe tidak menunjuk assets/satureport');
  if (!(r.src || '').endsWith(a.app)) fail(a.label + ': berkas aplikasi salah: ' + r.src);
  if (r.tinggi < 400) fail(a.label + ': tinggi bingkai terlalu kecil (' + r.tinggi + 'px)');
  if (!r.submenuTerbuka) fail(a.label + ': submenu Tools tidak terbuka otomatis');
  if (!r.aktif) fail(a.label + ': menu tidak ditandai aktif');
  if (!/Tools/.test(r.breadcrumb)) fail(a.label + ': breadcrumb tidak memuat Tools (' + r.breadcrumb + ')');
  if (!r.aiTerlihat) fail(a.label + ': widget AI tidak terlihat');
  if (!r.sticky) fail(a.label + ': header tidak memakai data-sticky-header');

  /* isi aplikasi di dalam bingkai + bahasa */
  const dalam = await page.evaluate(({ frame }) => {
    const f = document.getElementById(frame);
    const d = f && f.contentWindow ? f.contentWindow.document : null;
    return {
      judul: d ? d.title : null,
      alpine: !!(f && f.contentWindow && f.contentWindow.Alpine),
      tombol: d ? d.querySelectorAll('button').length : 0,
      bahasa: f && f.contentWindow && f.contentWindow.SatuI18n ? f.contentWindow.SatuI18n.lang : null,
    };
  }, a);
  console.log('      isi bingkai:', JSON.stringify(dalam));
  if (!dalam.judul || !/SatuReport|Galeri|Report/.test(dalam.judul)) fail(a.label + ': aplikasi tidak termuat di bingkai');
  if (!dalam.alpine) fail(a.label + ': Alpine tidak aktif di dalam aplikasi');
  if (dalam.bahasa !== 'en') fail(a.label + ': bahasa aplikasi tidak mengikuti template (en), dapat: ' + dalam.bahasa);

  /* ganti bahasa template → aplikasi harus ikut */
  await page.evaluate(() => window.I18n && window.I18n.set && window.I18n.set('id'));
  await page.waitForTimeout(2500);
  const bahasaId = await page.evaluate(({ frame }) => {
    const f = document.getElementById(frame);
    return f && f.contentWindow && f.contentWindow.SatuI18n ? f.contentWindow.SatuI18n.lang : null;
  }, a);
  console.log('      setelah bahasa template → ID, bahasa aplikasi:', bahasaId);
  if (bahasaId !== 'id') fail(a.label + ': aplikasi tidak berganti ke bahasa ID');

  /* layar penuh kartu */
  await page.click(`#kartu-${a.label.split(' ')[1].toLowerCase()} [data-card-tool="fullscreen"]`);
  await page.waitForTimeout(600);
  const max = await page.evaluate(({ frame }) => {
    const kartu = document.querySelector('.card-maximized');
    const f = document.getElementById(frame);
    const ai = document.querySelector('#aichat');
    const rect = f.getBoundingClientRect();
    return {
      ada: !!kartu,
      tinggi: Math.round(rect.height),
      zKartu: kartu ? getComputedStyle(kartu).zIndex : null,
      zAi: ai ? getComputedStyle(ai).zIndex : null,
    };
  }, a);
  console.log('      layar penuh:', JSON.stringify(max));
  if (!max.ada) fail(a.label + ': kartu tidak masuk mode layar penuh');
  if (max.tinggi < 400) fail(a.label + ': bingkai tidak membesar saat layar penuh (' + max.tinggi + 'px)');
  if (Number(max.zKartu) >= Number(max.zAi)) fail(a.label + ': kartu menutupi widget AI (z ' + max.zKartu + ' vs ' + max.zAi + ')');
  await page.click('.card-maximized [data-card-tool="fullscreen"]');
  await page.waitForTimeout(400);

  /* header tetap menempel saat di-scroll */
  const sticky = await page.evaluate(async () => {
    const h = document.querySelector('[data-sticky-header]');
    window.scrollTo(0, 600);
    await new Promise((r) => setTimeout(r, 400));
    const rect = h.getBoundingClientRect();
    const nav = document.querySelector('.app-navbar') || document.querySelector('header');
    return { atas: Math.round(rect.top), navBawah: nav ? Math.round(nav.getBoundingClientRect().bottom) : null, y: Math.round(window.scrollY) };
  });
  console.log('      sticky header:', JSON.stringify(sticky));
  if (sticky.y < 100) fail(a.label + ': halaman tidak bisa di-scroll (tinggi kurang?)');
  if (sticky.atas < -2 || sticky.atas > 80) fail(a.label + ': header tidak menempel saat scroll (top ' + sticky.atas + ')');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const asing = errs.filter((m) => !GALAT_UPSTREAM.test(m));
  if (asing.length) fail(a.label + ': error JS — ' + asing[0]);
  await page.screenshot({ path: SHOT + a.label.toLowerCase().replace(/ /g, '-') + '.png' });
  await ctx.close();
}

/* ---------- 3. berkas mandiri offline/ ---------- */
console.log('\n3. Berkas mandiri di folder offline/');
for (const [berkas, harap] of [
  ['report-design.html', 'Report Designer'],
  ['report-viewer.html', 'Report Viewer'],
  ['report-example.html', 'Galeri'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  const luar = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 80)));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) luar.push(r.url()); });
  await page.goto('file://' + PROYEK + 'offline/' + berkas, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => ({
    judul: document.title,
    alpine: typeof window.Alpine !== 'undefined',
    satu: typeof window.SatuReport !== 'undefined' || typeof window.SATU_EXAMPLES !== 'undefined',
    bahasa: window.SatuI18n ? window.SatuI18n.lang : null,
    tombol: document.querySelectorAll('button').length,
    tautanLama: /["'](designer|viewer|examples)\.html/.test(document.documentElement.innerHTML),
    jembatan: document.documentElement.innerHTML.includes('satureport.lang'),
  }));
  console.log('   ' + berkas + ':', JSON.stringify(r));
  if (!/Report|Galeri|SatuReport/.test(r.judul) || !/Aurivo Dash/.test(r.judul)) fail(berkas + ': judul tidak sesuai: ' + r.judul);
  if (!r.alpine) fail(berkas + ': Alpine tidak termuat');
  if (!r.satu) fail(berkas + ': API SatuReport tidak ada');
  if (r.bahasa !== 'id') fail(berkas + ': jembatan bahasa gagal (lang ' + r.bahasa + ')');
  if (r.tautanLama) fail(berkas + ': masih ada tautan ke designer.html/viewer.html/examples.html');
  if (!r.jembatan) fail(berkas + ': skrip jembatan bahasa tidak ada');
  if (luar.length) fail(berkas + ': ada permintaan jaringan: ' + luar[0]);
  const asing2 = errs.filter((m) => !GALAT_UPSTREAM.test(m));
  if (asing2.length) fail(berkas + ': error JS — ' + asing2[0]);
  await ctx.close();
}
/* tautan sidebar di berkas mandiri dashboard.html harus menuju berkas Tools */
{
  const dash = fs.readFileSync(PROYEK + 'offline/dashboard.html', 'utf8');
  const tautan = [...dash.matchAll(/href="(report-[a-z]+\.html)"/g)].map((m) => m[1]);
  console.log('   tautan Tools di offline/dashboard.html:', tautan.join(', '));
  const kurang = ['report-design.html', 'report-viewer.html', 'report-example.html'].filter((f) => !tautan.includes(f));
  if (kurang.length) fail('offline/dashboard.html belum menaut: ' + kurang.join(', '));
  const index = fs.readFileSync(PROYEK + 'offline/index.html', 'utf8');
  if (!/Aplikasi tools \(laporan\)/.test(index)) fail('offline/index.html tidak memuat daftar aplikasi tools');
  ['report-design.html', 'report-viewer.html', 'report-example.html'].forEach((f) => {
    if (!index.includes('href="' + f + '"')) fail('offline/index.html tidak menaut ' + f);
    if (!fs.existsSync(PROYEK + 'offline/' + f)) fail('berkas hilang: offline/' + f);
  });
}

await browser.close();
console.log("   catatan: galat 'pageHeaderSection'/'page' pada Report Design berasal dari aplikasi SatuReport sendiri.");
console.log(gagal === 0 ? '\n✅ Menu Tools + aplikasi SatuReport lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
