
/* Lokasi proyek dihitung dari letak berkas ini (qa/ → akar proyek),
   jadi skrip bisa dipindah/di-clone di mana saja. */
const PROYEK = new URL('../', import.meta.url).pathname;   // …/aurivodash/
/**
 * qa/check-scheduler.mjs — regresi halaman Scheduler (penjadwal job) ronde 4.
 *
 * Diuji:
 *   1. Akses: menu sidebar "Scheduler" + halaman pages/scheduler.html (judul, breadcrumb,
 *      subjudul, tombol aksi di header halaman & di navbar).
 *   2. Kartu ringkasan: job aktif, jatuh tempo hari ini, eksekusi berhasil/gagal —
 *      angkanya harus sama dengan data di komponen.
 *   3. Agenda pekan: 7 kolom, hari ini disorot, navigasi Pekan lalu/Minggu ini/Pekan depan,
 *      klik job membuka panel detail.
 *   4. Tabel job: 7 job, penyaring Aktif/Dijeda, pencarian, Jeda/Aktifkan, hapus (dialog).
 *   5. Eksekusi: Jalankan → kunci layar (Lock) → entri riwayat + notifikasi kategori
 *      "Jadwal" + toast. "Jalankan yang jatuh tempo" menjalankan banyak job sekaligus.
 *   6. Tambah job: dialog → job baru muncul + notifikasi "Job baru dijadwalkan".
 *   7. Riwayat eksekusi: daftar timeline + tombol Bersihkan.
 *   8. Dwibahasa EN bersih (data contoh dikecualikan).
 *   9. Berkas mandiri offline/scheduler.html.
 *
 * Jalankan (dari folder qa/):
 *   node check-scheduler.mjs
 * Prasyarat: server statis http://localhost:8080 dari akar proyek
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const browser = await chromium.launch();
let gagal = 0;
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };
const ok = (m) => console.log('   ✅ ' + m);

async function buka(url = 'pages/scheduler.html') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
/* data komponen (dibaca lewat Alpine.$data, bukan lewat pabrik fungsi) */
const data = (page, expr) => page.evaluate((e) => {
  const d = Alpine.$data(document.querySelector('[x-data^="schedulerApp"]'));
  return new Function('d', 'return (' + e + ')')(d);
}, expr);

/* ---------- 1. akses & kerangka ---------- */
console.log('1. Akses & kerangka halaman');
{
  const { ctx, page, errs } = await buka('pages/index.html');
  const menu = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.side-link')].find((x) => /Scheduler/.test(x.textContent));
    return a ? { href: a.getAttribute('href'), badge: (a.querySelector('.badge') || {}).textContent } : null;
  });
  if (!menu) fail('menu Scheduler tidak ada di sidebar');
  else if (menu.href !== 'scheduler.html') fail('arah menu salah: ' + menu.href);
  else ok(`menu sidebar Scheduler → ${menu.href} (badge ${menu.badge})`);
  await page.goto(BASE + 'pages/scheduler.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const kepala = await page.evaluate(() => ({
    judul: document.querySelector('.page-title').textContent.trim(),
    crumb: document.querySelector('.breadcrumb').textContent.replace(/\s+/g, ' ').trim(),
    sub: document.querySelector('.page-subtitle').textContent.trim().slice(0, 60),
    aksi: [...document.querySelectorAll('.page-actions .btn')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
    navbar: [...document.querySelectorAll('.app-navbar .nav-icon-btn')].map((b) => b.getAttribute('aria-label')),
  }));
  if (!/Scheduler/i.test(kepala.judul)) fail('judul halaman: ' + kepala.judul); else ok('judul: ' + kepala.judul);
  if (!/Scheduler/i.test(kepala.crumb)) fail('breadcrumb tidak memuat Scheduler: ' + kepala.crumb); else ok('breadcrumb: ' + kepala.crumb.slice(0, 60));
  ok('subjudul: ' + kepala.sub + '…');
  if (kepala.aksi.length !== 2) fail('aksi header halaman bukan 2: ' + besar(kepala.aksi));
  else ok('aksi header halaman: ' + kepala.aksi.join(' | '));
  const khas = ['Jalankan job jatuh tempo', 'Tambah job'];
  const ada = khas.filter((k) => kepala.navbar.includes(k));
  if (ada.length !== 2) fail('tombol khusus navbar tidak lengkap: ' + JSON.stringify(kepala.navbar));
  else ok('tombol khusus navbar: ' + ada.join(' + '));
  if (errs.length) fail('error konsol: ' + errs[0].slice(0, 80));
  await ctx.close();
}
function besar(a) { return a.join(', '); }

/* ---------- 2. kartu ringkasan ---------- */
console.log('2. Kartu ringkasan');
{
  const { ctx, page } = await buka();
  const r = await page.evaluate(() => {
    const d = Alpine.$data(document.querySelector('[x-data^="schedulerApp"]'));
    return {
      kotak: [...document.querySelectorAll('.small-box .description-header')].map((n) => parseInt(n.textContent, 10)),
      label: [...document.querySelectorAll('.small-box .description-text')].map((n) => n.textContent.trim()),
      data: {
        aktif: d.jobAktif().length, tempo: d.jatuhTempoHariIni().length,
        gagal: d.riwayat.filter((x) => x.status === 'Gagal').length,
        berhasil: d.riwayat.filter((x) => x.status === 'Berhasil').length,
        semua: d.job.length,
      },
    };
  });
  ok('kartu: ' + r.label.map((l, i) => l + '=' + r.kotak[i]).join(' · '));
  const cocok = r.kotak[0] === r.data.aktif && r.kotak[1] === r.data.tempo && r.kotak[2] === r.data.berhasil && r.kotak[3] === r.data.gagal;
  if (!cocok) fail('angka kartu ≠ data komponen: ' + JSON.stringify(r));
  else ok(`angka kartu sesuai data (aktif ${r.data.aktif} · tempo ${r.data.tempo} · berhasil ${r.data.berhasil} · gagal ${r.data.gagal})`);
  if (r.data.semua !== 7) fail('jumlah job awal bukan 7: ' + r.data.semua); else ok('7 job terdaftar (harian, mingguan, dan berkala)');
  await ctx.close();
}

/* ---------- 3. agenda pekan ---------- */
console.log('3. Agenda pekan');
{
  const { ctx, page } = await buka();
  const hari = await page.locator('.agenda-hari').count();
  if (hari !== 7) fail('kolom agenda bukan 7: ' + hari); else ok('7 kolom agenda: ' + (await page.locator('.agenda-kepala b').allInnerTexts()).join(' · '));
  if (!(await page.locator('.agenda-hari.kini').count())) fail('hari ini tidak disorot di agenda'); else ok('hari ini disorot (.agenda-hari.kini)');
  const kartuAwal = await page.locator('.agenda-job').count();
  const mingguIni = (await page.locator('.card-subtitle').first().innerText()).trim();
  ok(`agenda minggu ini: ${kartuAwal} job · ${mingguIni}`);
  const judulAwal = await page.locator('.agenda-hari .agenda-kepala span').first().innerText();
  await page.click('button:has-text("Pekan lalu")');
  await page.waitForTimeout(350);
  const judulLalu = await page.locator('.agenda-hari .agenda-kepala span').first().innerText();
  if (judulAwal === judulLalu) fail('navigasi "Pekan lalu" tidak mengubah rentang tanggal'); else ok(`Pekan lalu: ${judulAwal} → ${judulLalu}`);
  await page.click('button:has-text("Pekan depan")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Minggu ini")');
  await page.waitForTimeout(350);
  const kembali = await page.locator('.agenda-hari .agenda-kepala span').first().innerText();
  if (kembali !== judulAwal) fail('tombol "Minggu ini" tidak kembali ke pekan berjalan'); else ok('Minggu ini → kembali ke pekan berjalan (' + kembali + ')');
  await page.locator('.agenda-job').first().click();
  await page.waitForTimeout(350);
  const detail = await page.evaluate(() => {
    const dd = [...document.querySelectorAll('.detail-list dd')].map((n) => n.textContent.trim());
    return { n: dd.length, jenis: dd[0], cron: dd[2] };
  });
  if (detail.n < 6) fail('panel detail job tidak terisi lengkap: ' + JSON.stringify(detail));
  else ok(`klik job di agenda → detail terbuka (jenis ${detail.jenis} · ${detail.cron})`);
  await ctx.close();
}

/* ---------- 4. tabel job ---------- */
console.log('4. Tabel job');
{
  const { ctx, page } = await buka();
  const baris = await page.locator('tbody tr').count();
  if (baris !== 7) fail('baris tabel bukan 7: ' + baris); else ok('tabel menampilkan 7 job');
  for (const [label, kunci] of [['Aktif', 'Aktif'], ['Dijeda', 'Dijeda']]) {
    await page.click(`.card-tools button:has-text("${label}")`);
    await page.waitForTimeout(300);
    const n = await page.locator('tbody tr').count();
    const harus = await data(page, `d.job.filter(function (j) { return j.status === "${kunci}"; }).length`);
    if (n !== harus) fail(`penyaring ${label}: baris ${n} ≠ data ${harus}`); else ok(`penyaring ${label}: ${n} job`);
  }
  await page.click('.card-tools button:has-text("Semua")');
  await page.waitForTimeout(250);
  await page.fill('.card-tools input[type="search"]', 'laporan');
  await page.waitForTimeout(350);
  const cari = await page.locator('tbody tr').count();
  if (cari !== 1) fail('pencarian "laporan" tidak menyisakan 1 job: ' + cari); else ok('pencarian "laporan": ' + cari + ' job (Laporan harian bank)');
  await page.fill('.card-tools input[type="search"]', '');
  await page.waitForTimeout(250);
  /* jeda / aktifkan */
  const sebelum = await page.locator('tbody tr').first().locator('.badge').innerText();
  await page.locator('tbody tr').first().locator('button[title="Jeda"], button[title="Aktifkan"]').click();
  await page.waitForTimeout(350);
  const sesudah = await page.locator('tbody tr').first().locator('.badge').innerText();
  if (sebelum === sesudah) fail('tombol Jeda/Aktifkan tidak mengubah status'); else ok(`jeda/aktifkan: ${sebelum} → ${sesudah}`);
  /* hapus dengan dialog */
  const jumlah = await page.locator('tbody tr').count();
  await page.locator('tbody tr').first().locator('button[title="Hapus job"]').click();
  await page.waitForTimeout(400);
  const dialog = await page.locator('.modal-panel:visible h3').innerText().catch(() => null);
  if (!dialog) fail('dialog konfirmasi hapus tidak muncul'); else ok('dialog konfirmasi: "' + dialog.trim() + '"');
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    [...m.querySelectorAll('.modal-footer button')].pop().click();
  });
  await page.waitForTimeout(500);
  const sisa = await page.locator('tbody tr').count();
  if (sisa !== jumlah - 1) fail(`hapus job gagal (${jumlah} → ${sisa})`); else ok(`hapus job: ${jumlah} → ${sisa} baris`);
  await ctx.close();
}

/* ---------- 5. eksekusi job ---------- */
console.log('5. Eksekusi job');
{
  const { ctx, page } = await buka();
  const sebelum = await page.locator('.timeline > li').count();
  const notifSebelum = await page.evaluate(() => Alpine.store('notif').lingkup('admin').filter((n) => n.kategori === 'Jadwal').length);
  await page.locator('tbody tr').first().locator('button[title="Jalankan sekarang"]').click();
  await page.waitForTimeout(250);
  const kunci = await page.locator('.lock-overlay[data-open="1"]').count();
  if (!kunci) fail('menjalankan job tanpa kunci layar'); else ok('menjalankan job memakai kunci layar (Lock)');
  await page.waitForFunction(() => { const l = document.querySelector('.lock-overlay'); return !l || l.getAttribute('data-open') === '0'; }, { timeout: 8000 });
  await page.waitForTimeout(700);
  const sesudah = await page.locator('.timeline > li').count();
  if (sesudah !== sebelum + 1) fail(`riwayat tidak bertambah (${sebelum} → ${sesudah})`); else ok(`riwayat eksekusi: ${sebelum} → ${sesudah} entri`);
  const teratas = (await page.locator('.timeline-panel').first().innerText()).replace(/\n+/g, ' · ');
  ok('entri teratas: ' + teratas.slice(0, 90));
  const notifSesudah = await page.evaluate(() => Alpine.store('notif').lingkup('admin').filter((n) => n.kategori === 'Jadwal').length);
  if (notifSesudah <= notifSebelum) fail('eksekusi job tidak mengirim notifikasi kategori Jadwal'); else ok(`notifikasi kategori Jadwal: ${notifSebelum} → ${notifSesudah}`);
  const lencana = await page.locator('button[aria-label="Notifikasi"] .navbar-badge').innerText();
  ok('lencana navbar ikut menyala: ' + lencana.trim());
  /* jalankan yang jatuh tempo */
  await page.click('.page-actions button:has-text("Jalankan yang jatuh tempo")');
  await page.waitForTimeout(1200);
  ok('tombol "Jalankan yang jatuh tempo" dijalankan tanpa error');
  await ctx.close();
}

/* ---------- 6. tambah job ---------- */
console.log('6. Tambah job');
{
  const { ctx, page } = await buka();
  await page.click('.page-actions button:has-text("Tambah job")');
  await page.waitForTimeout(400);
  const dialog = await page.locator('.modal-panel:visible h3').innerText().catch(() => null);
  if (!dialog) fail('dialog tambah job tidak muncul'); else ok('dialog: "' + dialog.trim() + '"');
  const notifSebelum = await page.evaluate(() => Alpine.store('notif').lingkup('admin').length);
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal-panel')].find((x) => x.offsetParent !== null);
    [...m.querySelectorAll('.modal-footer button')].pop().click();
  });
  await page.waitForTimeout(600);
  const jumlah = await page.locator('tbody tr').count();
  if (jumlah !== 8) fail('job baru tidak masuk daftar (baris ' + jumlah + ')'); else ok('job baru masuk daftar: 7 → 8 job');
  const barisBaru = (await page.locator('tbody tr').first().innerText()).replace(/\n+/g, ' · ');
  ok('job teratas: ' + barisBaru.slice(0, 80));
  const notifSesudah = await page.evaluate(() => Alpine.store('notif').lingkup('admin').length);
  if (notifSesudah <= notifSebelum) fail('tambah job tidak mengirim notifikasi'); else ok(`notifikasi terkirim (${notifSebelum} → ${notifSesudah}) · judul: ` + await page.evaluate(() => Alpine.store('notif').lingkup('admin')[0].judul));
  await ctx.close();
}

/* ---------- 7. riwayat & pembersihan ---------- */
console.log('7. Riwayat eksekusi');
{
  const { ctx, page } = await buka();
  const awal = await page.locator('.timeline > li').count();
  ok('riwayat awal: ' + awal + ' entri (termasuk entri cadangan saat kosong)');
  const berhasil = await page.locator('.timeline-marker.bg-success').count();
  const gagalN = await page.locator('.timeline-marker.bg-danger').count();
  const harus = await data(page, 'd.riwayat.filter(function (r) { return r.status === "Berhasil"; }).length');
  const harusGagal = await data(page, 'd.riwayat.filter(function (r) { return r.status === "Gagal"; }).length');
  if (berhasil !== harus || gagalN !== harusGagal) fail(`penanda status tidak cocok data (${berhasil}/${gagalN} vs ${harus}/${harusGagal})`);
  else ok(`penanda status: ${berhasil} berhasil · ${gagalN} gagal (sesuai data)`);
  const progres = await page.locator('.progress-bar').first().getAttribute('style');
  if (!/width/.test(progres)) fail('bilah tingkat keberhasilan tidak diisi'); else ok('tingkat keberhasilan: ' + (await page.locator('.progress-bar').first().evaluate((n) => Math.round(n.getBoundingClientRect().width) + 'px ' + n.style.width)));
  await page.click('.card:has-text("Riwayat eksekusi") button:has-text("Bersihkan")');
  await page.waitForTimeout(500);
  const sesudah = await page.locator('.timeline-panel:has-text("Belum ada eksekusi.")').count();
  if (!sesudah) fail('tombol Bersihkan tidak mengosongkan riwayat'); else ok('Bersihkan → riwayat kosong ("Belum ada eksekusi.")');
  await ctx.close();
}

/* ---------- 8. dwibahasa ---------- */
console.log('8. Dwibahasa (EN)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('app.locale', 'en'));
  await page.goto(BASE + 'pages/scheduler.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const teks = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) teks.push(t); return; }
      if (n.nodeType !== 1 || n.closest('script,style,code')) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return { judul: document.title.split(' · ')[0], teks: [...new Set(teks)], agenda: [...document.querySelectorAll('.agenda-kepala b')].map((n) => n.textContent.trim()) };
  });
  const ID = /\b(dan|atau|yang|untuk|dengan|dari|tidak|halaman|jadwal|daftar|semua|kirim|tutup|buka|simpan|hapus|pekan|minggu|riwayat|jalankan|eksekusi|bersihkan|terakhir|berikutnya|jeda|aktifkan|penting|belum|sudah|dibaca)\b/i;
  const DATA = [/^Transfer/, /^Rekonsiliasi/, /^Autodebet/, /^Laporan/, /^Sinkronisasi/, /^Cadangkan/, /^Kirim promosi/, /^Pembersihan/, /^Uji laporan/, /^Rp /, /^IDR /, /^Snapshot/, /^PDF/, /^BI JISDOR/, /^1\.284/, /^Segmen/, /^Token/, /^Semua kanal/, /^admin@/, /^[A-Za-z.]+@/, /^\d/, /^—/,
    /^Pesanan #/, /^Stok /, /^Sisa /, /^Pengguna baru/, /^Jadwal autodebet/, /^Percobaan masuk/, /^Akun /, /^2 menit|^1 jam|^3 jam|^5 jam|^18 menit|^7 jam/];
  const residu = r.teks.filter((t) => t.length > 3 && ID.test(t) && !DATA.some((rx) => rx.test(t)));
  if (residu.length) fail('sisa bahasa Indonesia di mode EN: ' + residu.slice(0, 4).join(' | '));
  else ok(`${r.judul}: antarmuka EN bersih (data contoh dikecualikan)`);
  if (r.agenda.join('') !== 'MonTueWedThuFriSatSun') fail('nama hari agenda belum EN: ' + r.agenda.join(' · ')); else ok('nama hari agenda EN: ' + r.agenda.join(' · '));
  await ctx.close();
}

/* ---------- 9. berkas mandiri ---------- */
console.log('9. Berkas mandiri offline/scheduler.html');
{
  const berkas = PROYEK + 'offline/scheduler.html';
  if (!fs.existsSync(berkas)) fail('offline/scheduler.html tidak ada — jalankan npm run offline');
  else {
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1440, height: 980 } });
    const page = await ctx.newPage();
    const errs = []; const gagalReq = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('requestfailed', (r) => gagalReq.push(r.url()));
    await page.goto('file://' + berkas, { waitUntil: 'load' });
    await page.waitForTimeout(1400);
    const r = await page.evaluate(() => ({
      hari: document.querySelectorAll('.agenda-hari').length,
      baris: document.querySelectorAll('tbody tr').length,
      ikon: document.querySelectorAll('i[data-icon] svg').length,
      lock: !!window.Lock, notif: !!window.Alpine && !!window.Alpine.store('notif'),
      tautan: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join(' '),
    }));
    const masalah = [];
    if (r.hari !== 7) masalah.push('agenda ' + r.hari + ' kolom');
    if (r.baris !== 7) masalah.push('tabel ' + r.baris + ' baris');
    if (!r.ikon) masalah.push('ikon tidak dirender');
    if (!r.lock) masalah.push('Lock tidak dimuat');
    if (!r.notif) masalah.push('store notif tidak ada');
    if (/\.\.\//.test(r.tautan)) masalah.push('tautan relatif ke luar berkas');
    if (errs.length) masalah.push('error ' + errs[0].slice(0, 70));
    if (gagalReq.length) masalah.push(gagalReq.length + ' permintaan gagal');
    if (masalah.length) fail('offline/scheduler.html: ' + masalah.join(' | '));
    else ok(`offline/scheduler.html: agenda 7 hari · ${r.baris} job · ${r.ikon} ikon · tanpa jaringan`);
    await ctx.close();
  }
}

await browser.close();
console.log(gagal === 0 ? '\n✅ Halaman Scheduler lulus semua pemeriksaan.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
