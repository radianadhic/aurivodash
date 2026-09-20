/**
 * qa/check-kartu-qris.mjs — regresi menu "Kartu" (Kartu dengan QRIS + QRIS).
 *
 * Diuji:
 *   1. Menu sidebar "Kartu" (treeview 3 anak: Kartu dengan QRIS, QRIS, Aplikasi Nasabah,
 *      penanda aktif, pencarian menu).
 *   2. Halaman Kartu: kartu bergambar, balik 3D, masking nomor, salin nomor,
 *      3 pilihan kartu, tombol aksi navbar, riwayat + DataTable.
 *   3. QRIS dari kartu: QR ter-render, payload EMVCo, CRC16 sah, nominal masuk tag 54,
 *      hitung mundur jalan, unduh PNG (data URL), nonaktif saat QRIS dimatikan.
 *   4. Blokir kartu: dialog konfirmasi → QRIS dimatikan, tombol unduh mati.
 *   5. Halaman QRIS: statis vs dinamis (tag 01/54), struktur payload terbaca,
 *      data merchant mengalir ke payload & ringkasan, simulasi pembayaran,
 *      unduh PNG + CSV.
 *   6. Unit CRC16 (vektor uji 123456789 → 29B1) & pemarsing payload.
 *   7. Dwibahasa: mode EN bersih dari teks antarmuka Indonesia (data contoh dikecualikan).
 *   8. Tema: warna mengikuti aksen/preset & mode gelap.
 *   9. Berkas mandiri offline/kartu-qris.html & offline/qris.html tanpa jaringan.
 *
 * Jalankan (dari folder qa/):
 *   PLAYWRIGHT_BROWSERS_PATH=…/ms-playwright node check-kartu-qris.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const ROOT = new URL('../', import.meta.url).pathname;
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);
const tutupDialog = async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); };

/* Nilai yang memang sama di dua bahasa / merupakan data contoh (bukan teks antarmuka) */
const SAMA_DI_EN = [
  /* label menu yang memang sama di kedua bahasa (menu Tools + anaknya) */
  'Tools', 'Report Design', 'Report Viewer', 'Report Example',
  'Aulia S.', 'Breadcrumb', 'English', 'Indonesian', 'Invoice', 'MIT', 'AG Grid Community',
  'Mini Grid', 'Mini Grid 1', 'Mini Grid 2', 'Mini Grid 3', 'Mini Grid 4', 'Mini Grid 5', 'Mini Grid 6',
  'Cards', 'QRIS', 'Dashboard',
  'Tables', 'Home', 'Admin', 'aulia@perusahaan.id', 'Bank Nusantara', 'VISA', 'GPN', 'IDR', 'NMID', 'CVV',
  'MCC', 'UMI', 'UKM', 'UKEA', 'BCA Mobile', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'Jenius', 'BRImo',
  'Indomaret', 'Tokopedia', 'SPBU Pertamina', 'Garuda Indonesia', 'Hypermart', 'Apotek K24', 'Tiket.com',
  'PLN Mobile', 'Netflix', 'Kopi Nusantara', 'Kopi Arabika', 'Makanan & Minuman', 'Belanja', 'E-commerce',
  'Transportasi', 'Perjalanan', 'Kesehatan', 'Utilitas', 'Hiburan', 'QRIS Statis', 'QRIS Dinamis',
  'KOPI NUSANTARA', 'JAKARTA', 'Settlement', 'Acquirer', 'Merchant', 'A01', 'Uji Coba',
  /* nama pada data contoh (dropdown pengguna, riwayat) + label menu yang memang sama */
  'Aulia Saputra', 'Budi Prakoso', 'Nadia Maharani', 'Rani Setiawati', 'Data Table',
  /* lencana menu baru (kata serapan yang sama di dua bahasa) */
  'Mobile', 'Baru', 'New', 'Scheduler', 'Notifikasi', 'Notifications', 'Transaksi', 'Transaksi Sistem'];
const POLA_LEWAT = [/^Rp\s/, /^QR-2026-/, /^TRX-/, /^ID1024/, /^ID-\d+$/, /^#/, /^[•\w]+ •+/, /^CRC16/,
  /^[\d\s.,%:–—/+()\-]+$/, /^Menampilkan \d+/, /^\d+ (rows|baris)$/,
  /* pekan/tanggal & jam */
  /^\d{2}\/\d{2}\/\d{4}/, /^\d{2}:\d{2}/,
  /* isi notifikasi tiruan (data contoh pada lonceng navbar ronde 4) */
  /^Pesanan #/, /^Rp \d/, /^Stok /, /^Sisa \d/, /^Pengguna baru/, /^Nadia Maharani/, /^Sinkronisasi data/,
  /^1\.284 baris/, /^Jadwal autodebet/, /^Autodebet tagihan/, /^Percobaan masuk/, /^Akun admin@/,
  /^\d+ menit lalu|^\d+ jam lalu ·/];
const DILEWATI = (isi) => !isi || isi.length < 3 || SAMA_DI_EN.includes(isi)
  || POLA_LEWAT.some((r) => r.test(isi));

/* ---------- 1. menu sidebar "Kartu" ---------- */
console.log('1. Menu sidebar "Kartu" (treeview)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const r = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.sidebar-body li')].find((l) => (l.querySelector('button .txt') || {}).textContent === 'Kartu');
    if (!li) return { ada: false };
    const wrap = li.querySelector('.submenu-wrap');
    return {
      ada: true, badge: li.querySelector('button .badge').textContent.trim(), dataMenu: wrap.getAttribute('data-menu'),
      tertutup: wrap.classList.contains('closed'),
      anak: [...wrap.querySelectorAll(':scope > .side-submenu > li')].map((x) => ({
        label: x.querySelector('.txt').textContent.trim(), href: x.querySelector('a').getAttribute('href'),
        dataUrl: x.dataset.url || '',
      })),
    };
  });
  console.log('  ', JSON.stringify(r));
  if (!r.ada) fail('menu "Kartu" tidak ditemukan di sidebar');
  else {
    if (r.badge !== '3') fail('badge menu Kartu bukan 3: ' + r.badge);
    if (r.dataMenu !== 'kartu') fail('data-menu bukan "kartu": ' + r.dataMenu);
    const harap = [['Kartu dengan QRIS', 'kartu-qris.html'], ['QRIS', 'qris.html'], ['Aplikasi Nasabah', '../mobile/index.html']];
    if (r.anak.map((a) => a.label).join('|') !== harap.map((h) => h[0]).join('|')) fail('anak menu Kartu tidak sesuai: ' + JSON.stringify(r.anak.map((a) => a.label)));
    if (r.anak.map((a) => a.href).join('|') !== harap.map((h) => h[1]).join('|')) fail('href anak menu Kartu salah: ' + JSON.stringify(r.anak.map((a) => a.href)));
    if (r.anak.some((a) => !a.dataUrl)) fail('ada anak menu tanpa data-url');
    if (!r.tertutup) fail('treeview Kartu seharusnya tertutup di dashboard');
    /* buka/tutup */
    const buka = await page.evaluate(async () => {
      const btn = [...document.querySelectorAll('.sidebar-body button .txt')].find((t) => t.textContent === 'Kartu').parentElement;
      btn.click();
      await new Promise((x) => setTimeout(x, 450));
      const wrap = btn.parentElement.querySelector('.submenu-wrap');
      return { closed: wrap.classList.contains('closed'), tinggi: Math.round(wrap.getBoundingClientRect().height), aria: btn.getAttribute('aria-expanded') };
    });
    if (buka.closed || buka.tinggi < 30) fail('treeview Kartu tidak terbuka saat diklik: ' + JSON.stringify(buka));
    /* pencarian menu */
    const cari = await page.evaluate(async () => {
      const inp = document.querySelector('.sidebar-input');
      inp.value = 'qris';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((x) => setTimeout(x, 300));
      return [...document.querySelectorAll('.sidebar-body li')].filter((l) => l.style.display !== 'none')
        .map((l) => (l.querySelector('.txt') || {}).textContent || '').filter(Boolean);
    });
    console.log('   cari "qris" →', JSON.stringify(cari));
    if (!cari.includes('QRIS')) fail('anak menu QRIS tidak muncul di hasil pencarian');
  }
  if (errs.length) fail('error JS: ' + errs[0]);
  await ctx.close();
}

/* ---------- 2. halaman Kartu (markup, balik, masking, pilihan) ---------- */
console.log('\n2. Halaman "Kartu dengan QRIS" — kartu & kendali');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/kartu-qris.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);

  const awal = await page.evaluate(() => {
    const q = window.Qris;
    const payload = document.querySelector('#kartu-payload').textContent;
    return {
      judul: document.querySelector('.page-title').textContent.trim(),
      crumb: [...document.querySelectorAll('.breadcrumb li')].map((x) => x.textContent.trim()).join(' › '),
      navTombol: document.querySelectorAll('.app-navbar .nav-icon-btn').length,
      nomor: document.querySelector('#kartu-nomor').textContent.trim(),
      merek: document.querySelector('#kartu-merek').textContent.trim(),
      svgQR: !!document.querySelector('#kartu-qr svg'),
      qrBelakang: !!document.querySelector('#kartu-qr-belakang svg'),
      crcSah: q.crcSah(payload),
      tag: q.parse(payload).map((x) => x.tag),
      limitTransaksi: document.querySelector('#kartu-limit-transaksi-nilai').textContent.trim(),
      limitHarian: document.querySelector('#kartu-limit-harian-nilai').textContent.trim(),
      riwayat: document.querySelectorAll('#kartu-riwayat tr').length,
      struktur: document.querySelectorAll('#qris-struktur tr').length,
      ikonKosong: document.querySelectorAll('i[data-icon]:empty').length,
    };
  });
  console.log('  ', JSON.stringify(awal));
  if (!/Kartu dengan QRIS/.test(awal.judul)) fail('judul halaman salah: ' + awal.judul);
  if (!/Kartu/.test(awal.crumb)) fail('breadcrumb tanpa "Kartu": ' + awal.crumb);
  if (awal.navTombol < 3) fail('tombol navbar halaman kartu kurang dari 3: ' + awal.navTombol);
  if (!/^•••• /.test(awal.nomor)) fail('nomor kartu tidak dimasking: ' + awal.nomor);
  if (!awal.svgQR || !awal.qrBelakang) fail('QR tidak ter-render (kartu/belakang)');
  if (!awal.crcSah) fail('CRC16 payload kartu tidak sah');
  if (!awal.tag.some((t) => /^54$/.test(t))) fail('tag 54 (nominal) tidak ada di payload kartu: ' + awal.tag.join(','));
  if (!awal.tag.some((t) => /^63$/.test(t))) fail('tag 63 (CRC) tidak ada di payload kartu');
  if (awal.struktur !== 0) fail('halaman kartu tidak seharusnya punya tabel struktur payload');
  if (awal.riwayat < 10) fail('riwayat transaksi kartu kurang dari 10 baris: ' + awal.riwayat);
  if (awal.ikonKosong) fail(awal.ikonKosong + ' ikon kosong');
  if (!/^Rp /.test(awal.limitTransaksi)) fail('limit per transaksi tidak terisi: ' + awal.limitTransaksi);
  if (!/\//.test(awal.limitHarian)) fail('limit harian tidak terisi: ' + awal.limitHarian);

  /* balik kartu */
  const balik = await page.evaluate(async () => {
    const panggung = document.querySelector('#kartu-panggung');
    document.querySelector('[data-kartu-balik]').click();
    await new Promise((r) => setTimeout(r, 800));
    const tf = getComputedStyle(document.querySelector('.kartu')).transform;
    const m = tf.match(/^matrix3d\((-?\d+)/);
    document.querySelector('[data-kartu-balik]').click();
    await new Promise((r) => setTimeout(r, 800));
    return { dataBalik: panggung.getAttribute('data-balik'), tfBelakang: m ? m[1] : null, tfDepan: getComputedStyle(document.querySelector('.kartu')).transform };
  });
  console.log('   balik kartu:', JSON.stringify(balik));
  if (balik.tfBelakang !== '-1') fail('kartu tidak benar-benar dibalik 3D (matrix3d awal=' + balik.tfBelakang + ')');

  /* tampilkan nomor + salin */
  const nomor = await page.evaluate(async () => {
    document.querySelector('[data-kartu-tampil]').click();
    await new Promise((r) => setTimeout(r, 300));
    return { teks: document.querySelector('#kartu-nomor').textContent.trim(), ringkas: document.querySelector('#kartu-nomor-ringkas').textContent.trim() };
  });
  console.log('   tampilkan nomor:', JSON.stringify(nomor));
  if (!/^\d{4} \d{4} \d{4} \d{4}$/.test(nomor.teks)) fail('nomor kartu tidak tampil penuh: ' + nomor.teks);
  if (!/^•••• \d{4}$/.test(nomor.ringkas)) fail('ringkasan nomor tidak dimasking: ' + nomor.ringkas);

  /* ganti kartu ke slot 2 & 3 */
  const ganti = await page.evaluate(async () => {
    const hasil = [];
    for (const i of [1, 2]) {
      document.querySelectorAll('#kartu-pilih .kartu-chip-pilih')[i].click();
      await new Promise((r) => setTimeout(r, 450));
      hasil.push({
        jenis: document.querySelector('#kartu-jenis').textContent.trim(),
        merek: document.querySelector('#kartu-merek').textContent.trim(),
        tema: document.querySelector('#kartu-depan').getAttribute('data-tema'),
        nmid: document.querySelector('#kartu-nmid').textContent.trim(),
        crc: document.querySelector('#kartu-crc').textContent.trim(),
        limitLuar: document.querySelector('#kartu-limit-luar-nilai').textContent.trim(),
      });
    }
    return hasil;
  });
  console.log('   ganti kartu:', JSON.stringify(ganti));
  if (!/Kredit/.test(ganti[0].jenis) || !/Virtual/.test(ganti[1].jenis)) fail('pemilihan kartu tidak mengganti jenis: ' + JSON.stringify(ganti.map((g) => g.jenis)));
  if (new Set(ganti.map((g) => g.tema)).size < 2) fail('tema kartu tidak berganti antar pilihan');
  if (ganti.some((g) => !/✓/.test(g.crc))) fail('badge CRC tidak sah setelah ganti kartu: ' + JSON.stringify(ganti.map((g) => g.crc)));

  /* nominal → tag 54 & hitung mundur */
  const nominal = await page.evaluate(async () => {
    const inp = document.querySelector('#kartu-nominal');
    inp.value = '125000';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const payload = document.querySelector('#kartu-payload').textContent;
    const t1 = document.querySelector('#kartu-hitung').textContent.trim();
    await new Promise((r) => setTimeout(r, 1500));
    const t2 = document.querySelector('#kartu-hitung').textContent.trim();
    return { ada54: /5406125000/.test(payload), tampil: document.querySelector('#kartu-nominal-tampil').textContent.trim(), t1, t2, sah: window.Qris.crcSah(payload) };
  });
  console.log('   nominal 125000:', JSON.stringify(nominal));
  if (!nominal.ada54) fail('nominal tidak masuk tag 54 payload: ' + nominal.ada54);
  if (!/125\.000/.test(nominal.tampil)) fail('nominal tampil tidak diperbarui: ' + nominal.tampil);
  if (nominal.t1 === nominal.t2) fail('hitung mundur QR tidak berjalan (' + nominal.t1 + ' → ' + nominal.t2 + ')');
  if (!nominal.sah) fail('CRC tidak sah setelah nominal diubah');

  /* blokir kartu lewat dialog */
  await page.click('[data-kartu-kunci]');
  await page.waitForTimeout(600);
  const dialog = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    return m ? { judul: m.querySelector('h3').textContent.trim(), pesan: m.querySelector('.modal-body').textContent.trim(),
      tombol: [...m.querySelectorAll('.modal-footer button')].map((b) => b.textContent.trim()) } : null;
  });
  console.log('   dialog kunci:', JSON.stringify(dialog));
  if (!dialog) fail('dialog kunci kartu tidak muncul');
  const terkunci = await page.evaluate(async () => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    [...m.querySelectorAll('.modal-footer button')].pop().click();
    await new Promise((r) => setTimeout(r, 600));
    return {
      status: document.querySelector('#kartu-status').textContent.trim(),
      unduhMati: document.querySelector('#kartu-qr-unduh').disabled,
      buatMati: document.querySelector('#kartu-qr-buat').disabled,
      toggleMati: document.querySelector('#kartu-qris-toggle').disabled,
    };
  });
  console.log('   setelah diblokir:', JSON.stringify(terkunci));
  if (!/terkunci/i.test(terkunci.status)) fail('status kartu tidak menjadi terkunci: ' + terkunci.status);
  if (!terkunci.unduhMati || !terkunci.buatMati) fail('kontrol QRIS tidak dimatikan saat kartu terkunci');
  /* buka blokir lagi supaya keadaan bersih */
  await page.click('[data-kartu-kunci]');
  await page.waitForTimeout(500);

  /* nonaktifkan QRIS → QR disembunyikan dari kartu */
  const nonaktif = await page.evaluate(async () => {
    const t = document.querySelector('#kartu-qris-toggle');
    t.checked = false;
    t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const r = {
      status: document.querySelector('#kartu-status').textContent.trim(),
      qrSembunyi: document.querySelector('#kartu-qr-belakang').hidden,
      unduhMati: document.querySelector('#kartu-qr-unduh').disabled,
    };
    t.checked = true;
    t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((x) => setTimeout(x, 400));
    return r;
  });
  console.log('   QRIS dimatikan:', JSON.stringify(nonaktif));
  if (!/nonaktif/i.test(nonaktif.status)) fail('status tidak berubah saat QRIS dimatikan: ' + nonaktif.status);
  if (!nonaktif.qrSembunyi || !nonaktif.unduhMati) fail('QR/tombol unduh tidak dimatikan saat QRIS nonaktif');

  /* tabel riwayat: pencarian DataTable */
  const cariTabel = await page.evaluate(async () => {
    const inp = document.querySelector('#cari-kartu');
    inp.value = 'transportasi';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const baris = [...document.querySelectorAll('#kartu-riwayat tr')].filter((r) => r.style.display !== 'none');
    return { tampil: baris.length, info: (document.querySelector('#tabel-kartu').closest('.card').querySelector('[data-dt-info]') || {}).textContent };
  });
  console.log('   cari "transportasi":', JSON.stringify(cariTabel));
  if (!cariTabel.tampil) fail('pencarian tabel riwayat tidak menemukan apa pun');
  if (errs.length) fail('error JS halaman kartu: ' + errs[0].slice(0, 120));
  await ctx.close();
}

/* ---------- 3. halaman QRIS: statis/dinamis, struktur, simulasi, unduhan ---------- */
console.log('\n3. Halaman "QRIS" — pembangkit & transaksi');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + 'pages/qris.html', { waitUntil: 'load' });
  await page.waitForTimeout(1700);

  const awal = await page.evaluate(() => {
    const payload = document.querySelector('#qris-payload').textContent;
    const tags = window.Qris.parse(payload);
    return {
      judul: document.querySelector('.page-title').textContent.trim(),
      tipe: document.querySelector('#qris-tipe-tampil').textContent.trim(),
      crc: document.querySelector('#qris-crc').textContent.trim(),
      panjang: document.querySelector('#qris-panjang').textContent.trim(),
      svgQR: !!document.querySelector('#qris-qr svg'),
      tag54: tags.some((t) => t.tag === '54'),
      tag01: (tags.find((t) => t.tag === '01') || {}).nilai,
      struktur: document.querySelectorAll('#qris-struktur tr').length,
      anak51: tags.filter((t) => /^51 · /.test(t.tag)).length,
      anak62: tags.filter((t) => /^62 · /.test(t.tag)).length,
      riwayat: document.querySelectorAll('#qris-riwayat tr').length,
      statTransaksi: document.querySelector('#qris-stat-transaksi').textContent.trim(),
      statVolume: document.querySelector('#qris-stat-volume').textContent.trim(),
      hitung: document.querySelector('#qris-hitung').textContent.trim(),
      nominal: document.querySelector('#qris-nominal').disabled,
      ikonKosong: document.querySelectorAll('i[data-icon]:empty').length,
    };
  });
  console.log('  ', JSON.stringify(awal));
  if (!awal.svgQR) fail('QR tidak ter-render di halaman QRIS');
  if (awal.tipe !== 'QRIS Statis' || awal.tag01 !== '11') fail('mode statis salah: ' + awal.tipe + ' tag01=' + awal.tag01);
  if (awal.tag54) fail('QR statis tidak boleh punya tag 54 (nominal)');
  if (!/✓/.test(awal.crc)) fail('badge CRC tidak sah di halaman QRIS: ' + awal.crc);
  if (awal.struktur < 10) fail('tabel struktur payload kurang lengkap: ' + awal.struktur + ' baris');
  if (!awal.anak51 || !awal.anak62) fail('tag bersarang (51/62) tidak terbaca: 51×' + awal.anak51 + ' 62×' + awal.anak62);
  if (!awal.nominal) fail('mode statis seharusnya menonaktifkan input nominal (nominal diisi pembeli)');
  if (!awal.riwayat || !/^\d/.test(awal.statTransaksi)) fail('riwayat/ringkasan transaksi kosong');
  if (awal.ikonKosong) fail(awal.ikonKosong + ' ikon kosong');

  /* ubah data merchant → payload & ringkasan ikut berubah */
  const merchant = await page.evaluate(async () => {
    const sebelum = document.querySelector('#qris-payload').textContent;
    const inp = document.querySelector('#qris-nama');
    inp.value = 'Bakso Pak Har';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const inp2 = document.querySelector('#qris-kota');
    inp2.value = 'Bandung';
    inp2.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    const payload = document.querySelector('#qris-payload').textContent;
    return {
      berubah: payload !== sebelum,
      namaTag: (window.Qris.parse(payload).find((t) => t.tag === '59') || {}).nilai,
      namaTampil: document.querySelector('#qris-nama-tampil').textContent.trim(),
      ringkas: document.querySelector('#qris-merchant-ringkas').textContent.trim(),
      sah: window.Qris.crcSah(payload),
    };
  });
  console.log('   ubah merchant:', JSON.stringify(merchant));
  if (!merchant.berubah) fail('payload tidak berubah saat data merchant diubah');
  if (merchant.namaTag !== 'BAKSO PAK HAR') fail('tag 59 tidak memuat nama merchant baru: ' + merchant.namaTag);
  if (merchant.namaTampil !== 'BAKSO PAK HAR' || merchant.ringkas !== 'BAKSO PAK HAR') fail('nama merchant tidak mengalir ke tampilan');
  if (!merchant.sah) fail('CRC tidak sah setelah data merchant diubah');

  /* mode dinamis: nominal & keterangan aktif, tag 54 & 62 terisi */
  const dinamis = await page.evaluate(async () => {
    const tipe = document.querySelector('#qris-tipe');
    tipe.value = 'dinamis';
    tipe.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    const nom = document.querySelector('#qris-nominal');
    nom.value = '75000';
    nom.dispatchEvent(new Event('change', { bubbles: true }));
    const ket = document.querySelector('#qris-keterangan');
    ket.value = 'INV-2026-0918';
    ket.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));
    const payload = document.querySelector('#qris-payload').textContent;
    const tags = window.Qris.parse(payload);
    return {
      tipe: document.querySelector('#qris-tipe-tampil').textContent.trim(),
      tag01: (tags.find((t) => t.tag === '01') || {}).nilai,
      tag54: (tags.find((t) => t.tag === '54') || {}).nilai,
      tag62: tags.some((t) => t.tag === '62 · 01'),
      tampil: document.querySelector('#qris-nominal-tampil').textContent.trim(),
      hitung: document.querySelector('#qris-hitung').textContent.trim(),
      sah: window.Qris.crcSah(payload),
    };
  });
  console.log('   mode dinamis:', JSON.stringify(dinamis));
  if (dinamis.tag01 !== '12') fail('tag 01 bukan 12 saat dinamis: ' + dinamis.tag01);
  if (dinamis.tag54 !== '75000') fail('tag 54 bukan 75000: ' + dinamis.tag54);
  if (!dinamis.tag62) fail('tag 62 (nomor tagihan) tidak muncul di mode dinamis');
  if (!/75\.000/.test(dinamis.tampil)) fail('nominal tampil tidak diperbarui: ' + dinamis.tampil);
  if (dinamis.hitung === 'berlaku terus') fail('mode dinamis seharusnya pakai hitung mundur');
  if (!dinamis.sah) fail('CRC tidak sah di mode dinamis');

  /* simulasi pembayaran: baris + ringkasan naik */
  const simulasi = await page.evaluate(async () => {
    const sebelum = {
      baris: window.Qris.state.Qris.baris.length,
      transaksi: document.querySelector('#qris-stat-transaksi').textContent.trim(),
      volume: document.querySelector('#qris-stat-volume').textContent.trim(),
    };
    document.querySelector('[data-qris="bayar"]').click();
    await new Promise((r) => setTimeout(r, 700));
    return {
      sebelum,
      sesudah: {
        baris: window.Qris.state.Qris.baris.length,
        transaksi: document.querySelector('#qris-stat-transaksi').textContent.trim(),
        volume: document.querySelector('#qris-stat-volume').textContent.trim(),
        barisTabel: document.querySelectorAll('#qris-riwayat tr').length,
      },
    };
  });
  console.log('   simulasi pembayaran:', JSON.stringify(simulasi));
  if (simulasi.sesudah.baris !== simulasi.sebelum.baris + 1) fail('simulasi tidak menambah baris transaksi');
  if (simulasi.sesudah.transaksi === simulasi.sebelum.transaksi) fail('ringkasan transaksi tidak bertambah');
  if (simulasi.sesudah.volume === simulasi.sebelum.volume) fail('volume tidak bertambah setelah simulasi');

  /* unduh PNG + CSV */
  const png = await page.evaluate(() => window.Qris.png(document.querySelector('#qris-payload').textContent, 8, 32));
  if (!/^data:image\/(png|gif)/.test(png)) fail('data URL PNG tidak valid: ' + String(png).slice(0, 30));
  else ok('QR bisa diekspor sebagai PNG (data URL ' + png.length + ' byte)');
  const unduh = await Promise.all([
    page.waitForEvent('download', { timeout: 9000 }).catch(() => null),
    page.click('#qris-csv'),
  ]).then(([d]) => d);
  if (!unduh) fail('unduh CSV tidak menghasilkan berkas');
  else {
    const isi = fs.readFileSync(await unduh.path(), 'utf8').split('\n');
    console.log('   CSV:', unduh.suggestedFilename(), '·', isi.length - 1, 'baris');
    if (!/\.csv$/i.test(unduh.suggestedFilename())) fail('nama berkas CSV tidak sesuai: ' + unduh.suggestedFilename());
    if (isi.length - 1 < 20) fail('CSV hanya berisi ' + (isi.length - 1) + ' baris');
    if (!/ID,Waktu/.test(isi[0])) fail('header CSV tidak sesuai: ' + isi[0]);
  }
  if (errs.length) fail('error JS halaman QRIS: ' + errs[0].slice(0, 120));
  await ctx.close();
}

/* ---------- 4. unit CRC16 & pemarsing ---------- */
console.log('\n4. Unit CRC16-CCITT & pemarsing payload');
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/qris.html', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  const unit = await page.evaluate(() => {
    const q = window.Qris;
    const vektor = q.crc16('123456789');
    const teks = q.payload({ nmid: 'ID123', merchant: 'Toko Uji', kota: 'Bogor', mcc: '5411', tipe: 'dinamis', nominal: 1000 });
    return {
      vektor,
      sah: q.crcSah(teks),
      rusak: q.crcSah(teks.slice(0, -5) + (teks.slice(-5, -4) === 'A' ? 'B' : 'A') + teks.slice(-4)),
      bersih: q.bersih('toko bunga melati!!!', 25),
      jumlahTag: q.parse(teks).length,
      panjang: teks.length,
    };
  });
  console.log('  ', JSON.stringify(unit));
  if (unit.vektor !== '29B1') fail('CRC16 vektor uji salah (harus 29B1): ' + unit.vektor);
  if (!unit.sah) fail('crcSah gagal pada payload yang baru dibuat');
  if (unit.rusak) fail('crcSah tetap benar setelah payload diubah (harus false)');
  if (unit.bersih !== 'TOKO BUNGA MELATI') fail('pembersih teks QRIS salah: ' + unit.bersih);
  await ctx.close();
}

/* ---------- 5. dwibahasa ---------- */
console.log('\n5. Dwibahasa — mode EN bersih dari teks antarmuka Indonesia');
{
  const kumpul = (page) => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.content-wrapper, .content-header, .sidebar-body, .app-navbar, .modal-panel, .toast').forEach((r) => r.querySelectorAll('*').forEach((el) => {
      if (el.closest('code,pre,script,style')) return;
      [...el.childNodes].forEach((n) => { if (n.nodeType === 3 && n.nodeValue.trim()) out.push(n.nodeValue.replace(/\s+/g, ' ').trim()); });
      ['placeholder', 'title', 'aria-label'].forEach((a) => { if (el.hasAttribute && el.hasAttribute(a) && el.getAttribute(a).trim()) out.push(el.getAttribute(a).trim()); });
    }));
    return [...new Set(out)];
  });
  const sisa = new Set();
  for (const url of ['kartu-qris.html', 'qris.html']) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.removeItem('app.locale'); } catch (e) {} });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE + 'pages/' + url, { waitUntil: 'load' });
    await page.waitForTimeout(1700);
    const idSet = new Set(await kumpul(page));
    if (url === 'kartu-qris.html') {
      await page.click('[data-kartu-balik]'); await page.waitForTimeout(700);
      await page.click('[data-kartu-kunci]'); await page.waitForTimeout(600);
      await page.keyboard.press('Escape');   /* dialog tidak ikut ditranslate saat terbuka */
      await page.waitForTimeout(400);
    } else {
      await page.selectOption('#qris-tipe', 'dinamis'); await page.waitForTimeout(500);
    }
    (await kumpul(page)).forEach((x) => idSet.add(x));
    await page.evaluate(() => window.I18n.set('en'));
    await page.waitForTimeout(800);
    /* aksi setelah mode EN → pesan toast memakai T() */
    if (url === 'qris.html') { await page.click('[data-qris="bayar"]'); await page.waitForTimeout(600); }
    else { await page.click('[data-kartu-kunci]').catch(() => {}); await page.waitForTimeout(700); }
    const enSet = new Set(await kumpul(page));
    idSet.forEach((t) => { if (enSet.has(t) && !DILEWATI(t)) sisa.add(url + ' › ' + t); });
    /* toasts in EN must be English */
    const toastEN = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
    if (toastEN.some((t) => /Pembayaran masuk|Nomor kartu|Kartu diblokir|Beralih ke/.test(t))) fail(url + ': pesan toast masih Indonesia di mode EN → ' + toastEN.join(' | '));
    if (errs.length) fail(url + ' (EN): error JS ' + errs[0]);
    await ctx.close();
  }
  if (sisa.size) {
    [...sisa].sort().forEach((t) => console.log('     · ' + t));
    fail(sisa.size + ' teks antarmuka belum diterjemahkan di mode EN');
  } else ok('tidak ada teks/atribut antarmuka yang tertinggal di mode EN');

  /* kembali ke ID memulihkan teks asli */
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/kartu-qris.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const balik = await page.evaluate(async () => {
    const judul = () => document.querySelector('.page-title').textContent.trim();
    const menu = () => [...document.querySelectorAll('.sidebar-body .side-link .txt')].find((t) => /Cards|Kartu/.test(t.textContent)).textContent.trim();
    window.I18n.set('en');
    await new Promise((r) => setTimeout(r, 600));
    const en = { judul: judul(), menu: menu() };
    window.I18n.set('id');
    await new Promise((r) => setTimeout(r, 600));
    return { en, id: { judul: judul(), menu: menu() } };
  });
  console.log('   ID ⇄ EN:', JSON.stringify(balik));
  if (balik.en.judul !== 'Card with QRIS' || balik.id.judul !== 'Kartu dengan QRIS') fail('judul halaman tidak dwibahasa: ' + JSON.stringify(balik));
  if (balik.en.menu !== 'Cards' || balik.id.menu !== 'Kartu') fail('menu sidebar tidak dwibahasa: ' + JSON.stringify(balik));
  await ctx.close();
}

/* ---------- 6. tema ---------- */
console.log('\n6. Integrasi tema (mode gelap & preset)');
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'pages/qris.html', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  const ambil = () => page.evaluate(() => {
    const bar = document.querySelector('#qris-stat-volume');
    return {
      body: getComputedStyle(document.body).backgroundColor,
      teks: getComputedStyle(document.querySelector('.content-wrapper') || document.body).color,
      aksen: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim(),
      judulKartu: getComputedStyle(document.querySelector('.card-title')).color,
      volume: getComputedStyle(bar).color,
    };
  });
  const terang = await ambil();
  await page.evaluate(async () => { Alpine.store('ui').applyTheme('dark'); await new Promise((r) => setTimeout(r, 550)); });
  const gelap = await ambil();
  console.log('   terang:', JSON.stringify(terang));
  console.log('   gelap :', JSON.stringify(gelap));
  if (gelap.body === terang.body) fail('mode gelap tidak mengubah latar halaman QRIS');
  if (gelap.teks === terang.teks) fail('mode gelap tidak mengubah warna teks halaman QRIS');
  await page.evaluate(async () => {
    const ui = Alpine.store('ui');
    ui.applyTheme('light');
    await new Promise((r) => setTimeout(r, 400));
    ui.applyPreset(ui.presets.find((p) => p.id === 'korpo' + 'rat'));
    await new Promise((r) => setTimeout(r, 550));
  });
  const preset = await ambil();
  console.log('   preset korporat → aksen', JSON.stringify(preset.aksen), '(sebelumnya', JSON.stringify(terang.aksen) + ')');
  if (!preset.aksen || preset.aksen === terang.aksen) fail('preset tidak mengganti aksen: ' + preset.aksen);
  /* kartu & kotak QR tetap terbaca di mode gelap (di halaman kartu) */
  const kartuCtx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const kartuPage = await kartuCtx.newPage();
  await kartuPage.goto(BASE + 'pages/kartu-qris.html', { waitUntil: 'load' });
  await kartuPage.waitForTimeout(1600);
  const kartuGelap = await kartuPage.evaluate(async () => {
    const terang = {
      nomorWarna: getComputedStyle(document.querySelector('#kartu-nomor')).color,
      qrLatar: getComputedStyle(document.querySelector('.qr-kotak')).backgroundColor,
    };
    Alpine.store('ui').applyTheme('dark');
    await new Promise((r) => setTimeout(r, 600));
    return {
      terang,
      gelap: {
        nomorWarna: getComputedStyle(document.querySelector('#kartu-nomor')).color,
        qrLatar: getComputedStyle(document.querySelector('.qr-kotak')).backgroundColor,
        adaQR: !!document.querySelector('#kartu-qr svg'),
      },
    };
  });
  console.log('   kartu di mode gelap:', JSON.stringify(kartuGelap));
  if (!kartuGelap.gelap.adaQR) fail('QR kartu hilang saat mode gelap');
  if (kartuGelap.gelap.nomorWarna !== kartuGelap.terang.nomorWarna) fail('warna teks kartu berubah saat mode gelap (kartu harus tetap terang)');
  if (kartuGelap.gelap.qrLatar !== 'rgb(255, 255, 255)') fail('kotak QR tidak putih — kontras QRIS bisa turun: ' + kartuGelap.gelap.qrLatar);
  await kartuCtx.close();
  await ctx.close();
}

/* ---------- 7. berkas mandiri offline ---------- */
console.log('\n7. Berkas mandiri (offline/kartu-qris.html & offline/qris.html)');
{
  for (const berkas of ['kartu-qris', 'qris']) {
    const jalur = `${ROOT}offline/${berkas}.html`;
    if (!fs.existsSync(jalur)) { fail('offline/' + berkas + '.html tidak ada'); continue; }
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1400, height: 950 } });
    const page = await ctx.newPage();
    const errs = [];
    const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + jalur, { waitUntil: 'load' });
    await page.waitForTimeout(1900);
    const r = await page.evaluate(() => {
      const sel = document.querySelector('#kartu-qr svg, #qris-qr svg');
      const payload = (document.querySelector('#kartu-payload, #qris-payload') || {}).textContent || '';
      return {
        svg: !!sel, ikon: document.querySelectorAll('i[data-icon] svg').length,
        sah: window.Qris ? window.Qris.crcSah(payload) : null,
        menuKartu: !![...document.querySelectorAll('.sidebar-body .txt')].find((t) => /Kartu atau Cards/.test(t.textContent)),
        baris: document.querySelectorAll('#kartu-riwayat tr, #qris-riwayat tr').length,
      };
    });
    const masalah = [];
    if (!r.svg) masalah.push('QR tidak ter-render');
    if (!r.sah) masalah.push('CRC payload tidak sah');
    if (!r.ikon) masalah.push('ikon tidak dirender');
    if (!r.baris) masalah.push('tabel riwayat kosong');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 80));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal (harus 0 saat offline)');
    if (masalah.length) fail(`offline/${berkas}: ` + masalah.join(' | '));
    else ok(`offline/${berkas}: QR ok · CRC sah · ${r.ikon} ikon · ${r.baris} baris riwayat`);
    await ctx.close();
  }
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Kartu & QRIS lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
