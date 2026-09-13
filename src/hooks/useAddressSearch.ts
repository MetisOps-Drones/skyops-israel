"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ISRAEL_MAP_CENTER } from "@/lib/constants/airspace-zones";

export interface AddressSuggestion {
  id: string;
  placeName: string;
  point: [number, number];
}

/** Debounces the raw typed query so we don't fire a geocoding request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Mapbox forward geocoding, scoped to Israel/Hebrew — lets a dispatcher jump
 * the map to an address instead of scrolling/zooming manually to find it,
 * and doubles as a keyboard-reachable way to inspect a location (the map
 * click itself has no keyboard equivalent).
 */
export function useAddressSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 300);

  return useQuery({
    queryKey: ["address_search", debounced],
    queryFn: async (): Promise<AddressSuggestion[]> => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) return [];
      const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(debounced)}.json`);
      url.searchParams.set("access_token", token);
      url.searchParams.set("country", "il,ps");
      url.searchParams.set("language", "he");
      url.searchParams.set("limit", "5");
      url.searchParams.set("proximity", `${ISRAEL_MAP_CENTER[0]},${ISRAEL_MAP_CENTER[1]}`);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Geocoding request failed");
      const data = await res.json();
      const features = (data.features ?? []) as Array<{ id: string; place_name: string; center: [number, number] }>;
      return features.map((f) => ({ id: f.id, placeName: f.place_name, point: f.center }));
    },
    enabled: debounced.length >= 3,
    staleTime: 60_000,
  });
}
