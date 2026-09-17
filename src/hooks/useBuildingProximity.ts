"use client";

import { useQuery } from "@tanstack/react-query";

export type BuildingProximityResult = { available: boolean; isNearBuilding: boolean; bufferM: number };

/**
 * Authoritative building check — calls /api/building-proximity, backed by
 * the pre-computed R2 bitmap grid (src/lib/geo/proximity-grid.ts) built
 * from the full VIDA/Overture buildings dataset (~3.5M footprints).
 *
 * NOT the `buildings` Postgres table / buildings_near_point RPC
 * (0075/0076): that table was created for an earlier approach and was
 * never loaded with data — the full dataset doesn't fit Supabase's
 * free-tier storage, which is exactly why it was pivoted to R2 static
 * tiles/grids instead. A check against that table always returns "no
 * building nearby", so it must not be used as the source of truth here.
 */
export function useBuildingProximity(point: [number, number] | null, requiredDistanceM: number | null) {
  return useQuery({
    queryKey: ["building_proximity", point?.[0], point?.[1], requiredDistanceM],
    queryFn: async (): Promise<BuildingProximityResult> => {
      const [lng, lat] = point!;
      const res = await fetch(
        `/api/building-proximity?lat=${lat}&lon=${lng}&bufferM=${requiredDistanceM}`
      );
      if (!res.ok) {
        console.error("building-proximity request failed:", res.status);
        return { available: false, isNearBuilding: false, bufferM: requiredDistanceM! };
      }
      return (await res.json()) as BuildingProximityResult;
    },
    enabled: Boolean(point) && requiredDistanceM !== null,
    staleTime: 5 * 60_000,
  });
}
