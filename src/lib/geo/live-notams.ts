import * as turf from "@turf/turf";
import type { LiveNotam } from "@/lib/notams/live-feed";

const NM_TO_KM = 1.852;

export interface LiveNotamOverlapCheck {
  inside: boolean;
  notams: LiveNotam[];
}

/**
 * Every live NOTAM resolves to a circle (center + radius), never a real
 * polygon — see src/lib/notams/live-feed.ts. A point-in-circle distance
 * check is therefore exact for what this data actually offers, not an
 * approximation of some sharper shape we're rounding off.
 *
 * Same policy as an AIP-zone `coordination_ok` hit (src/lib/geo/flight-
 * rules.ts): never a hard block by itself, but the request must go to a
 * dispatcher for a real decision instead of auto-clearing.
 */
export function checkLiveNotamOverlap(point: [number, number], notams: LiveNotam[]): LiveNotamOverlapCheck {
  const turfPoint = turf.point(point);
  const inside = notams.filter((n) => {
    const distanceKm = turf.distance(turfPoint, turf.point([n.position.lon, n.position.lat]), {
      units: "kilometers",
    });
    return distanceKm <= n.position.radiusNm * NM_TO_KM;
  });
  return { inside: inside.length > 0, notams: inside };
}
