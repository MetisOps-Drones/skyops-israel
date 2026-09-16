"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export type AipReferenceZone = Tables<"aip_reference_zones">;

/**
 * Reference zone layer — most rows now carry real polygon boundaries from
 * the official AIP (see 0037_a17_official_geometry_rebuild.sql; a handful
 * of codes still fall back to an approximate circle, see that migration's
 * notes). Despite the historical "advisory-only" framing in 0023, this DOES
 * feed the real authorization-block check (flight-rules.ts's
 * checkFlightAuthorizationRequirement) — it has no live NOTAM feed and
 * isn't a substitute for official pre-flight verification, but its
 * geometry is not merely a visual aid.
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
