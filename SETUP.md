# GitHub Actions & VDS Kurulum Kılavuzu

## 1) GitHub Secrets — Ne Eklenmeli?

GitHub repo sayfasına git → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Adı | Açıklama | Örnek Değer |
|---|---|---|
| `VDS_HOST` | VDS'nin IP adresi | `185.123.45.67` |
| `VDS_USER` | SSH kullanıcı adı | `ubuntu` veya `root` |
| `VDS_SSH_KEY` | Private SSH anahtarı (tamamı) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VDS_PORT` | SSH portu | `22` |

> **SSH Key nasıl oluşturulur?**
> Yerel bilgisayarında:
> ```bash
> ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/weather_map_deploy
> ```
> - `~/.ssh/weather_map_deploy` → içeriğini **`VDS_SSH_KEY`** secret'ına yapıştır
> - `~/.ssh/weather_map_deploy.pub` → içeriğini VDS'deki `~/.ssh/authorized_keys` dosyasına ekle

---

## 2) GitHub Pages Aktif Etme

1. Repo → **Settings → Pages**
2. **Source** → `GitHub Actions` seç
3. Kaydet. `deploy-pages.yml` workflow otomatik çalışacak.

---

## 3) VDS İlk Kurulum (Sırayla Çalıştır)

### Adım 1 — Sunucuya bağlan ve repo'yu çek

```bash
ssh ubuntu@<VDS_IP>
sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/<KULLANICI>/<REPO>.git /var/www/weather-map
cd /var/www/weather-map
```

### Adım 2 — Sistem bağımlılıklarını kur

```bash
sudo bash scripts/setup-vds.sh
```

### Adım 3 — PostgreSQL veritabanı oluştur

```bash
sudo -u postgres psql <<'SQL'
CREATE USER weather_user WITH PASSWORD 'GUCLU_SIFRE_YAZ';
CREATE DATABASE weather_db OWNER weather_user;
GRANT ALL PRIVILEGES ON DATABASE weather_db TO weather_user;
SQL
```

### Adım 4 — Environment dosyasını doldur

```bash
cp .env.production.example .env.production
nano .env.production
```

Düzenlenecek değerler:
```env
PORT=5000
DATABASE_URL=postgresql://weather_user:GUCLU_SIFRE_YAZ@localhost:5432/weather_db
BASE_PATH=/
NODE_ENV=production
```

### Adım 5 — GitHub Actions için sudoers kur

```bash
sudo bash scripts/setup-sudoers.sh ubuntu   # ubuntu yerine kendi kullanıcı adını yaz
```

### Adım 6 — Deploy SSH public key'ini authorized_keys'e ekle

```bash
echo "ssh-ed25519 AAAA...buraya_public_key_yaz... github-actions-deploy" \
  >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Adım 7 — İlk deploy'u çalıştır

```bash
cd /var/www/weather-map
sudo bash scripts/deploy.sh
```

### Adım 8 — Systemd servisini kur

```bash
sudo cp scripts/weather-map-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now weather-map-api
systemctl status weather-map-api --no-pager
```

### Adım 9 — Nginx konfigürasyonunu aktif et

```bash
sudo cp nginx.conf /etc/nginx/sites-available/weather-map
sudo ln -sf /etc/nginx/sites-available/weather-map /etc/nginx/sites-enabled/weather-map
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Adım 10 — Güvenlik duvarını aç

```bash
sudo ufw enable
sudo ufw status
```

---

## 4) Test Et

```bash
# API canlı mı?
curl -i http://127.0.0.1:5000/api/health

# Nginx üzerinden
curl -i http://<VDS_IP>/
curl -i http://<VDS_IP>/api/devices
```

Tarayıcıdan `http://<VDS_IP>/` → SPA açılmalı.

---

## 5) Otomatik Deploy Nasıl Çalışır?

```
git push origin main
       │
       ▼
GitHub Actions (.github/workflows/deploy-vds.yml)
       │
       ▼  SSH bağlantısı
VDS: git pull origin main
       │
       ▼
sudo bash scripts/deploy.sh
  ├─ pnpm install
  ├─ pnpm run build
  ├─ pnpm db push
  ├─ uploads/ izinleri
  └─ weather-map-api restart
```

---

## 6) Sık Sorunlar

| Belirti | Çözüm |
|---|---|
| `Permission denied (publickey)` | `VDS_SSH_KEY` secret'ı yanlış veya public key `authorized_keys`'de yok |
| `sudo: a password is required` | `setup-sudoers.sh` çalıştırılmamış |
| `502 Bad Gateway` | `systemctl status weather-map-api` ve `journalctl -u weather-map-api -n 50` |
| `PORT environment variable is required` | `.env.production` eksik veya yanlış yol |
| SPA açılıyor ama API çalışmıyor | `curl http://127.0.0.1:5000/api/health` ile API'yi test et |
