import * as turf from "@turf/turf";
import type { LiveNotam } from "@/lib/notams/live-feed";

const NM_TO_KM = 1.852;

export interface LiveNotamOverlapCheck {
  inside: boolean;
  notams: LiveNotam[];
}

const FAR_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;

/** A NOTAM date/time in Israel time ("31.10, 23:59"; the year is added when it isn't this year). The feed publishes UTC. */
export function formatNotamTime(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * When the last of these NOTAMs expires — the earliest moment the NOTAM side
 * of a point is clear. A NOTAM published years ahead is a standing
 * restriction rather than a date to wait for, so it reads as "לטווח ארוך"
 * instead of a date nobody can plan around. Note this is the end of the
 * NOTAM's validity window; many are month-long windows whose actual daily
 * activity hours are written in the NOTAM text itself.
 */
export function notamsValidUntilLabel(notams: LiveNotam[]): string | null {
  const ends = notams.map((n) => Date.parse(n.toDate)).filter((t) => !Number.isNaN(t));
  if (ends.length === 0) return null;
  const latest = Math.max(...ends);
  if (latest - Date.now() > FAR_FUTURE_MS) return `לטווח ארוך (עד ${new Date(latest).getFullYear()})`;
  return formatNotamTime(new Date(latest).toISOString());
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
