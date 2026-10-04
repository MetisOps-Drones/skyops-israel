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
export function checkLiveNotamOverlap(
  point: [number, number],
  notams: LiveNotam[],
  /** The requested flight window. Omitted = "right now" (map, HUD, point inspector). With a window, a NOTAM that starts later still counts if it overlaps the flight. */
  window?: { start: Date; end: Date } | null
): LiveNotamOverlapCheck {
  const turfPoint = turf.point(point);
  const inside = notams.filter((n) => {
    const from = Date.parse(n.fromDate);
    const to = Date.parse(n.toDate);
    const inTime = window
      ? from <= window.end.getTime() && to >= window.start.getTime()
      : from <= Date.now() && Date.now() <= to;
    return inTime && notamCoversPoint(turfPoint, n);
  });
  return { inside: inside.length > 0, notams: inside };
}

function notamCoversPoint(turfPoint: ReturnType<typeof turf.point>, n: LiveNotam): boolean {
  const distanceKm = turf.distance(turfPoint, turf.point([n.position.lon, n.position.lat]), { units: "kilometers" });
  return distanceKm <= n.position.radiusNm * NM_TO_KM;
}

/** Whether a NOTAM is in force right now (the feed also carries ones that start later). */
export function isNotamActiveNow(n: LiveNotam): boolean {
  const now = Date.now();
  return Date.parse(n.fromDate) <= now && now <= Date.parse(n.toDate);
}

/** NOTAMs covering this point that have not started yet but will within `days` — so a pilot planning ahead isn't told "clear" about something that begins tomorrow. */
export function upcomingNotamsAt(point: [number, number], notams: LiveNotam[], days = 14, from?: Date): LiveNotam[] {
  const now = from ? from.getTime() : Date.now();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  const turfPoint = turf.point(point);
  return notams
    .filter((n) => {
      const from = Date.parse(n.fromDate);
      return from > now && from <= horizon;
    })
    .filter((n) => notamCoversPoint(turfPoint, n))
    .sort((a, b) => Date.parse(a.fromDate) - Date.parse(b.fromDate));
}

const WEEKDAYS_HE: Record<string, string> = {
  MON: "שני",
  TUE: "שלישי",
  WED: "רביעי",
  THU: "חמישי",
  FRI: "שישי",
  SAT: "שבת",
  SUN: "ראשון",
};

/** Israel's UTC offset in minutes on a given day (120 in winter, 180 in summer time). */
function israelOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * A NOTAM's item D) schedule ("DAILY 0500-1500", "MON-FRI 0600-1400") is
 * written in UTC; a pilot reads Israel time. Every HHMM-HHMM range is
 * converted using the offset in force on the NOTAM's first day, the day words
 * are translated, and anything else (SR-SS, free text) is kept as published.
 * Returns e.g. "מדי יום 08:00–18:00 (שעון ישראל)".
 */
export function formatNotamSchedule(schedule: string, referenceIso: string): string {
  const offset = israelOffsetMinutes(new Date(referenceIso));
  const toLocal = (hhmm: string) => {
    const total = (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2)) + offset + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const converted = schedule
    .replace(/\b(\d{4})\s*-\s*(\d{4})\b/g, (_m, a: string, b: string) => `${toLocal(a)}–${toLocal(b)}`)
    .replace(/\bDAILY\b|\bDLY\b/gi, "מדי יום")
    .replace(/\bH24\b/gi, "24 שעות")
    .replace(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/gi, (d) => WEEKDAYS_HE[d.toUpperCase()] ?? d);
  return /\d{2}:\d{2}/.test(converted) ? `${converted} (שעון ישראל)` : converted;
}

/** The activity hours to show for these NOTAMs when they all publish the same ones; null when they differ or none have any (the per-NOTAM detail still lists each). */
export function notamsActivityLabel(notams: LiveNotam[]): string | null {
  const distinct = Array.from(new Set(notams.map((n) => n.schedule ?? "")));
  const only = distinct.length === 1 ? distinct[0] : null;
  const first = notams[0];
  return only && first ? formatNotamSchedule(only, first.fromDate) : null;
}
