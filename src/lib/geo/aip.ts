import * as turf from "@turf/turf";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";

export interface AipMaxAltitudeResult {
  /** Highest altitude (ft) with no AIP-reference restriction on it at this point — null when we have no local data, 0 when a ground-based zone covers the point. */
  maxAltitudeFt: number | null;
  /** A ground-based (min_altitude_ft <= 0) zone covers this point — effectively no legal altitude to fly at without authorization. */
  blockedFromGround: boolean;
  /** Every AIP reference zone whose polygon contains this point, most restrictive first. */
  zones: AipReferenceZone[];
}

/** A ground-based zone of one of these kinds means no legal altitude exists at all (CTR/ATZ/prohibited — see flight-rules.ts FORBIDDEN_KINDS). */
const GROUND_BLOCKING_KINDS = new Set(["CTR", "ATZ", "PROHIBITED"]);

/**
 * RESTRICTED/DANGER are governed by an approval path (the area's conditions /
 * the controlling authority / the CAAI director), not by an altitude ceiling
 * of 0 — letting their GND floor zero the ceiling made a restricted area read
 * as flatly "אסור" and an organization's director-approval route unreachable.
 */
const APPROVAL_PATH_KINDS = new Set(["RESTRICTED", "DANGER"]);

/**
 * Derives "what's the highest altitude I can legally fly at this exact
 * point" from the AIP reference layer: if a forbidding zone reaches the
 * ground here, nothing is legal (max = 0); otherwise it's the base of the
 * lowest zone stacked above the point. Advisory only — same caveat as the
 * layer itself (see 0024_aip_zones_real_polygons.sql).
 */
export function maxLegalAltitudeAtPoint(point: [number, number], zones: AipReferenceZone[]): AipMaxAltitudeResult {
  const covering = zones.filter((zone) => {
    const geom = zone.geom_geojson as unknown as GeoJSON.Geometry;
    if (!geom || geom.type !== "Polygon") return false;
    try {
      return turf.booleanPointInPolygon(point, geom as GeoJSON.Polygon);
    } catch {
      return false;
    }
  });

  if (covering.length === 0) {
    return { maxAltitudeFt: null, blockedFromGround: false, zones: [] };
  }

  const sorted = [...covering].sort((a, b) => (a.min_altitude_ft ?? 0) - (b.min_altitude_ft ?? 0));
  const groundBased = sorted.some((zone) => GROUND_BLOCKING_KINDS.has(zone.kind) && (zone.min_altitude_ft ?? 0) <= 0);
  if (groundBased) {
    return { maxAltitudeFt: 0, blockedFromGround: true, zones: sorted };
  }

  const floors = sorted
    .filter((zone) => !(APPROVAL_PATH_KINDS.has(zone.kind) && (zone.min_altitude_ft ?? 0) <= 0))
    .map((zone) => zone.min_altitude_ft)
    .filter((n): n is number => n !== null);
  const maxAltitudeFt = floors.length > 0 ? Math.min(...floors) : null;
  return { maxAltitudeFt, blockedFromGround: false, zones: sorted };
}

const FT_TO_M = 0.3048;
const M_TO_FT = 1 / FT_TO_M;

/** Meters → feet, rounded to the nearest foot. */
export function mToFt(m: number): number {
  return Math.round(m * M_TO_FT);
}

/**
 * A pilot enters the flight altitude in meters above the ground (AGL). The AIP,
 * ATC and NOTAMs speak feet above mean sea level (מעפ"י / AMSL) — so a
 * coordinator needs ground elevation added in before converting. Returns null
 * when the ground elevation isn't known (never guess it).
 */
export function altitudeAmslFt(aglM: number, terrainElevationM: number | null): number | null {
  if (terrainElevationM === null || !Number.isFinite(terrainElevationM)) return null;
  return mToFt(aglM + terrainElevationM);
}

/** Feet → meters, rounded to the nearest meter — for pilots who think in meters, not the feet/AMSL units AIP charts publish in. */
export function ftToM(ft: number): number {
  return Math.round(ft * FT_TO_M);
}

/** "0 - 4000 ft" style AIP numbers rendered as "מ-0 עד 1,219 מ' (0–4,000 רגל)" — meters first, since that's what Israeli hobby-drone rules (and pilots) actually think in. */
export function formatAltitudeRangeMeters(minFt: number | null, maxFt: number | null): string {
  if (minFt === null && maxFt === null) return "גובה לא צוין";
  const minLabel = !minFt || minFt <= 0 ? "הקרקע" : `${ftToM(minFt).toLocaleString("he-IL")} מ'`;
  if (maxFt === null) return `מ${minLabel} וללא תקרה ידועה`;
  const maxLabel = `${ftToM(maxFt).toLocaleString("he-IL")} מ'`;
  return `מ${minLabel} עד ${maxLabel}`;
}
