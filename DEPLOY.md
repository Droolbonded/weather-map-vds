# Weather Map - VDS Kurulum Rehberi

Bu doküman, projeyi Replit'ten bağımsız olarak Ubuntu tabanlı bir VDS
(VPS) üzerinde nasıl çalıştıracağını **adım adım** gösterir. İlk hedef:
sunucu IP'si üzerinden çalışan canlı bir kurulum. Domain ve SSL eklemek
için en sondaki "Sonraki adımlar" bölümüne bakın.

## Mimari özeti

```
Browser ──► Nginx :80
            ├─►  /          → SPA (artifacts/esp32-map/dist/public)
            └─►  /api/*     → Node API :5000  ──► PostgreSQL (lokal)
                                              └─► uploads/ (lokal disk)
```

- **Frontend** (`artifacts/esp32-map`) Vite ile build edilir, statik dosyalar
  Nginx tarafından sunulur.
- **API** (`artifacts/api-server`) bir Node sürecidir; systemd ile arka
  planda çalışır, `localhost:5000` portunu dinler.
- **PostgreSQL** sadece lokalden erişilir (`127.0.0.1`); dışa açılmaz.
- **Uploads** (ESP32-CAM JPEG'leri) `artifacts/api-server/uploads/` altında
  yerel diske yazılır.

## Gereksinimler

- Ubuntu 22.04 veya 24.04 VDS
- Sudo erişimine sahip bir kullanıcı
- En az 1 GB RAM, 1 vCPU (build sırasında 2 GB RAM önerilir)

---

## 1) Sunucu hazırlığı

```bash
# Repo'yu sunucuya çek (veya git clone)
sudo apt-get update -y
sudo apt-get install -y git
git clone <REPO_URL> /tmp/weather-map
cd /tmp/weather-map

# Tek komutla bağımlılıkları kur
sudo bash scripts/setup-vds.sh
```

`setup-vds.sh` şunları kurar:

- Node.js 24 (NodeSource), `pnpm` (corepack)
- PostgreSQL 16 + `postgresql-contrib`
- Nginx
- UFW kuralları (SSH ve Nginx Full)

Script bittiğinde `node -v`, `pnpm -v`, `psql --version` ve `nginx -v`
sürümlerini ekrana yazar.

> UFW'yi script **etkinleştirmez**. SSH bağlantısını kaybetmemen için
> en sondaki adımda manuel `sudo ufw enable` çalıştır.

## 2) PostgreSQL kullanıcı ve veritabanı

```bash
sudo -u postgres psql <<'SQL'
CREATE USER weather_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE weather_db OWNER weather_user;
GRANT ALL PRIVILEGES ON DATABASE weather_db TO weather_user;
SQL
```

Şifreyi güçlü bir değerle değiştir; bu değeri 4. adımdaki
`.env.production` dosyasında da kullanacaksın.

## 3) Repo'yu deploy klasörüne taşı

```bash
sudo rsync -a --delete /tmp/weather-map/ /var/www/weather-map/
sudo chown -R "$USER":"$USER" /var/www/weather-map
cd /var/www/weather-map
```

## 4) Production environment dosyası

```bash
cp .env.production.example .env.production
nano .env.production
```

Doldurman gereken alanlar:

| Değişken      | Açıklama |
|---------------|----------|
| `PORT`        | API'nin dinleyeceği port (Nginx ile aynı tutulmalı, varsayılan `5000`). |
| `DATABASE_URL`| `postgresql://weather_user:GUCLU_SIFRE@localhost:5432/weather_db` |
| `BASE_PATH`   | SPA taban yolu. Site kökten yayınlanacaksa `/` bırak. |
| `NODE_ENV`    | `production` |

> Bu dosya `.gitignore` tarafından korunur ve repo'ya commit edilmez.

## 5) Bağımlılıkları kur ve build et

```bash
cd /var/www/weather-map
pnpm install --frozen-lockfile
pnpm run build
```

`pnpm run build`:

1. Tüm workspace'i typecheck eder.
2. `@workspace/api-server` için `dist/index.mjs` üretir.
3. `@workspace/esp32-map` için `dist/public/` altına SPA build'ini yazar.

## 6) Veritabanı şemasını uygula

Repo'da versiyonlu migration yok, şema Drizzle Kit `push` ile uygulanır:

```bash
cd /var/www/weather-map
# .env.production'i shell'e yükle (DATABASE_URL gerekiyor)
set -a; source .env.production; set +a
pnpm --filter @workspace/db run push
```

İlk push'ta tabloları ekleyeceği için "Yes" sorularına onay vermen
gerekebilir. Üretimde dikkatli ol; tehlikeli değişiklikler için
`push-force` kullanma alışkanlığı edinme.

## 7) API'yi systemd servisi olarak kur

```bash
# Uploads dizinini API'nin yazabileceği şekilde hazırla
sudo install -d -o www-data -g www-data /var/www/weather-map/artifacts/api-server/uploads

# Servis dosyasini kur
sudo cp /var/www/weather-map/scripts/weather-map-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now weather-map-api

# Durum
systemctl status weather-map-api --no-pager
journalctl -u weather-map-api -f
```

Servis dosyası (`scripts/weather-map-api.service`):

- `WorkingDirectory=/var/www/weather-map/artifacts/api-server`
- `EnvironmentFile=/var/www/weather-map/.env.production`
- `ExecStart=/usr/bin/node --enable-source-maps dist/index.mjs`
- `Restart=always`, log'lar `journald`'a yazılır.

> `User=www-data` olarak çalışır. Repo dosyalarının okunabilir, `uploads/`
> dizininin yazılabilir olduğundan emin ol.

## 8) Nginx site'ini etkinleştir

```bash
sudo cp /var/www/weather-map/nginx.conf /etc/nginx/sites-available/weather-map
sudo ln -sf /etc/nginx/sites-available/weather-map /etc/nginx/sites-enabled/weather-map
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

`nginx.conf` özetle:

- `:80` üzerinde dinler.
- `/` → `dist/public` statik dosyaları
- `/api/` → `127.0.0.1:5000` proxy
- `client_max_body_size 12m` (ESP32-CAM JPEG yüklemeleri için)
- gzip, hash'li asset'lerde uzun cache, gizli dosyalara erişim yasağı

## 9) Smoke test

```bash
# API canli mi?
curl -i http://127.0.0.1:5000/api/health   # endpoint mevcutsa

# Nginx uzerinden
curl -i http://<SUNUCU_IP>/
curl -i http://<SUNUCU_IP>/api/devices

# Upload klasoru yazilabilir mi?
sudo -u www-data touch /var/www/weather-map/artifacts/api-server/uploads/.write-test \
  && sudo -u www-data rm /var/www/weather-map/artifacts/api-server/uploads/.write-test \
  && echo "uploads OK"
```

Tarayıcıdan `http://<SUNUCU_IP>/` adresine git; SPA açılmalı ve panel
verilerini API'den çekmeli.

## 10) Güvenlik duvarını aç

```bash
sudo ufw status
sudo ufw enable
```

Sadece `OpenSSH` ve `Nginx Full` açık olmalı.

---

## Güncelleme akışı

Yeni kod sunucuya geldikten sonra:

```bash
cd /var/www/weather-map
git pull   # veya rsync ile yeni dosyalari getir
sudo bash scripts/deploy.sh
```

`scripts/deploy.sh` şunları yapar:

1. `pnpm install --frozen-lockfile`
2. `pnpm run build`
3. `pnpm --filter @workspace/db run push`
4. `uploads/` izinlerini doğrular
5. `weather-map-api` servisini yeniden başlatır
6. Nginx config'ini doğrulayıp reload eder

## Sık karşılaşılan sorunlar

- **`PORT environment variable is required`**: `.env.production` boş veya
  systemd `EnvironmentFile` yolu yanlış. `systemctl cat weather-map-api`
  ile kontrol et.
- **`DATABASE_URL must be set`**: aynı dosyada `DATABASE_URL` boş veya
  PostgreSQL erişimi yok. `psql "$DATABASE_URL" -c '\l'` ile dene.
- **502 Bad Gateway**: API ayakta değil. `systemctl status weather-map-api`
  ve `journalctl -u weather-map-api -n 100` ile logları incele.
- **404 / SPA route'lar bozuk**: `try_files ... /index.html` satırı
  Nginx config'inde olmalı, build çıktısı `dist/public` altında olmalı.
- **Upload yazma hatası**: `uploads/` dizini `www-data`'ya ait değil.
  `chown -R www-data:www-data .../uploads` ile düzelt.

## Sonraki adımlar (opsiyonel)

- **Domain + SSL**: Bir A kaydı oluşturup `nginx.conf` içindeki
  `server_name` değerini domain ile değiştir, ardından
  `sudo apt-get install certbot python3-certbot-nginx` ve
  `sudo certbot --nginx -d example.com` ile Let's Encrypt sertifikası al.
- **Otomatik yedekleme**: `pg_dump weather_db` ve `uploads/` klasörünü
  düzenli olarak harici depolamaya kopyalayan bir cron işi.
- **Versiyonlu migration**: Drizzle `push` yerine `drizzle-kit generate`
  ile checked-in migration dosyalarına geçiş.
