"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";
import { publishNotam, rejectFlightRequest } from "@/actions/notam";
import type { PublishNotamInput, RejectFlightRequestInput } from "@/lib/validations/flight-request";

export type FlightRequestWithRelations = Tables<"flight_requests"> & {
  profiles: Pick<Tables<"profiles">, "id" | "full_name" | "phone"> | null;
  drones: Pick<Tables<"drones">, "id" | "nickname" | "model" | "registration_number" | "mtow_grams"> | null;
};

/** Pilot-facing: only the signed-in user's own requests (RLS also enforces this). */
export function useMyFlightRequests() {
  return useQuery({
    queryKey: ["flight_requests", "mine"],
    queryFn: async (): Promise<FlightRequestWithRelations[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("flight_requests")
        .select(
          "*, profiles!flight_requests_user_id_fkey ( id, full_name, phone ), drones ( id, nickname, model, registration_number, mtow_grams )"
        )
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data as unknown as FlightRequestWithRelations[];
    },
    refetchInterval: 30_000,
  });
}

/** Dispatcher-facing (Module B): every pending/active coordination request, newest first. */
export function usePendingCoordinationRequests() {
  return useQuery({
    queryKey: ["flight_requests", "pending"],
    queryFn: async (): Promise<FlightRequestWithRelations[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("flight_requests")
        .select(
          "*, profiles!flight_requests_user_id_fkey ( id, full_name, phone ), drones ( id, nickname, model, registration_number, mtow_grams )"
        )
        .in("status", ["pending_dispatcher", "submitted_to_iaf"])
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as unknown as FlightRequestWithRelations[];
    },
    refetchInterval: 30_000,
  });
}

const ADMIN_MAP_STATUSES = ["pending_dispatcher", "submitted_to_iaf", "notam_published", "auto_cleared"] as const;

export type ControlTowerFlightRequest = Tables<"flight_requests"> & {
  profiles: (Pick<Tables<"profiles">, "id" | "full_name" | "org_id"> & {
    organizations: Pick<Tables<"organizations">, "name"> | null;
  }) | null;
};

/**
 * "Control tower" view: every active/pending coordination the signed-in
 * user is allowed to see beyond their own, not filtered to just the
 * requester — the map layer this drives is how a dispatcher_admin sees the
 * whole platform's airspace picture at once, or a fleet_manager sees their
 * whole team's, instead of one row at a time. This is a plain query, not a
 * security-definer RPC — RLS itself decides the actual scope per caller
 * (dispatcher_admin gets everything, an org member gets their own org via
 * 0011/0077), so the same query naturally returns different result sets for
 * different callers without the client needing to know which case it is.
 */
export function useControlTowerFlightRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["flight_requests", "control_tower"],
    queryFn: async (): Promise<ControlTowerFlightRequest[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("flight_requests")
        .select(
          "*, profiles!flight_requests_user_id_fkey ( id, full_name, org_id, organizations!profiles_org_id_fkey ( name ) )"
        )
        .in("status", ADMIN_MAP_STATUSES)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as unknown as ControlTowerFlightRequest[];
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export interface OverlappingFlightRequest {
  id: string;
  user_id: string;
  full_name: string;
  org_id: string | null;
  org_name: string | null;
  status: Tables<"flight_requests">["status"];
  start_time: string;
  end_time: string;
}

/** Deconfliction check for one request — other pilots' requests whose time window and footprint overlap it. Admin-only (enforced server-side too). */
export function useOverlappingFlightRequests(requestId: string | null) {
  return useQuery({
    queryKey: ["flight_requests", "overlaps", requestId],
    queryFn: async (): Promise<OverlappingFlightRequest[]> => {
      if (!requestId) return [];
      const supabase = createClient();
      const { data, error } = await supabase.rpc("overlapping_flight_requests", { target_id: requestId });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(requestId),
  });
}

export function usePublishNotam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PublishNotamInput) => publishNotam(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight_requests"] });
    },
  });
}

export function useRejectFlightRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RejectFlightRequestInput) => rejectFlightRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight_requests"] });
    },
  });
}
