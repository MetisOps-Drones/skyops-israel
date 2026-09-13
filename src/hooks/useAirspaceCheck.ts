"use client";

import { useMemo } from "react";
import { useMapDrawStore } from "@/stores/useMapDrawStore";
import { checkAirspaceIntersection, type SpatialCheckResult } from "@/lib/geo/spatial";
import { useAirspaceZones } from "./useAirspaceZones";

/**
 * Real-time client-side spatial check (Module A), run against the real
 * airspace_zones rows (see useAirspaceZones). Updates as the pilot drags the
 * bubble — the authoritative check re-runs server-side in
 * `src/actions/flight-requests.ts` when the request is actually submitted.
 */
export function useAirspaceCheck(): SpatialCheckResult | null {
  const { center, radiusMeters, polygon, shapeType, maxAltitudeMeters } = useMapDrawStore();
  const { data: zones = [] } = useAirspaceZones();

  return useMemo(() => {
    if (shapeType === "circle" && center) {
      return checkAirspaceIntersection(
        { center, radiusMeters, minAltitudeM: 0, maxAltitudeM: maxAltitudeMeters },
        zones
      );
    }
    if (shapeType === "polygon" && polygon) {
      return checkAirspaceIntersection(
        { center: turfCentroidOf(polygon), polygon, minAltitudeM: 0, maxAltitudeM: maxAltitudeMeters },
        zones
      );
    }
    return null;
  }, [center, radiusMeters, polygon, shapeType, maxAltitudeMeters, zones]);
}

function turfCentroidOf(polygon: GeoJSON.Polygon): [number, number] {
  const ring = polygon.coordinates[0] ?? [];
  if (ring.length === 0) return [35.2137, 31.7683];
  let sumLng = 0;
  let sumLat = 0;
  for (const point of ring) {
    sumLng += point[0] ?? 0;
    sumLat += point[1] ?? 0;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}
