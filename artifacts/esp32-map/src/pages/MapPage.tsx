import { useState, useCallback, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAllLatestReadings,
  getGetAllLatestReadingsQueryKey,
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useCreateDevice,
  useSimulateReading,
  useStartFire,
  useStopFire,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Cpu, Activity, Thermometer, Droplets, Gauge, MapPin, Wifi, WifiOff, Flame, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import WeatherCard from "@/components/WeatherCard";
import { Link } from "wouter";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createDeviceIcon(isVirtual: boolean, isActive: boolean, isOnFire: boolean) {
  if (isOnFire) {
    return L.divIcon({
      className: "",
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
          <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(239,68,68,0.15);animation:fire-outer 1.2s ease-out infinite;"></div>
          <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(249,115,22,0.25);animation:fire-inner 0.8s ease-out infinite alternate;"></div>
          <div style="width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,0.2);border:2.5px solid #ef4444;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;">
            <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></div>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });
  }

  const color = isActive ? (isVirtual ? "#06b6d4" : "#3b82f6") : "#475569";
  const glowColor = isActive ? (isVirtual ? "rgba(6,182,212,0.35)" : "rgba(59,130,246,0.35)") : "rgba(71,85,105,0.15)";
  const border = isVirtual ? "dashed" : "solid";

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
        ${isActive ? `<div style="position:absolute;width:32px;height:32px;border-radius:50%;background:${glowColor};animation:pulse-map 2s ease-out infinite;"></div>` : ""}
        <div style="width:22px;height:22px;border-radius:50%;background:${color}20;border:2px ${border} ${color};display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 8px ${glowColor};">
          <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

type DeviceWithReading = {
  device: {
    id: number;
    name: string;
    description?: string | null;
    latitude: number;
    longitude: number;
    isVirtual: boolean;
    isActive: boolean;
    deviceId: string;
    fireMode: boolean;
    fireModeStartedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  latestReading?: {
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
  } | null;
};

function MapClickHandler({ onMapClick, addingMode }: { onMapClick: (lat: number, lng: number) => void; addingMode: boolean }) {
  useMapEvents({
    click(e) {
      if (addingMode) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState<DeviceWithReading | null>(null);
  const [addingMode, setAddingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceDesc, setNewDeviceDesc] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: mapData = [] } = useGetAllLatestReadings();
  const { data: summary } = useGetDashboardSummary();
  const createDevice = useCreateDevice();
  const simulateReading = useSimulateReading();
  const startFire = useStartFire();
  const stopFire = useStopFire();

  const fireDeviceCount = (summary as { fireDevices?: number } | undefined)?.fireDevices ?? 0;

  // Sync selected device with fresh map data
  useEffect(() => {
    if (selectedDevice) {
      const fresh = (mapData as DeviceWithReading[]).find((d) => d.device.id === selectedDevice.device.id);
      if (fresh) setSelectedDevice(fresh);
    }
  }, [mapData]);

  // Auto-refresh every 8 seconds when fire is active, 30s otherwise
  useEffect(() => {
    const interval = fireDeviceCount > 0 ? 8000 : 30000;
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    }, interval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [queryClient, fireDeviceCount]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPendingCoords({ lat, lng });
    setAddingMode(false);
  }, []);

  const handleCreateVirtualDevice = async () => {
    if (!pendingCoords || !newDeviceName.trim()) return;
    createDevice.mutate(
      { data: { name: newDeviceName.trim(), description: newDeviceDesc.trim() || null, latitude: pendingCoords.lat, longitude: pendingCoords.lng, isVirtual: true, deviceId: `virtual-${Date.now()}` } },
      {
        onSuccess: (device) => {
          toast({ title: "Sanal cihaz eklendi", description: device.name });
          setPendingCoords(null); setNewDeviceName(""); setNewDeviceDesc("");
          queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => toast({ title: "Hata", description: "Cihaz eklenemedi", variant: "destructive" }),
      }
    );
  };

  const handleSimulate = (deviceId: number) => {
    simulateReading.mutate(
      { id: deviceId },
      {
        onSuccess: () => {
          toast({ title: "Veri uretildi" });
          queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
        },
        onError: () => toast({ title: "Hata", description: "Simulasyon basarisiz", variant: "destructive" }),
      }
    );
  };

  const handleStartFire = (deviceId: number, deviceName: string) => {
    startFire.mutate(
      { id: deviceId },
      {
        onSuccess: () => {
          toast({ title: "YANGIN BASLADI", description: `${deviceName} — sicaklik yukseliyor!`, variant: "destructive" });
          queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => toast({ title: "Hata", description: "Yangin baslatılamadı", variant: "destructive" }),
      }
    );
  };

  const handleStopFire = (deviceId: number) => {
    stopFire.mutate(
      { id: deviceId },
      {
        onSuccess: () => {
          toast({ title: "Yangin sonduruldu", description: "Cihaz normale donuyor." });
          queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => toast({ title: "Hata", description: "Yangin sondurulemedi", variant: "destructive" }),
      }
    );
  };

  const isOnFire = selectedDevice?.device.fireMode ?? false;

  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes pulse-map { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.5);opacity:0} }
        @keyframes fire-outer { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.8);opacity:0} }
        @keyframes fire-inner { 0%{transform:scale(.9);opacity:.8} 100%{transform:scale(1.2);opacity:.4} }
      `}</style>

      {/* Stats bar */}
      <div className="absolute top-4 left-4 right-4 z-[500] flex items-center gap-2 flex-wrap">
        <StatBadge icon={Cpu} label="Toplam" value={summary?.totalDevices ?? "--"} />
        <StatBadge icon={Activity} label="Aktif" value={summary?.activeDevices ?? "--"} color="text-primary" />
        <StatBadge icon={Thermometer} label="Ort.Sicaklik" value={summary?.avgTemperature != null ? `${Number(summary.avgTemperature).toFixed(1)}°C` : "--"} color="text-orange-400" />
        <StatBadge icon={Droplets} label="Ort.Nem" value={summary?.avgHumidity != null ? `${Number(summary.avgHumidity).toFixed(1)}%` : "--"} color="text-blue-400" />
        <StatBadge icon={Gauge} label="Ort.Basinc" value={summary?.avgPressure != null ? `${Number(summary.avgPressure).toFixed(0)} hPa` : "--"} color="text-purple-400" />
        {fireDeviceCount > 0 && (
          <StatBadge icon={Flame} label="Yangin" value={`${fireDeviceCount} AKTIF`} color="text-red-500" pulse />
        )}

        <div className="ml-auto flex gap-2">
          <Button
            data-testid="button-add-virtual-device"
            size="sm"
            variant={addingMode ? "default" : "outline"}
            onClick={() => { setAddingMode(!addingMode); setPendingCoords(null); }}
            className={`gap-2 text-xs font-medium shadow-lg ${addingMode ? "bg-primary text-primary-foreground" : "bg-card/90 backdrop-blur border-border"}`}
          >
            <Plus className="w-3.5 h-3.5" />
            {addingMode ? "Haritaya tiklayin..." : "Sanal ESP32 Ekle"}
          </Button>
        </div>
      </div>

      {/* Map */}
      <MapContainer center={[39.0, 35.0]} zoom={6} style={{ width: "100%", height: "100%" }} zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler onMapClick={handleMapClick} addingMode={addingMode} />
        {(mapData as DeviceWithReading[]).map((item) => (
          <Marker
            key={item.device.id}
            position={[item.device.latitude, item.device.longitude]}
            icon={createDeviceIcon(item.device.isVirtual, item.device.isActive, item.device.fireMode)}
            eventHandlers={{ click: () => setSelectedDevice(item) }}
          />
        ))}
      </MapContainer>

      {/* Device side panel */}
      <AnimatePresence>
        {selectedDevice && (
          <motion.div
            key="device-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`absolute top-0 right-0 h-full w-80 backdrop-blur-md border-l z-[500] overflow-y-auto shadow-2xl ${
              isOnFire
                ? "bg-red-950/90 border-red-900/60"
                : "bg-card/95 border-border"
            }`}
            data-testid="panel-device-detail"
          >
            <div className="p-4 space-y-4">
              {/* Fire alert banner */}
              {isOnFire && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-2"
                >
                  <Flame className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-red-400">YANGIN UYARISI AKTIF</div>
                    {selectedDevice.device.fireModeStartedAt && (
                      <div className="text-[10px] text-red-500/80 font-mono">
                        {Math.floor((Date.now() - new Date(selectedDevice.device.fireModeStartedAt).getTime()) / 1000)}s once basladi
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnFire ? "bg-red-500" : selectedDevice.device.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedDevice.device.isVirtual ? "SANAL" : "GERCEK"} ESP32
                    </span>
                    {selectedDevice.device.isActive ? <Wifi className="w-3 h-3 text-primary" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <h2 className={`font-semibold text-sm truncate ${isOnFire ? "text-red-300" : "text-foreground"}`} data-testid="text-device-name">
                    {selectedDevice.device.name}
                  </h2>
                  {selectedDevice.device.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedDevice.device.description}</p>
                  )}
                </div>
                <button
                  data-testid="button-close-panel"
                  onClick={() => setSelectedDevice(null)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-background/30 rounded-md px-3 py-2">
                <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                <span>{selectedDevice.device.latitude.toFixed(5)}, {selectedDevice.device.longitude.toFixed(5)}</span>
              </div>

              {/* Weather */}
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Son Olcum</div>
                {selectedDevice.latestReading ? (
                  <>
                    <div className="text-[11px] text-muted-foreground mb-2 font-mono">
                      {new Date(selectedDevice.latestReading.recordedAt).toLocaleString("tr-TR")}
                    </div>
                    {isOnFire && (
                      <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-2">
                        <span className="text-xs text-red-400">Sicaklik</span>
                        <span className="font-mono font-bold text-red-400 text-lg">{selectedDevice.latestReading.temperature.toFixed(1)}°C</span>
                      </div>
                    )}
                    <WeatherCard
                      temperature={selectedDevice.latestReading.temperature}
                      humidity={selectedDevice.latestReading.humidity}
                      pressure={selectedDevice.latestReading.pressure}
                      heatIndex={selectedDevice.latestReading.heatIndex}
                      windSpeed={selectedDevice.latestReading.windSpeed}
                      windDirection={selectedDevice.latestReading.windDirection}
                      uvIndex={selectedDevice.latestReading.uvIndex}
                      weatherCondition={selectedDevice.latestReading.weatherCondition}
                    />
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground bg-background/30 rounded-lg px-3 py-4 text-center">Henuz olcum yok</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                {selectedDevice.device.isVirtual && (
                  <>
                    {/* Fire control */}
                    {!isOnFire ? (
                      <Button
                        data-testid="button-start-fire"
                        size="sm"
                        className="w-full gap-2 text-xs bg-red-600 hover:bg-red-500 text-white border-red-500"
                        onClick={() => handleStartFire(selectedDevice.device.id, selectedDevice.device.name)}
                        disabled={startFire.isPending}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        {startFire.isPending ? "Baslıyor..." : "Yangin Baslat"}
                      </Button>
                    ) : (
                      <Button
                        data-testid="button-stop-fire"
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 text-xs border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300"
                        onClick={() => handleStopFire(selectedDevice.device.id)}
                        disabled={stopFire.isPending}
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        {stopFire.isPending ? "Sondurülüyor..." : "Yangin Sondur"}
                      </Button>
                    )}

                    {!isOnFire && (
                      <Button
                        data-testid="button-simulate"
                        size="sm"
                        variant="outline"
                        className="w-full text-xs gap-1.5"
                        onClick={() => handleSimulate(selectedDevice.device.id)}
                        disabled={simulateReading.isPending}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        {simulateReading.isPending ? "Uretiliyor..." : "Normal Veri Uret"}
                      </Button>
                    )}
                  </>
                )}

                <Link href={`/devices/${selectedDevice.device.id}`} className="w-full">
                  <Button size="sm" className="w-full text-xs" variant="outline" data-testid="button-view-detail">
                    Detay Sayfasi
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add virtual device dialog */}
      <AnimatePresence>
        {pendingCoords && (
          <motion.div
            key="add-dialog"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[600] bg-card border border-border rounded-xl shadow-2xl p-5 w-80"
          >
            <h3 className="font-semibold text-sm mb-1">Sanal ESP32 Ekle</h3>
            <p className="text-[11px] text-muted-foreground font-mono mb-3">
              {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cihaz Adi</Label>
                <Input
                  data-testid="input-device-name"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="ornek: Sanal - Istanbul"
                  className="mt-1 text-sm h-8"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreateVirtualDevice()}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Aciklama (Opsiyonel)</Label>
                <Input
                  data-testid="input-device-desc"
                  value={newDeviceDesc}
                  onChange={(e) => setNewDeviceDesc(e.target.value)}
                  placeholder="Kisa aciklama..."
                  className="mt-1 text-sm h-8"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  data-testid="button-cancel-add"
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => { setPendingCoords(null); setNewDeviceName(""); setNewDeviceDesc(""); }}
                >
                  Iptal
                </Button>
                <Button
                  data-testid="button-confirm-add"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={handleCreateVirtualDevice}
                  disabled={!newDeviceName.trim() || createDevice.isPending}
                >
                  {createDevice.isPending ? "Ekleniyor..." : "Ekle"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[500] bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-solid border-blue-500 bg-blue-500/20" />
          Gercek
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-dashed border-cyan-400 bg-cyan-400/20" />
          Sanal
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-solid border-red-500 bg-red-500/20" />
          Yangin
        </div>
      </div>
    </div>
  );
}

function StatBadge({ icon: Icon, label, value, color = "text-foreground", pulse = false }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: string;
  pulse?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 bg-card/90 backdrop-blur border rounded-lg px-3 py-1.5 shadow-sm ${pulse ? "border-red-800/50 animate-pulse" : "border-border"}`}>
      <Icon className={`w-3.5 h-3.5 ${pulse ? "text-red-500" : "text-muted-foreground"}`} />
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <span className={`text-xs font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
