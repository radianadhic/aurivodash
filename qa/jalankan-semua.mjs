/**
 * qa/jalankan-semua.mjs — menjalankan SELURUH pemeriksaan di folder ini.
 *
 *   node qa/jalankan-semua.mjs            # semua check-*.mjs
 *   node qa/jalankan-semua.mjs mini       # hanya yang namanya memuat "mini"
 *   SKIP=1 node qa/jalankan-semua.mjs     # lewati pemeriksaan lambat? (tidak dipakai)
 *
 * Prasyarat:
 *   1. server statis dari akar proyek:  npm run serve   (http://localhost:8080)
 *   2. Playwright + Chromium:           npm --prefix qa install && npx playwright install chromium
 *
 * Tiap skrip berjalan berurutan (satu peramban per skrip), lalu diringkas di akhir.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const QA = import.meta.dirname;
const filter = process.argv[2] || '';
const BASE = 'http://localhost:8080/';

/* ---------- preflight: server statis harus hidup ---------- */
let serverHidup = false;
try {
  const res = await fetch(BASE + 'index.html', { method: 'HEAD' });
  serverHidup = res.ok;
} catch (e) { /* biarkan gagal → pesan di bawah */ }

if (!serverHidup) {
  console.log('❌ Server statis belum jalan di ' + BASE);
  console.log('   Jalankan dulu (dari akar proyek):  npm run serve');
  process.exit(2);
}

const berkas = fs
  .readdirSync(QA)
  .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (!berkas.length) {
  console.log('Tidak ada berkas check-*.mjs yang cocok dengan filter: ' + filter);
  process.exit(0);
}

console.log(`Menjalankan ${berkas.length} berkas pemeriksaan…\n`);
const hasil = [];
for (const f of berkas) {
  const mulai = Date.now();
  process.stdout.write('▶ ' + f + ' … ');
  const r = spawnSync(process.execPath, [path.join(QA, f)], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);
  const lulus = r.status === 0;
  hasil.push({ f, lulus, detik, keluaran: (r.stdout || '') + (r.stderr || '') });

  /* ringkas: baris terakhir yang berisi ✅/❌ */
  const baris = (r.stdout || '').split('\n').filter((l) => /✅|❌/.test(l));
  const pesan = (baris[baris.length - 1] || (r.stderr || '').split('\n')[0] || '').trim().slice(0, 78);
  console.log((lulus ? '✅ ' : '❌ ') + detik + 's  ' + pesan);
  if (!lulus) {
    /* tampilkan penyebab kegagalan agar mudah ditindak */
    const gagal = (r.stdout || '').split('\n').filter((l) => l.includes('❌')).slice(0, 4);
    gagal.forEach((l) => console.log('      ' + l.trim().slice(0, 110)));
    const err = (r.stderr || '').split('\n').find((l) => /Error|error:/.test(l));
    if (err) console.log('      ' + err.trim().slice(0, 110));
  }
}

const lulus = hasil.filter((h) => h.lulus).length;
const total = hasil.reduce((a, h) => a + Number(h.detik), 0);
console.log('\n──────────────────────────────────────────────');
console.log(`Hasil: ${lulus}/${hasil.length} lulus · total ${total.toFixed(0)} detik`);
if (lulus !== hasil.length) {
  console.log('Gagal: ' + hasil.filter((h) => !h.lulus).map((h) => h.f).join(', '));
}
console.log(lulus === hasil.length ? '✅ Semua pemeriksaan lulus.' : `❌ ${hasil.length - lulus} berkas pemeriksaan gagal.`);
process.exit(lulus === hasil.length ? 0 : 1);
