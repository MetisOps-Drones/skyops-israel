"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export type AirspaceZone = Pick<
  Tables<"airspace_zones">,
  "id" | "name" | "type" | "min_altitude_m" | "max_altitude_m" | "geom_geojson" | "active_schedule"
>;

/**
 * The real airspace_zones table — the same rows `find_intersecting_zones`
 * (the authoritative server-side check in src/actions/flight-requests.ts)
 * queries via PostGIS. The map renders these directly and the client-side
 * clearance check (useAirspaceCheck) intersects against them with turf, so
 * there is exactly one set of zone geometry in the app, not a hand-maintained
 * mirror that can drift from what the server actually enforces.
 */
export function useAirspaceZones() {
  return useQuery({
    queryKey: ["airspace_zones"],
    queryFn: async (): Promise<AirspaceZone[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("airspace_zones")
        .select("id, name, type, min_altitude_m, max_altitude_m, geom_geojson, active_schedule");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
