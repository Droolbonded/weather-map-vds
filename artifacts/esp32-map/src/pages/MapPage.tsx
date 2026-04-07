import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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
} from "@workspace/api-client-react";
import {
  X, Plus, Cpu, Activity, Thermometer, Droplets, Gauge, MapPin, Wifi, WifiOff, Flame,
} from "lucide-react";
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

type DeviceWithReading = {
  device: {
    id: number; name: string; description?: string | null;
    latitude: number; longitude: number; isVirtual: boolean;
    isActive: boolean; deviceId: string; fireMode: boolean;
    fireModeStartedAt?: string | null; createdAt: string; updatedAt: string;
  };
  latestReading?: {
    id: number; deviceId: number; temperature: number; humidity: number;
    pressure: number; heatIndex?: number | null; windSpeed?: number | null;
    windDirection?: number | null; uvIndex?: number | null;
    weatherCondition?: string | null; recordedAt: string;
  } | null;
};

function createDeviceIcon(isVirtual: boolean, isActive: boolean, onFire: boolean) {
  if (onFire) {
    return L.divIcon({
      className: "",
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;">
        <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:rgba(239,68,68,0.35);animation:pulse-map 1.2s ease-out infinite;"></div>
        <div style="position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(239,68,68,0.15);animation:pulse-map 1.2s ease-out infinite 0.4s;"></div>
        <div style="width:26px;height:26px;border-radius:50%;background:#7f1d1d;border:2px solid #ef4444;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 12px rgba(239,68,68,0.6);">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="1">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        </div>
      </div>`,
      iconSize: [38, 38], iconAnchor: [19, 19],
    });
  }
  const color = isActive ? (isVirtual ? "#06b6d4" : "#3b82f6") : "#475569";
  const glowColor = isActive ? (isVirtual ? "rgba(6,182,212,0.35)" : "rgba(59,130,246,0.35)") : "rgba(71,85,105,0.15)";
  const border = isVirtual ? "dashed" : "solid";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      ${isActive ? `<div style="position:absolute;width:32px;height:32px;border-radius:50%;background:${glowColor};animation:pulse-map 2s ease-out infinite;"></div>` : ""}
      <div style="width:22px;height:22px;border-radius:50%;background:${color}20;border:2px ${border} ${color};display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 8px ${glowColor};">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
      </div>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

// Fully imperative Leaflet map — React never reconciles Leaflet's internal DOM
function PureLeafletMap({
  markers,
  addingMode,
  onMarkerClick,
  onMapClick,
}: {
  markers: DeviceWithReading[];
  addingMode: boolean;
  onMarkerClick: (item: DeviceWithReading) => void;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletMarkers = useRef<Map<number, L.Marker>>(new Map());
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);
  const addingModeRef = useRef(addingMode);

  onMarkerClickRef.current = onMarkerClick;
  onMapClickRef.current = onMapClick;
  addingModeRef.current = addingMode;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [39.0, 35.0],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (addingModeRef.current) {
        setTimeout(() => onMapClickRef.current(e.latlng.lat, e.latlng.lng), 0);
      }
    });

    mapRef.current = map;

    return () => {
      for (const m of leafletMarkers.current.values()) m.remove();
      leafletMarkers.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(markers.map((m) => m.device.id));

    for (const [id, marker] of leafletMarkers.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        leafletMarkers.current.delete(id);
      }
    }

    for (const item of markers) {
      const id = item.device.id;
      const icon = createDeviceIcon(item.device.isVirtual, item.device.isActive, item.device.fireMode);
      const captured = item;

      if (leafletMarkers.current.has(id)) {
        const m = leafletMarkers.current.get(id)!;
        m.setIcon(icon);
        m.setLatLng([item.device.latitude, item.device.longitude]);
        m.off("click");
        m.on("click", () => setTimeout(() => onMarkerClickRef.current(captured), 0));
      } else {
        const m = L.marker([item.device.latitude, item.device.longitude], { icon }).addTo(map);
        m.on("click", () => setTimeout(() => onMarkerClickRef.current(captured), 0));
        leafletMarkers.current.set(id, m);
      }
    }
  }, [markers]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", cursor: addingMode ? "crosshair" : "grab" }}
      data-testid="leaflet-map"
    />
  );
}

export default function MapPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState<DeviceWithReading | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [addingMode, setAddingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceDesc, setNewDeviceDesc] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: mapData = [] } = useGetAllLatestReadings();
  const { data: summary } = useGetDashboardSummary();
  const createDevice = useCreateDevice();
  const simulateReading = useSimulateReading();

  const markers = useMemo(() => mapData as DeviceWithReading[], [mapData]);
  const hasActiveFire = useMemo(() => markers.some((m) => m.device.fireMode), [markers]);

  useEffect(() => {
    if (!selectedDevice) return;
    const fresh = markers.find((d) => d.device.id === selectedDevice.device.id);
    if (fresh) setSelectedDevice(fresh);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedDevice) setPanelVisible(true);
  }, [selectedDevice?.device.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Faster polling (8s) when fire is active, normal 30s otherwise
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ms = hasActiveFire ? 8000 : 30000;
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [queryClient, hasActiveFire]);

  const invalidateMap = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetAllLatestReadingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }, [queryClient]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPendingCoords({ lat, lng });
    setAddingMode(false);
  }, []);

  const handleMarkerClick = useCallback((item: DeviceWithReading) => {
    setSelectedDevice(item);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelVisible(false);
    setTimeout(() => setSelectedDevice(null), 300);
  }, []);

  const handleCreateVirtualDevice = async () => {
    if (!pendingCoords || !newDeviceName.trim()) return;
    createDevice.mutate(
      { data: { name: newDeviceName.trim(), description: newDeviceDesc.trim() || null, latitude: pendingCoords.lat, longitude: pendingCoords.lng, isVirtual: true, deviceId: `virtual-${Date.now()}` } },
      {
        onSuccess: (device) => {
          setPendingCoords(null); setNewDeviceName(""); setNewDeviceDesc("");
          simulateReading.mutate(
            { id: device.id },
            {
              onSuccess: () => { toast({ title: "Sanal cihaz eklendi", description: device.name }); invalidateMap(); },
              onError: () => { toast({ title: "Cihaz eklendi", description: device.name }); invalidateMap(); },
            }
          );
        },
        onError: () => toast({ title: "Hata", description: "Cihaz eklenemedi", variant: "destructive" }),
      }
    );
  };

  const handleSimulate = (deviceId: number) => {
    simulateReading.mutate({ id: deviceId }, {
      onSuccess: () => { toast({ title: "Veri uretildi" }); invalidateMap(); },
      onError: () => toast({ title: "Hata", description: "Simulasyon basarisiz", variant: "destructive" }),
    });
  };

  const fireCount = summary?.fireDevices ?? 0;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <style>{`@keyframes pulse-map { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.5);opacity:0} }`}</style>

      {/* Stats */}
      <div className="absolute top-4 left-4 right-4 z-[500] flex items-center gap-2 flex-wrap pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap flex-1">
          <StatBadge icon={Cpu} label="Toplam" value={summary?.totalDevices ?? "--"} />
          <StatBadge icon={Activity} label="Aktif" value={summary?.activeDevices ?? "--"} color="text-primary" />
          <StatBadge icon={Thermometer} label="Ort.Sicaklik"
            value={summary?.avgTemperature != null ? `${Number(summary.avgTemperature).toFixed(1)}°C` : "--"} color="text-orange-400" />
          <StatBadge icon={Droplets} label="Ort.Nem"
            value={summary?.avgHumidity != null ? `${Number(summary.avgHumidity).toFixed(1)}%` : "--"} color="text-blue-400" />
          <StatBadge icon={Gauge} label="Ort.Basinc"
            value={summary?.avgPressure != null ? `${Number(summary.avgPressure).toFixed(0)} hPa` : "--"} color="text-purple-400" />
          {fireCount > 0 && (
            <Link href="/notifications">
              <div className="pointer-events-auto flex items-center gap-2 bg-red-950/80 backdrop-blur border border-red-700/60 rounded-lg px-3 py-1.5 shadow-sm cursor-pointer hover:bg-red-900/80 transition-colors">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] text-red-300 font-mono font-semibold">{fireCount} YANGIN AKTIF</span>
              </div>
            </Link>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {addingMode && (
            <span className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 font-mono">
              Haritaya tiklayin
            </span>
          )}
          <Button
            data-testid="button-add-virtual-device"
            size="sm"
            variant={addingMode ? "default" : "outline"}
            onClick={() => { setAddingMode((p) => !p); setPendingCoords(null); }}
            className={`gap-2 text-xs font-medium shadow-lg ${addingMode ? "bg-primary text-primary-foreground" : "bg-card/90 backdrop-blur border-border"}`}
          >
            <Plus className="w-3.5 h-3.5" />
            {addingMode ? "Iptal" : "Sanal ESP32 Ekle"}
          </Button>
        </div>
      </div>

      <PureLeafletMap
        markers={markers}
        addingMode={addingMode}
        onMarkerClick={handleMarkerClick}
        onMapClick={handleMapClick}
      />

      {/* Side panel */}
      {selectedDevice && createPortal(
        <div
          className={`fixed top-0 right-0 h-full w-80 bg-card/95 backdrop-blur-md border-l border-border z-[9999] overflow-y-auto shadow-2xl transition-transform duration-300 ease-in-out ${panelVisible ? "translate-x-0" : "translate-x-full"}`}
          data-testid="panel-device-detail"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedDevice.device.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {selectedDevice.device.isVirtual ? "SANAL" : "GERCEK"} ESP32
                  </span>
                  {selectedDevice.device.isActive
                    ? <Wifi className="w-3 h-3 text-primary" />
                    : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                  {selectedDevice.device.fireMode && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      <Flame className="w-3 h-3" /> YANGIN
                    </span>
                  )}
                </div>
                <h2 className={`font-semibold text-sm truncate ${selectedDevice.device.fireMode ? "text-red-300" : ""}`} data-testid="text-device-name">
                  {selectedDevice.device.name}
                </h2>
                {selectedDevice.device.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedDevice.device.description}</p>
                )}
              </div>
              <button
                data-testid="button-close-panel"
                onClick={handleClosePanel}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedDevice.device.fireMode && selectedDevice.device.fireModeStartedAt && (
              <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 text-xs text-red-300">
                Yangin basladi: {new Date(selectedDevice.device.fireModeStartedAt).toLocaleString("tr-TR")}
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-background/30 rounded-md px-3 py-2">
              <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{selectedDevice.device.latitude.toFixed(5)}, {selectedDevice.device.longitude.toFixed(5)}</span>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Son Olcum</div>
              {selectedDevice.latestReading ? (
                <>
                  <div className="text-[11px] text-muted-foreground mb-2 font-mono">
                    {new Date(selectedDevice.latestReading.recordedAt).toLocaleString("tr-TR")}
                  </div>
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
                <div className="text-sm text-muted-foreground bg-background/30 rounded-lg px-3 py-4 text-center">
                  Henuz olcum yok
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {selectedDevice.device.isVirtual && !selectedDevice.device.fireMode && (
                <Button
                  data-testid="button-simulate"
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => handleSimulate(selectedDevice.device.id)}
                  disabled={simulateReading.isPending}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {simulateReading.isPending ? "Uretiliyor..." : "Veri Uret"}
                </Button>
              )}
              <Link href={`/devices/${selectedDevice.device.id}`} className="w-full">
                <Button size="sm" className="w-full text-xs" variant="outline" data-testid="button-view-detail">
                  Detay Sayfasi
                </Button>
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add device dialog */}
      {pendingCoords && createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] bg-card border border-border rounded-xl shadow-2xl p-5 w-80">
          <h3 className="font-semibold text-sm mb-1">Sanal ESP32 Ekle</h3>
          <p className="text-[11px] text-muted-foreground font-mono mb-3">
            {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Cihaz Adi</Label>
              <Input data-testid="input-device-name" value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="ornek: Sanal - Istanbul" className="mt-1 text-sm h-8" autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateVirtualDevice()} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Aciklama (Opsiyonel)</Label>
              <Input data-testid="input-device-desc" value={newDeviceDesc}
                onChange={(e) => setNewDeviceDesc(e.target.value)}
                placeholder="Kisa aciklama..." className="mt-1 text-sm h-8" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button data-testid="button-cancel-add" size="sm" variant="outline" className="flex-1 text-xs"
                onClick={() => { setPendingCoords(null); setNewDeviceName(""); setNewDeviceDesc(""); }}>
                Iptal
              </Button>
              <Button data-testid="button-confirm-add" size="sm" className="flex-1 text-xs"
                onClick={handleCreateVirtualDevice}
                disabled={!newDeviceName.trim() || createDevice.isPending || simulateReading.isPending}>
                {createDevice.isPending || simulateReading.isPending ? "Ekleniyor..." : "Ekle"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[500] bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 flex gap-3 text-[11px] text-muted-foreground pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-solid border-blue-500 bg-blue-500/20" />
          Gercek
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-dashed border-cyan-400 bg-cyan-400/20" />
          Sanal
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-solid border-red-500 bg-red-900/60" />
          Yangin
        </div>
      </div>
    </div>
  );
}

function StatBadge({ icon: Icon, label, value, color = "text-foreground" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-1.5 shadow-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <span className={`text-xs font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
