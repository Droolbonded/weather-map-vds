#!/usr/bin/env bash
#
# Weather Map - Sudoers kurulum scripti
# -------------------------------------
# VDS'de GitHub Actions'in sudo kullanabilmesi icin
# /etc/sudoers.d/ altina passwordless kural ekler.
#
# Kullanim (root olarak):
#   sudo bash scripts/setup-sudoers.sh <deploy-kullanici-adi>
#   ornek: sudo bash scripts/setup-sudoers.sh ubuntu
#
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "[!] Bu scripti root olarak calistirin: sudo bash scripts/setup-sudoers.sh <user>" >&2
  exit 1
fi

DEPLOY_USER="${1:-}"
if [[ -z "$DEPLOY_USER" ]]; then
  echo "[!] Kullanici adi belirtilmedi." >&2
  echo "    Kullanim: sudo bash scripts/setup-sudoers.sh ubuntu" >&2
  exit 1
fi

SUDOERS_FILE="/etc/sudoers.d/weather-map-deploy"

cat > "$SUDOERS_FILE" <<EOF
# Weather Map deploy — GitHub Actions bu kullanici ile SSH'a girer
# ve deploy.sh scriptini sudo ile calistirir.
${DEPLOY_USER} ALL=(ALL) NOPASSWD: /bin/bash /var/www/weather-map/scripts/deploy.sh
EOF

chmod 0440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

echo "[+] Sudoers kuruldu: $SUDOERS_FILE"
echo "    '${DEPLOY_USER}' artik sudo sifre girmeden deploy.sh calistirabilir."
