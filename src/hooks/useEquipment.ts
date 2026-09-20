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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      // drone_maintenance_log has no user_id/org_id of its own — RLS scopes
      // it through the parent drone's ownership. That's fine for a regular
      // pilot, but "Dispatcher admins read all maintenance logs" is a
      // separate permissive SELECT policy, so an unfiltered select() for a
      // dispatcher_admin returned every drone's maintenance history instead
      // of just the drones this account can actually manage.
      const droneFilter = profile?.org_id
        ? `user_id.eq.${user.id},org_id.eq.${profile.org_id}`
        : `user_id.eq.${user.id}`;
      const { data: drones, error: dronesError } = await supabase.from("drones").select("id").or(droneFilter);
      if (dronesError) throw dronesError;
      const droneIds = (drones ?? []).map((d) => d.id);
      if (droneIds.length === 0) return [];
      const { data, error } = await supabase
        .from("drone_maintenance_log")
        .select("*, drones ( id, nickname )")
        .in("drone_id", droneIds)
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      // Mirrors the RLS scope a non-admin pilot already gets ("own inventory"
      // OR "org fleet") — "Dispatcher admins read all inventory" is a
      // separate permissive SELECT policy that otherwise leaks every org's
      // inventory into this account's own list.
      const ownerFilter = profile?.org_id
        ? `user_id.eq.${user.id},org_id.eq.${profile.org_id}`
        : `user_id.eq.${user.id}`;
      const { data, error } = await supabase.from("inventory_items").select("*").or(ownerFilter).order("name");
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
