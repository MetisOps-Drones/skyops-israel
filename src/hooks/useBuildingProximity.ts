"use client";

import { useQuery } from "@tanstack/react-query";

export type BuildingProximityResult = { available: boolean; isNearBuilding: boolean; bufferM: number };

/**
 * Authoritative local building check (src/lib/geo/proximity-grid.ts) — used
 * as a fallback in LocationInfoCard when the OSM/Overpass-based
 * useProximityCheck is unavailable, so a dispatcher/pilot gets a real
 * answer instead of "couldn't check, verify manually".
 */
export function useBuildingProximity(point: [number, number] | null, requiredDistanceM: number | null) {
  return useQuery({
    queryKey: ["building_proximity", point?.[0], point?.[1], requiredDistanceM],
    queryFn: async (): Promise<BuildingProximityResult> => {
      const [lng, lat] = point!;
      const res = await fetch(`/api/building-proximity?lat=${lat}&lon=${lng}&bufferM=${requiredDistanceM}`);
      if (!res.ok) return { available: false, isNearBuilding: false, bufferM: requiredDistanceM! };
      return res.json();
    },
    enabled: Boolean(point) && requiredDistanceM !== null,
    staleTime: 5 * 60_000,
  });
}
