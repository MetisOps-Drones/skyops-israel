"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProximityFinding } from "@/lib/geo/proximity-check";

export type ProximityCheckResult = {
  available: boolean;
  findings: ProximityFinding[];
};

/**
 * Generic proximity rules (residential areas, aviation sports sites, power
 * stations, prisons, police, stadiums) via OpenStreetMap/Overpass — see
 * src/app/api/proximity-check/route.ts. `available: false` means the
 * Overpass service didn't answer, not that the point is clear — callers
 * should treat that as "unknown", not "safe".
 */
export function useProximityCheck(point: [number, number] | null) {
  return useQuery({
    queryKey: ["proximity_check", point?.[0], point?.[1]],
    queryFn: async (): Promise<ProximityCheckResult> => {
      const [lng, lat] = point!;
      const res = await fetch(`/api/proximity-check?lat=${lat}&lon=${lng}`);
      if (!res.ok) return { available: false, findings: [] };
      return res.json();
    },
    enabled: Boolean(point),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
