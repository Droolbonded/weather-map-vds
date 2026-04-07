import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, MapPin, Thermometer, Droplets, Wind, AlertTriangle, CheckCircle2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListDevices } from "@workspace/api-client-react";

type Device = {
  id: number; name: string; latitude: number; longitude: number;
  isVirtual: boolean; isActive: boolean; fireMode: boolean;
  fireModeStartedAt?: string | null;
};

type FireEvent = {
  reading: {
    id: number; deviceId: number; temperature: number; humidity: number;
    pressure: number; windSpeed?: number | null; weatherCondition?: string | null;
    recordedAt: string;
  };
  device: Device;
};

function useFireHistory() {
  return useQuery<FireEvent[]>({
    queryKey: ["fire-history"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/readings/fire-history`);
      if (!res.ok) throw new Error("Fire history fetch failed");
      return res.json();
    },
    staleTime: 5000,
  });
}

function elapsed(isoDate: string) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} saniye once`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dakika once`;
  const h = Math.floor(m / 60);
  return `${h} saat once`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: devices = [] } = useListDevices();
  const { data: history = [], isLoading } = useFireHistory();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeFireDevices = (devices as Device[]).filter((d) => d.fireMode);
  const hasActiveFire = activeFireDevices.length > 0;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ms = hasActiveFire ? 8000 : 30000;
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["fire-history"] });
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [queryClient, hasActiveFire]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Bildirimler
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasActiveFire
                ? <span className="flex items-center gap-1 text-red-400 font-medium"><Flame className="w-3 h-3" /> {activeFireDevices.length} aktif yangin algi</span>
                : "Aktif yangin algi yok"}
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5" /> Haritaya Git
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Active fires section */}
        {activeFireDevices.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5" /> Aktif Yanginlar
            </h2>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {activeFireDevices.map((device) => (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="border border-red-700/50 bg-red-950/30 rounded-lg px-4 py-3 flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Flame className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-red-300">{device.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          {device.isVirtual ? "SANAL" : "GERCEK"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground font-mono">
                        <MapPin className="w-3 h-3" />
                        {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                      </div>
                      {device.fireModeStartedAt && (
                        <p className="text-[11px] text-red-400/70 mt-1">
                          Baslangic: {new Date(device.fireModeStartedAt).toLocaleString("tr-TR")}
                        </p>
                      )}
                    </div>
                    <Link href="/devices">
                      <Button size="sm" variant="outline" className="text-xs h-7 border-red-700/50 text-red-300 hover:bg-red-900/30 flex-shrink-0">
                        Yonet
                      </Button>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {activeFireDevices.length === 0 && (
          <div className="flex items-center gap-3 border border-green-800/30 bg-green-950/20 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span className="text-sm text-green-300">Tum cihazlar normal. Aktif yangin algi yok.</span>
          </div>
        )}

        {/* Fire event history */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Yangin Kayitlari
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-card/60 animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-card/30 border border-border rounded-lg px-4 py-6 text-center">
              Henuz yangin kaydi yok.
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((event) => (
                <div
                  key={event.reading.id}
                  className={`border rounded-lg px-4 py-2.5 flex items-center gap-3 ${
                    event.reading.weatherCondition === "Extreme Fire"
                      ? "border-red-800/40 bg-red-950/20"
                      : "border-orange-800/30 bg-orange-950/10"
                  }`}
                >
                  <div className={`w-1.5 h-full rounded-full flex-shrink-0 self-stretch ${
                    event.reading.weatherCondition === "Extreme Fire" ? "bg-red-500" : "bg-orange-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${
                        event.reading.weatherCondition === "Extreme Fire" ? "text-red-300" : "text-orange-300"
                      }`}>
                        {event.device.name}
                      </span>
                      <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                        event.reading.weatherCondition === "Extreme Fire"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-orange-500/20 text-orange-400"
                      }`}>
                        {event.reading.weatherCondition}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                        <Thermometer className="w-3 h-3 text-red-400" />
                        {event.reading.temperature.toFixed(1)}°C
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                        <Droplets className="w-3 h-3 text-blue-400" />
                        %{event.reading.humidity.toFixed(0)}
                      </span>
                      {event.reading.windSpeed != null && (
                        <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                          <Wind className="w-3 h-3 text-cyan-400" />
                          {event.reading.windSpeed.toFixed(0)} km/s
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                    {elapsed(event.reading.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
