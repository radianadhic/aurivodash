/**
 * qa/scan-terjemahan.mjs — memindai sisa teks Indonesia saat mode Inggris aktif.
 * Menghasilkan daftar unik agar kamus src/i18n/en.json bisa dilengkapi.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const PAGES = ['index', 'analytics', 'tables', 'forms', 'charts', 'widgets', 'kanban', 'icons', 'profile', 'invoice',
  'ag-grid', 'mini-grid-1', 'mini-grid-2', 'mini-grid-3', 'mini-grid-4', 'mini-grid-5', 'mini-grid-6', 'kartu-qris', 'qris',
  'notifications', 'scheduler'];
const ROOT_PAGES = [['mobile', 'http://localhost:8080/mobile/index.html'], ['login', 'http://localhost:8080/login.html'], ['register', 'http://localhost:8080/register.html'], ['404', 'http://localhost:8080/404.html'], ['landing', 'http://localhost:8080/index.html']];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
await page.goto('http://localhost:8080/pages/index.html', { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(() => window.I18n.set('en'));

const found = new Map();

async function scan(label, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const items = await page.evaluate(() => {
    const ID = /\b(dan|atau|yang|untuk|dengan|dari|tidak|ini|itu|pada|akan|adalah|bisa|semua|dalam|ulang|baru|lagi|sudah|belum|halaman|tombol|kartu|tabel|waktu|tanggal|hari|jam|menit|jumlah|nama|pilih|tambah|hapus|simpan|ubah|lihat|buka|tutup|cari|kirim|masuk|keluar|unduh|unggah|pengguna|produk|pesanan|transaksi|laporan|stok|harga|warna|tema|bahasa|tautan|menu|ikon|grafik|formulir|papan|profil|status|pesan|notifikasi|aktivitas|ringkasan|contoh|siap|pakai|jenis|tanpa|gaya|berkas|penjualan|pelanggan|karyawan|tugas|proyek|alamat|nomor|kota|kode|sandi|akun|saya|anda|pengaturan|terang|gelap|juga|masih|lebih|paling|sedang|setiap|selama|sampai|mulai|selesai|klik|geser|lanjut|kembali|lewat|kapan|siapa|bagaimana|dimana|milik|punya|kirim|pilih|bantu|bantuan|gratis|paket|langganan)\b/i;
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) {
        const t = n.nodeValue.replace(/\s+/g, ' ').trim();
        if (t.length > 3 && ID.test(t) && n.parentElement && !n.parentElement.closest('script,style')) out.push(t);
        return;
      }
      if (n.nodeType !== 1 || n.closest('script,style')) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return [...new Set(out)];
  });
  items.forEach((t) => found.set(t, (found.get(t) || new Set()).add ? (found.get(t) || []).concat(label) : [label]));
  return items.length;
}

const perPage = [];
for (const p of PAGES) perPage.push([p, await scan(p, `http://localhost:8080/pages/${p}.html`)]);
for (const [label, url] of ROOT_PAGES) perPage.push([label, await scan(label, url)]);

console.log('Sisa teks Indonesia per halaman (mode EN):');
for (const [k, v] of perPage) console.log(`  ${k.padEnd(10)} ${v}`);

const rows = [...found.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`\nTotal unik: ${rows.length}`);
fs.writeFileSync(PROYEK + 'qa/sisa-terjemahan.txt', rows.map(([t, w]) => `${w.length}x  ${t}`).join('\n') + '\n');
rows.slice(0, 70).forEach(([t, w]) => console.log(`  ${String(w.length).padStart(2)}x ${t.slice(0, 88)}`));
await browser.close();
