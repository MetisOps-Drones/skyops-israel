"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type BuildingProximityResult = { available: boolean; isNearBuilding: boolean; bufferM: number };

/**
 * Authoritative building check — queries the real `buildings` table
 * (0067_buildings_layer.sql, ~3.5M footprints) via the buildings_near_point
 * RPC (0075), the same table that already backs the map's vector-tile
 * layer. Replaces an earlier approach that exported a separate static
 * bitmap grid to R2: that export was a second, unsynchronized copy of the
 * same data, and if it went stale or was never (re)generated the check had
 * nothing to read and silently came back "no building nearby." Querying
 * the table directly means there's exactly one buildings dataset, and
 * every required distance is checked exactly rather than snapped to a
 * precomputed bucket.
 */
export function useBuildingProximity(point: [number, number] | null, requiredDistanceM: number | null) {
  return useQuery({
    queryKey: ["building_proximity", point?.[0], point?.[1], requiredDistanceM],
    queryFn: async (): Promise<BuildingProximityResult> => {
      const [lng, lat] = point!;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("buildings_near_point", {
        lng,
        lat,
        distance_m: requiredDistanceM!,
      });
      if (error) {
        console.error("buildings_near_point failed:", error);
        return { available: false, isNearBuilding: false, bufferM: requiredDistanceM! };
      }
      return { available: true, isNearBuilding: data, bufferM: requiredDistanceM! };
    },
    enabled: Boolean(point) && requiredDistanceM !== null,
    staleTime: 5 * 60_000,
  });
}
