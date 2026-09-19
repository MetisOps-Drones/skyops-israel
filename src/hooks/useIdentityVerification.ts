"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export function useMyDocumentsByKind(kind: Tables<"documents">["kind"]) {
  return useQuery({
    queryKey: ["documents", kind],
    queryFn: async (): Promise<Tables<"documents">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
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
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("*")
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
