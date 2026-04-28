#!/usr/bin/env bash
#
# Weather Map - Ubuntu VDS bootstrap
# ----------------------------------
# Tek seferlik calistir. Ubuntu 22.04 / 24.04 uzerinde dogrulanmistir.
# Idempotent olmaya calisir; tekrar calistirmak yeniden yuklemez.
#
# Kurulanlar:
#   - Node.js 24 (NodeSource)
#   - pnpm (corepack uzerinden)
#   - PostgreSQL 16 (Ubuntu varsayilan apt paketi)
#   - Nginx
#   - UFW guvenlik duvari kurallari (Nginx Full + OpenSSH)
#
# Kullanim:
#   sudo bash scripts/setup-vds.sh
#

set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "[!] Bu scripti root olarak (sudo ile) calistirin." >&2
  exit 1
fi

NODE_MAJOR="${NODE_MAJOR:-24}"

log() { echo -e "\n[+] $*"; }

log "Sistem paketleri guncelleniyor"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

log "Temel araclar kuruluyor (curl, ca-certificates, gnupg, git, build-essential)"
apt-get install -y curl ca-certificates gnupg git build-essential ufw

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "^v${NODE_MAJOR}\."; then
  log "Node.js ${NODE_MAJOR} kuruluyor (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  log "Node.js zaten kurulu: $(node -v)"
fi

log "corepack etkinlestiriliyor ve pnpm haz\u0131rlan\u0131yor"
corepack enable
corepack prepare pnpm@latest --activate

log "PostgreSQL kuruluyor"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql

log "Nginx kuruluyor"
apt-get install -y nginx
systemctl enable --now nginx

log "UFW kurallari uygulaniyor"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
# UFW'yi script icinde aktif etmiyoruz; SSH'tan dusmemek icin kullanici manuel onaylasin.

log "Deploy hedef dizini hazirlaniyor (/var/www/weather-map)"
install -d -o "${SUDO_USER:-root}" -g "${SUDO_USER:-root}" /var/www/weather-map

log "Kurulum tamam. Ozet:"
echo "  - node: $(node -v)"
echo "  - pnpm: $(pnpm -v)"
echo "  - psql: $(psql --version)"
echo "  - nginx: $(nginx -v 2>&1)"

cat <<'EOS'

Sonraki adimlar:
  1) PostgreSQL kullanici ve veritabani olustur:
       sudo -u postgres psql <<'SQL'
       CREATE USER weather_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
       CREATE DATABASE weather_db OWNER weather_user;
       SQL

  2) Repo'yu /var/www/weather-map altina kopyala (rsync veya git clone).

  3) Repo kokunde:
       cp .env.production.example .env.production
       nano .env.production       # gercek degerleri yaz

  4) Bagimliliklari kur ve build et:
       pnpm install --frozen-lockfile
       pnpm run build

  5) Veritabani semasini uygula:
       pnpm --filter @workspace/db run push

  6) API systemd servisini kur:
       sudo cp scripts/weather-map-api.service /etc/systemd/system/
       sudo systemctl daemon-reload
       sudo systemctl enable --now weather-map-api

  7) Nginx site'ini etkinlestir:
       sudo cp nginx.conf /etc/nginx/sites-available/weather-map
       sudo ln -sf /etc/nginx/sites-available/weather-map /etc/nginx/sites-enabled/weather-map
       sudo rm -f /etc/nginx/sites-enabled/default
       sudo nginx -t && sudo systemctl reload nginx

  8) Guvenlik duvarini etkinlestir:
       sudo ufw enable

Detayli rehber: DEPLOY.md
EOS
