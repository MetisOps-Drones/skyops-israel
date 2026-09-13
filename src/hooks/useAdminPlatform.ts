"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

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
