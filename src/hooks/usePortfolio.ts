"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getPortfolioSignedUrls, deletePortfolioItem } from "@/actions/portfolio";
import type { Tables } from "@/lib/types/database.types";

export type PortfolioItem = Tables<"portfolio_items">;

export function useMyPortfolioItems() {
  return useQuery({
    queryKey: ["portfolio_items", "mine"],
    queryFn: async (): Promise<PortfolioItem[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("pilot_id", user.id)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Another pilot's showcase — org accounts (and the pilot themself) can read these rows per 0059's RLS. */
export function usePilotPortfolioItems(pilotId: string | null) {
  return useQuery({
    queryKey: ["portfolio_items", pilotId],
    queryFn: async (): Promise<PortfolioItem[]> => {
      if (!pilotId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("pilot_id", pilotId)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(pilotId),
  });
}

/** Signed URLs (bucket is private) for a set of storage paths, keyed by path. */
export function usePortfolioSignedUrls(storagePaths: string[]) {
  const key = storagePaths.slice().sort().join(",");
  return useQuery({
    queryKey: ["portfolio_signed_urls", key],
    queryFn: () => getPortfolioSignedUrls(storagePaths),
    enabled: storagePaths.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeletePortfolioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; storagePath: string }) => {
      const result = await deletePortfolioItem(input.id, input.storagePath);
      if (!result.success) throw new Error(result.error ?? "המחיקה נכשלה");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio_items"] });
    },
  });
}
