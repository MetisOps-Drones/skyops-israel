"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";
import type { CoordinationPeriod } from "@/lib/coordination-quota";

export interface AdminOrganizationRow {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  drone_count: number;
  flight_request_count_30d: number;
}

/** "כל הארגונים" — platform-wide, admin-only. RLS already grants dispatcher_admin the underlying reads; the RPC just does the aggregation in one round trip. */
export function useAdminOrganizations(enabled: boolean) {
  return useQuery({
    queryKey: ["admin_organizations"],
    queryFn: async (): Promise<AdminOrganizationRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_organizations_overview");
      if (error) throw error;
      return data;
    },
    enabled,
  });
}

export type AdminUserRow = Tables<"profiles"> & {
  organizations: Pick<Tables<"organizations">, "name"> | null;
};

/** "כל המשתמשים" — every profile on the platform, admin-only. Plain query: profiles RLS already gives dispatcher_admin unrestricted SELECT (0011). */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin_users"],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*, organizations!profiles_org_id_fkey ( name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AdminUserRow[];
    },
    enabled,
  });
}

/** Sets a user's plan_code directly — the "what type of subscription are they on" control. Relies on the "Dispatcher admins update any profile" RLS policy (0049); no billing processor behind it, same demo-checkout convention as the self-serve PlanCatalog. */
export function useAdminSetUserPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; plan_code: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ plan_code: input.plan_code }).eq("id", input.user_id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_users"] }),
  });
}

export type AdminQuotaOverrideRow = Tables<"coordination_quota_overrides">;

/** Every admin-set quota override, keyed by user_id — a separate table from profiles on purpose (see 0085): its note/set_by/set_at must never ride along on a user's own `select("*")` on their profile, so it lives somewhere only dispatcher_admin can read at all. */
export function useAdminQuotaOverrides(enabled: boolean) {
  return useQuery({
    queryKey: ["admin_quota_overrides"],
    queryFn: async (): Promise<AdminQuotaOverrideRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("coordination_quota_overrides").select("*");
      if (error) throw error;
      return data;
    },
    enabled,
  });
}

/** Creates/updates/removes a user's quota override. `override: null` removes it (the user falls back to their plan's own limit). */
export function useAdminSetQuotaOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      override: { count: number; period: CoordinationPeriod; complexAllowed: number; note: string } | null;
    }) => {
      const supabase = createClient();
      if (input.override === null) {
        const { error } = await supabase.from("coordination_quota_overrides").delete().eq("user_id", input.user_id);
        if (error) throw error;
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("coordination_quota_overrides").upsert({
        user_id: input.user_id,
        override_count: input.override.count,
        override_period: input.override.period,
        override_complex_allowed: input.override.complexAllowed,
        note: input.override.note || null,
        set_by: user?.id ?? null,
        set_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_quota_overrides"] }),
  });
}
