"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

/** The caller's own marketplace pilot-profile row, if they've ever saved one. */
export function useMyPilotProfile() {
  return useQuery({
    queryKey: ["pilot_profile", "mine"],
    queryFn: async (): Promise<Tables<"pilot_profiles"> | null> => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return null;
      const { data, error } = await supabase.from("pilot_profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export interface PilotProfileInput {
  headline: string | null;
  years_experience: number | null;
  drone_models: string[];
  uav_categories: string[];
  flight_modes: string[];
  skills: string[];
  software: string[];
  specializations: string[];
  service_areas: string[];
}

export function useUpdatePilotProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PilotProfileInput) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase
        .from("pilot_profiles")
        .upsert({ id: user.id, ...input, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilot_profile"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_freelancers"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_pilot_profile"] });
    },
  });
}
