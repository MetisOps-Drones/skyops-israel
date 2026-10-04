import * as turf from "@turf/turf";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";
import type { LiveNotam } from "@/lib/notams/live-feed";
import { formatNotamTime, upcomingNotamsAt } from "@/lib/geo/live-notams";
import { ISRAEL_TIME_ZONE, nextEditionChange, zoneIsInForce } from "@/lib/geo/weekday-zones";

export interface BriefingItem {
  text: string;
  detail?: string;
}

export interface LocationBriefing {
  /** The lowest legal height cap (m above ground) that applies at this point and time, for every account; null = none beyond the general ceiling. */
  ceilingM: number | null;
  /** The sentence that says it. */
  ceiling: BriefingItem | null;
  /** In force at the checked time and worth knowing — the pilot may fly, "but pay attention to…". */
  notes: BriefingItem[];
  /** Not in force at the checked time, but about to be (a weekday-only area starting, a NOTAM beginning). */
  upcoming: BriefingItem[];
}

/** "יום ראשון 07:00" in Israel time, with the date when it is more than two days away. */
export function formatWhen(at: Date, from: Date): string {
  const farOut = at.getTime() - from.getTime() > 2 * 24 * 60 * 60 * 1000;
  return at.toLocaleString("he-IL", {
    timeZone: ISRAEL_TIME_ZONE,
    weekday: "long",
    ...(farOut ? { day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function covers(zone: AipReferenceZone, point: [number, number]): boolean {
  const geom = zone.geom_geojson as unknown as GeoJSON.Geometry | null;
  if (!geom || geom.type !== "Polygon") return false;
  try {
    return turf.booleanPointInPolygon(point, geom as GeoJSON.Polygon);
  } catch {
    return false;
  }
}

/**
 * What the pilot should know about a point *at a given time*: the height cap the law puts there (same for
 * a hobby and a commercial pilot — it is what is permitted, not a licence matter), standing limits that are
 * in force then, and what is about to come into force — so "you may fly here, but note…" is always about the
 * moment being asked about, not a static picture. `at` is "now" for a point inspected on the map, or the
 * time the pilot is planning for.
 */
export function buildLocationBriefing(input: {
  point: [number, number];
  zones: AipReferenceZone[];
  notams: LiveNotam[];
  at: Date;
}): LocationBriefing {
  const { point, zones, notams, at } = input;
  // A one-instant window: judged at exactly that time.
  const window = { start: at, end: at };

  const here = zones.filter((z) => (z.weekdays_only || z.drone_max_altitude_m != null) && covers(z, point));
  const inForce = here.filter((z) => zoneIsInForce(z, window, at));
  const notYet = here.filter((z) => !zoneIsInForce(z, window, at));

  const capZones = inForce.filter((z) => z.drone_max_altitude_m != null);
  const ceilingM = capZones.length > 0 ? Math.min(...capZones.map((z) => z.drone_max_altitude_m as number)) : null;
  const ceilingZone = capZones.find((z) => z.drone_max_altitude_m === ceilingM);
  const ceiling: BriefingItem | null =
    ceilingM !== null && ceilingZone
      ? {
          text: `בנקודה זו מותר להטיס עד ${ceilingM} מ' מעל הקרקע בלבד — ${ceilingZone.name}`,
          detail: ceilingZone.note ?? undefined,
        }
      : null;

  const notes: BriefingItem[] = [];
  const endOfWeekday = inForce.some((z) => z.weekdays_only) ? nextEditionChange(at) : null;
  for (const z of inForce) {
    if (!z.weekdays_only) continue;
    if (z.drone_max_altitude_m != null) continue; // said by the ceiling sentence
    notes.push({
      text: `${z.name} — בתוקף בימי חול בלבד${endOfWeekday && !endOfWeekday.weekdayEditionAfter ? ` (עד ${formatWhen(endOfWeekday.at, at)})` : ""}`,
      detail: z.note ?? undefined,
    });
  }
  if (ceiling && endOfWeekday && !endOfWeekday.weekdayEditionAfter && capZones.every((z) => z.weekdays_only)) {
    notes.push({ text: `מגבלת הגובה בנקודה זו בתוקף עד ${formatWhen(endOfWeekday.at, at)}` });
  }

  const upcoming: BriefingItem[] = [];
  if (notYet.length > 0) {
    const start = nextEditionChange(at);
    const names = notYet.map((z) => z.name);
    const caps = notYet.filter((z) => z.drone_max_altitude_m != null).map((z) => z.drone_max_altitude_m as number);
    upcoming.push({
      text: `${names.join(", ")} — ייכנס לתוקף ${formatWhen(start.at, at)}${caps.length > 0 ? `, ואז מותר להטיס רק עד ${Math.min(...caps)} מ'` : ""}`,
    });
  }
  for (const n of upcomingNotamsAt(point, notams, 14, at)) {
    upcoming.push({ text: `נוטאם ${n.id} — מתחיל ${formatNotamTime(n.fromDate)}`, detail: n.eText });
  }

  return { ceilingM, ceiling, notes, upcoming };
}
