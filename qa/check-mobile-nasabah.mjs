
/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
/**
 * qa/check-mobile-nasabah.mjs — regresi template mobile untuk nasabah (mobile/index.html).
 *
 * Diuji:
 *   1. Akses: tautan sidebar "Aplikasi Nasabah" (treeview Kartu) + berkas mobile/index.html.
 *   2. Kerangka: 5 tab navigasi bawah (Beranda · Tagihan · QRIS · Riwayat · Profil),
 *      bingkai ponsel di layar lebar vs penuh di ponsel, tanpa gulir mendatar.
 *   3. Beranda: kartu saldo + sembunyikan saldo, 4 aksi cepat, 2 promo, 4 transaksi
 *      terbaru, baris keamanan.
 *   4. QRIS saya: QR ter-render, CRC16 sah, nominal bebas/25k/50k/100k mengubah tag 54,
 *      payload bisa disalin, PNG bisa diunduh, tautan ke halaman QRIS lengkap.
 *   5. Kartu: 3 kartu, nomor tersamarkan & bisa ditampilkan, blokir kartu via dialog
 *      (status jadi Terblokir + kunci layar tampil).
 *   6. Transfer: numpad, minimal Rp 1.000, kunci layar saat kirim, saldo berkurang,
 *      transaksi masuk riwayat, toast sukses.
 *   7. Riwayat: penyaring Semua/Uang masuk/Uang keluar/QRIS konsisten dengan data,
 *      tombol muat ulang memakai kunci layar.
 *   8. Profil: ganti bahasa, mode gelap, keluar → dialog → dialihkan ke login.
 *   9. Dwibahasa: mode EN bersih dari teks antarmuka Indonesia (data contoh dikecualikan).
 *  10. Berkas mandiri offline/mobile-nasabah.html tanpa jaringan.
 *
 * Jalankan (dari folder qa/):
 *   node check-mobile-nasabah.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const HP = { width: 390, height: 844 };
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);

async function hp(opts = {}) {
  const ctx = await browser.newContext({ viewport: HP, isMobile: true, hasTouch: true, ...opts });
  /* ronde 4: aplikasi mengunci diri saat dibuka (biometric/PIN). Untuk menguji isi
     aplikasi, kunci otomatis dimatikan dan layar kunci dibuka dengan sidik jari. */
  await ctx.addInitScript(() => { try { localStorage.setItem('app.idleMs', '0'); } catch (e) {} });
  /* asisten AI selalu muncul → mulai tertutup (perilakunya diuji di check-aichat.mjs) */
  await ctx.addInitScript(() => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.mobile-app');
  await page.waitForTimeout(1600);   /* kunci otomatis dipicu ~900 ms setelah init */
  const kunci = await page.evaluate(() => {
    const b = document.querySelector('.bio-layar');
    return b ? b.getAttribute('data-open') : null;
  });
  if (kunci === '1') {
    await page.locator('[data-bio-jari]').click();
    await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
  }
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
const tab = (page) => page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).tab);
const data = (page, expr) => page.evaluate((e) => {
  const d = Alpine.$data(document.querySelector('.mobile-app'));
  return new Function('d', 'return (' + e + ')')(d);
}, expr);

/* ---------- 1. akses dari sidebar ---------- */
console.log('1. Akses halaman');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const tautan = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.sidebar-body a')].find((x) => /Aplikasi Nasabah|Customer App/.test(x.textContent));
    return a ? { href: a.getAttribute('href'), teks: a.textContent.trim().replace(/\s+/g, ' ') } : null;
  });
  if (!tautan) fail('tautan "Aplikasi Nasabah" tidak ada di sidebar');
  else if (tautan.href !== '../mobile/index.html') fail('arah tautan salah: ' + tautan.href);
  else ok('sidebar → ' + tautan.teks + ' (' + tautan.href + ')');
  const badge = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.sidebar-body .submenu-wrap')].find((s) => s.getAttribute('data-menu') === 'kartu');
    return li ? li.querySelectorAll('a').length : 0;
  });
  if (badge !== 3) fail('treeview Kartu tidak berisi 3 tautan: ' + badge); else ok('treeview Kartu berisi Kartu dengan QRIS · QRIS · Aplikasi Nasabah (' + badge + ')');
  await ctx.close();
}

/* ---------- 2. kerangka & navigasi ---------- */
console.log('2. Kerangka & navigasi bawah');
{
  const { ctx, page, errs } = await hp();
  const nav = await page.locator('.mobile-nav-btn').count();
  if (nav !== 5) fail('jumlah tab navigasi bukan 5: ' + nav); else ok('5 tab: ' + (await page.locator('.mobile-nav-btn').allInnerTexts()).join(' · '));
  const judul = await page.locator('.mobile-bar-judul b').innerText();
  if (!/Halo/i.test(judul)) fail('judul bilah atas tidak wajar: ' + judul); else ok('bilah atas: "' + judul.trim() + '"');
  const notif = await page.locator('.mobile-bar-btn[aria-label="Notifikasi"] .mobile-titik-notif').count();
  if (!notif) fail('penanda notifikasi tidak tampil'); else ok('penanda notifikasi tampil');

  /* tiap tab punya layar sendiri & tombol kembali muncul */
  for (const [label, id] of [['Tagihan', 'tagihan'], ['QRIS', 'bayar'], ['Riwayat', 'riwayat'], ['Profil', 'profil']]) {
    await page.click(`.mobile-nav-btn:has-text("${label}")`);
    await page.waitForTimeout(250);
    const t = await tab(page);
    const aktif = await page.locator('.mobile-layar.aktif').count();
    if (t !== id || aktif !== 1) fail(`tab ${label} tidak membuka layar "${id}" (tab=${t}, layar aktif=${aktif})`);
    else ok(`tab ${label} → layar "${id}" aktif satu-satunya`);
  }
  const tombolKembali = await page.locator('.mobile-bar-btn[aria-label="Kembali ke beranda"]').count();
  if (!tombolKembali) fail('tombol kembali tidak muncul di tab selain beranda'); else ok('tombol kembali muncul di tab selain beranda');
  await page.click('.mobile-bar-btn[aria-label="Kembali ke beranda"]');
  await page.waitForTimeout(250);
  if ((await tab(page)) !== 'beranda') fail('tombol kembali tidak mengembalikan ke beranda'); else ok('tombol kembali → beranda');

  /* gulir mendatar tidak boleh ada */
  const geser = await page.evaluate(() => ({
    lebar: document.documentElement.scrollWidth, jendela: window.innerWidth,
    isi: document.querySelector('.mobile-isi').scrollWidth,
    wadah: document.querySelector('.mobile-isi').clientWidth,
  }));
  if (geser.isi > geser.wadah + 2) fail(`isi halaman bergulir mendatar (${geser.isi} > ${geser.wadah})`);
  else ok(`tidak ada gulir mendatar (isi ${geser.isi} ≤ wadah ${geser.wadah})`);
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90));
  await ctx.close();

  /* bingkai ponsel di layar lebar */
  const besar = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await besar.newPage();
  await p2.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await p2.waitForSelector('.mobile-app');
  await p2.waitForTimeout(400);
  const bingkai = await p2.evaluate(() => {
    const app = document.querySelector('.mobile-app');
    const cs = getComputedStyle(app);
    return { max: cs.maxWidth, radius: cs.borderTopLeftRadius, tinggi: Math.round(app.getBoundingClientRect().height) };
  });
  if (bingkai.radius === '0px') fail('layar lebar: bingkai ponsel tidak membulat'); else ok(`layar lebar: bingkai ponsel (radius ${bingkai.radius}, lebar maks ${bingkai.max}, tinggi ${bingkai.tinggi}px)`);
  await besar.close();
}

/* ---------- 3. beranda ---------- */
console.log('3. Beranda');
{
  const { ctx, page } = await hp();
  const saldo = await page.locator('.mobile-saldo-nilai').innerText();
  if (!/Rp/.test(saldo)) fail('saldo tidak tampil: ' + saldo); else ok('saldo tampil: ' + saldo.trim());
  await page.click('.mobile-mata');
  await page.waitForTimeout(200);
  const tersembunyi = await page.locator('.mobile-saldo-nilai').innerText();
  if (!/•/.test(tersembunyi)) fail('tombol mata tidak menyembunyikan saldo: ' + tersembunyi); else ok('tombol mata menyembunyikan saldo (' + tersembunyi.trim() + ')');
  await page.click('.mobile-mata');
  const aksi = await page.locator('.mobile-aksi').count();
  if (aksi !== 4) fail('aksi cepat bukan 4: ' + aksi); else ok('4 aksi cepat: ' + (await page.locator('.mobile-aksi').allInnerTexts()).map((t) => t.trim()).join(' · '));
  const promo = await page.locator('.mobile-promo-kartu').count();
  if (promo !== 2) fail('kartu promo bukan 2: ' + promo); else ok('2 kartu promo');
  const trx = await page.locator('.mobile-layar.aktif .mobile-kartu .mobile-baris').count();
  if (trx < 4) fail('transaksi terbaru kurang dari 4: ' + trx); else ok('transaksi terbaru tampil (' + trx + ' baris)');
  const keamanan = await page.locator('.mobile-baris:has-text("Keamanan aktif")').count();
  if (!keamanan) fail('baris keamanan tidak ada'); else ok('baris keamanan + tombol uji ada');
  await ctx.close();
}

/* ---------- 4. QRIS saya ---------- */
console.log('4. Tab QRIS saya');
{
  const { ctx, page, errs } = await hp();
  await page.click('.mobile-nav-btn:has-text("QRIS")');
  await page.waitForTimeout(400);
  const qr = await page.evaluate(() => {
    const host = document.getElementById('nasabah-qr');
    const svg = host.querySelector('svg');
    const d = Alpine.$data(document.querySelector('.mobile-app'));
    return {
      svg: !!svg, modul: +(host.getAttribute('data-modul') || 0), kotak: svg ? svg.innerHTML.length : 0,
      payload: d._qr, sah: d._qr ? window.Qris.crcSah(d._qr) : false,
      statis: d._qr ? d._qr.includes('010211') : false,
      nominal: (document.getElementById('nasabah-nominal') || {}).textContent,
      crc: (document.getElementById('nasabah-crc') || {}).textContent,
    };
  });
  if (!qr.svg || qr.modul < 21) fail(`QR tidak ter-render (svg=${qr.svg}, modul=${qr.modul})`);
  else ok(`QR ter-render (${qr.modul}×${qr.modul} modul, ${Math.round(qr.kotak / 1024)} KB SVG)`);
  if (!qr.sah) fail('CRC16 payload QRIS tidak sah'); else ok('CRC16 payload sah · ' + qr.crc.trim());
  if (!qr.statis) fail('payload default tidak bertipe statis (tag 01 bukan 11)'); else ok('payload default statis (tag 01 = 11)');
  if (!/bebas/i.test(qr.nominal)) fail('nominal default bukan "Nominal bebas": ' + qr.nominal); else ok('nominal default: ' + qr.nominal.trim());

  await page.click('.mobile-chip:has-text("Rp 50.000")');
  await page.waitForTimeout(400);
  const dinamis = await page.evaluate(() => {
    const d = Alpine.$data(document.querySelector('.mobile-app'));
    const p = d._qr;
    const parts = {};
    for (let i = 0; i + 4 <= p.length;) { const tag = p.slice(i, i + 2), len = +p.slice(i + 2, i + 4); parts[tag] = p.slice(i + 4, i + 4 + len); i += 4 + len; }
    return { tipe: parts['01'], nominal: parts['54'], sah: window.Qris.crcSah(p), teks: (document.getElementById('nasabah-nominal') || {}).textContent };
  });
  if (dinamis.tipe !== '12') fail('tag 01 bukan 12 (dinamis): ' + dinamis.tipe);
  else if (dinamis.nominal !== '50000') fail('tag 54 bukan 50000: ' + dinamis.nominal);
  else ok('pilih nominal → payload dinamis (tag 01=12, tag 54=' + dinamis.nominal + ')');
  if (!dinamis.sah) fail('CRC payload dinamis tidak sah'); else ok('CRC payload dinamis tetap sah');

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('button:has-text("Salin payload")');
  await page.waitForTimeout(300);
  const klip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (!/^000201/.test(klip)) fail('payload tidak tersalin ke papan klip: ' + klip.slice(0, 20)); else ok('payload tersalin ke papan klip (' + klip.length + ' karakter)');

  const unduh = await page.evaluate(() => window.Qris.png(window.Alpine.$data(document.querySelector('.mobile-app'))._qr, 8, 32));
  if (!/^data:image\/png/.test(unduh)) fail('PNG QR tidak dihasilkan (bukan image/png): ' + String(unduh).slice(0, 30));
  else ok('PNG QR asli (canvas) siap diunduh (' + Math.round(unduh.length / 1024) + ' KB data-URI)');
  await page.click('button:has-text("Unduh PNG")');
  await page.waitForTimeout(300);
  const toastUnduh = await page.locator('.toast, .toast-item').filter({ hasText: /unduh|download/i }).count();
  if (!toastUnduh) fail('tombol unduh PNG tidak memberi umpan balik'); else ok('tombol unduh PNG memberi umpan balik');
  const tautan = await page.locator('a[href="../pages/qris.html"]').count();
  if (!tautan) fail('tautan ke halaman QRIS lengkap tidak ada'); else ok('tautan ke ../pages/qris.html tersedia');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90));
  await ctx.close();
}

/* ---------- 5. kartu ---------- */
console.log('5. Layar Kartu (lewat pintasan "Kartu saya" di beranda)');
{
  const { ctx, page } = await hp();
  await page.click('.mobile-kartu:has-text("Kartu saya")');
  await page.waitForTimeout(400);
  if ((await tab(page)) !== 'kartu') fail('pintasan "Kartu saya" tidak membuka layar kartu (tab=' + await tab(page) + ')');
  else ok('pintasan "Kartu saya" → layar kartu');
  const kartu = await page.locator('.mobile-layar.aktif .mobile-saldo').count();
  if (kartu !== 3) fail('jumlah kartu bukan 3: ' + kartu); else ok('3 kartu tampil (debit · kredit · virtual)');
  const nomor = await page.locator('.mobile-layar.aktif .mobile-saldo').first().locator('.font-mono').innerText();
  if (!/•/.test(nomor)) fail('nomor kartu tidak tersamarkan: ' + nomor); else ok('nomor kartu tersamarkan: ' + nomor.trim());
  await page.click('button:has-text("Tampilkan nomor")');
  await page.waitForTimeout(300);
  const terbuka = await page.locator('.mobile-layar.aktif .mobile-saldo').first().locator('.font-mono').innerText();
  if (/•/.test(terbuka)) fail('nomor tidak terbuka setelah ditekan'); else ok('nomor terbuka setelah ditekan: ' + terbuka.trim());
  await page.click('button:has-text("Kunci kartu")');
  await page.waitForTimeout(500);
  const dialog = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    return m ? { judul: m.querySelector('h3').textContent.trim(), tombol: [...m.querySelectorAll('.modal-footer button')].map((b) => b.textContent.trim()) } : null;
  });
  if (!dialog) fail('dialog konfirmasi kunci kartu tidak muncul');
  else ok('dialog konfirmasi muncul ("' + dialog.judul + '" · ' + dialog.tombol.join(' / ') + ')');
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    [...m.querySelectorAll('.modal-footer button')].pop().click();
  });
  await page.waitForTimeout(600);
  const status = await page.locator('.mobile-layar.aktif .badge:has-text("Terblokir")').count();
  const kunciLayar = await page.locator('.lock-overlay[data-open="1"]').count();
  if (!status) fail('status kartu tidak berubah menjadi Terblokir'); else ok('status kartu → Terblokir');
  if (!kunciLayar) fail('kunci layar tidak tampil setelah kartu diblokir'); else ok('kunci layar "Kartu terkunci" tampil');
  await page.waitForTimeout(1200);
  await ctx.close();
}

/* ---------- 6. transfer ---------- */
console.log('6. Transfer + kunci layar');
{
  const { ctx, page } = await hp();
  const saldoAwal = await data(page, 'd.saldo');
  await page.click('.mobile-aksi:has-text("Transfer")');
  await page.waitForTimeout(300);
  if (!(await page.locator('.mobile-sheet.terbuka').count())) fail('lembar aksi tidak terbuka'); else ok('lembar transfer terbuka');
  const nonaktif = await page.locator('.mobile-sheet button:has-text("Lanjut")').isDisabled();
  if (!nonaktif) fail('tombol lanjut aktif tanpa nominal'); else ok('tombol lanjut nonaktif sebelum ada nominal');
  await page.click('.mobile-numpad button:has-text("5")');
  await page.click('.mobile-numpad button:has-text("000")');
  await page.waitForTimeout(200);
  let nominal = await page.inputValue('#mobile-nominal');
  if (!/^Rp 5\.000$/.test(nominal.trim())) fail('numpad menghasilkan nominal keliru: ' + nominal); else ok('numpad: 5 + 000 → ' + nominal.trim());
  await page.click('.mobile-numpad button:text-is("0")');
  await page.click('.mobile-numpad button:text-is("⌫")');
  await page.waitForTimeout(200);
  nominal = await page.inputValue('#mobile-nominal');
  if (!/^Rp 5\.000$/.test(nominal.trim())) fail('backspace tidak mengembalikan nominal: ' + nominal); else ok('tombol 0 & ⌫ berfungsi (kembali ke ' + nominal.trim() + ')');
  await page.fill('#mobile-tujuan', 'Budi Santoso');
  await page.click('.mobile-sheet button:has-text("Lanjut")');
  await page.waitForTimeout(300);
  if (!(await page.locator('.lock-overlay[data-open="1"][data-mode="form"]').count())) fail('kunci layar tidak tampil saat mengirim'); else ok('kunci layar mode form saat mengirim');
  await page.waitForSelector('.mobile-layar.aktif .mobile-baris:has-text("Budi Santoso")', { timeout: 8000 });
  await page.waitForSelector('.mobile-nav-btn.aktif:has-text("Riwayat")', { timeout: 5000 });
  ok('transaksi masuk riwayat & tab riwayat otomatis aktif');
  const saldoAkhir = await data(page, 'd.saldo');
  if (saldoAwal - saldoAkhir !== 5000) fail(`saldo tidak berkurang tepat Rp 5.000 (${saldoAwal} → ${saldoAkhir})`);
  else ok('saldo berkurang Rp 5.000 (Rp ' + saldoAwal.toLocaleString('id-ID') + ' → Rp ' + saldoAkhir.toLocaleString('id-ID') + ')');
  const baris = await page.locator('.mobile-layar.aktif .mobile-baris').first().innerText();
  if (!/5\.000/.test(baris)) fail('baris riwayat tidak memuat nominal: ' + baris.replace(/\n/g, ' | ')); else ok('baris teratas riwayat: ' + baris.replace(/\n/g, ' · '));
  await ctx.close();
}

/* ---------- 7. riwayat ---------- */
console.log('7. Tab Riwayat & penyaring');
{
  const { ctx, page } = await hp();
  await page.click('.mobile-nav-btn:has-text("Riwayat")');
  await page.waitForTimeout(400);
  const hitung = async () => page.evaluate(() => {
    const d = Alpine.$data(document.querySelector('.mobile-app'));
    return { tampil: d.riwayatTampil().length, semua: d.riwayat.length, masuk: d.riwayat.filter((r) => r.jenis === 'masuk').length,
      keluar: d.riwayat.filter((r) => r.jenis === 'keluar').length, qris: d.riwayat.filter((r) => /QRIS/.test(r.metode)).length };
  });
  const c = await hitung();
  const barisSemua = await page.locator('.mobile-layar.aktif .mobile-baris:has(.mobile-nominal)').count();
  if (barisSemua !== c.semua) fail(`baris riwayat (${barisSemua}) tidak sama dengan data (${c.semua})`); else ok(`riwayat awal: ${barisSemua} baris`);
  for (const [label, kunci] of [['Uang masuk', 'masuk'], ['Uang keluar', 'keluar'], ['QRIS', 'qris']]) {
    await page.click(`.mobile-chip:has-text("${label}")`);
    await page.waitForTimeout(250);
    const d = await hitung();
    const baris = await page.locator('.mobile-layar.aktif .mobile-baris:has(.mobile-nominal)').count();
    if (d.tampil !== d[kunci]) fail(`penyaring ${label}: data ${d.tampil} ≠ hitungan ${d[kunci]}`);
    else if (baris !== d.tampil) fail(`penyaring ${label}: baris DOM ${baris} ≠ data ${d.tampil}`);
    else ok(`penyaring ${label}: ${baris} baris (sesuai data)`);
  }
  await page.click('.mobile-chip:has-text("Semua")');
  await page.waitForTimeout(200);
  const tombolMuat = await page.locator('.mobile-layar.aktif button:has-text("Muat ulang")').count();
  if (!tombolMuat) fail('tombol muat ulang tidak ada di tab riwayat'); else ok('tombol muat ulang ada di tab riwayat');
  await page.click('.mobile-layar.aktif button:has-text("Muat ulang")');
  await page.waitForTimeout(300);
  if (!(await page.locator('.lock-overlay[data-open="1"][data-mode="load"]').count())) fail('muat ulang tanpa kunci layar'); else ok('muat ulang memakai kunci layar mode load');
  await page.waitForFunction(() => { const l = document.querySelector('.lock-overlay'); return !l || l.getAttribute('data-open') === '0'; }, { timeout: 6000 });
  const log = await page.locator('#mobile-log').innerText();
  if (!/offline/i.test(log)) fail('catatan log tidak diperbarui: ' + log); else ok('catatan log diperbarui: ' + log.trim());
  await ctx.close();
}

/* ---------- 8. profil ---------- */
console.log('8. Tab Profil');
{
  const { ctx, page } = await hp();
  await page.click('.mobile-nav-btn:has-text("Profil")');
  await page.waitForTimeout(400);
  if (!(await page.locator('.avatar:has-text("AS")').count())) fail('avatar nasabah tidak tampil'); else ok('kartu profil nasabah tampil');
  const barisBahasa = '.mobile-baris:has(i[data-icon="translate"]) button';
  await page.click(barisBahasa);
  await page.waitForTimeout(400);
  const loc = await page.evaluate(() => window.I18n.locale);
  if (loc !== 'en') fail('tombol ganti bahasa tidak mengubah locale: ' + loc); else ok('ganti bahasa → EN');
  const labelBaru = await page.locator('.mobile-baris:has(i[data-icon="translate"]) span span, .mobile-baris:has(i[data-icon="translate"]) .mobile-baris-teks span').first().innerText();
  if (!/English/i.test(labelBaru)) fail('keterangan bahasa tidak ikut berganti: ' + labelBaru); else ok('keterangan baris bahasa berganti ke "' + labelBaru.trim() + '"');
  await page.click(barisBahasa);
  await page.waitForTimeout(300);
  const sw = await page.locator('.form-switch input').count();
  if (sw < 2) fail('sakelar mode gelap/notifikasi tidak lengkap: ' + sw); else ok(sw + ' sakelar (mode gelap + notifikasi)');
  const barisGelap = '.mobile-baris:has(i[data-icon="moon-stars"]) .form-switch';
  await page.click(barisGelap);
  await page.waitForTimeout(400);
  const tema = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (tema !== 'dark') fail('sakelar mode gelap tidak bekerja (' + tema + ')'); else ok('sakelar mode gelap → dark');
  await page.click(barisGelap);
  await page.waitForTimeout(300);
  await page.click('.mobile-baris:has(i[data-icon="box-arrow-right"])');
  await page.waitForTimeout(500);
  const dialog = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    return m ? { judul: m.querySelector('h3').textContent.trim(), pesan: m.querySelector('.modal-body').textContent.trim() } : null;
  });
  if (!dialog) fail('dialog keluar tidak muncul'); else ok('dialog keluar: "' + dialog.judul + '"');
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    [...m.querySelectorAll('.modal-footer button')].pop().click();
  });
  await page.waitForURL('**/login.html', { timeout: 8000 }).then(() => ok('konfirmasi keluar → dialihkan ke login.html')).catch(() => fail('tidak dialihkan ke login.html setelah keluar'));
  await ctx.close();
}

/* ---------- 9. dwibahasa ---------- */
console.log('9. Dwibahasa (EN)');
{
  const ctx = await browser.newContext({ viewport: HP, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('app.locale', 'en'));
  await page.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.mobile-app');
  await page.waitForTimeout(900);
  const label = await page.locator('.mobile-nav-btn').allInnerTexts();
  const harusEN = ['Home', 'Bills', 'QRIS', 'History', 'Profile'];
  const salah = label.filter((t) => !harusEN.includes(t.split('\n')[0].trim()));
  if (salah.length) fail('label tab belum EN: ' + salah.join(' · ')); else ok('label tab EN: ' + label.join(' · '));

  const teks = await page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) out.push(t); return; }
      if (n.nodeType !== 1 || n.closest('script,style')) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return [...new Set(out)];
  });
  const ID = /\b(dan|atau|yang|untuk|dengan|dari|tidak|nasabah|saldo|rekening|tunai|tagihan|kartu|verifikasi|kirim|masuk|keluar|kunci|layar|notifikasi|perangkat|bahasa|promo|transaksi|riwayat|beranda|profil|unduh|salin|bebas|nominal|merchant|nasabah|aplikasi|saya|anda)\b/i;
  /* data contoh & nama cepat-lah yang dikecualikan (bukan teks antarmuka) */
  const DATA = [/^AULIA SAPUTRA/, /^Aulia/, /^Budi/, /^Kopi Nusantara/, /^Indomaret/, /^Tokopedia/, /^SPBU/, /^Tagihan PLN/, /^Top up GoPay/, /^Cashback QRIS/, /^Netflix/, /^Gaji September/, /^Transfer dari/, /^ID1024/, /^aulia@/, /^\d{2}\/\d{2}/, /^Rp /, /^IDR /, /^Limit Rp/, /^18 transaksi/, /^Rp 25\.000\.000/, /^Merchant$/, /^UMI/, /^EMVCo/, /^Push/, /^Transfer$/,
    /* data contoh ronde 4: kartu, tagihan kartu, dan isi notifikasi benih */
    /^(just now|\d+ (seconds?|minutes?|hours?|days?) ago|yesterday|today) · /, /^Kartu Kredit BNI/, /^Kartu (Debit|Kredit|Virtual)/, /^[•·]+ ?\d/, /tagihan (Sep|Okt|Nov|Des|Jan)/i, /^No\. Kartu/, /^Berlaku/, /^Promo$/, /^Anda mendapat/, /^Tagihan listrik menunggu/, /^Ada masuk dari perangkat/, /^Bayar tagihan dapat poin/, /^Bayar 2 tagihan/, /^Saldo GoPay/, /^Diskon 20/, /^Rekap transaksi/, /^Merchant ID/, /^PLN pascabayar/, /^Perangkat baru/, /^Autodebet aktif/, /^Transfer berhasil/,
    /^PLN/, /^PDAM/, /^IndiHome/, /^Telkomsel/, /^BNI /, /^GoPay/, /^OVO/, /^Dana/, /^ShopeePay/, /^Zakat/, /^Transfer (bulanan|mingguan)/,
    /^[\d ]{6,} · /, /^Ibu Sari/, /^[A-Z]{2,4}$/, /^1 Januari|^\d{1,2} \w+ \d{4}$/];
  const residu = teks.filter((t) => t.length > 3 && ID.test(t) && !DATA.some((r) => r.test(t)));
  if (residu.length) fail('sisa bahasa Indonesia di mode EN: ' + residu.slice(0, 5).join(' | '));
  else ok('antarmuka EN bersih (data contoh dikecualikan)');
  await ctx.close();
}

/* ---------- 10. berkas mandiri offline ---------- */
console.log('10. Berkas mandiri offline/mobile-nasabah.html');
{
  const berkas = PROYEK + 'offline/mobile-nasabah.html';
  if (!fs.existsSync(berkas)) { fail('offline/mobile-nasabah.html tidak ada — jalankan npm run offline'); }
  else {
    const ctx = await browser.newContext({ offline: true, viewport: HP, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('app.idleMs', '0'); } catch (e) {} });
    const page = await ctx.newPage();
    const errs = []; const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    /* berkas mandiri juga terkunci otomatis (biometric) — buka dulu dengan sidik jari */
    if (await page.locator('.bio-layar[data-open="1"]').count()) {
      await page.locator('[data-bio-jari]').click();
      await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
    }
    await page.click('.mobile-nav-btn:has-text("QRIS")').catch(() => {});
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({
      app: !!document.querySelector('.mobile-app'),
      nav: document.querySelectorAll('.mobile-nav-btn').length,
      qr: !!document.querySelector('#nasabah-qr svg'),
      ikon: document.querySelectorAll('i[data-icon] svg').length,
      lock: !!window.Lock,
      tautan: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join(' '),
    }));
    const masalah = [];
    if (!r.app) masalah.push('kerangka mobile tidak ada');
    if (r.nav !== 5) masalah.push('tab navigasi ' + r.nav);
    if (!r.qr) masalah.push('QR tidak ter-render');
    if (!r.ikon) masalah.push('ikon tidak dirender');
    if (!r.lock) masalah.push('Lock tidak dimuat');
    if (/\.\.\//.test(r.tautan)) masalah.push('masih ada tautan relatif ke luar berkas mandiri');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 70));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal saat offline');
    if (masalah.length) fail('offline/mobile-nasabah.html: ' + masalah.join(' | '));
    else ok(`offline/mobile-nasabah.html: 5 tab · QR ok · ${r.ikon} ikon · Lock siap · tanpa jaringan`);
    await ctx.close();
  }
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Template mobile nasabah lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
