"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

/** RLS returns the caller's own clients plus any their active org shares — no manual filtering needed. */
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Tables<"clients">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name: string; phone?: string | null; notes?: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("clients")
        .update({ name: input.name, phone: input.phone ?? null, notes: input.notes ?? null })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["flight_logs"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["flight_logs"] });
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; phone?: string; notes?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      const { data, error } = await supabase
        .from("clients")
        .insert({
          owner_id: user.id,
          org_id: profile?.org_id ?? null,
          name: input.name,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
