import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  useGetDevice,
  getGetDeviceQueryKey,
  useGetDeviceReadings,
  getGetDeviceReadingsQueryKey,
  useSimulateReading,
  useUpdateDevice,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowLeft, Activity, Wifi, WifiOff, MapPin, Cpu, Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import WeatherCard from "@/components/WeatherCard";

type Reading = {
  id: number;
  deviceId: number;
  temperature: number;
  humidity: number;
  pressure: number;
  heatIndex?: number | null;
  windSpeed?: number | null;
  windDirection?: number | null;
  uvIndex?: number | null;
  weatherCondition?: string | null;
  recordedAt: string;
};

type Device = {
  id: number;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  isVirtual: boolean;
  isActive: boolean;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1 font-mono">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }} className="font-mono font-semibold">{p.value?.toFixed(1)}</span>
          <span className="text-muted-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  );
};

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deviceId = parseInt(params.id ?? "0", 10);

  const { data: device, isLoading: deviceLoading } = useGetDevice(deviceId, {
    query: { enabled: !!deviceId, queryKey: getGetDeviceQueryKey(deviceId) },
  });
  const { data: readings = [], isLoading: readingsLoading } = useGetDeviceReadings(deviceId, undefined, {
    query: { enabled: !!deviceId, queryKey: getGetDeviceReadingsQueryKey(deviceId, undefined) },
  });

  const simulateReading = useSimulateReading();
  const updateDevice = useUpdateDevice();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  // Kamera durumu
  const [camStatus, setCamStatus] = useState<{
    hasCamera: boolean; hasImage: boolean; imageTime: string | null; pendingRequest: boolean;
  } | null>(null);
  const [requestingPhoto, setRequestingPhoto] = useState(false);
  const [imgTs, setImgTs] = useState(Date.now());
  const prevImageTime = useRef<string | null>(null);

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const espDeviceId = (device as Device | undefined)?.deviceId ?? null;

  const fetchCamStatus = useCallback(async () => {
    if (!espDeviceId) return;
    try {
      const r = await fetch(`${BASE}/api/esp32/${espDeviceId}/camera-status`);
      const data = await r.json();
      setCamStatus(data);
      if (data.imageTime && data.imageTime !== prevImageTime.current) {
        prevImageTime.current = data.imageTime;
        setImgTs(Date.now());
        setRequestingPhoto(false);
      }
    } catch { /* sessiz */ }
  }, [espDeviceId, BASE]);

  useEffect(() => {
    if (!espDeviceId) return;
    fetchCamStatus();
    const interval = setInterval(fetchCamStatus, requestingPhoto ? 3000 : 10000);
    return () => clearInterval(interval);
  }, [espDeviceId, fetchCamStatus, requestingPhoto]);

  const handleRequestPhoto = async () => {
    if (!espDeviceId) return;
    setRequestingPhoto(true);
    await fetch(`${BASE}/api/esp32/${espDeviceId}/request-photo`, { method: "POST" });
    toast({ title: "Fotoğraf isteği gönderildi", description: "Cihaz bir sonraki senkronizasyonda fotoğraf gönderecek (~15 sn)." });
    fetchCamStatus();
  };

  const handleSimulate = () => {
    simulateReading.mutate(
      { id: deviceId },
      {
        onSuccess: () => {
          toast({ title: "Veri uretildi", description: "Rastgele sensor verisi kaydedildi." });
          queryClient.invalidateQueries({ queryKey: getGetDeviceReadingsQueryKey(deviceId, undefined) });
        },
        onError: () => {
          toast({ title: "Hata", description: "Simulasyon basarisiz", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveName = () => {
    if (!newName.trim()) return;
    updateDevice.mutate(
      { id: deviceId, data: { name: newName.trim() } },
      {
        onSuccess: () => {
          setEditingName(false);
          queryClient.invalidateQueries({ queryKey: getGetDeviceQueryKey(deviceId) });
          toast({ title: "Cihaz adi guncellendi" });
        },
      }
    );
  };

  const chartData = (readings as Reading[])
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.recordedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      "Sicaklik (°C)": r.temperature,
      "Nem (%)": r.humidity,
    }));

  const latestReading = (readings as Reading[])[0] ?? null;
  const d = device as Device | undefined;

  if (deviceLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Yukleniyor...</div>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Cpu className="w-10 h-10 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">Cihaz bulunamadi.</p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/devices")}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Geri don
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs text-muted-foreground mb-4 -ml-2"
            onClick={() => setLocation("/devices")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cihazlar
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${d.isVirtual ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                  {d.isVirtual ? "SANAL ESP32" : "GERCEK ESP32"}
                </span>
                {d.isActive
                  ? <span className="flex items-center gap-1 text-[11px] text-primary"><Wifi className="w-3 h-3" /> Aktif</span>
                  : <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><WifiOff className="w-3 h-3" /> Pasif</span>
                }
              </div>

              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    data-testid="input-edit-device-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-xl font-bold h-10"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveName} disabled={updateDevice.isPending}>Kaydet</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Iptal</Button>
                </div>
              ) : (
                <h1
                  className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setEditingName(true); setNewName(d.name); }}
                  data-testid="text-device-name-header"
                  title="Duzenlemek icin tiklayin"
                >
                  {d.name}
                </h1>
              )}

              {d.description && (
                <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
              )}
            </div>

            {d.isVirtual && (
              <Button
                data-testid="button-simulate-detail"
                size="sm"
                variant="outline"
                className="gap-2 flex-shrink-0"
                onClick={handleSimulate}
                disabled={simulateReading.isPending}
              >
                <Activity className="w-4 h-4" />
                {simulateReading.isPending ? "Uretiliyor..." : "Veri Uret"}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Meta info */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <InfoCard label="Cihaz ID" value={d.deviceId} mono />
          <InfoCard label="Konum" value={`${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}`} mono icon={MapPin} />
          <InfoCard label="Kayit Tarihi" value={new Date(d.createdAt).toLocaleDateString("tr-TR")} />
        </motion.div>

        {/* Kamera Paneli — gerçek cihazlarda her zaman göster */}
        {!d.isVirtual && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Canlı Kamera</h2>
                {camStatus?.pendingRequest && (
                  <span className="text-[10px] text-yellow-400 font-mono animate-pulse">Bekleniyor...</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {camStatus?.imageTime && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(camStatus.imageTime).toLocaleTimeString("tr-TR")}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  onClick={handleRequestPhoto}
                  disabled={requestingPhoto}
                >
                  <RefreshCw className={`w-3 h-3 ${requestingPhoto ? "animate-spin" : ""}`} />
                  {requestingPhoto ? "Bekleniyor..." : "Fotoğraf İste"}
                </Button>
              </div>
            </div>
            <div className="bg-black/40 flex items-center justify-center min-h-48">
              {camStatus?.hasImage ? (
                <img
                  src={`${BASE}/api/esp32/image/${espDeviceId}?t=${imgTs}`}
                  alt="Kamera görüntüsü"
                  className="max-w-full max-h-96 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <Camera className="w-8 h-8 opacity-30" />
                  <span className="text-xs">Henüz görüntü yok</span>
                  <span className="text-[11px] opacity-60">Fotoğraf İste butonuna basın</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Latest reading */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Son Olcum</h2>
            {latestReading && (
              <span className="text-[11px] text-muted-foreground font-mono">
                {new Date(latestReading.recordedAt).toLocaleString("tr-TR")}
              </span>
            )}
          </div>
          {latestReading ? (
            <WeatherCard
              temperature={latestReading.temperature}
              humidity={latestReading.humidity}
              pressure={latestReading.pressure}
              heatIndex={latestReading.heatIndex}
              windSpeed={latestReading.windSpeed}
              windDirection={latestReading.windDirection}
              uvIndex={latestReading.uvIndex}
              weatherCondition={latestReading.weatherCondition}
            />
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">
              Henuz olcum kaydedilmemis.
              {d.isVirtual && (
                <p className="text-xs mt-1">
                  Veri uretmek icin "Veri Uret" butonuna basin.
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Chart */}
        {chartData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h2 className="text-sm font-semibold mb-4">Gecmis Veriler</h2>
            {readingsLoading ? (
              <div className="h-48 bg-background/50 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 14%)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "hsl(220 8% 52%)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: "hsl(220 12% 14%)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(220 8% 52%)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "hsl(220 8% 52%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Sicaklik (°C)"
                    stroke="hsl(192 90% 44%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Nem (%)"
                    stroke="hsl(152 65% 46%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}

        {/* Readings table */}
        {(readings as Reading[]).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold">Son Olcumler ({(readings as Reading[]).length})</h2>
            </div>
            <div className="overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    {["Tarih", "Sicaklik", "Nem", "Basinc", "Ruzgar", "UV", "Durum"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(readings as Reading[]).map((r, i) => (
                    <tr
                      key={r.id}
                      data-testid={`row-reading-${r.id}`}
                      className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                        {new Date(r.recordedAt).toLocaleString("tr-TR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-orange-400">{r.temperature.toFixed(1)}°C</td>
                      <td className="px-4 py-2.5 font-mono text-blue-400">{r.humidity.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 font-mono">{r.pressure.toFixed(0)} hPa</td>
                      <td className="px-4 py-2.5 font-mono">{r.windSpeed != null ? `${r.windSpeed.toFixed(1)} km/h` : "--"}</td>
                      <td className="px-4 py-2.5 font-mono">{r.uvIndex != null ? r.uvIndex.toFixed(1) : "--"}</td>
                      <td className="px-4 py-2.5">{r.weatherCondition ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, mono, icon: Icon }: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className={`text-sm font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>
    </div>
  );
}
