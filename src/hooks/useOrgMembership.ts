"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export type MembershipWithOrg = Tables<"organization_members"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name"> | null;
};

export type MembershipWithProfile = Tables<"organization_members"> & {
  profiles: Pick<Tables<"profiles">, "id" | "full_name" | "phone" | "role"> | null;
};

/** Every org this person belongs to (any status), for the org switcher and their own request history. */
export function useMyMemberships() {
  return useQuery({
    queryKey: ["organization_members", "mine"],
    queryFn: async (): Promise<MembershipWithOrg[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("organization_members")
        .select("*, organizations ( id, name )")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MembershipWithOrg[];
    },
  });
}

/** Pending join requests for the org a fleet manager currently has active. */
export function usePendingMembershipRequests(orgId: string | null) {
  return useQuery({
    queryKey: ["organization_members", "pending", orgId],
    queryFn: async (): Promise<MembershipWithProfile[]> => {
      if (!orgId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organization_members")
        .select("*, profiles!organization_members_user_id_fkey ( id, full_name, phone, role )")
        .eq("org_id", orgId)
        .eq("status", "pending")
        .order("added_at", { ascending: true });
      if (error) throw error;
      return data as unknown as MembershipWithProfile[];
    },
    enabled: Boolean(orgId),
  });
}

export function useJoinOrgByCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const supabase = createClient();
      const { data: org, error: lookupError } = await supabase
        .rpc("find_organization_by_invite_code", { code: inviteCode })
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!org) throw new Error("לא נמצא ארגון עם קוד הזמנה זה");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");

      const { error } = await supabase
        .from("organization_members")
        .insert({ org_id: org.id, user_id: user.id, status: "pending" });
      if (error) throw error;
      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_members"] });
    },
  });
}

export function useSwitchActiveOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase.from("profiles").update({ org_id: orgId }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_org_context"] });
      queryClient.invalidateQueries({ queryKey: ["drones"] });
      queryClient.invalidateQueries({ queryKey: ["equipment_handoffs"] });
    },
  });
}

/** Creates a brand-new organization with the caller as its fleet manager — the "direct upgrade to organization" paid tier on /profile. */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgName: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_organization_as_owner", { org_name: orgName });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_org_context"] });
      queryClient.invalidateQueries({ queryKey: ["my_global_role"] });
      queryClient.invalidateQueries({ queryKey: ["organization_members"] });
    },
  });
}

/** Active roster of an org — everyone a fleet manager can currently see and remove. */
export function useActiveOrgMembers(orgId: string | null) {
  return useQuery({
    queryKey: ["organization_members", "active", orgId],
    queryFn: async (): Promise<MembershipWithProfile[]> => {
      if (!orgId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organization_members")
        .select("*, profiles!organization_members_user_id_fkey ( id, full_name, phone, role )")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("added_at", { ascending: true });
      if (error) throw error;
      return data as unknown as MembershipWithProfile[];
    },
    enabled: Boolean(orgId),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { org_id: string; user_id: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("organization_members")
        .update({
          status: "removed",
          decided_at: new Date().toISOString(),
          decided_by: user?.id ?? null,
        })
        .eq("org_id", input.org_id)
        .eq("user_id", input.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_members"] });
    },
  });
}

export function useDecideMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { org_id: string; user_id: string; approve: boolean; role?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("organization_members")
        .update({
          status: input.approve ? "active" : "rejected",
          role: input.approve ? (input.role as Tables<"organization_members">["role"]) : null,
          decided_at: new Date().toISOString(),
          decided_by: user?.id ?? null,
        })
        .eq("org_id", input.org_id)
        .eq("user_id", input.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_members"] });
    },
  });
}
