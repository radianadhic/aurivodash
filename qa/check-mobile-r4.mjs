
/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
/**
 * qa/check-mobile-r4.mjs — regresi fitur ronde 4 di aplikasi nasabah (mobile/index.html):
 * kunci biometric/PIN, halaman tagihan & top up, jadwal otomatis, dan notifikasi push palsu.
 *
 * Diuji:
 *   1. Kunci otomatis saat dibuka: overlay .bio-layar terbuka, sidik jari membuka,
 *      tombol "Masuk dengan PIN" → numpad 6 digit (salah dulu, lalu benar).
 *   2. Kunci manual dari bilah atas & layar Keamanan + event bio:locked/bio:unlocked.
 *   3. Layar Keamanan: sakelar biometric, pilihan kunci otomatis (tersimpan di app.idleMs),
 *      ganti PIN (berlaku saat kunci berikutnya), sakelar "minta PIN untuk transaksi besar".
 *   4. Tagihan: 6 tagihan, ringkasan total & jatuh tempo terdekat, bayar satu tagihan
 *      lewat lembar pembayaran → kunci layar, saldo berkurang, status lunas, riwayat,
 *      notifikasi mobile bertambah.
 *   5. Top up: segmen top up (5 dompet + 3 paket), top up dompet menambah saldo dompet.
 *   6. Transaksi besar (≥ Rp 1.000.000) meminta verifikasi PIN sebelum diproses.
 *   7. Jadwal otomatis: 4 jadwal, kalender 7 kolom + titik, sakelar jeda/aktif (tersimpan),
 *      Jalankan sekarang → catatan eksekusi + notifikasi, hapus jadwal, tambah "Jadwal baru".
 *   8. Push palsu: banner otomatis muncul (tanpa aksi pengguna) + pusat notifikasi mobile.
 *   9. Dwibahasa EN pada layar ronde 4 (tagihan, jadwal, keamanan) bersih dari teks ID.
 *  10. Berkas mandiri offline/mobile-nasabah.html: overlay kunci + layar baru tetap jalan.
 *  11. Kerangka layar: sembilan layar berada DI DALAM #mobile-isi (bukan bocor
 *      menjadi anak .mobile-app) dan area isi itu yang menggulir.
 *
 * Jalankan (dari folder qa/):
 *   node check-mobile-r4.mjs
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
  const { kunciAktif, ...rest } = opts;
  const ctx = await browser.newContext({ viewport: HP, isMobile: true, hasTouch: true, ...rest });
  if (!kunciAktif) {
    /* matikan kunci otomatis (app.idleMs = 0) supaya pemeriksaan panjang tidak
       terpotong oleh layar kunci; uji kunci otomatis ada di bagian 1 */
    await ctx.addInitScript(() => { try { localStorage.setItem('app.idleMs', '0'); } catch (e) {} });
  }
  /* asisten AI selalu muncul → mulai dalam keadaan tertutup supaya tidak
     menutupi tombol yang diuji (perilaku widget diuji di check-aichat.mjs) */
  await ctx.addInitScript(() => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.mobile-app');
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
/* komponen Alpine aplikasi nasabah */
const d = (page, expr) => page.evaluate((e) => {
  const s = Alpine.$data(document.querySelector('.mobile-app'));
  return new Function('s', 'return (' + e + ')')(s);
}, expr);
const terbuka = (page) => page.evaluate(() => {
  const b = document.querySelector('.bio-layar');
  return b ? b.getAttribute('data-open') : 'tidak ada';
});
/* Bio.kunci() mengembalikan Promise yang baru selesai setelah dibuka —
   jangan pernah mengembalikannya dari page.evaluate (Playwright akan menunggu) */
const kunci = (page, alasan = 'Uji kunci') => page.evaluate((a) => {
  window.Bio.kunci({ alasan: a });
  return true;
}, alasan);
const bukaViaJari = async (page) => {
  await page.locator('[data-bio-jari]').click();
  await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 });
};
const pindah = async (page, id) => {
  await page.evaluate((i) => {
    const s = Alpine.$data(document.querySelector('.mobile-app'));
    s.pindah(i);
  }, id);
  await page.waitForTimeout(400);
};

/* ---------- 1. kunci otomatis & pembukaan ---------- */
console.log('1. Kunci otomatis & sidik jari / PIN');
{
  const { ctx, page, errs } = await hp({ kunciAktif: true });
  const wujud = await page.locator('.bio-layar').count();
  if (!wujud) fail('overlay kunci (biometric) tidak dibuat');
  else {
    const kunci = await terbuka(page);
    if (kunci !== '1') fail('aplikasi tidak terkunci otomatis saat dibuka (data-open=' + kunci + ')');
    else ok('aplikasi terkunci otomatis saat dibuka');
  }
  const merek = await page.locator('.bio-layar .bio-merek').innerText();
  const rek = await page.locator('.bio-layar .bio-rek').innerText();
  ok('layar kunci: ' + merek.replace(/\n/g, ' ') + ' · ' + rek);
  const petunjuk = await page.locator('[data-bio-petunjuk]').innerText();
  ok('petunjuk: ' + petunjuk.trim());
  await bukaViaJari(page);
  if ((await terbuka(page)) !== '0') fail('sidik jari tidak membuka kunci');
  else ok('sidik jari (simulasi) membuka kunci');
  /* kunci lagi, lalu uji PIN: salah dulu, baru benar */
  await kunci(page, 'Uji PIN');
  await page.waitForTimeout(500);
  if ((await terbuka(page)) !== '1') fail('Bio.kunci() tidak mengunci aplikasi');
  await page.locator('[data-bio-pin-pilih]').click();
  await page.waitForTimeout(300);
  await page.waitForTimeout(300);
  for (const angka of ['1', '1', '1', '1', '1', '1']) {
    await page.locator(`[data-bio-angka="${angka}"]`).click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(500);
  const salah = await page.locator('[data-bio-salah]').isVisible();
  if (!salah) fail('PIN salah tidak memunculkan peringatan'); else ok('PIN salah → peringatan "' + (await page.locator('[data-bio-salah]').innerText()).trim() + '"');
  for (const angka of ['1', '2', '3', '4', '5', '6']) {
    await page.locator(`[data-bio-angka="${angka}"]`).click();
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
  if ((await terbuka(page)) !== '0') fail('PIN bawaan 123456 tidak membuka kunci');
  else ok('PIN bawaan 123456 membuka kunci');
  await page.evaluate(() => {
    window.__ev = [];
    window.addEventListener('bio:locked', () => window.__ev.push('locked'));
    window.addEventListener('bio:unlocked', () => window.__ev.push('unlocked'));
  });
  await kunci(page, 'Uji event');
  await page.waitForTimeout(400);
  const ev = await page.evaluate(() => window.__ev.slice());
  if (ev.join(',') !== 'locked') fail('event bio:locked tidak terkirim: ' + JSON.stringify(ev)); else ok('event bio:locked terkirim');
  await bukaViaJari(page);
  const ev2 = await page.evaluate(() => window.__ev.slice());
  if (!ev2.includes('unlocked')) fail('event bio:unlocked tidak terkirim: ' + JSON.stringify(ev2)); else ok('event bio:unlocked terkirim setelah dibuka');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90));
  await ctx.close();
}

/* ---------- 2. kunci manual dari bilah atas ---------- */
console.log('2. Kunci manual');
{
  const { ctx, page } = await hp();
  await bukaViaJari(page);
  await page.click('.mobile-bar-btn[aria-label="Kunci aplikasi (biometric/PIN)"]');
  await page.waitForTimeout(500);
  if ((await terbuka(page)) !== '1') fail('tombol kunci di bilah atas tidak mengunci aplikasi'); else ok('tombol kunci di bilah atas → terkunci');
  const alasan = await page.locator('[data-bio-alasan]').innerText();
  ok('alasan di layar kunci: ' + alasan.trim());
  await bukaViaJari(page);
  await pindah(page, 'keamanan');
  await page.evaluate(() => {
    const s = Alpine.$data(document.querySelector('.mobile-app'));
    s.kunciAplikasi();
  });
  await page.waitForTimeout(500);
  if ((await terbuka(page)) !== '1') fail('tombol "Kunci sekarang" di layar Keamanan tidak bekerja'); else ok('layar Keamanan → "Kunci sekarang" mengunci aplikasi');
  await bukaViaJari(page);
  if ((await d(page, 's.tab')) !== 'keamanan') fail('kembali dari kunci kehilangan layar sebelumnya'); else ok('setelah dibuka kembali ke layar Keamanan');
  await ctx.close();
}

/* ---------- 3. layar keamanan ---------- */
console.log('3. Layar Keamanan (biometric, kunci otomatis, PIN)');
{
  const { ctx, page } = await hp();
  await bukaViaJari(page);
  await pindah(page, 'keamanan');
  const judul = await page.locator('.mobile-layar.aktif .mobile-seksi h2').allInnerTexts();
  if (judul.length < 2) fail('seksi layar keamanan kurang: ' + judul.join(' | ')); else ok('seksi layar Keamanan: ' + judul.join(' · '));
  const chipIdle = await page.locator('.mobile-layar.aktif .mobile-seksi:has(h2:text("Kunci otomatis")) .mobile-chip').allInnerTexts();
  ok('pilihan kunci otomatis: ' + chipIdle.join(' · '));
  await page.click('.mobile-layar.aktif .mobile-seksi:has(h2:text("Kunci otomatis")) .mobile-chip:has-text("1 menit")');
  await page.waitForTimeout(400);
  const idle = await d(page, 's.idleMs');
  const lsIdle = await page.evaluate(() => localStorage.getItem('app.idleMs'));
  if (idle !== 60000 || String(lsIdle) !== '60000') fail(`pilihan kunci otomatis tidak tersimpan (idleMs=${idle}, LS=${lsIdle})`);
  else ok('kunci otomatis 1 menit tersimpan (app.idleMs = ' + lsIdle + ')');
  /* ganti PIN lalu uji */
  await page.fill('input[aria-label="PIN baru"]', '654321');
  await page.click('.mobile-layar.aktif .mobile-seksi:has-text("PIN aplikasi") button:has-text("Simpan")');
  await page.waitForTimeout(500);
  const pinLS = await page.evaluate(() => localStorage.getItem('app.pin'));
  if (pinLS !== '654321') fail('PIN baru tidak tersimpan (app.pin=' + pinLS + ')'); else ok('PIN baru 654321 tersimpan di app.pin');
  const tersamar = await page.locator('.mobile-layar.aktif .mobile-baris-teks:has-text("PIN saat ini") span').innerText();
  ok('teks PIN: ' + tersamar.trim());
  /* kunci lalu buka dengan PIN baru */
  await page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).kunciAplikasi());
  await page.waitForTimeout(400);
  await page.locator('[data-bio-pin-pilih]').click();
  for (const angka of ['6', '5', '4', '3', '2', '1']) {
    await page.locator(`[data-bio-angka="${angka}"]`).click();
    await page.waitForTimeout(110);
  }
  await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
  if ((await terbuka(page)) !== '0') fail('PIN baru tidak berlaku di layar kunci'); else ok('PIN baru dipakai layar kunci');
  /* sakelar biometric: matikan lalu nyalakan lagi (minta konfirmasi sidik jari) */
  await pindah(page, 'keamanan');
  await page.click('input[aria-label="Aktifkan biometric"]');
  await page.waitForTimeout(600);
  const bioLS = await page.evaluate(() => localStorage.getItem('app.bio'));
  const bioState = await d(page, 's.bioAktif');
  const bioAPI = await page.evaluate(() => window.Bio.aktif());
  if (bioAPI !== false || bioState !== false) fail(`sakelar biometric tidak mematikan mode (state ${bioState}, Bio.aktif() ${bioAPI}, LS ${bioLS})`);
  else ok(`biometric dimatikan (Bio.aktif() ${bioAPI} · app.bio ${bioLS})`);
  await page.click('input[aria-label="Aktifkan biometric"]');
  await page.waitForTimeout(700);
  if ((await terbuka(page)) !== '1') fail('mengaktifkan biometric tidak meminta konfirmasi sidik jari');
  else ok('mengaktifkan biometric meminta konfirmasi sidik jari');
  await bukaViaJari(page);
  const bioLS2 = await page.evaluate(() => localStorage.getItem('app.bio'));
  ok('biometric aktif kembali (app.bio = ' + bioLS2 + ')');
  await pindah(page, 'keamanan');
  await page.click('input[aria-label="Minta PIN untuk transaksi besar"]');
  await page.waitForTimeout(400);
  const pinBesar = await d(page, 's.pinBesar');
  const pinBesarLS = await page.evaluate(() => localStorage.getItem('app.pinBesar'));
  ok(`sakelar "minta PIN transaksi besar": state ${pinBesar} · app.pinBesar ${pinBesarLS}`);
  await page.click('input[aria-label="Minta PIN untuk transaksi besar"]');
  await page.waitForTimeout(300);
  await ctx.close();
}

/* ---------- 4. tagihan ---------- */
console.log('4. Halaman tagihan');
{
  const { ctx, page, errs } = await hp();
  await bukaViaJari(page);
  await pindah(page, 'tagihan');
  const isi = await d(page, '({ tagihan: s.tagihan.length, belum: s.tagihanBelum(), total: s.tagihanTotal(), terdekat: s.tagihanTerdekat(), saldo: s.saldo })');
  if (isi.tagihan !== 6) fail('jumlah tagihan bukan 6: ' + isi.tagihan); else ok('6 tagihan terdaftar (' + isi.belum + ' menunggu)');
  const ringkas = await page.locator('.mobile-kartu b:has-text("tagihan menunggu")').innerText();
  ok('ringkasan: ' + ringkas.trim());
  const nominalBaris = await page.locator('.mobile-layar.aktif .tagihan-item:visible .tagihan-nominal b').allInnerTexts();
  if (nominalBaris.length !== 6) fail('nominal tagihan tidak tampil 6: ' + nominalBaris.length); else ok('nominal tampil: ' + nominalBaris.slice(0, 3).join(' · ') + ' …');
  /* bayar tagihan pertama */
  const sebelum = await d(page, '({ jumlahRiwayat: s.riwayat.length, saldo: s.saldo, notif: Alpine.store("notif").lingkup("mobile").length })');
  await page.locator('.mobile-layar.aktif .tagihan-item:visible').first().click();
  await page.waitForTimeout(500);
  const lembar = await page.locator('.mobile-sheet.terbuka').count();
  const nominal = await page.inputValue('#mobile-nominal');
  if (!lembar) fail('lembar pembayaran tidak terbuka'); else ok('lembar pembayaran terbuka · nominal terisi ' + nominal.trim());
  await page.click('.mobile-sheet.terbuka button:has-text("Bayar sekarang")');
  await page.waitForTimeout(300);
  if (!(await page.locator('.lock-overlay[data-open="1"]').count())) fail('bayar tagihan tanpa kunci layar'); else ok('pembayaran memakai kunci layar (proses)');
  await page.waitForFunction(() => { const l = document.querySelector('.lock-overlay'); return !l || l.getAttribute('data-open') === '0'; }, { timeout: 8000 });
  await page.waitForTimeout(800);
  const sesudah = await d(page, '({ jumlahRiwayat: s.riwayat.length, saldo: s.saldo, lunas: s.tagihan[0].lunas, tab: s.tab, notif: Alpine.store("notif").lingkup("mobile").length })');
  if (sesudah.saldo >= sebelum.saldo) fail('saldo tidak berkurang setelah bayar tagihan'); else ok('saldo berkurang: ' + sebelum.saldo.toLocaleString('id-ID') + ' → ' + sesudah.saldo.toLocaleString('id-ID'));
  if (!sesudah.lunas) fail('tagihan tidak berubah menjadi lunas'); else ok('tagihan pertama → Lunas');
  if (sesudah.jumlahRiwayat !== sebelum.jumlahRiwayat + 1) fail('riwayat tidak bertambah'); else ok('entri riwayat bertambah: ' + sebelum.jumlahRiwayat + ' → ' + sesudah.jumlahRiwayat);
  if (sesudah.notif <= sebelum.notif) fail('notifikasi mobile tidak bertambah setelah pembayaran'); else ok('notifikasi push dibuat: ' + sebelum.notif + ' → ' + sesudah.notif);
  if (sesudah.tab !== 'riwayat') fail('setelah bayar tidak berpindah ke riwayat: ' + sesudah.tab); else ok('setelah bayar → tab Riwayat');
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90));
  await ctx.close();
}

/* ---------- 5. top up ---------- */
console.log('5. Top up dompet & paket');
{
  const { ctx, page } = await hp();
  await bukaViaJari(page);
  await pindah(page, 'tagihan');
  await page.click('.mobile-segmen button:has-text("Top up")');
  await page.waitForTimeout(500);
  const isi = await d(page, '({ dompet: s.dompet.length, paket: s.paket.length, saldo0: s.dompet[0].saldo })');
  if (isi.dompet !== 5) fail('dompet digital bukan 5: ' + isi.dompet); else ok('5 dompet digital + ' + isi.paket + ' paket data/voucher');
  const judul = await page.locator('.mobile-layar.aktif .mobile-judul h2').allInnerTexts();
  ok('judul seksi: ' + judul.join(' · '));
  await page.locator('.mobile-layar.aktif .tagihan-item:visible').first().click();
  await page.waitForTimeout(500);
  const nominal = await page.inputValue('#mobile-nominal');
  ok('lembar top up terbuka · nominal ' + nominal.trim());
  await page.click('.mobile-sheet.terbuka button:has-text("Top up sekarang")');
  await page.waitForFunction(() => { const l = document.querySelector('.lock-overlay'); return !l || l.getAttribute('data-open') === '0'; }, { timeout: 8000 });
  await page.waitForTimeout(900);
  const isi2 = await d(page, '({ saldo1: s.dompet[0].saldo, riwayat: s.riwayat.length })');
  if (isi2.saldo1 <= isi.saldo0) fail('saldo dompet tidak bertambah setelah top up'); else ok('saldo dompet bertambah: ' + isi.saldo0.toLocaleString('id-ID') + ' → ' + isi2.saldo1.toLocaleString('id-ID'));
  await ctx.close();
}

/* ---------- 6. transaksi besar minta PIN ---------- */
console.log('6. Transaksi besar (≥ Rp 1.000.000)');
{
  const { ctx, page } = await hp();
  await bukaViaJari(page);
  await page.evaluate(() => {
    const s = Alpine.$data(document.querySelector('.mobile-app'));
    s.bukaSheet({ id: 'transfer', label: 'Transfer besar', sub: 'Uji verifikasi', ikon: 'arrow-left-right', nominal: 1500000 });
  });
  await page.waitForTimeout(500);
  const besar = await d(page, 's.nominal');
  if (besar !== 1500000) fail('nominal uji tidak terpasang: ' + besar); else ok('nominal uji Rp ' + besar.toLocaleString('id-ID'));
  await page.click('.mobile-sheet.terbuka button:has-text("Lanjut & verifikasi")');
  await page.waitForTimeout(600);
  if ((await terbuka(page)) !== '1') fail('transaksi besar tidak meminta verifikasi PIN/biometric (Bio.minta)');
  else ok('verifikasi diminta untuk nominal besar: "' + (await page.locator('[data-bio-alasan]').innerText()).trim() + '"');
  await page.locator('[data-bio-pin-pilih]').click();
  for (const angka of ['1', '2', '3', '4', '5', '6']) {
    await page.locator(`[data-bio-angka="${angka}"]`).click();
    await page.waitForTimeout(110);
  }
  await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const sesudah = await d(page, '({ riwayat: s.riwayat.length, saldo: s.saldo, tab: s.tab })');
  if (sesudah.riwayat < 1) fail('transaksi besar tidak tercatat di riwayat'); else ok('setelah verifikasi PIN: transaksi tercatat (' + sesudah.riwayat + ' entri riwayat)');
  await ctx.close();
}

/* ---------- 7. jadwal otomatis ---------- */
console.log('7. Jadwal otomatis');
{
  const { ctx, page, errs } = await hp();
  await bukaViaJari(page);
  await pindah(page, 'jadwal');
  const isi = await d(page, '({ jumlah: s.jadwal.length, aktif: s.jadwalAktif(), kalender: s.kalender.length, hari: s.kalender[0].titik.length })');
  if (isi.jumlah !== 4) fail('jadwal awal bukan 4: ' + isi.jumlah); else ok(`4 jadwal awal (${isi.aktif} aktif)`);
  if (isi.kalender !== 7) fail('kalender bukan 7 kolom: ' + isi.kalender); else ok('kalender pekan 7 kolom (titik per hari)');
  const kartu = await page.locator('.jadwal-item').count();
  if (kartu !== 5) fail('kartu jadwal (termasuk kartu kosong) bukan 5: ' + kartu); else ok('daftar jadwal: 4 kartu + kartu cadangan');
  const ringkas = await page.locator('.mobile-kartu b').filter({ hasText: /^\d+$/ }).allInnerTexts();
  ok('ringkasan: ' + ringkas.slice(0, 3).join(' · '));
  /* sakelar jeda/aktif */
  const sebelumAktif = await d(page, 's.jadwalAktif()');
  await page.locator('.jadwal-item').nth(2).locator('.sakelar').click();
  await page.waitForTimeout(500);
  const sesudahAktif = await d(page, 's.jadwalAktif()');
  const lsJadwal = await page.evaluate(() => (localStorage.getItem('app.jadwal') || '').length);
  if (sebelumAktif === sesudahAktif) fail('sakelar jadwal tidak mengubah status aktif'); else ok(`sakelar jeda: jadwal aktif ${sebelumAktif} → ${sesudahAktif}`);
  if (!lsJadwal) fail('jadwal tidak disimpan ke localStorage app.jadwal'); else ok('jadwal tersimpan di app.jadwal (' + lsJadwal + ' byte)');
  await page.locator('.jadwal-item').nth(2).locator('.sakelar').click();
  await page.waitForTimeout(300);
  /* jalankan sekarang */
  const log0 = await d(page, 's.jadwalLog.length');
  const notif0 = await d(page, 'Alpine.store("notif").lingkup("mobile").length');
  const nominalPertama = await d(page, 's.jadwal[0].nominal');
  await page.locator('.jadwal-item').first().locator('button:has-text("Jalankan sekarang")').click();
  await page.waitForTimeout(700);
  if (nominalPertama >= 1000000) {
    if ((await terbuka(page)) !== '1') fail('jadwal besar tidak meminta verifikasi biometric/PIN lebih dulu');
    else {
      ok('jadwal besar minta verifikasi: "' + (await page.locator('[data-bio-alasan]').innerText()).trim() + '"');
      await bukaViaJari(page);
    }
  }
  if (!(await page.locator('.lock-overlay[data-open="1"]').count())) fail('menjalankan jadwal tanpa kunci layar'); else ok('menjalankan jadwal memakai kunci layar');
  await page.waitForFunction(() => { const l = document.querySelector('.lock-overlay'); return !l || l.getAttribute('data-open') === '0'; }, { timeout: 9000 });
  await page.waitForTimeout(700);
  const log1 = await d(page, 's.jadwalLog.length');
  const notif1 = await d(page, 'Alpine.store("notif").lingkup("mobile").length');
  if (log1 !== log0 + 1) fail(`catatan eksekusi tidak bertambah (${log0} → ${log1})`); else ok(`catatan eksekusi: ${log0} → ${log1} entri`);
  if (notif1 <= notif0) fail('eksekusi jadwal tidak mengirim notifikasi'); else ok(`notifikasi eksekusi: ${notif0} → ${notif1}`);
  const teratas = (await page.locator('.mobile-seksi:has-text("Riwayat eksekusi") .mobile-baris').first().innerText()).replace(/\n+/g, ' · ');
  ok('catatan teratas: ' + teratas.slice(0, 80));
  /* jadwal baru */
  await page.click('button:has-text("Jadwal baru")');
  await page.waitForTimeout(400);
  const lembar = await page.locator('.mobile-sheet.terbuka:has-text("Simpan jadwal")').count();
  if (!lembar) fail('lembar "Jadwal baru" tidak muncul'); else ok('lembar "Jadwal baru" terbuka');
  await page.fill('#jadwal-nama', 'Transfer kos bulanan');
  await page.fill('#jadwal-ke', '8820 1122 3344 · Kos Ananda');
  await page.fill('#jadwal-nominal', '750000');
  await page.locator('.mobile-sheet.terbuka button:has-text("Simpan jadwal")').click();
  await page.waitForTimeout(600);
  const jumlah2 = await d(page, 's.jadwal.length');
  if (jumlah2 !== isi.jumlah + 1) fail('jadwal baru tidak tersimpan: ' + jumlah2); else ok(`jadwal baru tersimpan: ${isi.jumlah} → ${jumlah2}`);
  /* hapus jadwal */
  await page.locator('.jadwal-item').first().locator('button[aria-label="Hapus jadwal"]').click();
  await page.waitForTimeout(400);
  const dialog = await page.locator('.modal-panel:visible h3').innerText().catch(() => null);
  if (!dialog) fail('dialog hapus jadwal tidak muncul'); else ok('dialog hapus: "' + dialog.trim() + '"');
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    [...m.querySelectorAll('.modal-footer button')].pop().click();
  });
  await page.waitForTimeout(500);
  const jumlah3 = await d(page, 's.jadwal.length');
  if (jumlah3 !== jumlah2 - 1) fail('hapus jadwal gagal: ' + jumlah3); else ok(`hapus jadwal: ${jumlah2} → ${jumlah3}`);
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 90));
  await ctx.close();
}

/* ---------- 8. push palsu otomatis ---------- */
console.log('8. Notifikasi push palsu');
{
  const { ctx, page } = await hp();
  await bukaViaJari(page);
  const sebelum = await d(page, 'Alpine.store("notif").lingkup("mobile").length');
  await page.waitForTimeout(11000);   /* demo push otomatis pada detik ke-9 */
  const sesudah = await d(page, 'Alpine.store("notif").lingkup("mobile").length');
  if (sesudah <= sebelum) fail(`push otomatis tidak muncul (${sebelum} → ${sesudah})`);
  else ok(`push otomatis masuk tanpa aksi pengguna: ${sebelum} → ${sesudah} notifikasi`);
  const banner = await page.locator('.mobile-app .push-banner').count();
  ok('banner push di dalam bingkai ponsel: ' + (banner ? 'tampil' : 'sudah tertutup otomatis (wajar)'));
  await pindah(page, 'notif');
  const kartu = await page.locator('.mobile-layar.aktif .mobile-bar, .mobile-layar.aktif .mobile-kartu').first().innerText();
  ok('pusat notifikasi: ' + kartu.split('\n')[0].trim());
  const kategori = await page.locator('.mobile-layar.aktif .mobile-chip').allInnerTexts();
  ok('penyaring kategori: ' + kategori.join(' · '));
  await page.click('.mobile-layar.aktif .mobile-chip:has-text("Keamanan")');
  await page.waitForTimeout(400);
  const baris = await page.locator('.mobile-layar.aktif .mobile-baris[data-baca]').count();
  const harus = await d(page, 's.notifTampil().length');
  if (baris !== harus) fail(`penyaring notifikasi mobile: baris ${baris} ≠ data ${harus}`); else ok(`penyaring kategori "Keamanan": ${baris} notifikasi`);
  await ctx.close();
}

/* ---------- 9. dwibahasa layar ronde 4 ---------- */
console.log('9. Dwibahasa (EN) layar ronde 4');
{
  const ctx = await browser.newContext({ viewport: HP, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('app.locale', 'en'));
  await page.goto(BASE + 'mobile/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.mobile-app');
  await page.waitForTimeout(1400);
  await page.locator('[data-bio-jari]').click();
  await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
  const layar = [['tagihan', 'Bills'], ['jadwal', 'Schedules'], ['notif', 'Notifications'], ['keamanan', 'Security']];
  for (const [id] of layar) {
    await pindah(page, id);
    const r = await page.evaluate(() => {
      const aktif = document.querySelector('.mobile-layar.aktif');
      const teks = [];
      const walk = (n) => {
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) teks.push(t); return; }
        if (n.nodeType !== 1 || n.closest('script,style,code')) return;
        for (const c of n.childNodes) walk(c);
      };
      walk(aktif);
      return { judul: aktif.getAttribute('aria-label'), teks: [...new Set(teks)] };
    });
    const ID = /\b(dan|atau|yang|untuk|dengan|dari|tidak|tagihan|jadwal|notifikasi|belum|dibaca|aktif|kunci|sidik|jari|bayar|lunas|nominal|simpan|halaman|kategori|keamanan|layar|aplikasi)\b/i;
    /* data contoh (nama tagihan, dompet, isi notifikasi benih) dikecualikan */
    const DATA = [/^PLN/, /^PDAM/, /^IndiHome/, /^Telkomsel/, /^BNI /, /^Netflix/, /^GoPay/, /^OVO/, /^Dana/, /^ShopeePay/, /^Transfer/, /^Zakat/, /^Autodebet/, /^Top up /, /^[\d ]{6,} · /, /^\d/, /^Rp /, /^IDR /, /^Ibu /, /^[A-Z]{2,4}$/, /^Paket /, /^Pulsa /, /^Kuota /, /^—/,
      /^[•·]+ ?\d/, /tagihan (Sep|Okt|Nov|Des|Jan)/i, /^Anda mendapat/, /^Tagihan listrik menunggu/, /^Ada masuk dari perangkat/, /^Bayar tagihan dapat poin/, /^Kopi Nusantara/, /^Android /, /^Jakarta/, /^Bayar 2 tagihan/, /^Saldo GoPay/, /^Diskon 20/, /^Rekap transaksi/, /^Merchant ID/, /^Rp 2\.000\.000/, /^PLN pascabayar/, /^Top up GoPay/];
    const residu = r.teks.filter((t) => t.length > 3 && ID.test(t) && !DATA.some((rx) => rx.test(t)));
    if (residu.length) fail(`layar ${id} (EN) masih memuat teks ID: ` + residu.slice(0, 4).join(' | '));
    else ok(`layar ${id} (${r.judul}) bersih dalam mode EN`);
  }
  await ctx.close();
}

/* ---------- 10. berkas mandiri ---------- */
console.log('10. Berkas mandiri offline/mobile-nasabah.html');
{
  const berkas = PROYEK + 'offline/mobile-nasabah.html';
  if (!fs.existsSync(berkas)) fail('offline/mobile-nasabah.html tidak ada — jalankan npm run offline');
  else {
    const ctx = await browser.newContext({ offline: true, viewport: HP, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('app.aiChat', JSON.stringify({ kenal: 1, buka: 0, riwayat: [] })); sessionStorage.setItem('app.aiChat.teaser', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    const errs = []; const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({
      bio: !!window.Bio, notif: !!window.Notify,
      kunci: (document.querySelector('.bio-layar') || {}).getAttribute ? document.querySelector('.bio-layar').getAttribute('data-open') : null,
      tab: Alpine.$data(document.querySelector('.mobile-app')).tab,
      tautan: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join(' '),
    }));
    if (r.kunci === null) fail('offline: overlay kunci tidak dibuat');
    else if (r.kunci !== '1') fail('offline: aplikasi tidak terkunci otomatis');
    else ok('offline: kunci biometric otomatis aktif');
    await page.locator('[data-bio-jari]').click();
    await page.waitForFunction(() => document.querySelector('.bio-layar').getAttribute('data-open') === '0', { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).pindah('tagihan'));
    await page.waitForTimeout(500);
    const tagihan = await page.locator('.mobile-layar.aktif .tagihan-item:visible').count();
    await page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).pindah('jadwal'));
    await page.waitForTimeout(500);
    const jadwal = await page.locator('.mobile-layar.aktif .jadwal-item').count();
    const masalah = [];
    if (!r.bio) masalah.push('biometric.js tidak dimuat');
    if (!r.notif) masalah.push('notify.js tidak dimuat');
    if (tagihan !== 6) masalah.push('tagihan ' + tagihan);
    if (jadwal !== 5) masalah.push('jadwal ' + jadwal);
    if (/\.\.\//.test(r.tautan)) masalah.push('tautan relatif ke luar berkas');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 70));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal');
    if (masalah.length) fail('offline/mobile-nasabah.html: ' + masalah.join(' | '));
    else ok(`offline: tagihan ${tagihan} · jadwal ${jadwal} kartu · Bio + Notify siap · tanpa jaringan`);
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
console.log('11. Kerangka layar (isi di dalam #mobile-isi)');
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('app.idleMs', '0'));
  await page.goto(BASE + '/mobile/index.html');
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => {
    const app = document.querySelector('.mobile-app');
    const isi = document.getElementById('mobile-isi');
    const diIsi = Array.from(isi.querySelectorAll(':scope > .mobile-layar')).map((el) => el.getAttribute('aria-label'));
    const diLuar = Array.from(app.children).filter((el) => el.classList.contains('mobile-layar')).length;
    return { jumlah: diIsi.length, label: diIsi.join(' | '), diLuar };
  });
  if (r.jumlah !== 9) fail('jumlah layar di dalam #mobile-isi: ' + r.jumlah + ' (harus 9) — ' + r.label);
  else ok('9 layar berada di dalam #mobile-isi: ' + r.label);
  if (r.diLuar !== 0) fail(r.diLuar + ' layar bocor menjadi anak .mobile-app (markup terpotong?)');
  else ok('tidak ada layar di luar #mobile-isi');

  await page.evaluate(() => Alpine.$data(document.querySelector('.mobile-app')).pindah('jadwal'));
  await page.waitForTimeout(700);
  const g = await page.evaluate(() => {
    const isi = document.getElementById('mobile-isi');
    const nav = document.querySelector('.mobile-nav').getBoundingClientRect();
    return { sc: isi.scrollHeight, cl: isi.clientHeight, navBawah: Math.round(nav.bottom), vh: window.innerHeight };
  });
  if (g.sc <= g.cl) fail('area isi tidak menggulir sendiri (scrollHeight ' + g.sc + ' ≤ clientHeight ' + g.cl + ')');
  else ok('area isi menggulir sendiri (isi ' + g.sc + ' px di dalam ' + g.cl + ' px)');
  if (Math.abs(g.navBawah - g.vh) > 2) fail('bar bawah tidak menempel di dasar layar (' + g.navBawah + ' vs ' + g.vh + ')');
  else ok('bar bawah menempel di dasar layar (tetap saat isi digulir)');
  await ctx.close();
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Biometric, tagihan/top up, jadwal & push palsu lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
