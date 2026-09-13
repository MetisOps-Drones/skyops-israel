"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createApiKeyAction, revokeApiKeyAction, setLayerOverrideAction } from "@/actions/api-keys";
import type { ApiLayer, Tables } from "@/lib/types/database.types";

export function useApiKeys() {
  return useQuery({
    queryKey: ["api_keys"],
    queryFn: async (): Promise<Tables<"api_keys">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ layer, label }: { layer: ApiLayer; label: string }) => createApiKeyAction(layer, label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api_keys"] }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => revokeApiKeyAction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api_keys"] }),
  });
}

export function useLayerOverrides() {
  return useQuery({
    queryKey: ["layer_source_overrides"],
    queryFn: async (): Promise<Tables<"layer_source_overrides">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("layer_source_overrides").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useSetLayerOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ layer, overrideUrl }: { layer: ApiLayer; overrideUrl: string | null }) =>
      setLayerOverrideAction(layer, overrideUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layer_source_overrides"] }),
  });
}
