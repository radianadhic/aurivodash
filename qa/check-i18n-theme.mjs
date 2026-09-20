/**
 * qa/check-i18n-theme.mjs — menguji tiga hal:
 *  1. tema perbankan (preset + skin + sidebar terang)
 *  2. dual bahasa (ID ⇄ EN) termasuk sisa teks Indonesia yang belum diterjemahkan
 *  3. header halaman: judul + breadcrumb + subjudul + aksi
 * Jalankan: PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright node qa/check-i18n-theme.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8080/pages/';
const SHOT = new URL('../preview/', import.meta.url).pathname;
const browser = await chromium.launch();
let gagal = 0;
const fail = (msg) => { gagal++; console.log('   ❌ ' + msg); };

/* ============ 1. TEMA PERBANKAN ============ */
console.log('1. Tema perbankan (preset, skin, sidebar)');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const presets = await page.evaluate(() => window.Alpine.store('ui').presets.map((p) => p.id));
  for (const id of presets) {
    const r = await page.evaluate((presetId) => {
      const ui = window.Alpine.store('ui');
      const p = ui.presets.find((x) => x.id === presetId);
      ui.applyPreset(p);
      const cs = getComputedStyle(document.documentElement);
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        skin: document.documentElement.getAttribute('data-skin'),
        sidebar: document.documentElement.getAttribute('data-sidebar'),
        primary: cs.getPropertyValue('--c-primary').trim(),
        sidebarBg: getComputedStyle(document.querySelector('.app-sidebar')).backgroundColor,
        badgeBg: getComputedStyle(document.querySelector('.side-link.active') || document.querySelector('.badge')).backgroundColor,
      };
    }, id);
    console.log(`   ${id.padEnd(9)} theme=${r.theme.padEnd(5)} skin=${r.skin.padEnd(9)} sidebar=${r.sidebar.padEnd(5)} primary=${r.primary.padEnd(8)} sidebarBg=${r.sidebarBg}`);
    if (r.theme !== (id === 'private' ? 'dark' : 'light')) fail(`preset ${id}: tema tidak sesuai`);
    if (r.skin !== { klasik: 'navy', private: 'midnight', wealth: 'emerald', korporat: 'burgundy', fintech: 'graphite', premium: 'gold' }[id]) fail(`preset ${id}: skin tidak sesuai`);
    if (!r.primary || r.primary === '') fail(`preset ${id}: --c-primary kosong`);
    if (id === 'klasik') await page.screenshot({ path: SHOT + 'tema-perbankan-klasik.png' });
    if (id === 'private') await page.screenshot({ path: SHOT + 'tema-private-banking.png' });
  }
  // 14 skin harus terdaftar & bisa diterapkan
  const skins = await page.evaluate(() => {
    const ui = window.Alpine.store('ui');
    const list = ['blue', 'green', 'purple', 'red', 'yellow', 'navy', 'black', 'midnight', 'gold', 'emerald', 'burgundy', 'royal', 'graphite', 'teal'];
    return list.map((s) => {
      ui.setSkin(s);
      return { s, v: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() };
    });
  });
  console.log('   skin teruji :', skins.length, '→', skins.map((x) => x.s).join(' '));
  if (skins.some((x) => !x.v)) fail('ada skin tanpa --c-primary');
  await page.evaluate(() => window.Alpine.store('ui').reset());
  if (errs.length) fail('error JS saat uji tema: ' + errs[0]);
  await ctx.close();
}

/* ============ 2. DUAL BAHASA ============ */
console.log('\n2. Dual bahasa (ID ⇄ EN)');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const sebelum = await page.evaluate(() => ({
    sidebar: document.querySelector('.side-link .txt')?.textContent.trim(),
    judul: document.querySelector('.page-title')?.textContent.trim(),
    sub: document.querySelector('.page-subtitle')?.textContent.trim().slice(0, 40),
    nav: [...document.querySelectorAll('.breadcrumb li')].map((li) => li.textContent.trim()).join(' > '),
    alpine: !!window.Alpine.store('i18n'),
  }));
  console.log('   ID:', JSON.stringify(sebelum));
  if (!sebelum.alpine) fail('store Alpine i18n tidak terdaftar');

  // ganti lewat tombol di navbar (bukan API langsung)
  await page.click('[title="Bahasa / Language"]');
  await page.waitForTimeout(300);
  await page.click('.dropdown-menu button:has-text("English")');
  await page.waitForTimeout(500);

  const sesudah = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    html_lang: document.documentElement.getAttribute('lang'),
    sidebarItem1: [...document.querySelectorAll('.side-link .txt')].slice(0, 6).map((n) => n.textContent.trim()),
    judul: document.querySelector('.page-title')?.textContent.trim(),
    sub: document.querySelector('.page-subtitle')?.textContent.trim().slice(0, 40),
    nav: [...document.querySelectorAll('.breadcrumb li')].map((li) => li.textContent.trim()).join(' > '),
    search: document.querySelector('[data-global-search]')?.getAttribute('placeholder'),
    tabTitle: document.title,
    panelJudul: document.querySelector('.control-sidebar h3')?.textContent.trim(),
    ls: localStorage.getItem('app.locale'),
  }));
  console.log('   EN:', JSON.stringify(sesudah));
  if (sesudah.judul !== 'Analytics Dashboard') fail('judul halaman tidak diterjemahkan');
  if (!Object.values(sesudah).length) fail('tidak ada perubahan');
  if (!sesudah.sidebarItem1.includes('Data Table') && !sesudah.sidebarItem1.includes('Tables'))
    fail('menu sidebar tidak diterjemahkan: ' + sesudah.sidebarItem1.join(', '));
  if (!/Search anything/.test(sesudah.search || '')) fail('placeholder pencarian tidak diterjemahkan');
  if (sesudah.ls !== 'en') fail('pilihan bahasa tidak tersimpan di localStorage');
  if (!/· Aurivo Dash$/.test(sesudah.tabTitle)) fail('judul tab peramban rusak (sufiks merek harus "· Aurivo Dash"): ' + sesudah.tabTitle);
  await page.screenshot({ path: SHOT + 'bahasa-inggris.png' });

  /* --- sisa teks Indonesia yang masih tampak (kualitas terjemahan) --- */
  const sisa = await page.evaluate(() => {
    const ID = /\b(dan|atau|yang|untuk|dengan|dari|tidak|ini|itu|pada|akan|adalah|bisa|semua|dalam|ulang|baru|lagi|sudah|belum|halaman|tombol|kartu|tabel|waktu|tanggal|hari|jam|menit|jumlah|nama|pilih|tambah|hapus|simpan|ubah|lihat|buka|tutup|cari|kirim|masuk|keluar|unduh|unggah|pengguna|produk|pesanan|transaksi|laporan|stok|harga|total|warna|tema|bahasa|tautan|menu|ikon|grafik|formulir|papan|profil|status|pesan|notifikasi|aktivitas|ringkasan|contoh|siap|pakai|jenis|tanpa|gaya|berkas|penjualan|pelanggan|karyawan|tugas|proyek|alamat|nomor|kota|kode|sandi|akun|saya|anda|pengaturan|terang|gelap|juga|masih|lebih|paling|sedang|setiap|selama|sampai|mulai|selesai|klik|geser|lanjut|kembali|lewat)\b/i;
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) {
        const t = n.nodeValue.trim();
        if (t.length > 3 && ID.test(t) && n.parentElement && !n.parentElement.closest('[x-text],[x-html],script,style')) out.push(t);
        return;
      }
      if (n.nodeType !== 1 || n.closest('script,style')) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return [...new Set(out)];
  });
  console.log(`   sisa teks Indonesia di dashboard: ${sisa.length}`);
  sisa.slice(0, 12).forEach((t) => console.log('      · ' + t.slice(0, 78)));

  // kembali ke Indonesia
  await page.evaluate(() => window.Alpine.store('i18n').set('id'));
  await page.waitForTimeout(400);
  const balik = await page.evaluate(() => ({
    judul: document.querySelector('.page-title')?.textContent.trim(),
    lang: document.documentElement.lang,
  }));
  if (balik.judul !== 'Dashboard Analitik') fail('gagal kembali ke bahasa Indonesia: ' + balik.judul);
  if (errs.length) fail('error JS saat uji bahasa: ' + errs[0]);
  await ctx.close();
}

/* ============ 3. HEADER HALAMAN ============ */
console.log('\n3. Header halaman (judul + breadcrumb + subjudul + aksi)');
{
  const pages = ['index', 'analytics', 'tables', 'forms', 'charts', 'widgets', 'kanban', 'icons', 'profile', 'invoice'];
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  for (const p of pages) {
    await page.goto(`${BASE}${p}.html`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const h = await page.evaluate(() => {
      const hd = document.querySelector('.content-header');
      const inner = document.querySelector('.content-header-inner');
      const crumb = document.querySelectorAll('.breadcrumb li').length;
      const sub = document.querySelector('.page-subtitle');
      const act = document.querySelector('.page-actions');
      return {
        ada: !!hd,
        judul: document.querySelector('.page-title')?.textContent.trim() || '',
        crumbItems: crumb,
        crumbAktif: document.querySelector('.breadcrumb-current')?.textContent.trim() || '',
        subjudul: (sub?.textContent.trim() || '').slice(0, 46),
        aksi: act ? act.children.length : 0,
        sejajar: inner ? Math.abs(inner.querySelector('.content-header-main').getBoundingClientRect().top - (act ? act.getBoundingClientRect().top : 0)) < 60 : false,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    const masalah = [];
    if (!h.ada) masalah.push('header hilang');
    if (!h.judul) masalah.push('judul kosong');
    if (h.crumbItems < 2) masalah.push('breadcrumb < 2 item');
    if (!h.crumbAktif) masalah.push('crumb aktif kosong');
    if (!h.subjudul) masalah.push('subjudul kosong');
    if (h.aksi === 0) masalah.push('tanpa aksi');
    if (h.overflowX) masalah.push('overflow X');
    if (masalah.length) gagal++;
    console.log(' ', p.padEnd(10), `judul="${h.judul}" crumb=${h.crumbItems}("${h.crumbAktif}") aksi=${h.aksi}`, masalah.length ? '❌ ' + masalah.join(', ') : '✅');
  }
  if (errs.length) fail('error JS pada header: ' + errs[0]);
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Semua pemeriksaan lulus.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
