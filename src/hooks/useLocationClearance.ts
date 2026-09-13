"use client";

import { useMemo } from "react";
import { checkAirspaceIntersection, type SpatialCheckResult } from "@/lib/geo/spatial";
import { useAirspaceZones } from "./useAirspaceZones";

/** Ground-level hobby ceiling used for the HUD's "can I fly from here" indicator — not a substitute for the full altitude/drone check in the request drawer. */
const INDICATIVE_CHECK_ALTITUDE_M = 120;
/** Small footprint standing in for "this exact point", so the HUD reuses the same zone-intersection logic as the flight-request check instead of a second point-in-polygon implementation. */
const POINT_CHECK_RADIUS_M = 25;

/** Lightweight "is my current GPS position inside a restricted zone" check for the map HUD banner. */
export function useLocationClearance(coords: [number, number] | null): SpatialCheckResult | null {
  const { data: zones = [] } = useAirspaceZones();

  return useMemo(() => {
    if (!coords) return null;
    return checkAirspaceIntersection(
      { center: coords, radiusMeters: POINT_CHECK_RADIUS_M, minAltitudeM: 0, maxAltitudeM: INDICATIVE_CHECK_ALTITUDE_M },
      zones
    );
  }, [coords, zones]);
}
