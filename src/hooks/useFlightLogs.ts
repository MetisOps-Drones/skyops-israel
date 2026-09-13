"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/lib/types/database.types";

export type FlightLogWithDrone = Tables<"flight_logs"> & {
  drones: Pick<Tables<"drones">, "id" | "nickname" | "model"> | null;
  clients: Pick<Tables<"clients">, "id" | "name"> | null;
};

export function useFlightLogs() {
  return useQuery({
    queryKey: ["flight_logs"],
    queryFn: async (): Promise<FlightLogWithDrone[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("flight_logs")
        .select("*, drones ( id, nickname, model ), clients ( id, name )")
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data as unknown as FlightLogWithDrone[];
    },
  });
}

/** Generates a share token if the log doesn't have one yet, and returns the token either way. */
export function useShareFlightLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string): Promise<string> => {
      const supabase = createClient();
      const { data: existing, error: readError } = await supabase
        .from("flight_logs")
        .select("share_token")
        .eq("id", logId)
        .single();
      if (readError) throw readError;
      if (existing.share_token) return existing.share_token;

      const token = crypto.randomUUID().replace(/-/g, "");
      const { error: updateError } = await supabase
        .from("flight_logs")
        .update({ share_token: token })
        .eq("id", logId);
      if (updateError) throw updateError;
      return token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight_logs"] });
    },
  });
}

export function useCreateFlightLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"flight_logs">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("flight_logs").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flight_logs"] });
      queryClient.invalidateQueries({ queryKey: ["drones"] });
      queryClient.invalidateQueries({ queryKey: ["batteries"] });
    },
  });
}
