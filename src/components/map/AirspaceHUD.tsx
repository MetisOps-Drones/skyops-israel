"use client";

import { CheckCircle2, XCircle, Wind, ArrowUpToLine } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { windSafety } from "@/components/map/WeatherPanel";
import { useLocationClearance } from "@/hooks/useLocationClearance";
import { useAipMaxAltitude } from "@/hooks/useAipMaxAltitude";
import { CoordinateShareButton } from "@/components/map/CoordinateShareButton";
import { ftToM } from "@/lib/geo/aip";
import { cn } from "@/lib/utils";

export function AirspaceHUD({
  coords,
  showWind,
  highContrast,
}: {
  coords: [number, number] | null;
  showWind: boolean;
  highContrast: boolean;
}) {
  const clearance = useLocationClearance(coords);
  const aipMaxAltitude = useAipMaxAltitude(coords);
  const { data: weather } = useWeather(showWind ? coords : null);

  const windKmh = weather?.wind_speed_ms !== null && weather?.wind_speed_ms !== undefined ? Math.round(weather.wind_speed_ms * 3.6) : null;
  const gustKmh = weather?.wind_gust_ms !== null && weather?.wind_gust_ms !== undefined ? Math.round(weather.wind_gust_ms * 3.6) : null;
  const safety = weather ? windSafety(weather.wind_speed_ms, weather.precipitation) : "unknown";

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-1.5 border-b bg-card/95 px-2 py-1.5 backdrop-blur-sm",
        highContrast && "border-b-2 border-foreground bg-card"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {!coords ? null : clearance?.clear ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3 w-3" />
            מותר לטיסה במיקומך
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
            <XCircle className="h-3 w-3" />
            אסור לטיסה במיקומך
          </span>
        )}

        {aipMaxAltitude && aipMaxAltitude.zones.length > 0 && (
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              aipMaxAltitude.blockedFromGround ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
            )}
          >
            <ArrowUpToLine className="h-3 w-3" />
            {aipMaxAltitude.blockedFromGround
              ? "אסור לטיסה כאן"
              : `עד ${ftToM(aipMaxAltitude.maxAltitudeFt ?? 0).toLocaleString("he-IL")} מ'`}
          </span>
        )}

        {showWind && windKmh !== null && (
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              safety === "unsafe" ? "bg-destructive/15 text-destructive" : safety === "caution" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
            )}
          >
            <Wind className="h-3 w-3" />
            רוח {windKmh} קמ״ש{gustKmh !== null && gustKmh > windKmh ? ` (משבים ${gustKmh})` : ""}
          </span>
        )}
      </div>

      {coords && <CoordinateShareButton coords={coords} />}
    </div>
  );
}
