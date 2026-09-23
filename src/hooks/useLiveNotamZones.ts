"use client";

import { useQuery } from "@tanstack/react-query";
import type { LiveNotam } from "@/lib/notams/live-feed";

/**
 * Live Israeli NOTAMs (github.com/arielf-idra/notam-isr, refreshed ~10 min
 * at the source) via our own /api/notams/live proxy — see
 * src/lib/notams/live-feed.ts for the full source/caveats. Polled the same
 * cadence the source itself refreshes at, so this rarely serves data older
 * than the source's own.
 */
export function useLiveNotamZones() {
  return useQuery({
    queryKey: ["live_notam_zones"],
    queryFn: async (): Promise<LiveNotam[]> => {
      const res = await fetch("/api/notams/live");
      const body = (await res.json()) as { notams: LiveNotam[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "שגיאה בטעינת נוטאמים");
      return body.notams;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
