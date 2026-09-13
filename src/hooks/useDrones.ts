"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { requestGovernmentValidation } from "@/actions/government-validation";
import type { Tables, TablesInsert } from "@/lib/types/database.types";

export function useDrones() {
  return useQuery({
    queryKey: ["drones"],
    queryFn: async (): Promise<Tables<"drones">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("drones").select("*").order("nickname");
      if (error) throw error;
      return data;
    },
  });
}

export function useDroneBatteries(droneId: string | null) {
  return useQuery({
    queryKey: ["batteries", droneId],
    queryFn: async (): Promise<Tables<"batteries">[]> => {
      if (!droneId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("batteries")
        .select("*")
        .eq("drone_id", droneId)
        .order("serial_number");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(droneId),
  });
}

export function useCreateDrone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"drones">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("drones").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (drone) => {
      queryClient.invalidateQueries({ queryKey: ["drones"] });
      // Fire-and-forget: registration lookup has no live government endpoint
      // yet (see src/lib/government-validation), so this just opens the
      // validation-request trail — never blocks drone creation on it.
      if (drone.registration_number) {
        requestGovernmentValidation({
          entityType: "drone_registration",
          entityId: drone.id,
          submittedValue: drone.registration_number,
        }).catch(() => {});
      }
    },
  });
}

/**
 * Extends a drone's CAAI registration by another 4 years — תקנות הטיס:
 * "בעלים רשום רשאי לבקש להאריך את תוקפה של תעודת הרישום לתקופות נוספות של
 * 4 שנים." Extends from the later of (today, current expiry) so a timely
 * renewal keeps the original expiry rhythm, while a lapsed one restarts
 * from today rather than compounding the gap.
 */
export function useRenewDroneRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { droneId: string; currentExpiresAt: string | null }) => {
      const base = input.currentExpiresAt ? new Date(input.currentExpiresAt) : new Date();
      const today = new Date();
      const from = base > today ? base : today;
      const newExpiry = new Date(from);
      newExpiry.setFullYear(newExpiry.getFullYear() + 4);

      const supabase = createClient();
      const { error } = await supabase
        .from("drones")
        .update({ registration_expires_at: newExpiry.toISOString().slice(0, 10) })
        .eq("id", input.droneId);
      if (error) throw error;
      return newExpiry.toISOString().slice(0, 10);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drones"] });
    },
  });
}

export function useCreateBattery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"batteries">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("batteries").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["batteries", variables.drone_id] });
    },
  });
}
