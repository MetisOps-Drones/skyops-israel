"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/lib/types/database.types";

export function useMyLicenses() {
  return useQuery({
    queryKey: ["pilot_licenses"],
    queryFn: async (): Promise<Tables<"pilot_licenses">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pilot_licenses")
        .select("*")
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Mirrors the insurance half of the server trigger (validate_flight_request_requirements) — see src/lib/validations/flight-request-requirements.ts. */
export function useHasValidInsurance() {
  return useQuery({
    queryKey: ["documents", "insurance_certificate", "valid"],
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("kind", "insurance_certificate")
        .not("ocr_extracted_expires_at", "is", null)
        .gte("ocr_extracted_expires_at", new Date().toISOString().slice(0, 10));
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

/** Dispatcher-facing (Module B): read another pilot's licenses. RLS's "Dispatcher admins read all licenses" policy gates this. */
export function usePilotLicensesForDispatcher(pilotUserId: string | null) {
  return useQuery({
    queryKey: ["pilot_licenses", "dispatcher-view", pilotUserId],
    queryFn: async (): Promise<Tables<"pilot_licenses">[]> => {
      if (!pilotUserId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pilot_licenses")
        .select("*")
        .eq("user_id", pilotUserId)
        .order("expires_at");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(pilotUserId),
  });
}

export function useCreateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"pilot_licenses">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("pilot_licenses").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilot_licenses"] });
    },
  });
}
