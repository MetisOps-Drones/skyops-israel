"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export function useDronePlatformConnections() {
  return useQuery({
    queryKey: ["drone_platform_connections"],
    queryFn: async (): Promise<Tables<"drone_platform_connections">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("drone_platform_connections").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateDronePlatformConnections() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["drone_platform_connections"] });
    queryClient.invalidateQueries({ queryKey: ["flight_logs"] });
  };
}
