"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database.types";

export interface EquipmentRate {
  name: string;
  price_ils: number;
}

export interface PilotPricing {
  pilot_id: string;
  hourly_rate_ils: number | null;
  daily_rate_ils: number | null;
  equipment_rates: EquipmentRate[];
}

/**
 * The pilot's own rate card. Deliberately never fetched through the
 * marketplace-browse RPCs and never given a policy that lets an org read
 * it directly — prices stay private, negotiated in-chat once a booking is
 * open (see 0059_pilot_pricing_and_portfolio.sql).
 */
export function useMyPilotPricing() {
  return useQuery({
    queryKey: ["pilot_pricing", "mine"],
    queryFn: async (): Promise<PilotPricing | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from("pilot_pricing").select("*").eq("pilot_id", user.id).maybeSingle();
      if (error) throw error;
      return data as PilotPricing | null;
    },
  });
}

export function useUpdatePilotPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { hourly_rate_ils: number | null; daily_rate_ils: number | null; equipment_rates: EquipmentRate[] }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase.from("pilot_pricing").upsert({
        pilot_id: user.id,
        hourly_rate_ils: input.hourly_rate_ils,
        daily_rate_ils: input.daily_rate_ils,
        equipment_rates: input.equipment_rates as unknown as Json,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilot_pricing"] });
    },
  });
}
