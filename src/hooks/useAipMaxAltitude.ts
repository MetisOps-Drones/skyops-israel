"use client";

import { useMemo } from "react";
import { maxLegalAltitudeAtPoint, type AipMaxAltitudeResult } from "@/lib/geo/aip";
import { useAipReferenceZones } from "./useAipReferenceZones";

/** "What's the highest altitude I can legally fly at this point" per the AIP reference layer — used by the map HUD. */
export function useAipMaxAltitude(coords: [number, number] | null): AipMaxAltitudeResult | null {
  const { data: zones = [] } = useAipReferenceZones();

  return useMemo(() => {
    if (!coords) return null;
    return maxLegalAltitudeAtPoint(coords, zones);
  }, [coords, zones]);
}
