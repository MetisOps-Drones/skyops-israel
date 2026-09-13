"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export type HandoffWithDrone = Tables<"equipment_handoffs"> & {
  drones: Pick<Tables<"drones">, "id" | "nickname" | "model" | "status"> | null;
};

/** The org's drones, for a contractor pilot deciding what to check out. */
export function useOrgDrones(orgId: string | null) {
  return useQuery({
    queryKey: ["drones", "org", orgId],
    queryFn: async (): Promise<Tables<"drones">[]> => {
      if (!orgId) return [];
      const supabase = createClient();
      const { data, error } = await supabase.from("drones").select("*").eq("org_id", orgId).order("nickname");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(orgId),
  });
}

/** Every drone in the org currently checked out to *anyone*, so a contractor can see what's actually free. */
export function useOrgActiveHandoffs(orgId: string | null) {
  return useQuery({
    queryKey: ["equipment_handoffs", "org_active", orgId],
    queryFn: async (): Promise<Tables<"equipment_handoffs">[]> => {
      if (!orgId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("equipment_handoffs")
        .select("*, drones!inner ( org_id )")
        .eq("status", "checked_out")
        .eq("drones.org_id", orgId);
      if (error) throw error;
      return data as unknown as Tables<"equipment_handoffs">[];
    },
    enabled: Boolean(orgId),
  });
}

export function useMyHandoffs() {
  return useQuery({
    queryKey: ["equipment_handoffs", "mine"],
    queryFn: async (): Promise<HandoffWithDrone[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("equipment_handoffs")
        .select("*, drones ( id, nickname, model, status )")
        .order("checked_out_at", { ascending: false });
      if (error) throw error;
      return data as unknown as HandoffWithDrone[];
    },
  });
}

export function useCheckOutDrone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      drone_id: string;
      user_id: string;
      checked_out_condition: "good" | "minor_issue" | "damaged";
      checked_out_notes?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("equipment_handoffs").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment_handoffs"] });
    },
  });
}

export function useCheckInDrone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      checked_in_condition: "good" | "minor_issue" | "damaged";
      checked_in_notes?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("equipment_handoffs")
        .update({ status: "returned", ...input })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment_handoffs"] });
      queryClient.invalidateQueries({ queryKey: ["drone_maintenance_log"] });
    },
  });
}
