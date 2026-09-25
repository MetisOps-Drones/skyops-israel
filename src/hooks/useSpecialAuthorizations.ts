"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { requestGovernmentValidation } from "@/actions/government-validation";
import type { Tables } from "@/lib/types/database.types";

export type SpecialAuthorizationType = Tables<"special_authorization_types">;
export type UserSpecialAuthorization = Tables<"user_special_authorizations"> & {
  special_authorization_types: Pick<SpecialAuthorizationType, "id" | "name" | "description" | "price_ils"> | null;
};

/** The catalog an admin populates with real רת"א permit categories — starts empty until they do. */
export function useSpecialAuthorizationTypes() {
  return useQuery({
    queryKey: ["special_authorization_types"],
    queryFn: async (): Promise<SpecialAuthorizationType[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("special_authorization_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useMySpecialAuthorizations() {
  return useQuery({
    queryKey: ["user_special_authorizations", "mine"],
    queryFn: async (): Promise<UserSpecialAuthorization[]> => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_special_authorizations")
        .select("*, special_authorization_types ( id, name, description, price_ils )")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as UserSpecialAuthorization[];
    },
  });
}

/**
 * Demo purchase — same stand-in pattern as PaywallScreen/useCreateOrganization
 * until a real payment processor is wired in. Marks the row "active" directly
 * instead of going through a checkout redirect, and there's no email
 * provider yet (see src/lib/notifications/sms.ts for the one provider
 * integration that does exist) so the "file arrives by email" step is not
 * actually triggered here.
 */
export function usePurchaseSpecialAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (authorizationTypeId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");

      const { data, error } = await supabase
        .from("user_special_authorizations")
        .insert({
          user_id: user.id,
          authorization_type_id: authorizationTypeId,
          status: "active",
          purchased_at: new Date().toISOString(),
        })
        .select("*, special_authorization_types ( name, regulation_number )")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (authorization) => {
      queryClient.invalidateQueries({ queryKey: ["user_special_authorizations"] });
      const type = authorization.special_authorization_types as unknown as {
        name: string;
        regulation_number: string | null;
      } | null;
      requestGovernmentValidation({
        entityType: "special_authorization",
        entityId: authorization.id,
        submittedValue: type?.regulation_number ?? type?.name ?? authorization.authorization_type_id,
      }).catch(() => {});
    },
  });
}
