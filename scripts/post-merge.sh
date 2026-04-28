#!/usr/bin/env bash
#
# .git/hooks/post-merge — git pull sonrasi otomatik calisir.
# Bu dosyayi git hook olarak aktif etmek icin:
#   cp scripts/post-merge.sh .git/hooks/post-merge
#   chmod +x .git/hooks/post-merge
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[post-merge] Deploy basliyor..."
sudo bash "${REPO_ROOT}/scripts/deploy.sh"
echo "[post-merge] Deploy tamamlandi."
