import type { AipMaxAltitudeResult } from "./aip";
import { ftToM } from "./aip";

/** תקנה: מרחק אנכי מזערי מתחת לענן. Used by WeatherPanel (cloud base is a weather concern, not an airspace-ceiling one — see the split in migration notes for this file). */
export const REQUIRED_CLOUD_SEPARATION_M = 150;
/** הפרדה אופקית/אנכית הנהוגה בנתיבי תובלה נמוכה מתואמים (LLR/LLD/LLP) בין כטב"ם לתעבורה אחרת בנתיב. */
export const REQUIRED_ROUTE_TRAFFIC_SEPARATION_FT = 200;
/** תקנות הטיס (הפעלת מטיסן), תשפ"ד 2024 — תקרת גובה כללית קבועה למטיסן, ללא תלות בנתוני AIP. */
export const HOBBY_GENERAL_CEILING_M = 50;
/** תקנות הטיס (הפעלת כטב"ם קטן), תשפ"ד 2024 — תקרת גובה כללית קבועה לכטב"ם קטן (עשויה לרדת ל-60 מ' באישור מפקד חיל האוויר לפי פמ"ת ספציפי — לא ממודל כאן). */
export const COMMERCIAL_GENERAL_CEILING_M = 100;

export interface FullAltitudeCeiling {
  terrainElevationM: number | null;
  /** Route-floor-minus-terrain-minus-traffic-separation, in meters AGL. Null when no route zone covers the point, or terrain is unavailable. */
  routeAglM: number | null;
  /** Whether the covering AIP zone is a low-level route/danger/prohibited zone (LLR/LLD/LLP) — only these carry the 200ft traffic-separation subtraction; a CTR/ATZ/TMA/CTA ceiling doesn't represent "another aircraft in a shared corridor". */
  routeIsTrafficCorridor: boolean;
  /** The lower of routeAglM/the flat general ceiling — the legal airspace ceiling once every regulatory constraint is applied. Cloud base is a separate, weather-driven limit (see WeatherPanel) — deliberately not folded in here, since "how high the law lets you fly" and "how high the sky lets you fly today" are two different questions with two different owners. */
  combinedAglM: number | null;
  limitingFactor: "route" | "general_ceiling" | null;
}

/**
 * The legal ceiling the pilot needs: route floor above your head (AIP zone,
 * AMSL) minus the ground elevation under your feet minus the required
 * separation from other traffic in that route, capped by the flat general
 * ceiling. Terrain comes from src/app/api/altitude-ceiling/route.ts — this
 * function is pure math over what that route returns.
 */
export function computeFullAltitudeCeiling(
  altitude: AipMaxAltitudeResult,
  terrainElevationM: number | null,
  generalCeilingM: number = COMMERCIAL_GENERAL_CEILING_M
): FullAltitudeCeiling {
  const routeIsTrafficCorridor = altitude.zones.some(
    (z) => z.kind === "RESTRICTED" || z.kind === "DANGER" || z.kind === "PROHIBITED"
  );

  let routeAglM: number | null = null;
  if (altitude.blockedFromGround) {
    routeAglM = 0;
  } else if (altitude.maxAltitudeFt !== null && terrainElevationM !== null) {
    const separationM = routeIsTrafficCorridor ? ftToM(REQUIRED_ROUTE_TRAFFIC_SEPARATION_FT) : 0;
    routeAglM = Math.max(0, ftToM(altitude.maxAltitudeFt) - terrainElevationM - separationM);
  }

  const candidates: { value: number; source: "route" | "general_ceiling" }[] = [
    { value: generalCeilingM, source: "general_ceiling" },
  ];
  if (routeAglM !== null) candidates.push({ value: routeAglM, source: "route" });
  candidates.sort((a, b) => a.value - b.value);

  return {
    terrainElevationM,
    routeAglM,
    routeIsTrafficCorridor,
    combinedAglM: candidates[0]?.value ?? null,
    limitingFactor: candidates[0]?.source ?? null,
  };
}
