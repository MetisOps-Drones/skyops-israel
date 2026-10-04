"use client";

import { CheckCircle2, XCircle, Loader2, Wind, ArrowUpToLine, ShieldAlert } from "lucide-react";
import { useMyGlobalRole, useMyOrgContext } from "@/hooks/useOrgContext";
import { useAltitudeCeiling } from "@/hooks/useAltitudeCeiling";
import { HOBBY_GENERAL_CEILING_M, COMMERCIAL_GENERAL_CEILING_M } from "@/lib/geo/altitude-ceiling";
import { locationStatusFor } from "@/lib/geo/location-status";
import { useWeather } from "@/hooks/useWeather";
import { windSafety } from "@/lib/weather/windSafety";
import { useLocationClearance } from "@/hooks/useLocationClearance";
import { useAipMaxAltitude } from "@/hooks/useAipMaxAltitude";
import { useAirspaceZones } from "@/hooks/useAirspaceZones";
import { useAipReferenceZones } from "@/hooks/useAipReferenceZones";
import { useLiveNotamZones } from "@/hooks/useLiveNotamZones";
import { CoordinateShareButton } from "@/components/map/CoordinateShareButton";
import { ftToM } from "@/lib/geo/aip";
import { checkFlightAuthorizationRequirement } from "@/lib/geo/flight-rules";
import { checkLiveNotamOverlap } from "@/lib/geo/live-notams";
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
  const { isLoading: airspaceZonesLoading } = useAirspaceZones();
  const { data: aipZones, isLoading: aipZonesLoading } = useAipReferenceZones();
  const { data: liveNotams, isLoading: liveNotamsLoading } = useLiveNotamZones();

  // Three independent signals feed this HUD (the mock airspace_zones table,
  // the advisory aip_reference_zones layer used for the altitude pill, and
  // now checkFlightAuthorizationRequirement — the same real-AIP-data check
  // LocationInfoCard and the server-side authorization action both use) —
  // showing "מותר לטיסה במיקומך" in green while LocationInfoCard right below
  // warned about a restricted/controlled zone at the identical point, because
  // this pill never looked at that data at all, was the actual bug. Any
  // non-"none" blockLevel here now counts as not-clear, same as the server's
  // "never auto-clear" policy for that data.
  const { data: role } = useMyGlobalRole();
  const { data: orgContext } = useMyOrgContext();
  const terrain = useAltitudeCeiling(coords);
  const isHobby = role === "pilot_hobby";
  const hasOrg = Boolean(orgContext?.orgId);
  const isChecking = Boolean(coords) && (airspaceZonesLoading || aipZonesLoading || liveNotamsLoading || terrain.isLoading);
  // Same inputs as the location card: licence type, and the highest height the account may fly (so a
  // zone floating above any drone's reach doesn't count) — otherwise the bar and the card disagree.
  const generalCeilingM = isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M;
  const terrainM = terrain.data?.terrainElevationM ?? null;
  const authCheck =
    coords && aipZones
      ? checkFlightAuthorizationRequirement(coords, aipZones, isHobby, {
          maxAltitudeAmslM: terrainM === null ? null : terrainM + generalCeilingM,
        })
      : null;
  const notamCheck = coords && liveNotams ? checkLiveNotamOverlap(coords, liveNotams) : null;
  const status = locationStatusFor({
    blockLevel: authCheck?.blockLevel ?? "none",
    hasOrg,
    blockedFromGround: Boolean(aipMaxAltitude?.blockedFromGround),
    legacyBlocked: clearance ? !clearance.clear : false,
    notamInside: Boolean(notamCheck?.inside),
  });

  const windKmh = weather?.wind_speed_ms !== null && weather?.wind_speed_ms !== undefined ? Math.round(weather.wind_speed_ms * 3.6) : null;
  const gustKmh = weather?.wind_gust_ms !== null && weather?.wind_gust_ms !== undefined ? Math.round(weather.wind_gust_ms * 3.6) : null;
  const safety = weather ? windSafety(weather.wind_speed_ms, weather.precipitation) : "unknown";

  // Every pill above depends on coords (directly, or via weather which is
  // only fetched when coords is set) — without it (permission denied, still
  // locating, etc.) there is nothing to show, and the bar itself was
  // rendering anyway as an empty strip across the top of the map.
  if (!coords) return null;

  return (
    // The map's zoom buttons sit in the top-left corner (Mapbox NavigationControl); the bar starts to
    // their right so it never covers them.
    <div
      className={cn(
        "absolute left-14 right-0 top-0 z-20 flex flex-wrap items-center justify-between gap-1.5 border-b bg-card/95 px-2 py-1.5 backdrop-blur-sm",
        highContrast && "border-b-2 border-foreground bg-card"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {!coords ? null : isChecking ? (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            בודק את המיקום...
          </span>
        ) : status.tone === "clear" ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3 w-3" />
            {status.label}
          </span>
        ) : status.tone === "caution" ? (
          <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
            <ShieldAlert className="h-3 w-3" />
            {status.label}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
            <XCircle className="h-3 w-3" />
            {status.label}
          </span>
        )}

        {/* The ceiling pill only says something when a zone actually has a floor over the pilot's head;
            a blocked point is already said by the status pill, and "up to 0 m" was never a real number. */}
        {aipMaxAltitude && !aipMaxAltitude.blockedFromGround && aipMaxAltitude.maxAltitudeFt !== null && (
          <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
            <ArrowUpToLine className="h-3 w-3" />
            {`עד ${ftToM(aipMaxAltitude.maxAltitudeFt).toLocaleString("he-IL")} מ'`}
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
