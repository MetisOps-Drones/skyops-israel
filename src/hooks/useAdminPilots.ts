"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface VerifiablePilot {
  id: string;
  full_name: string;
  phone: string | null;
  professional_category: string | null;
  freelance_available: boolean;
  is_verified_pilot: boolean;
  verified_at: string | null;
}

/** Every pro pilot, for the dispatcher_admin verification screen (RLS: "Dispatcher admins read every profile"). */
export function useVerifiablePilots() {
  return useQuery({
    queryKey: ["admin_pilots"],
    queryFn: async (): Promise<VerifiablePilot[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, professional_category, freelance_available, is_verified_pilot, verified_at")
        .eq("role", "pilot_pro")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSetPilotVerified() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { pilot_id: string; verified: boolean }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          is_verified_pilot: input.verified,
          verified_at: input.verified ? new Date().toISOString() : null,
          verified_by: input.verified ? (user?.id ?? null) : null,
        })
        .eq("id", input.pilot_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pilots"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_freelancers"] });
    },
  });
}
