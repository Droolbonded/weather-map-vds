import { useState } from "react";
import { useListDevices } from "@workspace/api-client-react";
import { Copy, Check, Cpu, Wifi, Code2, BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
          <span className="text-[11px] font-mono text-muted-foreground">{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? "Kopyalandi" : "Kopyala"}
          </button>
        </div>
      )}
      <pre className="p-4 text-xs font-mono text-foreground overflow-auto leading-relaxed whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}

type Device = {
  id: number;
  name: string;
  isVirtual: boolean;
  deviceId: string;
};

export default function Esp32GuidePage() {
  const { data: devices = [] } = useListDevices();
  const realDevices = (devices as Device[]).filter((d) => !d.isVirtual);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(
    realDevices[0]?.id ?? null
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedDevice = realDevices.find((d) => d.id === selectedDeviceId);

  // Get the base URL of the API
  const baseUrl = `${window.location.origin}/api`;

  const arduinoCode = `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
// Opsiyonel: BME280 veya DHT22 icin kutuphaneler
// #include <DHT.h>
// #include <Adafruit_BME280.h>

// ---- WIFI AYARLARI ----
const char* ssid     = "WIFI_ADINIZ";
const char* password = "WIFI_SIFRENIZ";

// ---- API AYARLARI ----
const char* apiBase = "${baseUrl}";
const int   deviceId = ${selectedDevice?.id ?? 1};  // Cihaz ID'niz

// ---- SENSOR AYARLARI (ornek: DHT22) ----
// #define DHTPIN 4
// #define DHTTYPE DHT22
// DHT dht(DHTPIN, DHTTYPE);

HTTPClient http;

void setup() {
  Serial.begin(115200);
  // dht.begin(); // DHT sensor baslatma

  WiFi.begin(ssid, password);
  Serial.print("WiFi baglanıyor");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Baglandi! IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Sensor oku (burada ornekler — gercek sensorunuze gore degistirin)
    float temperature = 23.5;   // Gerçek: dht.readTemperature()
    float humidity    = 60.0;   // Gerçek: dht.readHumidity()
    float pressure    = 1013.25; // Gerçek: bme.readPressure() / 100.0F
    float windSpeed   = 15.0;   // Gerçek: anemometre okumasi
    float uvIndex     = 3.5;    // Gerçek: UV sensor okumasi

    // JSON olustur
    StaticJsonDocument<256> doc;
    doc["temperature"] = temperature;
    doc["humidity"]    = humidity;
    doc["pressure"]    = pressure;
    doc["windSpeed"]   = windSpeed;
    doc["uvIndex"]     = uvIndex;
    doc["weatherCondition"] = "Clear"; // veya otomatik hesapla

    String jsonBody;
    serializeJson(doc, jsonBody);

    // API'ye gonder
    String url = String(apiBase) + "/devices/${selectedDevice?.id ?? 1}/readings";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(jsonBody);

    if (httpCode == 201) {
      Serial.println("Veri gonderildi!");
    } else {
      Serial.print("HTTP Hata: ");
      Serial.println(httpCode);
    }
    http.end();
  }

  delay(30000); // Her 30 saniyede bir gonder
}`;

  const bme280Code = `// BME280 ile sicaklik + nem + basinc okuma
#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;

void setup() {
  Serial.begin(115200);
  if (!bme.begin(0x76)) {
    Serial.println("BME280 bulunamadi!");
    while (1);
  }
}

// loop icinde:
float temperature = bme.readTemperature();
float humidity    = bme.readHumidity();
float pressure    = bme.readPressure() / 100.0F; // hPa`;

  const curlTest = `# Terminalde test etmek icin:
curl -X POST ${baseUrl}/devices/${selectedDevice?.id ?? 1}/readings \\
  -H "Content-Type: application/json" \\
  -d '{
    "temperature": 24.5,
    "humidity": 58.2,
    "pressure": 1012.3,
    "windSpeed": 12.0,
    "uvIndex": 4.1,
    "weatherCondition": "Sunny"
  }'`;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
            <Code2 className="w-3.5 h-3.5" />
            ESP32 Entegrasyon Rehberi
          </div>
          <h1 className="text-2xl font-bold">Gercek ESP32 Baglantisi</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            ESP32 kartinizi WiFi uzerinden bu sisteme baglamak icin asagidaki adimlari takip edin.
          </p>
        </div>

        {/* Device selector */}
        {realDevices.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Cihaz Secin
            </div>
            <div className="flex flex-wrap gap-2">
              {realDevices.map((d) => (
                <button
                  key={d.id}
                  data-testid={`button-select-device-${d.id}`}
                  onClick={() => setSelectedDeviceId(d.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedDeviceId === d.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{d.name}</span>
                  <span className="font-mono text-[10px] opacity-60">#{d.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">1</div>
            <div>
              <h2 className="text-sm font-semibold">Arduino Kutuphanelerini Yukleyin</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Arduino IDE &gt; Kutuphaneler &gt; Yukle</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { lib: "WiFi", desc: "ESP32 ile gelir (dahili)" },
                { lib: "HTTPClient", desc: "ESP32 ile gelir (dahili)" },
                { lib: "ArduinoJson", desc: "Benoit Blanchon tarafindan" },
                { lib: "Adafruit BME280", desc: "BME280 sensoru icin" },
              ].map(({ lib, desc }) => (
                <div key={lib} className="bg-background border border-border rounded-lg px-3 py-2">
                  <div className="font-mono text-primary font-medium">{lib}</div>
                  <div className="text-muted-foreground mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">2</div>
            <div>
              <h2 className="text-sm font-semibold">Ana Kod — Veri Gonderme</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDevice
                  ? `"${selectedDevice.name}" (ID: ${selectedDevice.id}) icin hazirlanmis`
                  : "Bir cihaz secin"}
              </p>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-3 text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <strong className="text-yellow-400">Not:</strong> WIFI_ADINIZ ve WIFI_SIFRENIZ alanlarini kendi WiFi bilgilerinizle degistirin.
            </div>
            <CodeBlock code={arduinoCode} title="esp32_weather.ino" />
          </div>
        </div>

        {/* Step 3 - BME280 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">3</div>
            <div>
              <h2 className="text-sm font-semibold">BME280 Sensor Baglatisi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">SDA → GPIO21, SCL → GPIO22</p>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-4 gap-2 mb-4 text-[11px]">
              {[
                { pin: "3.3V", desc: "VCC" },
                { pin: "GND", desc: "GND" },
                { pin: "GPIO21", desc: "SDA" },
                { pin: "GPIO22", desc: "SCL" },
              ].map(({ pin, desc }) => (
                <div key={pin} className="bg-background border border-border rounded-lg px-2 py-2 text-center">
                  <div className="font-mono text-primary font-semibold">{pin}</div>
                  <div className="text-muted-foreground mt-0.5">→ {desc}</div>
                </div>
              ))}
            </div>
            <CodeBlock code={bme280Code} title="bme280_okuma.ino" />
          </div>
        </div>

        {/* Step 4 - Test */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">4</div>
            <div>
              <h2 className="text-sm font-semibold">Baglantıyı Test Edin</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Terminal veya Postman ile test edin</p>
            </div>
          </div>
          <div className="p-5">
            <CodeBlock code={curlTest} title="terminal — curl testi" />
            <div className="mt-3 text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <strong className="text-primary">Basarili yanit:</strong> HTTP 201 ve JSON formatinda kaydedilen veri doner. Haritada cihaziniz otomatik gozukur.
            </div>
          </div>
        </div>

        {/* Advanced - API reference */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            className="w-full px-5 py-4 border-b border-border flex items-center gap-3 hover:bg-secondary/30 transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 text-left">
              <h2 className="text-sm font-semibold">API Referansi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tum endpoint'ler ve parametreler</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>

          {showAdvanced && (
            <div className="p-5 space-y-3">
              {[
                {
                  method: "POST",
                  path: `/api/devices/{id}/readings`,
                  desc: "Sensor verisi gonder",
                  body: '{ "temperature": 24.5, "humidity": 58.2, "pressure": 1012.3 }',
                },
                {
                  method: "GET",
                  path: `/api/devices/{id}/latest`,
                  desc: "Son olcumu getir",
                  body: null,
                },
                {
                  method: "GET",
                  path: `/api/devices`,
                  desc: "Tüm cihazları listele",
                  body: null,
                },
              ].map(({ method, path, desc, body }) => (
                <div key={path} className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${method === "GET" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"}`}>
                      {method}
                    </span>
                    <span className="text-xs font-mono text-foreground">{path}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                  {body && (
                    <div className="mt-2 text-[11px] font-mono text-muted-foreground bg-card px-2 py-1.5 rounded border border-border/50">
                      {body}
                    </div>
                  )}
                </div>
              ))}
              <div className="text-xs text-muted-foreground pt-1">
                API base: <code className="font-mono text-primary">{baseUrl}</code>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl px-5 py-4">
          <Wifi className="w-8 h-8 text-primary opacity-60 flex-shrink-0" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">ESP32'nizi bagladiktan sonra:</strong> Cihaziniz her 30 saniyede bir veri gonderdikce haritada marker otomatik belirir ve veriler canli olarak guncellenir.
          </div>
        </div>
      </div>
    </div>
  );
}
