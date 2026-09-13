"use client";

import { useQuery } from "@tanstack/react-query";

/** [lng, lat] tuple, matching the GeoJSON order used everywhere else in the map code. */
export function useReverseGeocode(point: [number, number] | null) {
  return useQuery({
    queryKey: ["reverse_geocode", point?.[0]?.toFixed(3), point?.[1]?.toFixed(3)],
    queryFn: async (): Promise<string | null> => {
      const [lng, lat] = point!;
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&types=place&language=he&access_token=${token}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.features?.[0]?.properties?.name ?? null;
    },
    enabled: Boolean(point),
    // City names don't change — safe to hold in memory for the whole session.
    // (Mapbox's terms say this response may not be *retained* — we only ever
    // cache it in browser memory via TanStack Query, never persist it.)
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
