#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include "DHT.h"
#include <WiFiManager.h> 

// --- SENSÖR PİN TANIMLAMALARI ---
#define DHTPIN 14      // D5
#define ALEV_PIN 12    // D6
#define GAZ_PIN 13     // D7
#define DHTTYPE DHT11

// --- ÖZEL PARAMETRE DEĞİŞKENLERİ ---
// Bu değerler varsayılan olarak atanır, arayüzden değiştirilebilir.
char custom_modul_id[10] = "6";
char custom_sunucu_url[100] = "http://zonguldak67.alwaysdata.net/gozcu3/api4.php";
char custom_enlem[20] = "41.4357";
char custom_boylam[20] = "31.8208";

String g_enlem = "", g_boylam = "";
DHT dht(DHTPIN, DHTTYPE);

// --- KONUM BULMA FONKSİYONU ---
void konumBul() {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(3000); 
  Serial.println("[KONUM] IP uzerinden konum araniyor...");
  
  if (http.begin(client, "http://ip-api.com/json/")) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, payload);
      String sehir = doc["city"].as<String>();
      
      if (sehir.indexOf("Zonguldak") != -1) {
          g_enlem = doc["lat"].as<String>();
          g_boylam = doc["lon"].as<String>();
          Serial.println("[KONUM] Basarili: " + g_enlem + "," + g_boylam);
      } else {
          g_enlem = String(custom_enlem); 
          g_boylam = String(custom_boylam);
          Serial.println("[KONUM] Sehir disi veya bulunamadi, sabit kullaniliyor.");
      }
    } else {
      g_enlem = String(custom_enlem); 
      g_boylam = String(custom_boylam);
      Serial.println("[KONUM] Baglanti hatasi, sabit kullaniliyor.");
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(ALEV_PIN, INPUT);
  pinMode(GAZ_PIN, INPUT);

  // FLASH butonu NodeMCU'da D3 (GPIO 0) pinine bağlıdır.
  // Giriş olarak tanımlıyoruz.
  pinMode(0, INPUT_PULLUP); 

  WiFiManager wm;

  Serial.println("Sifirlama kontrol ediliyor...");
  delay(3000); // Butona basmak için kısa bir süre tanıyalım

  // Eğer D3 (FLASH butonu) basılıysa (GND'ye çekilmişse)
  if (digitalRead(0) == LOW) {
    Serial.println("[SISTEM] Ayarlar siliniyor...");
    wm.resetSettings(); // Wi-Fi ve parametreleri temizle
    Serial.println("[SISTEM] Hafiza temizlendi! Cihaz yeniden basliyor...");
    delay(1000);
    ESP.restart();
  }

  // Web arayüzünde görünecek giriş kutuları
  WiFiManagerParameter custom_id_html("id", "Modul ID", custom_modul_id, 10);
  WiFiManagerParameter custom_url_html("url", "Sunucu URL", custom_sunucu_url, 100);
  WiFiManagerParameter custom_lat_html("lat", "Sabit Enlem (Yedek)", custom_enlem, 20);
  WiFiManagerParameter custom_lon_html("lon", "Sabit Boylam (Yedek)", custom_boylam, 20);

  wm.addParameter(&custom_id_html);
  wm.addParameter(&custom_url_html);
  wm.addParameter(&custom_lat_html);
  wm.addParameter(&custom_lon_html);

  // Cihaz Wi-Fi'ye bağlanamazsa bu isimle yayın yapar
  Serial.println("[SISTEM] Kurulum modu baslatiliyor...");
  if (!wm.autoConnect("ESP8266_YANGIN_PANELI", "12345678")) {
    Serial.println("[HATA] Baglanti kurulamadi, reset atiliyor.");
    delay(3000);
    ESP.restart();
  }

  // Arayüzden girilen yeni değerleri al
  strcpy(custom_modul_id, custom_id_html.getValue());
  strcpy(custom_sunucu_url, custom_url_html.getValue());
  strcpy(custom_enlem, custom_lat_html.getValue());
  strcpy(custom_boylam, custom_lon_html.getValue());

  Serial.println("\n[WIFI] Baglanti Saglandi!");
  konumBul();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // 1. Sensör Okuma
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int alev = !digitalRead(ALEV_PIN); // Sensöre göre HIGH/LOW değişebilir, kontrol et.
    int gaz = digitalRead(GAZ_PIN);

    // 2. Risk Analizi
    int yangin = 0;
    if (alev == 1 || gaz == LOW || (t > 70.0 && h < 20.0)) {
      yangin = 1;
    }

    Serial.printf("\n[VERI] Sicaklik: %.1f | Nem: %.1f | Yangin: %d\n", t, h, yangin);

    // 3. HTTP Gönderimi
    WiFiClient client;
    HTTPClient http;
    
    // Konum verisi IP'den gelmediyse sabit girilen veriyi kullan
    String enlem_gonder = (g_enlem == "") ? String(custom_enlem) : g_enlem;
    String boylam_gonder = (g_boylam == "") ? String(custom_boylam) : g_boylam;

    String url = String(custom_sunucu_url) + "?islem=veri_guncelle&id=" + String(custom_modul_id) +
                 "&mac=" + WiFi.macAddress() + 
                 "&sicaklik=" + String(t) + 
                 "&nem=" + String(h) + 
                 "&durum=" + String(yangin) + 
                 "&gaz=" + String(gaz) + 
                 "&alev=" + String(alev) + 
                 "&enlem=" + enlem_gonder + 
                 "&boylam=" + boylam_gonder +
                 "&kamerali=0";

    Serial.println("[URL] " + url);

    if (http.begin(client, url)) {
      int httpCode = http.GET();
      if (httpCode == 200) {
        Serial.println("[SUNUCU] Basarili.");
      } else {
        Serial.printf("[SUNUCU] Hata Kodu: %d\n", httpCode);
      }
      http.end();
    }
  } else {
    Serial.println("[WIFI] Baglanti koptu!");
    // WiFiManager otomatik tekrar bağlanmayı dener
  }
  
  delay(15000); 
}