#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# tools/siapkan-repo.sh — siapkan identitas repo Aurivo Dash di GitHub.
#
# Yang dilakukan skrip ini:
#   1. periksa prasyarat (git, gh, status login gh)
#   2. git init + commit pertama (bila belum ada repo git di folder ini)
#   3. pastikan organisasi GitHub ada (kalau belum, tampilkan cara membuatnya)
#   4. buat repositori ORG/REPO, pasang deskripsi/topik/homepage, lalu push
#
# Pemakaian:
#   bash tools/siapkan-repo.sh                 # pakai nilai bawaan di bawah
#   ORG=aurivodash REPO=aurivodash bash tools/siapkan-repo.sh
#   VISIBILITY=public bash tools/siapkan-repo.sh
#
# Catatan: pembuatan ORGANISASI tidak bisa lewat gh CLI (harus dari web/pengaturan
# akun). Skrip ini akan berhenti dengan petunjuk bila organisasinya belum ada.
# ---------------------------------------------------------------------------
set -euo pipefail

ORG="${ORG:-aurivodash}"
REPO="${REPO:-aurivodash}"
VISIBILITY="${VISIBILITY:-public}"
BRANCH="${BRANCH:-main}"
HOMEPAGE="${HOMEPAGE:-https://aurivodash.com}"
DESKRIPSI="Aurivo Dash — template dashboard perbankan bergaya AdminLTE v3 (Tailwind CSS v4 + Alpine.js), dwibahasa ID/EN, 100% offline."
TOPIK=("dashboard" "template" "banking" "perbankan" "tailwindcss" "alpinejs" "vanilla-js" "offline" "admin-template")

langkah() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
info()    { printf '  · %s\n' "$1"; }
gagal()   { printf '\n✖ %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- 1. prasyarat
langkah "1/5 Memeriksa prasyarat"
command -v git >/dev/null || gagal "git tidak ditemukan. Pasang git lebih dulu."
info "git: $(git --version)"

if ! command -v gh >/dev/null; then
  cat <<'PESAN'
  gh (GitHub CLI) belum terpasang. Pasang dulu:
    macOS   : brew install gh
    Debian  : sudo apt install gh
    Windows : winget install --id GitHub.cli
  Lalu: gh auth login
PESAN
  exit 1
fi
info "gh: $(gh --version | head -1)"

gh auth status >/dev/null 2>&1 || gagal "belum login GitHub. Jalankan: gh auth login"
info "login GitHub: ok"

# ------------------------------------------------------------- 2. repo lokal
langkah "2/5 Menyiapkan repo git lokal"
if [ ! -d .git ]; then
  git init -q
  git branch -M "$BRANCH"
  info "git init (branch $BRANCH)"
else
  info "repo git sudah ada"
fi

if [ ! -f .gitignore ]; then
  cat > .gitignore <<'EOF'
node_modules/
.DS_Store
*.log
EOF
  info ".gitignore dibuat"
fi

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  git add -A
  git -c user.name="${GIT_NAME:-Radian Adhi C.}" \
      -c user.email="${GIT_EMAIL:-radianac@gmail.com}" \
      commit -qm "Aurivo Dash 1.0.0 — template dashboard perbankan (Tailwind CSS v4 + Alpine.js, offline)"
  info "commit pertama dibuat"
else
  info "commit sudah ada ($(git rev-parse --short HEAD))"
fi

# -------------------------------------------------------- 3. organisasi GitHub
langkah "3/5 Memeriksa organisasi GitHub: $ORG"
if gh api "orgs/$ORG" >/dev/null 2>&1; then
  info "organisasi '$ORG' ditemukan"
else
  cat <<PESAN

  Organisasi '$ORG' belum ada. GitHub CLI tidak bisa membuat organisasi —
  buat lewat web (gratis) lalu jalankan skrip ini lagi:

    1. buka https://github.com/account/organizations/new
    2. nama organisasi : $ORG
    3. pemilik          : akun Anda
    4. setelah dibuat, jalankan ulang: ORG=$ORG bash tools/siapkan-repo.sh

PESAN
  exit 1
fi

# ------------------------------------------------------------ 4. repositori
langkah "4/5 Membuat repositori $ORG/$REPO"
if gh repo view "$ORG/$REPO" >/dev/null 2>&1; then
  info "repositori sudah ada — menyetel remote saja"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$ORG/$REPO.git"
else
  gh repo create "$ORG/$REPO" "--$VISIBILITY" \
    --description "$DESKRIPSI" \
    --homepage "$HOMEPAGE" \
    --source=. --remote=origin
  info "repositori dibuat"
fi

for t in "${TOPIK[@]}"; do
  gh repo edit "$ORG/$REPO" --add-topic "$t" >/dev/null
done
info "topik: ${TOPIK[*]}"

# ------------------------------------------------------------------ 5. push
langkah "5/5 Mendorong commit"
git push -u origin "$BRANCH"
info "selesai → https://github.com/$ORG/$REPO"

langkah "Langkah manual yang masih tersisa"
cat <<PESAN
  · daftarkan domain: aurivodash.com, aurivodash.id, aurivodash.co.id
  · klaim paket npm: npm publish --dry-run   (lalu 'npm publish' bila sudah siap)
  · klaim handle sosial: @aurivodash (X/IG/LinkedIn)
  · cek merek dagang: DJKI kelas 9 & 42 (lalu USPTO/EUIPO bila jualan global)
  · lihat NAMING.md §7 untuk daftar lengkapnya
PESAN
