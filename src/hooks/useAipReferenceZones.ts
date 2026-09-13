"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export type AipReferenceZone = Tables<"aip_reference_zones">;

/**
 * Advisory-only overlay digitized from the official CAAI CVFR low-level
 * transit charts (North sheet ed. 1/23, South sheet ed. 2/25) — approximate
 * circles, not surveyed boundaries. Never used for the automated clearance
 * check (see 0023_aip_reference_zones.sql for why); purely a visual/lookup
 * aid rendered behind its own toggle in the map's layer control.
 */
export function useAipReferenceZones() {
  return useQuery({
    queryKey: ["aip_reference_zones"],
    queryFn: async (): Promise<AipReferenceZone[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("aip_reference_zones").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60_000,
  });
}
