"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export function useMyDocumentsByKind(kind: Tables<"documents">["kind"]) {
  return useQuery({
    queryKey: ["documents", kind],
    queryFn: async (): Promise<Tables<"documents">[]> => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return [];
      // "Dispatcher admins read all documents" is a separate permissive
      // SELECT policy — without this filter a dispatcher_admin's own
      // documents list returned every pilot's uploaded documents.
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("kind", kind)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyIdentityVerifications() {
  return useQuery({
    queryKey: ["identity_verifications"],
    queryFn: async (): Promise<Tables<"identity_verifications">[]> => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return [];
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateIdentityVerification() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["identity_verifications"] });
  };
}
