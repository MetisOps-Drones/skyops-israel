import * as turf from "@turf/turf";
import type { AirspaceZone } from "@/hooks/useAirspaceZones";

export interface SpatialCheckInput {
  /** [lng, lat] center of the requested flight bubble. */
  center: [number, number];
  /** Radius in meters (for basic_auto_100m requests). */
  radiusMeters?: number;
  /** Drawn polygon (for manual_notam_bubble requests), GeoJSON ring coordinates. */
  polygon?: GeoJSON.Polygon;
  minAltitudeM: number;
  maxAltitudeM: number;
}

export interface SpatialCheckResult {
  clear: boolean;
  intersectingZones: AirspaceZone[];
  requestGeometry: GeoJSON.Feature<GeoJSON.Polygon>;
}

/** Builds the flight footprint (circle or drawn polygon) as a single GeoJSON Feature. */
export function buildFlightFootprint(
  input: Pick<SpatialCheckInput, "center" | "radiusMeters" | "polygon">
): GeoJSON.Feature<GeoJSON.Polygon> {
  if (input.polygon) {
    return turf.feature(input.polygon);
  }
  if (input.radiusMeters) {
    return turf.circle(input.center, input.radiusMeters / 1000, { units: "kilometers" });
  }
  throw new Error("Either radiusMeters or polygon must be provided");
}

function isAlwaysActive(zone: AirspaceZone): boolean {
  const schedule = zone.active_schedule as { always_active?: boolean } | null;
  return schedule?.always_active !== false;
}

/**
 * Client-side check against the *real* airspace_zones rows (fetched once via
 * useAirspaceZones, not a hardcoded mirror) — gives an instant clearance
 * badge while dragging on the map. The authoritative check is the same
 * PostGIS `find_intersecting_zones` RPC run server-side when the request is
 * actually submitted (src/actions/flight-requests.ts); this just runs the
 * equivalent intersection test with turf against the same geometry so the
 * two never disagree because of stale duplicated data.
 */
export function checkAirspaceIntersection(input: SpatialCheckInput, zones: AirspaceZone[]): SpatialCheckResult {
  const requestGeometry = buildFlightFootprint(input);

  const intersectingZones = zones.filter((zone) => {
    if (!isAlwaysActive(zone)) return false; // scheduled zones require dispatcher judgement regardless
    const altitudeOverlaps = zone.min_altitude_m <= input.maxAltitudeM && zone.max_altitude_m >= input.minAltitudeM;
    if (!altitudeOverlaps) return false;
    const zoneGeom = zone.geom_geojson as unknown as GeoJSON.Geometry;
    if (!zoneGeom || !("type" in zoneGeom)) return false;
    return turf.booleanIntersects(requestGeometry, turf.feature(zoneGeom));
  });

  return {
    clear: intersectingZones.length === 0,
    intersectingZones,
    requestGeometry,
  };
}

/** Converts decimal degrees to CAAI/IAF-style DD°MM'SS"N / DD°MM'SS"E. */
export function toDMS(decimal: number, axis: "lat" | "lng"): string {
  const hemisphere =
    axis === "lat" ? (decimal >= 0 ? "N" : "S") : decimal >= 0 ? "E" : "W";
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${pad(degrees)}°${pad(minutes)}'${pad(seconds)}"${hemisphere}`;
}

export function formatCoordinatesForSubmission(lng: number, lat: number): string {
  return `${toDMS(lat, "lat")} / ${toDMS(lng, "lng")}`;
}

/** Approximate radius (meters) of a drawn polygon, for display purposes only. */
export function polygonApproxRadiusMeters(polygon: GeoJSON.Polygon): number {
  const centroid = turf.centroid(polygon);
  const coords = polygon.coordinates[0] ?? [];
  const distances = coords.map((coord) =>
    turf.distance(centroid, turf.point(coord), { units: "kilometers" })
  );
  return Math.max(...distances, 0) * 1000;
}
