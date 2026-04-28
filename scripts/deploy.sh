#!/usr/bin/env bash
#
# Weather Map - tek komutla deploy
# --------------------------------
# Bu script, kod sunucuya kopyalandiktan SONRA repo kokunde calistirilir.
# Idempotent: install -> build -> db push -> uploads izinleri -> servis restart.
#
# Kullanim:
#   sudo bash scripts/deploy.sh
#
# Cevre degiskenleri:
#   APP_DIR  (varsayilan: betigin bulundugu repo koku)
#   APP_USER (varsayilan: www-data) - uploads dizinini bu kullanici sahiplenir
#   SERVICE  (varsayilan: weather-map-api)

set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "[!] Bu scripti sudo ile calistirin." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
APP_USER="${APP_USER:-www-data}"
SERVICE="${SERVICE:-weather-map-api}"

cd "${APP_DIR}"

echo "[+] Repo koku: ${APP_DIR}"

if [[ ! -f .env.production ]]; then
  echo "[!] .env.production bulunamadi. Once .env.production.example dosyasini" >&2
  echo "    kopyalayip gercek degerleri girin:" >&2
  echo "      cp .env.production.example .env.production" >&2
  exit 1
fi

# .env.production'i bu shell'e yukle (DATABASE_URL drizzle push icin gereklidir).
set -a
# shellcheck disable=SC1091
source .env.production
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[!] .env.production icinde DATABASE_URL tanimsiz." >&2
  exit 1
fi

# pnpm sistem genelinde olmayabilir; corepack uzerinden cagrilabilir.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[+] corepack ile pnpm aktiflestiriliyor"
  corepack enable
  corepack prepare pnpm@latest --activate
fi

echo "[+] Bagimliliklar yukleniyor (pnpm install --frozen-lockfile)"
pnpm install --frozen-lockfile

echo "[+] Workspace build ediliyor (typecheck + tum paketler)"
pnpm run build

echo "[+] DB semasi push ediliyor (drizzle-kit push)"
pnpm --filter @workspace/db run push

echo "[+] uploads dizini hazirlaniyor / izinler"
install -d -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}/artifacts/api-server/uploads"

if systemctl list-unit-files | grep -q "^${SERVICE}\.service"; then
  echo "[+] ${SERVICE} servisi yeniden baslatiliyor"
  systemctl restart "${SERVICE}"
  systemctl status "${SERVICE}" --no-pager --lines=5 || true
else
  echo "[!] ${SERVICE} servisi henuz kurulu degil." >&2
  echo "    DEPLOY.md adim 6'yi izleyin: scripts/weather-map-api.service kurulumu." >&2
fi

if command -v nginx >/dev/null 2>&1; then
  echo "[+] Nginx config dogrulamasi"
  nginx -t
  systemctl reload nginx || true
fi

echo "[+] Deploy tamam."
