const UNSAFE_WIND_MS = 12;
const CAUTION_WIND_MS = 8;

/** Extracted out of WeatherPanel.tsx (a "use client" component) so server-side code — the recommended-flight-window notification job — can reuse the exact same thresholds instead of drifting out of sync with what the map itself shows as safe/caution/unsafe. */
export function windSafety(windSpeedMs: number | null, precipitation: boolean) {
  if (windSpeedMs === null) return "unknown" as const;
  if (precipitation || windSpeedMs >= UNSAFE_WIND_MS) return "unsafe" as const;
  if (windSpeedMs >= CAUTION_WIND_MS) return "caution" as const;
  return "safe" as const;
}
