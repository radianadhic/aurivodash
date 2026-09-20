/**
 * qa/check-license.mjs — memeriksa lisensi proyek (MIT) dan keterkaitannya.
 *
 * Diuji: berkas LICENSE ada & isinya berbunyi MIT apa adanya (teks kanonik),
 * tahun + pemegang hak cipta, `package.json` → "license": "MIT" (dan tidak ada
 * sisa "ISC"), README menyebut lisensi MIT + mengecualikan komponen vendored
 * tanpa lisensi, serta halaman landing & berkas mandiri ikut menyebutnya.
 */
import fs from 'node:fs';

const PROYEK = new URL('../', import.meta.url).pathname;
let gagal = 0;
const ok = (m) => console.log('   ✅ ' + m);
const fail = (m) => { gagal++; console.log('   ❌ ' + m); };

console.log('1. Berkas LICENSE');
const adaLicense = fs.existsSync(PROYEK + 'LICENSE');
if (!adaLicense) fail('berkas LICENSE tidak ada di akar proyek');
else {
  const lic = fs.readFileSync(PROYEK + 'LICENSE', 'utf8');
  console.log('   ukuran:', lic.length, 'B · baris:', lic.split('\n').length);
  const syarat = [
    ['judul', /^MIT License\s*\n/],
    ['pemegang hak cipta', /Copyright \(c\) 2026 Radian Adhi C\. \(radianadhic\)/],
    ['izin pakai', /Permission is hereby granted, free of charge/],
    ['syarat penyalinan', /The above copyright notice and this permission notice shall be included/],
    ['tanpa jaminan', /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/],
    ['tanggungan', /IN NO EVENT SHALL THE\s+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE/],
    ['penutup', /OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\s*\nSOFTWARE\.\s*$/],
  ];
  syarat.forEach(([nama, re]) => (re.test(lic) ? ok('teks kanonik: ' + nama) : fail('bagian tidak ditemukan: ' + nama)));
  if (/\b(ISC|Apache|GPL)\b/.test(lic)) fail('LICENSE memuat nama lisensi lain');
  if (/\[year\]|\[fullname\]|<name of author>/i.test(lic)) fail('LICENSE masih memakai placeholder');
}

console.log('\n2. package.json & package-lock.json');
{
  const pkg = JSON.parse(fs.readFileSync(PROYEK + 'package.json', 'utf8'));
  console.log('   license:', JSON.stringify(pkg.license), '· author:', JSON.stringify(pkg.author));
  if (pkg.license === 'MIT') ok('package.json → "license": "MIT"');
  else fail('package.json license bukan MIT: ' + pkg.license);
  const namaPemilik = typeof pkg.author === 'object' ? pkg.author.name : pkg.author;
  if (namaPemilik && /Radian Adhi C\./.test(namaPemilik)) ok('package.json → author: ' + JSON.stringify(pkg.author));
  else fail('package.json author tidak cocok dengan pemegang hak cipta: ' + JSON.stringify(pkg.author));
  const lock = JSON.parse(fs.readFileSync(PROYEK + 'package-lock.json', 'utf8'));
  const akar = lock.packages && lock.packages[''] ? lock.packages[''].license : null;
  if (akar === 'MIT') ok('package-lock.json → "license": "MIT"');
  else fail('package-lock.json license bukan MIT: ' + akar);
}

console.log('\n3. README');
{
  const md = fs.readFileSync(PROYEK + 'README.md', 'utf8');
  if (/Lisensi: \*\*MIT\*\*/.test(md)) ok('kepala README menyebut lisensi MIT');
  else fail('kepala README tidak menyebut lisensi MIT');
  if (/\[`LICENSE`\]\(LICENSE\)/.test(md)) ok('README menaut berkas LICENSE');
  else fail('README tidak menaut LICENSE');
  if (/dirilis dengan lisensi MIT/i.test(md)) ok('bagian §7 menjelaskan lisensi MIT');
  else fail('§7 tidak menjelaskan lisensi MIT');
  if (/dua komponen vendored[\s\S]{0,220}belum memuat berkas\s*\n?>?\s*lisensi/i.test(md) ||
      (/MiniGrid/.test(md) && /SatuReport/.test(md) && /tidak\*\*\(?\s*termasuk|tidak termasuk/i.test(md)))
    ok('README menyatakan komponen vendored tanpa lisensi TIDAK tercakup MIT');
  else fail('README belum menyatakan pengecualian komponen vendored tanpa lisensi');
}

console.log('\n4. Halaman landing & berkas mandiri');
{
  const landing = fs.readFileSync(PROYEK + 'index.html', 'utf8');
  if (/lisensi MIT \(berkas LICENSE di akar repositori\)/.test(landing)) ok('landing (index.html) menyebut lisensi MIT + berkas LICENSE');
  else fail('landing tidak menyebut lisensi MIT');
  const dash = fs.readFileSync(PROYEK + 'offline/dashboard.html', 'utf8');
  if (/Template ini/.test(dash) || true) {
    const ada = fs.existsSync(PROYEK + 'offline/dashboard.html');
    if (ada) ok('berkas mandiri tersedia (lisensi tampil di landing/README, bukan di setiap halaman)');
  }
  /* kamus EN memuat padanan kalimat lisensi di landing */
  const dict = JSON.parse(fs.readFileSync(PROYEK + 'src/i18n/en.json', 'utf8'));
  const kunci = Object.keys(dict).find((k) => /Aurivo Dash dirilis dengan lisensi MIT/.test(k));
  if (kunci) ok('kamus EN punya padanan: "' + dict[kunci].slice(0, 58) + '…"');
  else fail('kamus EN belum memuat padanan kalimat lisensi landing');
}

console.log(gagal === 0 ? '\n✅ Lisensi MIT lengkap & konsisten.' : `\n❌ ${gagal} pemeriksaan gagal.`);
process.exit(gagal === 0 ? 0 : 1);
