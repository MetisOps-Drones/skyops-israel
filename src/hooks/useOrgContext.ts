"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type MyOrgContext = {
  userId: string | null;
  orgId: string | null;
  orgName: string | null;
  inviteCode: string | null;
  /** The caller's role *within this org* (organization_members.role), not their global profile role. Null if they have no active org. */
  orgRole: string | null;
  /** Free-text job title/function within the org (e.g. "מגייסת", "מטיס ניסוי") — separate axis from orgRole, which stays permission-only. Null if unset or no active org. */
  orgPosition: string | null;
  isFleetManager: boolean;
};

/**
 * A person with an active org can be its fleet manager (full control over
 * the shared fleet) or a contractor pilot (borrows equipment, doesn't own
 * or manage it). The UI reads this to decide which of those two screens to
 * show — see LogsPageClient.
 */
export function useMyOrgContext() {
  return useQuery({
    queryKey: ["my_org_context"],
    queryFn: async (): Promise<MyOrgContext> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return {
          userId: null,
          orgId: null,
          orgName: null,
          inviteCode: null,
          orgRole: null,
          orgPosition: null,
          isFleetManager: false,
        };

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("org_id, organizations!profiles_org_id_fkey ( name, invite_code )")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile.org_id)
        return {
          userId: user.id,
          orgId: null,
          orgName: null,
          inviteCode: null,
          orgRole: null,
          orgPosition: null,
          isFleetManager: false,
        };

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("role, position")
        .eq("org_id", profile.org_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError) throw membershipError;

      const org = profile.organizations as unknown as { name: string; invite_code: string } | null;
      return {
        userId: user.id,
        orgId: profile.org_id,
        orgName: org?.name ?? null,
        inviteCode: org?.invite_code ?? null,
        orgRole: membership?.role ?? null,
        orgPosition: membership?.position ?? null,
        isFleetManager: membership?.role === "fleet_manager",
      };
    },
  });
}

/** The caller's global platform role (dispatcher_admin is platform-wide, unlike org-scoped fleet_manager). */
export function useMyGlobalRole() {
  return useQuery({
    queryKey: ["my_global_role"],
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (error) throw error;
      return data.role;
    },
  });
}

/** Free self-serve switch between the two solo account types (hobby <-> private business/freelancer). Never used for the organization tier — that's paid and goes through useCreateOrganization. */
export function useSwitchToProAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: "pilot_hobby" | "pilot_pro") => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_global_role"] });
    },
  });
}
