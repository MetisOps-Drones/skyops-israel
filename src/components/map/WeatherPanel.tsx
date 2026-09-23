"use client";

import { CloudRain, Cloud, Wind, Eye, AlertTriangle, Mountain, Loader2, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWeather } from "@/hooks/useWeather";
import { ftToM } from "@/lib/geo/aip";
import { windSafety } from "@/lib/weather/windSafety";
import type { AltitudeCeilingIngredients } from "@/hooks/useAltitudeCeiling";

type CloudBase = AltitudeCeilingIngredients["cloudBase"];

export function WeatherPanel({ center, cloudBase }: { center: [number, number] | null; cloudBase?: CloudBase }) {
  const { data, isLoading, isError } = useWeather(center);

  if (!center) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען תחזית מזג אוויר לאזור הטיסה...
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <WifiOff className="h-4 w-4" />
        לא ניתן היה לטעון תחזית מזג אוויר — יש לבדוק תנאים ידנית לפני הטיסה.
      </div>
    );
  }

  const safety = windSafety(data.wind_speed_ms, data.precipitation);
  const windKmh = data.wind_speed_ms !== null ? Math.round(data.wind_speed_ms * 3.6) : null;

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">מזג אוויר באזור הטיסה</p>
        <Badge variant={safety === "unsafe" ? "destructive" : safety === "caution" ? "warning" : "success"}>
          {safety === "unsafe" ? "לא מומלץ לטוס" : safety === "caution" ? "טוס בזהירות" : "תנאים תקינים"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {data.elevation_m !== null && (
          <span className="flex items-center gap-1">
            <Mountain className="h-4 w-4 text-muted-foreground" />
            גובה הנקודה {Math.round(data.elevation_m)} מ׳ ({Math.round(data.elevation_m * 3.281).toLocaleString("he-IL")} רגל) מעפ״י
          </span>
        )}
        <span className="flex items-center gap-1">
          <Wind className="h-4 w-4 text-muted-foreground" />
          רוח {windKmh ?? "—"} קמ״ש
        </span>
        {data.visibility_m !== null && (
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4 text-muted-foreground" />
            ראות {(data.visibility_m / 1000).toFixed(1)} ק״מ
          </span>
        )}
        {data.precipitation && (
          <span className="flex items-center gap-1 text-destructive">
            <CloudRain className="h-4 w-4" />
            משקעים
          </span>
        )}
        {data.description && <span className="text-muted-foreground">{data.description}</span>}
      </div>
      {cloudBase !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          {cloudBase === null ? (
            <span className="text-muted-foreground">אין נתוני בסיס עננים זמינים</span>
          ) : cloudBase.baseFtAgl === null ? (
            <span className="text-muted-foreground">
              ללא עננים משמעותיים מתחת ל-5,000 רגל (תחנת {cloudBase.stationId}, כ-{cloudBase.stationDistanceKm} ק״מ)
            </span>
          ) : (
            <span>
              בסיס עננים כ-{ftToM(cloudBase.baseFtAgl).toLocaleString("he-IL")} מ׳ ({cloudBase.baseFtAgl.toLocaleString("he-IL")} רגל)
              <span className="text-muted-foreground"> · תחנת {cloudBase.stationId}, כ-{cloudBase.stationDistanceKm} ק״מ</span>
            </span>
          )}
        </div>
      )}
      {safety === "unsafe" && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          רוח או משקעים חורגים מהמומלץ לטיסת רחפן — שקלו לדחות את הטיסה.
        </div>
      )}
    </div>
  );
}
