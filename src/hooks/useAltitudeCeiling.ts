"use client";

import { useQuery } from "@tanstack/react-query";

export interface AltitudeCeilingIngredients {
  terrainElevationM: number | null;
  cloudBase: {
    baseFtAgl: number | null;
    cover: string;
    stationId: string;
    stationName: string;
    stationDistanceKm: number;
    reportTime: string;
  } | null;
}

/** [lng, lat] tuple, matching the GeoJSON order used everywhere else in the map code. */
export function useAltitudeCeiling(point: [number, number] | null) {
  return useQuery({
    queryKey: ["altitude_ceiling", point?.[0]?.toFixed(3), point?.[1]?.toFixed(3)],
    queryFn: async (): Promise<AltitudeCeilingIngredients> => {
      const [lng, lat] = point!;
      const res = await fetch(`/api/altitude-ceiling?lat=${lat}&lon=${lng}`);
      if (!res.ok) throw new Error("שליפת נתוני גובה קרקע/עננים נכשלה");
      return res.json();
    },
    enabled: Boolean(point),
    // Terrain never changes; cloud base is only as fresh as the last METAR (~hourly) anyway.
    staleTime: 30 * 60_000,
  });
}
