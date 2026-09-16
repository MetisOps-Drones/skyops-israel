"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, CoordinationContactStatus } from "@/lib/types/database.types";

export type CoordinationAuthority = Tables<"coordination_authorities">;
export type FlightRequestCoordination = Tables<"flight_request_coordination">;

/** Admin-only directory (RLS gated to is_dispatcher_admin() — see 0072). Listed for the "ניהול גורמי תיאום" admin screen. */
export function useCoordinationAuthorities() {
  return useQuery({
    queryKey: ["coordination_authorities"],
    queryFn: async (): Promise<CoordinationAuthority[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("coordination_authorities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCoordinationAuthority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      unit_type: string;
      phone: string;
      backup_phone: string | null;
      notes: string | null;
      center_lng: number;
      center_lat: number;
      radius_m: number;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("coordination_authorities").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordination_authorities"] });
    },
  });
}

export function useUpdateCoordinationAuthority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      unit_type: string;
      phone: string;
      backup_phone: string | null;
      notes: string | null;
      center_lng: number;
      center_lat: number;
      radius_m: number;
    }) => {
      const supabase = createClient();
      const { id, ...rest } = input;
      const { error } = await supabase.from("coordination_authorities").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordination_authorities"] });
    },
  });
}

export function useDeleteCoordinationAuthority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("coordination_authorities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordination_authorities"] });
    },
  });
}

/** Point lookup for one request's center — RLS on the underlying table already restricts this to dispatcher_admin, so a non-admin caller just gets an empty array. */
export function useCoordinationAuthorityLookup(lng: number | null, lat: number | null) {
  return useQuery({
    queryKey: ["coordination_authorities", "lookup", lng, lat],
    queryFn: async (): Promise<CoordinationAuthority[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("find_coordination_authority", { lng: lng!, lat: lat! });
      if (error) throw error;
      return data;
    },
    enabled: lng !== null && lat !== null,
  });
}

/** The external-coordination tracking row for one flight request — null until the dispatcher first touches its status/notes. */
export function useFlightRequestCoordination(flightRequestId: string | null) {
  return useQuery({
    queryKey: ["flight_request_coordination", flightRequestId],
    queryFn: async (): Promise<FlightRequestCoordination | null> => {
      if (!flightRequestId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("flight_request_coordination")
        .select("*")
        .eq("flight_request_id", flightRequestId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(flightRequestId),
  });
}

export function useUpsertFlightRequestCoordination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      flight_request_id: string;
      authority_id: string | null;
      status: CoordinationContactStatus;
      notes: string | null;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase
        .from("flight_request_coordination")
        .upsert({ ...input, updated_by: user.id }, { onConflict: "flight_request_id" });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["flight_request_coordination", variables.flight_request_id] });
    },
  });
}
