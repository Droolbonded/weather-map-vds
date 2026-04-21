import { Thermometer, Droplets, Gauge, Wind, Compass, Sun, Cloud, Flame, FlaskConical } from "lucide-react";

interface WeatherCardProps {
  temperature?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  heatIndex?: number | null;
  windSpeed?: number | null;
  windDirection?: number | null;
  uvIndex?: number | null;
  weatherCondition?: string | null;
  gasValue?: number | null;
  flameValue?: number | null;
  compact?: boolean;
}

function getWindDirectionLabel(deg: number | null | undefined): string {
  if (deg == null) return "--";
  const dirs = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"];
  return dirs[Math.round(deg / 45) % 8];
}

function getConditionColor(condition: string | null | undefined): string {
  if (!condition) return "text-muted-foreground";
  const c = condition.toLowerCase();
  if (c.includes("sunny") || c.includes("clear")) return "text-yellow-400";
  if (c.includes("rain") || c.includes("thunder")) return "text-blue-400";
  if (c.includes("cloud")) return "text-slate-400";
  if (c.includes("fog")) return "text-slate-500";
  return "text-primary";
}

export default function WeatherCard({
  temperature,
  humidity,
  pressure,
  heatIndex,
  windSpeed,
  windDirection,
  uvIndex,
  weatherCondition,
  gasValue,
  flameValue,
  compact = false,
}: WeatherCardProps) {
  const metrics = [
    {
      icon: Thermometer,
      label: "Sicaklik",
      value: temperature != null ? `${temperature.toFixed(1)}°C` : "--",
      color: temperature != null
        ? temperature > 30 ? "text-orange-400" : temperature < 0 ? "text-blue-400" : "text-primary"
        : "text-muted-foreground",
    },
    {
      icon: Droplets,
      label: "Nem",
      value: humidity != null ? `${humidity.toFixed(1)}%` : "--",
      color: humidity != null
        ? humidity > 70 ? "text-blue-400" : "text-primary"
        : "text-muted-foreground",
    },
    {
      icon: Gauge,
      label: "Basinc",
      value: pressure != null ? `${pressure.toFixed(0)} hPa` : "--",
      color: "text-primary",
    },
    {
      icon: Wind,
      label: "Ruzgar",
      value: windSpeed != null ? `${windSpeed.toFixed(1)} km/h` : "--",
      color: "text-primary",
    },
    {
      icon: Compass,
      label: "Yon",
      value: getWindDirectionLabel(windDirection),
      color: "text-primary",
    },
    {
      icon: Sun,
      label: "UV Indeksi",
      value: uvIndex != null ? uvIndex.toFixed(1) : "--",
      color: uvIndex != null
        ? uvIndex > 7 ? "text-red-400" : uvIndex > 4 ? "text-orange-400" : "text-yellow-400"
        : "text-muted-foreground",
    },
    {
      icon: FlaskConical,
      label: "Gaz",
      value: gasValue != null ? (gasValue === 0 ? "⚠ Algılandi" : "Normal") : "--",
      color: gasValue === 0 ? "text-yellow-400" : "text-primary",
    },
    {
      icon: Flame,
      label: "Alev",
      value: flameValue != null ? (flameValue === 0 ? "⚠ Algılandi" : "Yok") : "--",
      color: flameValue === 0 ? "text-red-400" : "text-primary",
    },
  ];

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {metrics.slice(0, 4).map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-2 bg-background/50 rounded-md px-2 py-1.5">
            <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
            <div>
              <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
              <div className={`text-xs font-mono font-semibold ${color} leading-tight mt-0.5`}>{value}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {weatherCondition && (
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Cloud className="w-4 h-4 text-muted-foreground" />
          <span className={`text-sm font-medium ${getConditionColor(weatherCondition)}`}>
            {weatherCondition}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-background/60 rounded-lg px-3 py-2.5 border border-border/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
            <div className={`font-mono text-sm font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      {heatIndex != null && (
        <div className="bg-background/60 rounded-lg px-3 py-2.5 border border-border/50">
          <div className="text-[11px] text-muted-foreground mb-1">Hissedilen Sicaklik</div>
          <div className="font-mono text-sm font-semibold text-orange-400">{heatIndex.toFixed(1)}°C</div>
        </div>
      )}
    </div>
  );
}
