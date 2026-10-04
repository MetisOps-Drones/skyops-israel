import { test, expect } from "@playwright/test";
import { checkFlightAuthorizationRequirement } from "../../src/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint } from "../../src/lib/geo/aip";
import { isWeekdayEditionAt, nextEditionChange, weekdayEditionAppliesTo, zoneIsInForce } from "../../src/lib/geo/weekday-zones";
import { buildLocationBriefing } from "../../src/lib/geo/location-briefing";
import { hasServiceKey, loadAipZones } from "./data";
import type { AipReferenceZone } from "../../src/hooks/useAipReferenceZones";
import type { LiveNotam } from "../../src/lib/notams/live-feed";

/**
 * Weekday-only areas (ranges, helicopter areas, the 100-ft area) from the weekday edition of the CAAI
 * drone map: hidden/ignored on the weekend, judged by the weekdays inside a requested flight window,
 * and — for the height-limited ones — a ceiling for every account (not a coordination requirement).
 *
 * The weekend is Friday 10:00 UTC to Sunday 04:00 UTC (13:00 Friday to 07:00 Sunday Israel summer time).
 */
const at = (iso: string) => new Date(iso);

test.describe("weekday edition clock (UTC weekend)", () => {
  test("weekday / Friday flips at 10:00 UTC / Saturday / Sunday flips back at 04:00 UTC", () => {
    expect(isWeekdayEditionAt(at("2026-10-06T09:00:00Z"))).toBe(true); // Tue
    expect(isWeekdayEditionAt(at("2026-10-09T09:59:00Z"))).toBe(true); // Fri 12:59 Israel
    expect(isWeekdayEditionAt(at("2026-10-09T10:00:00Z"))).toBe(false); // Fri 13:00 Israel
    expect(isWeekdayEditionAt(at("2026-10-10T08:00:00Z"))).toBe(false); // Sat
    expect(isWeekdayEditionAt(at("2026-10-11T03:59:00Z"))).toBe(false); // Sun 06:59 Israel
    expect(isWeekdayEditionAt(at("2026-10-11T04:00:00Z"))).toBe(true); // Sun 07:00 Israel
  });

  test("the boundaries are fixed in UTC, so they move with Israel's winter time", () => {
    expect(isWeekdayEditionAt(at("2026-12-04T09:59:00Z"))).toBe(true); // Fri 11:59 Israel
    expect(isWeekdayEditionAt(at("2026-12-04T10:00:00Z"))).toBe(false); // Fri 12:00 Israel
  });

  test("a flight window counts if ANY part of it is on a weekday", () => {
    expect(weekdayEditionAppliesTo({ start: at("2026-10-10T06:00:00Z"), end: at("2026-10-10T12:00:00Z") })).toBe(false); // Sat daytime
    expect(weekdayEditionAppliesTo({ start: at("2026-10-09T06:00:00Z"), end: at("2026-10-10T12:00:00Z") })).toBe(true); // Fri morning → Sat
    expect(weekdayEditionAppliesTo({ start: at("2026-10-10T18:00:00Z"), end: at("2026-10-11T06:00:00Z") })).toBe(true); // Sat evening → Sun after 04:00Z
    expect(weekdayEditionAppliesTo({ start: at("2026-10-09T10:00:00Z"), end: at("2026-10-11T03:59:00Z") })).toBe(false); // exactly the weekend
    expect(weekdayEditionAppliesTo({ start: at("2026-10-08T00:00:00Z"), end: at("2026-10-13T00:00:00Z") })).toBe(true); // multi-day
  });

  test("with no window the weekday zones follow 'now'", () => {
    expect(weekdayEditionAppliesTo(null, at("2026-10-06T09:00:00Z"))).toBe(true);
    expect(weekdayEditionAppliesTo(undefined, at("2026-10-10T08:00:00Z"))).toBe(false);
    expect(zoneIsInForce({ weekdays_only: false }, null, at("2026-10-10T08:00:00Z"))).toBe(true);
    expect(zoneIsInForce({ weekdays_only: true }, null, at("2026-10-10T08:00:00Z"))).toBe(false);
  });

  test("the next change: a weekday → the weekend starts Friday; the weekend → the weekdays resume Sunday", () => {
    const fromTue = nextEditionChange(at("2026-10-06T09:00:00Z"));
    expect(fromTue.at.toISOString()).toBe("2026-10-09T10:00:00.000Z");
    expect(fromTue.weekdayEditionAfter).toBe(false);
    const fromSat = nextEditionChange(at("2026-10-10T08:00:00Z"));
    expect(fromSat.at.toISOString()).toBe("2026-10-11T04:00:00.000Z");
    expect(fromSat.weekdayEditionAfter).toBe(true);
    expect(nextEditionChange(at("2026-10-09T10:00:00Z")).at.toISOString()).toBe("2026-10-11T04:00:00.000Z"); // exactly at the start
    expect(nextEditionChange(at("2026-10-11T04:00:00Z")).at.toISOString()).toBe("2026-10-16T10:00:00.000Z"); // exactly at the end
  });
});

/** A 2 km square around (35, 31), far from every runway. */
function zone(overrides: Partial<AipReferenceZone>): AipReferenceZone {
  return {
    id: "z",
    name: "אזור בדיקה",
    code: "TEST",
    kind: "RESTRICTED",
    altitude_text: "",
    min_altitude_ft: 0,
    max_altitude_ft: null,
    geom_geojson: { type: "Polygon", coordinates: [[[34.99, 30.99], [35.01, 30.99], [35.01, 31.01], [34.99, 31.01], [34.99, 30.99]]] },
    geometry_precise: true,
    source_edition: "test",
    source_sheet: "test",
    created_at: "",
    weekdays_only: false,
    drone_max_altitude_m: null,
    note: null,
    ...overrides,
  } as AipReferenceZone;
}
const PT: [number, number] = [35, 31];
const weekday = { start: at("2026-10-06T06:00:00Z"), end: at("2026-10-06T09:00:00Z") };
const saturday = { start: at("2026-10-10T06:00:00Z"), end: at("2026-10-10T09:00:00Z") };

test.describe("rule engine with weekday-only areas", () => {
  const range = zone({ weekdays_only: true });

  test("a weekday-only area asks for coordination on a weekday and is ignored on a Saturday", () => {
    expect(checkFlightAuthorizationRequirement(PT, [range], false, { window: weekday }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(PT, [range], false, { window: saturday }).blockLevel).toBe("none");
  });

  test("an area that is not weekday-only applies on any day", () => {
    const always = zone({ weekdays_only: false });
    expect(checkFlightAuthorizationRequirement(PT, [always], false, { window: saturday }).blockLevel).toBe("coordination_ok");
  });

  test("the altitude ceiling lookup ignores weekday-only areas on the weekend too", () => {
    expect(maxLegalAltitudeAtPoint(PT, [range], saturday).zones).toHaveLength(0);
    expect(maxLegalAltitudeAtPoint(PT, [range], weekday).zones).toHaveLength(1);
  });

  test("Friday morning is a weekday, Friday evening is not", () => {
    const friMorning = { start: at("2026-10-09T05:00:00Z"), end: at("2026-10-09T07:00:00Z") }; // Fri 08–10 Israel
    const friEvening = { start: at("2026-10-09T15:00:00Z"), end: at("2026-10-09T17:00:00Z") }; // Fri 18–20 Israel
    expect(checkFlightAuthorizationRequirement(PT, [range], false, { window: friMorning }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(PT, [range], false, { window: friEvening }).blockLevel).toBe("none");
  });
});

test.describe("height-limited areas (helicopter 60 m, 100-ft area 30 m) are a ceiling for everyone", () => {
  const heli = zone({ weekdays_only: true, drone_max_altitude_m: 60, name: "אזור מסוקים — חרמון" });
  const hundredFt = zone({ weekdays_only: true, drone_max_altitude_m: 30, name: "אזור 100 רגל" });

  test("the cap is reported — and it does NOT turn into a coordination requirement", () => {
    for (const hobby of [true, false]) {
      const r = checkFlightAuthorizationRequirement(PT, [heli], hobby, { window: weekday });
      expect(r.blockLevel, `hobby=${hobby}`).toBe("none");
      expect(r.altitudeCapM, `hobby=${hobby}`).toBe(60);
      expect(r.capZones.map((z) => z.name)).toEqual(["אזור מסוקים — חרמון"]);
    }
  });

  test("overlapping caps: the lowest wins", () => {
    expect(checkFlightAuthorizationRequirement(PT, [heli, hundredFt], false, { window: weekday }).altitudeCapM).toBe(30);
  });

  test("on a weekend the area is not in force — no cap", () => {
    expect(checkFlightAuthorizationRequirement(PT, [heli], false, { window: saturday }).altitudeCapM).toBeNull();
  });

  test("a point outside any capped area has no cap", () => {
    expect(checkFlightAuthorizationRequirement([36, 32], [heli], false, { window: weekday }).altitudeCapM).toBeNull();
  });
});

test.describe("location briefing — what matters at the time asked about", () => {
  const heli = zone({ weekdays_only: true, drone_max_altitude_m: 60, name: "אזור מסוקים — חרמון", note: 'יש לשמור 1 ק"מ מכביש' });
  const range = zone({ id: "r", weekdays_only: true, name: "מטווח (ימי חול) 1" });
  const tuesday = at("2026-10-06T09:00:00Z");
  const saturdayNoon = at("2026-10-10T09:00:00Z");

  test("on a weekday: the cap sentence says 'up to 60 m only', for any account, and names the zone", () => {
    const b = buildLocationBriefing({ point: PT, zones: [heli], notams: [], at: tuesday });
    expect(b.ceilingM).toBe(60);
    expect(b.ceiling?.text).toContain("עד 60 מ'");
    expect(b.ceiling?.text).toContain("אזור מסוקים — חרמון");
    expect(b.ceiling?.detail).toContain("כביש");
    expect(b.upcoming).toEqual([]);
  });

  test("a standing weekday-only limit says until when it holds", () => {
    const b = buildLocationBriefing({ point: PT, zones: [range], notams: [], at: tuesday });
    expect(b.notes).toHaveLength(1);
    expect(b.notes[0]!.text).toContain("בימי חול בלבד");
    expect(b.notes[0]!.text).toContain("עד ");
  });

  test("on the weekend: no cap now, and the briefing warns the cap comes into force on Sunday", () => {
    const b = buildLocationBriefing({ point: PT, zones: [heli, range], notams: [], at: saturdayNoon });
    expect(b.ceilingM).toBeNull();
    expect(b.notes).toEqual([]);
    expect(b.upcoming).toHaveLength(1);
    expect(b.upcoming[0]!.text).toContain("ייכנס לתוקף");
    expect(b.upcoming[0]!.text).toContain("עד 60 מ'");
  });

  test("a NOTAM that starts after the time asked about is listed as coming up; one already over is not", () => {
    const notam = (id: string, from: string, to: string): LiveNotam => ({
      id, location: "LLLL", airfield: "", fromDate: from, toDate: to, eText: "בדיקה", lowerLimit: null, upperLimit: null,
      position: { lat: 31, lon: 35, radiusNm: 5, source: "e_text" }, notamType: "N", replaces: null, schedule: null,
    });
    const b = buildLocationBriefing({
      point: PT, zones: [], at: tuesday,
      notams: [notam("A1/26", "2026-10-08T06:00:00Z", "2026-10-09T06:00:00Z"), notam("A0/26", "2026-10-01T06:00:00Z", "2026-10-02T06:00:00Z")],
    });
    expect(b.upcoming.map((u) => u.text).join(" ")).toContain("A1/26");
    expect(b.upcoming.map((u) => u.text).join(" ")).not.toContain("A0/26");
  });

  test("a point outside any such area has nothing to say", () => {
    const b = buildLocationBriefing({ point: [36, 32], zones: [heli, range], notams: [], at: tuesday });
    expect(b).toEqual({ ceilingM: null, ceiling: null, notes: [], upcoming: [] });
  });
});

test.describe("production data (after migration 0093)", () => {
  test.skip(!hasServiceKey, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to audit the real zone data");

  test("every weekday-only area is a valid polygon, flagged and noted", async () => {
    const zones = await loadAipZones();
    const weekdayOnly = zones.filter((z) => z.weekdays_only);
    test.skip(weekdayOnly.length === 0, "Migration 0093 has not been run yet");
    expect(weekdayOnly.length).toBeGreaterThan(100);
    for (const z of weekdayOnly) {
      expect((z.geom_geojson as { type?: string }).type, z.name).toBe("Polygon");
      expect(z.kind, z.name).toBe("RESTRICTED");
      expect(z.note, z.name).toBeTruthy();
    }
    expect(weekdayOnly.some((z) => z.drone_max_altitude_m === 60)).toBe(true);
    expect(weekdayOnly.some((z) => z.drone_max_altitude_m === 30)).toBe(true);
    expect(weekdayOnly.some((z) => z.drone_max_altitude_m === null)).toBe(true); // the firing ranges
  });

  test("a point inside the Negev firing-range area asks for coordination on a weekday and not on Saturday", async () => {
    const zones = await loadAipZones();
    const ranges = zones.filter((z) => z.weekdays_only && z.code?.startsWith("CAAI-RANGE"));
    test.skip(ranges.length === 0, "Migration 0093 has not been run yet");
    const turf = await import("@turf/turf");
    const poly = ranges.map((z) => turf.polygon((z.geom_geojson as unknown as GeoJSON.Polygon).coordinates));
    const centre = turf.pointOnFeature(poly[0]!).geometry.coordinates as [number, number];
    // The point may also sit in other zones (a prohibited area, a base): compare the range's own contribution only.
    expect(checkFlightAuthorizationRequirement(centre, ranges, false, { window: weekday }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(centre, ranges, false, { window: saturday }).blockLevel).toBe("none");
  });

  test("Hermon helicopter area: capped at 60 m on a weekday, and never a coordination requirement", async () => {
    const zones = await loadAipZones();
    const heli = zones.filter((z) => z.weekdays_only && z.code?.startsWith("CAAI-HELI") && z.name.includes("חרמון"));
    test.skip(heli.length === 0, "Migration 0093 has not been run yet");
    const turf = await import("@turf/turf");
    const centre = turf.pointOnFeature(turf.polygon((heli[0]!.geom_geojson as unknown as GeoJSON.Polygon).coordinates)).geometry.coordinates as [number, number];
    const r = checkFlightAuthorizationRequirement(centre, heli, false, { window: weekday });
    expect(r.altitudeCapM).toBe(60);
    expect(r.blockLevel).toBe("none");
  });
});
