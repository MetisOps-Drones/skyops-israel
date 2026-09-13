"use client";

import { useQuery } from "@tanstack/react-query";

export type WeatherConditions = {
  temp_c: number | null;
  wind_speed_ms: number | null;
  wind_gust_ms: number | null;
  wind_deg: number | null;
  visibility_m: number | null;
  precipitation: boolean;
  description: string | null;
  icon: string | null;
  elevation_m: number | null;
};

/** [lng, lat] tuple, matching the GeoJSON order used everywhere else in the map code. */
export function useWeather(center: [number, number] | null) {
  return useQuery({
    queryKey: ["weather", center?.[0], center?.[1]],
    queryFn: async (): Promise<WeatherConditions> => {
      const [lng, lat] = center!;
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lng}`);
      if (!res.ok) throw new Error("שליפת מזג האוויר נכשלה");
      return res.json();
    },
    enabled: Boolean(center),
    staleTime: 10 * 60_000,
  });
}
