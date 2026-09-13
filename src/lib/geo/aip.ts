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

/**
 * Derives "what's the highest altitude I can legally fly at this exact
 * point" from the AIP reference layer: if a zone reaches the ground here,
 * nothing is legal without coordination (max = 0); otherwise it's the base
 * of the lowest zone stacked above the point. Advisory only — same caveat
 * as the layer itself (see 0024_aip_zones_real_polygons.sql).
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
  const groundBased = sorted.some((zone) => (zone.min_altitude_ft ?? 0) <= 0);
  if (groundBased) {
    return { maxAltitudeFt: 0, blockedFromGround: true, zones: sorted };
  }

  const floors = sorted.map((zone) => zone.min_altitude_ft).filter((n): n is number => n !== null);
  const maxAltitudeFt = floors.length > 0 ? Math.min(...floors) : null;
  return { maxAltitudeFt, blockedFromGround: false, zones: sorted };
}

const FT_TO_M = 0.3048;

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
