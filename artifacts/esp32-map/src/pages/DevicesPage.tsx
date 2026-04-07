import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDevices,
  getListDevicesQueryKey,
  useDeleteDevice,
  useUpdateDevice,
  useSimulateReading,
  useStartFire,
  useStopFire,
} from "@workspace/api-client-react";
import {
  Cpu,
  Wifi,
  WifiOff,
  Trash2,
  Activity,
  ChevronRight,
  MapPin,
  Edit2,
  Check,
  X,
  Flame,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Device = {
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

export default function DevicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: devices = [], isLoading } = useListDevices();
  const deleteDevice = useDeleteDevice();
  const updateDevice = useUpdateDevice();
  const simulateReading = useSimulateReading();
  const startFire = useStartFire();
  const stopFire = useStopFire();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const handleDelete = (device: Device) => {
    if (!confirm(`"${device.name}" cihazini silmek istediginize emin misiniz?`)) return;
    deleteDevice.mutate(
      { id: device.id },
      {
        onSuccess: () => {
          toast({ title: "Cihaz silindi", description: device.name });
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        },
        onError: () => {
          toast({ title: "Hata", description: "Cihaz silinemedi", variant: "destructive" });
        },
      }
    );
  };

  const handleToggleActive = (device: Device) => {
    updateDevice.mutate(
      { id: device.id, data: { isActive: !device.isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        },
      }
    );
  };

  const handleSimulate = (device: Device) => {
    simulateReading.mutate(
      { id: device.id },
      {
        onSuccess: () => {
          toast({ title: "Veri uretildi", description: `${device.name} icin rastgele olcum kaydedildi.` });
        },
        onError: () => {
          toast({ title: "Hata", description: "Simulasyon basarisiz", variant: "destructive" });
        },
      }
    );
  };

  const handleStartFire = (device: Device) => {
    startFire.mutate(
      { id: device.id },
      {
        onSuccess: () => {
          toast({ title: "YANGIN BASLADI", description: `${device.name} — sicaklik yukseliyor!`, variant: "destructive" });
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        },
        onError: () => toast({ title: "Hata", description: "Yangin baslatılamadı", variant: "destructive" }),
      }
    );
  };

  const handleStopFire = (device: Device) => {
    stopFire.mutate(
      { id: device.id },
      {
        onSuccess: () => {
          toast({ title: "Yangin sonduruldu", description: `${device.name} normale donuyor.` });
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        },
        onError: () => toast({ title: "Hata", description: "Yangin sondurulemedi", variant: "destructive" }),
      }
    );
  };

  const handleStartEdit = (device: Device) => {
    setEditingId(device.id);
    setEditName(device.name);
  };

  const handleSaveEdit = (device: Device) => {
    if (!editName.trim()) return;
    updateDevice.mutate(
      { id: device.id, data: { name: editName.trim() } },
      {
        onSuccess: () => {
          setEditingId(null);
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
          toast({ title: "Cihaz guncellendi" });
        },
      }
    );
  };

  const total = (devices as Device[]).length;
  const active = (devices as Device[]).filter((d) => d.isActive).length;
  const virtual = (devices as Device[]).filter((d) => d.isVirtual).length;
  const onFire = (devices as Device[]).filter((d) => d.fireMode).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Cihaz Listesi</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
              <span>Toplam {total} cihaz — {active} aktif, {virtual} sanal</span>
              {onFire > 0 && (
                <span className="flex items-center gap-1 text-red-400 animate-pulse font-medium">
                  <Flame className="w-3 h-3" />
                  {onFire} Yangin Aktif
                </span>
              )}
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 text-xs" data-testid="button-go-to-map">
              <MapPin className="w-3.5 h-3.5" />
              Haritaya Git
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-card/60 animate-pulse" />
            ))}
          </div>
        ) : (devices as Device[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Cpu className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Henuz cihaz eklenmemis.</p>
            <p className="text-xs mt-1">Haritadan sanal bir ESP32 ekleyin.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {(devices as Device[]).map((device, i) => (
                <motion.div
                  key={device.id}
                  data-testid={`card-device-${device.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04 }}
                  className={`border rounded-lg px-4 py-3 flex items-center gap-4 group transition-colors ${
                    device.fireMode
                      ? "bg-red-950/40 border-red-900/60 hover:border-red-700/60"
                      : "bg-card border-border hover:border-primary/30"
                  }`}
                >
                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      device.fireMode
                        ? "bg-red-500/20 text-red-400"
                        : device.isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {device.fireMode ? <Flame className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    {editingId === device.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          data-testid={`input-edit-name-${device.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm py-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(device);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button onClick={() => handleSaveEdit(device)} className="text-primary hover:text-primary/80">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${device.fireMode ? "text-red-300" : ""}`} data-testid={`text-device-name-${device.id}`}>
                          {device.name}
                        </span>
                        {device.fireMode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                            YANGIN
                          </span>
                        )}
                        <button
                          data-testid={`button-edit-${device.id}`}
                          onClick={() => handleStartEdit(device)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${device.isVirtual ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                        {device.isVirtual ? "SANAL" : "GERCEK"}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {device.latitude.toFixed(3)}, {device.longitude.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {device.isActive
                      ? <Wifi className="w-3.5 h-3.5 text-primary" />
                      : <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                    <span className={`text-[11px] font-medium ${device.isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {device.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      data-testid={`button-toggle-active-${device.id}`}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleToggleActive(device)}
                    >
                      {device.isActive ? "Deaktif Et" : "Aktif Et"}
                    </Button>

                    {device.isVirtual && (
                      <>
                        {!device.fireMode ? (
                          <>
                            <Button
                              data-testid={`button-simulate-${device.id}`}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => handleSimulate(device)}
                              disabled={simulateReading.isPending}
                            >
                              <Activity className="w-3 h-3" />
                              Veri Uret
                            </Button>
                            <Button
                              data-testid={`button-start-fire-${device.id}`}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => handleStartFire(device)}
                              disabled={startFire.isPending}
                            >
                              <Flame className="w-3 h-3" />
                              Yangin
                            </Button>
                          </>
                        ) : (
                          <Button
                            data-testid={`button-stop-fire-${device.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleStopFire(device)}
                            disabled={stopFire.isPending}
                          >
                            <ShieldOff className="w-3 h-3" />
                            Sondur
                          </Button>
                        )}
                      </>
                    )}

                    <Link href={`/devices/${device.id}`}>
                      <Button
                        data-testid={`button-view-${device.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>

                    <Button
                      data-testid={`button-delete-${device.id}`}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(device)}
                      disabled={deleteDevice.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
