/**
 * qa/check-aichat.mjs — regresi "asisten AI yang selalu muncul" (window.AIChat).
 *
 * Diuji:
 *   1. Selalu ada: tombol peluncur #aichat terpasang di SEMUA halaman
 *      (pages/*.html, mobile/index.html, login/register/404, landing index.html).
 *   2. Tampilan: panel, gelembung sapaan, saran cepat, ikon SVG ter-render,
 *      posisi di dalam layar, tidak menutupi tombol "ke atas" maupun navigasi bawah.
 *   3. Percakapan: tema (sekalian mengganti tema), notifikasi (jumlah belum
 *      dibaca + tautan), penjelasan template, fallback, input kosong, tombol saran.
 *   4. Tautan aksi menyesuaikan kedalaman berkas (pages/ · root · mobile/ · offline/).
 *   5. Dwibahasa: label, saran, dan seluruh balasan ikut berganti ke EN.
 *   6. Kait API: setProvider() dipakai, gagal → kembali ke simulasi.
 *   7. Aplikasi nasabah: widget di dalam kerangka ponsel, di atas navigasi bawah,
 *      dan tetap bisa membuka/menutup panel.
 *   8. Berkas mandiri offline (file://): tampil tanpa satu pun permintaan jaringan.
 *   9. Tidak mengganggu: saat tertutup, tombol di area yang biasa tertutup panel
 *      tetap bisa diklik.
 *  10. Persistensi: percakapan & status panel bertahan saat pindah halaman.
 *
 * Jalankan (dari folder qa/):
 *   node check-aichat.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const PROYEK = new URL('..', import.meta.url).pathname;
/* Galat bawaan aplikasi SatuReport di halaman Tools (sama pada berkas upstream) */
const GALAT_UPSTREAM = /pageHeaderSection|reading 'width'|reading 'page'/;

const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);

/* widget dimulai tertutup (dipakai bagian yang tidak menguji widgetnya) */
const AI_OFF = () => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} };

async function halaman(url, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
  if (opts.aiOff !== false) await ctx.addInitScript(AI_OFF);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const keadaan = (page) => page.evaluate(() => {
  const root = document.getElementById('aichat');
  if (!root) return { ada: false };
  const panel = root.querySelector('.aichat-panel');
  const tombol = root.querySelector('.aichat-tombol');
  const r = tombol.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  return {
    ada: true,
    buka: root.getAttribute('data-buka'),
    panelTampil: !panel.hidden && p.width > 0,
    tombolTampil: r.width > 0 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
    pos: [Math.round(p.width), Math.round(p.height), Math.round(p.right), Math.round(p.bottom)],
    pesan: root.querySelectorAll('.aichat-baris').length,
    ikon: root.querySelectorAll('svg').length,
    saran: [...root.querySelectorAll('.aichat-saran button')].map((b) => b.textContent),
    zat: { ai: getComputedStyle(root).zIndex, induk: root.parentElement.className },
    dalamApp: !!root.closest('.mobile-app')
  };
});

/* ------------------------------------------------------------------ */
console.log('1. Selalu ada di semua halaman');
{
  const berkas = [
    ...fs.readdirSync(PROYEK + '/pages').filter((f) => f.endsWith('.html')).map((f) => 'pages/' + f),
    'mobile/index.html',
    ...['index.html', 'login.html', 'register.html', '404.html'],
  ];
  const hilang = [];
  for (const u of berkas) {
    const p = await browser.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + u, { waitUntil: 'load' });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const root = document.getElementById('aichat');
      const tombol = root && root.querySelector('.aichat-tombol');
      const rect = tombol && tombol.getBoundingClientRect();
      return { ada: !!root, terlihat: !!rect && rect.width > 20 && getComputedStyle(root).display !== 'none' };
    });
    if (!r.ada || !r.terlihat) hilang.push(u);
    const asing = errs.filter((e) => !GALAT_UPSTREAM.test(e));
    if (asing.length) hilang.push(u + '(error: ' + asing[0].slice(0, 40) + ')');
    await p.close();
  }
  if (hilang.length) fail('widget tidak terpasang di: ' + hilang.join(' · '));
  else ok(`widget terpasang & tombolnya terlihat di ${berkas.length} halaman (pages, mobile, login/register/404, landing)`);
  if (berkas.length !== 29) fail('daftar halaman berubah: ' + berkas.length);
  else ok('jumlah halaman yang diperiksa: 29');
}

console.log('2. Tampilan & posisi');
{
  const { ctx, page, errs } = await halaman('pages/index.html', { aiOff: false });
  await page.waitForTimeout(1600);
  const s = await keadaan(page);
  if (!s.ada) fail('widget tidak ada di dashboard');
  else {
    if (s.buka !== '1' || !s.panelTampil) fail('panel tidak terbuka otomatis pada kunjungan pertama');
    else ok('panel terbuka otomatis pada kunjungan pertama');
    if (s.pesan < 2) fail('sapaan awal hanya ' + s.pesan + ' pesan');
    else ok('sapaan awal: ' + s.pesan + ' pesan');
    if (s.ikon < 6) fail('ikon SVG hanya ' + s.ikon);
    else ok(`ikon SVG ter-render: ${s.ikon}`);
    if (s.saran.length !== 6) fail('saran cepat: ' + s.saran.length);
    else ok('saran cepat: ' + s.saran.length + ' tombol');
    const [w, h, kanan, bawah] = s.pos;
    if (kanan > 1440 || bawah > 900 || w < 300) fail('panel keluar layar: ' + JSON.stringify(s.pos));
    else ok(`panel ${w}×${h} px, tepi kanan ${kanan}/1440, tepi bawah ${bawah}/900`);
  }
  /* tombol "ke atas" tidak boleh bertumpuk dengan tombol AI */
  const tabel = await page.evaluate(() => {
    const ai = document.querySelector('#aichat .aichat-tombol').getBoundingClientRect();
    const atas = [...document.querySelectorAll('[data-back-to-top]')]
      .map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0)[0];
    if (!atas) return null;
    const tumpang = !(ai.right < atas.left || ai.left > atas.right || ai.bottom < atas.top || ai.top > atas.bottom);
    return { jarak: Math.round(atas.bottom - ai.top), tumpang };
  });
  if (tabel && tabel.tumpang) fail('tombol "ke atas" bertumpuk dengan tombol AI');
  else ok('tombol "ke atas" tidak bertumpuk dengan tombol AI');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 70));
  else ok('tanpa error konsol');
  await ctx.close();
}

console.log('3. Percakapan');
{
  const { ctx, page, errs } = await halaman('pages/index.html', { aiOff: false });
  await page.waitForTimeout(1500);
  const balas = async (teks) => {
    await page.fill('#aichat .aichat-input', teks);
    await page.press('#aichat .aichat-input', 'Enter');
    await page.waitForTimeout(1700);
    return page.evaluate(() => {
      const baris = [...document.querySelectorAll('#aichat .aichat-baris')];
      const balon = baris[baris.length - 1].querySelector('.aichat-balon');
      return { teks: balon.querySelector(':scope > *') ? balon.firstChild.textContent.trim() : balon.textContent.trim(), tautan: [...balon.querySelectorAll('.aichat-tautan')].map((a) => a.textContent) };
    });
  };

  const temaAwal = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const t = await balas('ganti mode gelap');
  const temaAkhir = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (temaAkhir === temaAwal) fail('perintah tema dari obrolan tidak mengganti tema');
  else ok(`"ganti mode gelap" → tema ${temaAwal} → ${temaAkhir}`);
  if (!/gelap/i.test(t.teks)) fail('balasan tema: ' + t.teks.slice(0, 60));
  else ok('balasan tema: "' + t.teks.slice(0, 46) + '"');
  if (!t.tautan.includes('Ganti tema')) fail('tombol "Ganti tema" tidak ada di balon');
  else ok('tombol aksi "Ganti tema" tersedia');

  const n = await balas('notifikasi saya');
  if (!/belum dibaca/.test(n.teks) || !/\d/.test(n.teks)) fail('balasan notifikasi: ' + n.teks.slice(0, 70));
  else ok('balasan notifikasi memuat jumlah: "' + n.teks.slice(0, 46) + '"');
  if (!n.tautan.includes('Buka Pusat Notifikasi')) fail('tautan pusat notifikasi tidak ada');
  else ok('tautan "Buka Pusat Notifikasi" tersedia');

  const tp = await balas('apa itu template ini?');
  if (!/template/i.test(tp.teks) || tp.teks.length < 60) fail('balasan template terlalu pendek');
  else ok('balasan template: ' + tp.teks.slice(0, 52) + '…');

  const f = await balas('resep kue lapis legit');
  if (!/setProvider/.test(f.teks)) fail('fallback tidak memberi petunjuk kait API');
  else ok('fallback memuat petunjuk window.AIChat.setProvider()');

  /* input kosong tidak menambah gelembung */
  const sebelum = await page.evaluate(() => document.querySelectorAll('#aichat .aichat-baris').length);
  await page.fill('#aichat .aichat-input', '   ');
  await page.press('#aichat .aichat-input', 'Enter');
  await page.waitForTimeout(600);
  const sesudah = await page.evaluate(() => document.querySelectorAll('#aichat .aichat-baris').length);
  if (sesudah !== sebelum) fail('input kosong menambah pesan (' + sebelum + ' → ' + sesudah + ')');
  else ok('input kosong diabaikan');

  /* tombol saran cepat mengirim pertanyaan */
  const sebelumSaran = sesudah;
  await page.click('#aichat .aichat-saran button:has-text("Mode offline")');
  await page.waitForTimeout(1700);
  const setelahSaran = await page.evaluate(() => ({
    n: document.querySelectorAll('#aichat .aichat-baris').length,
    balas: [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim()
  }));
  if (setelahSaran.n !== sebelumSaran + 2) fail('tombol saran tidak mengirim pertanyaan');
  else ok('tombol saran cepat mengirim pertanyaan & dibalas');
  if (!/offline|mandiri/i.test(setelahSaran.balas)) fail('balasan saran offline: ' + setelahSaran.balas.slice(0, 50));
  else ok('balasan "Mode offline" sesuai topik');

  /* tutup & buka lagi lewat tombol peluncur */
  await page.click('#aichat .aichat-tombol');
  await page.waitForTimeout(400);
  const tutup = await keadaan(page);
  if (tutup.buka !== '0' || tutup.panelTampil) fail('panel tidak tertutup oleh tombol peluncur');
  else ok('panel bisa ditutup lewat tombol peluncur');
  await page.click('#aichat .aichat-tombol');
  await page.waitForTimeout(400);
  if ((await keadaan(page)).buka !== '1') fail('panel tidak terbuka lagi');
  else ok('panel bisa dibuka lagi');

  /* bersihkan percakapan */
  await page.click('#aichat .aichat-bersih, #aichat .aichat-aksi-kepala button:nth-child(1)');
  await page.waitForTimeout(600);
  const bersih = await page.evaluate(() => document.querySelectorAll('#aichat .aichat-baris').length);
  if (bersih !== 2) fail('bersihkan percakapan menyisakan ' + bersih + ' pesan (harus 2 sapaan)');
  else ok('bersihkan percakapan → kembali ke 2 sapaan');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 70));
  else ok('tanpa error konsol');
  await ctx.close();
}

console.log('4. Tautan aksi menyesuaikan letak berkas');
{
  const uji = [
    ['pages/tables.html', '../pages/notifications.html'],
    ['index.html', 'pages/notifications.html'],
    ['mobile/index.html', '../pages/notifications.html'],
  ];
  let benar = 0;
  for (const [url, harap] of uji) {
    const { ctx, page } = await halaman(url, { aiOff: false, isMobile: url.startsWith('mobile'), hasTouch: url.startsWith('mobile'), viewport: url.startsWith('mobile') ? { width: 430, height: 900 } : undefined });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.AIChat.kirim('notifikasi'));
    await page.waitForTimeout(1700);
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('#aichat a.aichat-tautan')].pop();
      return a && a.getAttribute('href');
    });
    if (href !== harap) fail(url + ': tautan ' + href + ' (harus ' + harap + ')');
    else benar++;
    await ctx.close();
  }
  if (benar === uji.length) ok('tautan aksi benar di pages/ · root · mobile/ (' + uji.map((u) => u[1]).join(' · ') + ')');
}

console.log('5. Dwibahasa (EN)');
{
  const { ctx, page, errs } = await halaman('pages/index.html', { aiOff: false });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.I18n.set('en'));
  await page.waitForTimeout(700);
  const s = await keadaan(page);
  const label = await page.evaluate(() => ({
    judul: document.querySelector('#aichat .aichat-judul').textContent,
    sub: document.querySelector('#aichat .aichat-sub span:last-child').textContent,
    tanya: document.querySelector('#aichat .aichat-input').placeholder,
    catatan: document.querySelector('#aichat .aichat-catatan').textContent
  }));
  const idSisa = Object.values(label).filter((v) => /\b(tema|notifikasi|tanya|jawaban|asisten|kirim|pertanyaan)\b/i.test(v));
  if (idSisa.length) fail('label belum diterjemahkan: ' + JSON.stringify(idSisa));
  else ok('label widget EN: "' + label.judul + '" · "' + label.sub + '" · "' + label.tanya + '"');
  if (s.saran.join('|') !== 'What is Aurivo Dash?|Switch to dark mode|My notifications|Automatic schedules|QRIS|Offline mode')
    fail('saran cepat EN: ' + JSON.stringify(s.saran));
  else ok('6 saran cepat ikut diterjemahkan');

  await page.fill('#aichat .aichat-input', 'My notifications');
  await page.press('#aichat .aichat-input', 'Enter');
  await page.waitForTimeout(1800);
  const balas = await page.evaluate(() => [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim());
  if (!/unread notifications/.test(balas) || !/Open Notification Center/.test(balas)) fail('balasan notifikasi EN: ' + balas.slice(0, 80));
  else ok('balasan dinamis EN: "' + balas.split('.')[0] + '. · Open Notification Center"');
  const seluruh = await page.evaluate(() => [...document.querySelectorAll('#aichat .aichat-balon, #aichat .aichat-saran button, #aichat .aichat-judul, #aichat .aichat-catatan')]
    .map((e) => e.textContent).join(' | '));
  const bocor = seluruh.match(/\b(belum dibaca|Ganti tema|Buka Pusat Notifikasi|Coba tanya|Asisten AI|siap disambung)\b/g);
  if (bocor) fail('teks Indonesia tersisa di mode EN: ' + [...new Set(bocor)].join(', '));
  else ok('tidak ada sisa teks Indonesia di widget saat mode EN');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 70));
  await ctx.close();
}

console.log('6. Kait API (setProvider)');
{
  const { ctx, page } = await halaman('pages/scheduler.html', { aiOff: false });
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.AIChat.setProvider(async (o) => ({ teks: 'API: ' + o.pesan + ' [' + o.bahasa + ']', tautan: [{ label: 'Dokumentasi', href: 'https://example.com' }] })));
  const hasil = await page.evaluate(async () => { await window.AIChat.tanya('halo dari API'); return true; });
  await page.waitForTimeout(900);
  const p = await page.evaluate(() => ({
    balas: [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim(),
    tautan: [...document.querySelectorAll('#aichat a.aichat-tautan')].map((a) => a.getAttribute('href')).pop(),
    catatan: document.querySelector('#aichat .aichat-catatan').textContent
  }));
  if (!/^API: halo dari API \[id\]/.test(p.balas)) fail('balasan provider: ' + p.balas.slice(0, 60));
  else ok('provider dipakai: "' + p.balas.slice(0, 40) + '"');
  if (p.tautan !== 'https://example.com') fail('tautan dari provider tidak dirender');
  else ok('tautan dari provider dirender (href ' + p.tautan + ')');
  if (!/setProvider/.test(p.catatan)) fail('catatan kaki tidak berubah saat provider aktif');
  else ok('catatan kaki menandai model eksternal aktif');

  await page.evaluate(() => window.AIChat.setProvider(async () => { throw new Error('jaringan mati'); }));
  await page.evaluate(() => window.AIChat.tanya('tes gagal'));
  await page.waitForTimeout(1200);
  const g = await page.evaluate(() => [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim());
  if (!/Gagal menghubungi API/.test(g) || !/jaringan mati/.test(g)) fail('penanganan provider gagal: ' + g.slice(0, 70));
  else ok('provider gagal → "' + g.slice(0, 56) + '…"');

  await page.evaluate(() => window.AIChat.setProvider(null));
  const sim = await page.evaluate(() => window.AIChat.tanya('qris'));
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim());
  if (!/EMVCo/.test(s)) fail('kembali ke simulasi gagal: ' + s.slice(0, 60));
  else ok('setProvider(null) → kembali ke simulasi offline ("' + s.slice(0, 34) + '…")');
  await ctx.close();
}

console.log('7. Aplikasi nasabah');
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('app.idleMs', '0'));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const sebelumKunci = await page.evaluate(() => ({
    induk: document.getElementById('aichat').parentElement.className,
    zat: getComputedStyle(document.getElementById('aichat')).zIndex,
    zatBio: getComputedStyle(document.querySelector('.bio-layar')).zIndex
  }));
  if (!/mobile-app/.test(sebelumKunci.induk)) fail('widget tidak berada di dalam kerangka ponsel');
  else ok('widget duduk di dalam kerangka .mobile-app');
  if (parseInt(sebelumKunci.zat, 10) >= parseInt(sebelumKunci.zatBio, 10)) fail('widget menutupi layar kunci biometric');
  else ok(`lapisan widget (${sebelumKunci.zat}) di bawah layar kunci biometric (${sebelumKunci.zatBio})`);

  await page.locator('[data-bio-jari]').click();
  await page.waitForTimeout(1600);
  const pos = await page.evaluate(() => {
    const ai = document.querySelector('#aichat .aichat-tombol').getBoundingClientRect();
    const nav = document.querySelector('.mobile-nav').getBoundingClientRect();
    const panel = document.querySelector('#aichat .aichat-panel').getBoundingClientRect();
    const app = document.querySelector('.mobile-app').getBoundingClientRect();
    return {
      jarakNav: Math.round(nav.top - ai.bottom),
      panelDalam: Math.round(app.right - panel.right) >= 0 && Math.round(app.bottom - panel.bottom) >= 0,
      panelDiAtasNav: panel.bottom <= nav.top
    };
  });
  if (pos.jarakNav < 8) fail('tombol AI terlalu dekat/menutupi navigasi bawah (' + pos.jarakNav + 'px)');
  else ok('tombol AI ' + pos.jarakNav + 'px di atas navigasi bawah');
  if (!pos.panelDalam || !pos.panelDiAtasNav) fail('panel keluar kerangka ponsel / menutupi navigasi');
  else ok('panel tetap di dalam kerangka & tidak menutupi navigasi bawah');

  /* navigasi bawah tetap bisa diklik walau widget terbuka */
  await page.click('.mobile-nav-btn:has-text("Tagihan")');
  await page.waitForTimeout(700);
  const layar = await page.evaluate(() => document.querySelector('.mobile-layar.aktif').getAttribute('aria-label'));
  if (!/Tagihan/.test(layar)) fail('navigasi bawah terhalang widget (layar: ' + layar + ')');
  else ok('navigasi bawah tetap bisa diklik saat panel terbuka');
  await page.evaluate(() => window.AIChat.kirim('biometric'));
  await page.waitForTimeout(1700);
  const b = await page.evaluate(() => [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim());
  if (!/123456/.test(b)) fail('balasan biometric: ' + b.slice(0, 60));
  else ok('balasan konteks mobile: "' + b.slice(0, 44) + '…"');
  /* lembar aksi (sheet) harus menang atas widget: sheet = permukaan teratas */
  await page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).bukaAksi({ id: 'transfer', label: 'Transfer', sub: 'Ke rekening lain', ikon: 'arrow-left-right' }));
  await page.waitForTimeout(600);
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('.mobile-sheet.terbuka');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + 30));
    return { zSheet: getComputedStyle(s).zIndex, atas: el && el.closest('.mobile-sheet') ? 'sheet' : (el ? 'lain: ' + el.className : 'null') };
  });
  if (!sheet) fail('lembar aksi tidak terbuka untuk uji lapisan');
  else if (sheet.atas !== 'sheet') fail('lembar aksi tertutup widget (atas: ' + sheet.atas + ')');
  else ok('lembar aksi (z ' + sheet.zSheet + ') tetap di atas widget saat terbuka');
  await page.evaluate(() => document.querySelector('.mobile-app') && Alpine.$data(document.querySelector('.mobile-app')).tutupSheet());
  await page.waitForTimeout(500);
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 70));
  else ok('tanpa error konsol');
  await ctx.close();
}

console.log('8. Berkas mandiri offline (file://)');
{
  for (const [nama, berkas, harap] of [
    ['dashboard', '/offline/dashboard.html', 'notifikasi.html'],
    ['mobile-nasabah', '/offline/mobile-nasabah.html', 'notifikasi.html'],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const req = [];
    const errs = [];
    page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) req.push(r.url()); });
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('file://' + PROYEK + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    if (nama === 'mobile-nasabah') {
      await page.locator('[data-bio-jari]').click();
      await page.waitForTimeout(1400);
    }
    await page.evaluate(() => window.AIChat.kirim('notifikasi'));
    await page.waitForTimeout(1700);
    const r = await page.evaluate(() => ({
      ada: !!document.getElementById('aichat'),
      balas: [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim(),
      tautan: [...document.querySelectorAll('#aichat a.aichat-tautan')].map((a) => a.getAttribute('href')).pop()
    }));
    const masalah = [];
    if (!r.ada) masalah.push('widget tidak ada');
    if (!/belum dibaca/.test(r.balas)) masalah.push('balasan: ' + r.balas.slice(0, 40));
    if (r.tautan !== harap) masalah.push('tautan ' + r.tautan + ' (harus ' + harap + ')');
    if (req.length) masalah.push(req.length + ' permintaan jaringan');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 50));
    if (masalah.length) fail('offline/' + nama + ': ' + masalah.join(' | '));
    else ok(`offline/${nama}: tampil, balasan & tautan lokal benar, tanpa jaringan`);
    await ctx.close();
  }
}

console.log('9. Tidak mengganggu halaman');
{
  const { ctx, page } = await halaman('pages/index.html');
  await page.waitForTimeout(1500);
  const s = await keadaan(page);
  if (s.buka !== '0' || s.panelTampil) fail('widget tidak menghormati pilihan "tertutup" dari localStorage');
  else ok('status tertutup dihormati saat halaman dimuat ulang');
  /* kartu di kolom kanan (area yang biasa tertutup panel) tetap bisa diklik */
  /* saat tertutup: area tempat panel biasa berada harus bebas (isi halaman), dan
     hanya tombol peluncur (54 px) yang menempati sudut kanan bawah */
  const uji2 = await page.evaluate(() => {
    const diAichat = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'null';
      if (el.closest('#aichat')) return 'widget';
      var k = typeof el.className === 'string' ? el.className : '';
      return (k || el.tagName).toString().split(' ')[0];
    };
    return {
      areaPanel: diAichat(window.innerWidth - 180, window.innerHeight - 320),
      areaTombol: diAichat(window.innerWidth - 40, window.innerHeight - 40)
    };
  });
  if (uji2.areaPanel === 'widget') fail('panel (tertutup) masih menutupi isi halaman di area kanan bawah');
  else ok('saat tertutup, area kanan bawah bebas untuk isi halaman (elemen: ' + uji2.areaPanel + ')');
  if (uji2.areaTombol !== 'widget') fail('tombol peluncur tidak menempati sudut kanan bawah (' + uji2.areaTombol + ')');
  else ok('tombol peluncur ada di sudut kanan bawah & bisa diklik');
  const kecil = await page.evaluate(() => {
    const ai = document.querySelector('#aichat .aichat-tombol').getBoundingClientRect();
    return { w: Math.round(ai.width), h: Math.round(ai.height), kanan: Math.round(window.innerWidth - ai.right), bawah: Math.round(window.innerHeight - ai.bottom) };
  });
  if (kecil.w > 60) fail('tombol peluncur terlalu besar: ' + kecil.w + 'px');
  else ok(`tombol peluncur ${kecil.w}×${kecil.h} px, jarak ${kecil.kanan}px dari kanan & ${kecil.bawah}px dari bawah`);
  await ctx.close();
}

console.log('10. Persistensi antar halaman');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/tables.html', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.AIChat.kirim('jadwal saya'));
  await page.waitForTimeout(1700);
  const n = await page.evaluate(() => document.querySelectorAll('#aichat .aichat-baris').length);
  await page.goto(BASE + 'pages/widgets.html', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  const s = await page.evaluate(() => ({
    buka: document.getElementById('aichat').getAttribute('data-buka'),
    pesan: document.querySelectorAll('#aichat .aichat-baris').length,
    terakhir: [...document.querySelectorAll('#aichat .aichat-balon')].slice(-1)[0].textContent.trim().slice(0, 40)
  }));
  if (s.pesan !== n) fail('riwayat hilang saat pindah halaman (' + n + ' → ' + s.pesan + ')');
  else ok('riwayat percakapan bertahan saat pindah halaman (' + s.pesan + ' pesan)');
  if (s.buka !== '1') fail('status panel tidak diingat (data-buka=' + s.buka + ')');
  else ok('status panel (terbuka) diingat di halaman berikutnya');
  if (!/Jadwal|Scheduler|jadwal/i.test(s.terakhir)) fail('balasan topik jadwal: ' + s.terakhir);
  else ok('balasan "jadwal saya" tetap benar: "' + s.terakhir + '…"');
  /* lencana belum dibaca saat balasan tiba dalam keadaan tertutup */
  await page.evaluate(() => { window.AIChat.buka(); });
  await page.waitForTimeout(200);
  await page.fill('#aichat .aichat-input', 'mode offline');
  await page.press('#aichat .aichat-input', 'Enter');
  await page.evaluate(() => window.AIChat.tutup());   // ditutup sebelum balasan tiba
  await page.waitForTimeout(1800);
  const lencana = await page.evaluate(() => {
    const l = document.querySelector('#aichat .aichat-lencana');
    return { tampil: l && !l.hidden, teks: l && l.textContent };
  });
  if (!lencana.tampil) fail('lencana belum dibaca tidak muncul saat balasan tiba dalam keadaan tertutup');
  else ok('lencana "belum dibaca" muncul saat panel tertutup (' + lencana.teks + ')');
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Asisten AI (selalu muncul) lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
