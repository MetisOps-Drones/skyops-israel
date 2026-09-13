"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/lib/types/database.types";

export type MaintenanceLogWithDrone = Tables<"drone_maintenance_log"> & {
  drones: Pick<Tables<"drones">, "id" | "nickname"> | null;
};

export function useMaintenanceLog() {
  return useQuery({
    queryKey: ["drone_maintenance_log"],
    queryFn: async (): Promise<MaintenanceLogWithDrone[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("drone_maintenance_log")
        .select("*, drones ( id, nickname )")
        .order("performed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as MaintenanceLogWithDrone[];
    },
  });
}

export function useAddMaintenanceLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"drone_maintenance_log">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("drone_maintenance_log").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drone_maintenance_log"] });
      queryClient.invalidateQueries({ queryKey: ["drones"] });
    },
  });
}

export function useInventory() {
  return useQuery({
    queryKey: ["inventory_items"],
    queryFn: async (): Promise<Tables<"inventory_items">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("inventory_items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"inventory_items">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("inventory_items").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    },
  });
}

export function useAdjustInventoryQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, quantity_on_hand }: { id: string; quantity_on_hand: number }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inventory_items")
        .update({ quantity_on_hand })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    },
  });
}

export function useAddBatteryReading() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TablesInsert<"battery_readings">) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("battery_readings").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batteries"] });
      queryClient.invalidateQueries({ queryKey: ["batteries", "all"] });
    },
  });
}
