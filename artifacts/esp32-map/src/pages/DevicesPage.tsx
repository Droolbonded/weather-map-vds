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
} from "@workspace/api-client-react";
import {
  Cpu, Wifi, WifiOff, Trash2, Activity, ChevronRight,
  MapPin, Edit2, Check, X, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Device = {
  id: number; name: string; description?: string | null;
  latitude: number; longitude: number; isVirtual: boolean;
  isActive: boolean; deviceId: string; createdAt: string; updatedAt: string;
};

export default function DevicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: devices = [], isLoading } = useListDevices();
  const deleteDevice = useDeleteDevice();
  const updateDevice = useUpdateDevice();
  const simulateReading = useSimulateReading();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidateDevices = () => queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });

  const handleDelete = (device: Device) => {
    deleteDevice.mutate(
      { id: device.id },
      {
        onSuccess: () => {
          toast({ title: "Cihaz silindi", description: device.name });
          setConfirmDeleteId(null);
          invalidateDevices();
        },
        onError: () => {
          toast({ title: "Hata", description: "Cihaz silinemedi", variant: "destructive" });
          setConfirmDeleteId(null);
        },
      }
    );
  };

  const handleToggleActive = (device: Device) => {
    updateDevice.mutate(
      { id: device.id, data: { isActive: !device.isActive } },
      { onSuccess: invalidateDevices }
    );
  };

  const handleSimulate = (device: Device) => {
    simulateReading.mutate({ id: device.id }, {
      onSuccess: () => toast({ title: "Veri uretildi", description: `${device.name} icin rastgele olcum kaydedildi.` }),
      onError: () => toast({ title: "Hata", description: "Simulasyon basarisiz", variant: "destructive" }),
    });
  };

  const handleStartEdit = (device: Device) => { setEditingId(device.id); setEditName(device.name); };

  const handleSaveEdit = (device: Device) => {
    if (!editName.trim()) return;
    updateDevice.mutate(
      { id: device.id, data: { name: editName.trim() } },
      { onSuccess: () => { setEditingId(null); invalidateDevices(); toast({ title: "Cihaz guncellendi" }); } }
    );
  };

  const total = (devices as Device[]).length;
  const active = (devices as Device[]).filter((d) => d.isActive).length;
  const virtual = (devices as Device[]).filter((d) => d.isVirtual).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Cihaz Listesi</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toplam {total} cihaz — {active} aktif, {virtual} sanal
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 text-xs" data-testid="button-go-to-map">
              <MapPin className="w-3.5 h-3.5" /> Haritaya Git
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-card/60 animate-pulse" />)}
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
                >
                  {confirmDeleteId === device.id ? (
                    <div className="border border-destructive/50 bg-destructive/10 rounded-lg px-4 py-3 flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <span className="text-sm flex-1 text-destructive">
                        <strong>"{device.name}"</strong> silinsin mi?
                      </span>
                      <Button
                        size="sm" variant="destructive" className="h-7 px-3 text-xs gap-1"
                        onClick={() => handleDelete(device)} disabled={deleteDevice.isPending}
                        data-testid={`button-confirm-delete-${device.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        {deleteDevice.isPending ? "Siliniyor..." : "Evet, Sil"}
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 px-3 text-xs"
                        onClick={() => setConfirmDeleteId(null)}
                        data-testid={`button-cancel-delete-${device.id}`}
                      >
                        Vazgec
                      </Button>
                    </div>
                  ) : (
                    <div className="border border-border bg-card hover:border-primary/30 rounded-lg px-4 py-3 flex items-center gap-4 group transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${device.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Cpu className="w-4 h-4" />
                      </div>

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
                            <span className="text-sm font-medium truncate" data-testid={`text-device-name-${device.id}`}>
                              {device.name}
                            </span>
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
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            device.isVirtual
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {device.isVirtual ? "SANAL" : "GERCEK"}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {device.latitude.toFixed(3)}, {device.longitude.toFixed(3)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {device.isActive
                          ? <Wifi className="w-3.5 h-3.5 text-primary" />
                          : <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span className={`text-[11px] font-medium ${device.isActive ? "text-primary" : "text-muted-foreground"}`}>
                          {device.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          data-testid={`button-toggle-active-${device.id}`}
                          size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => handleToggleActive(device)}
                        >
                          {device.isActive ? "Deaktif Et" : "Aktif Et"}
                        </Button>

                        {device.isVirtual && (
                          <Button
                            data-testid={`button-simulate-${device.id}`}
                            size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleSimulate(device)}
                            disabled={simulateReading.isPending}
                          >
                            <Activity className="w-3 h-3" /> Veri Uret
                          </Button>
                        )}

                        <Link href={`/devices/${device.id}`}>
                          <Button data-testid={`button-view-${device.id}`} size="sm" variant="ghost" className="h-7 px-2">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>

                        <Button
                          data-testid={`button-delete-${device.id}`}
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDeleteId(device.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
