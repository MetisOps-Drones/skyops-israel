"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { resolveCoordinationLimit, periodStart, fetchMyCoordinationOverride, type CoordinationLimit } from "@/lib/coordination-quota";

export interface CoordinationQuotaStatus {
  /** null = unlimited (org account or dispatcher_admin) — nothing else in this object is meaningful then. */
  limit: CoordinationLimit | null;
  used: number;
  complexUsed: number;
}

/**
 * How many of this period's flight-request quota the signed-in pilot has
 * already used — drives both the FlightParamsDrawer submit-time display and
 * its client-side block, mirroring the authoritative check in
 * actions/flight-requests.ts (that one can't be skipped by a stale client;
 * this one is just so the UI doesn't let someone fill out the whole form
 * before finding out).
 */
export function useCoordinationQuota() {
  return useQuery({
    queryKey: ["coordination_quota"],
    queryFn: async (): Promise<CoordinationQuotaStatus> => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return { limit: null, used: 0, complexUsed: 0 };

      const [{ data: profile }, override] = await Promise.all([
        supabase.from("profiles").select("role, org_id, plan_code").eq("id", user.id).single(),
        fetchMyCoordinationOverride(supabase),
      ]);
      const limit = resolveCoordinationLimit({
        role: profile?.role ?? null,
        hasOrg: Boolean(profile?.org_id),
        planCode: profile?.plan_code ?? null,
        override,
      });
      if (!limit) return { limit: null, used: 0, complexUsed: 0 };

      const since = periodStart(limit.period);
      const { data: requests, error } = await supabase
        .from("flight_requests")
        .select("request_type")
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .gte("created_at", since.toISOString());
      if (error) throw error;

      const used = requests?.length ?? 0;
      const complexUsed = (requests ?? []).filter((r) => r.request_type === "manual_notam_bubble").length;
      return { limit, used, complexUsed };
    },
  });
}
