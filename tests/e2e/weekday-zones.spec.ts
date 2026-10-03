import { test, expect } from "@playwright/test";
import { checkFlightAuthorizationRequirement } from "../../src/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint } from "../../src/lib/geo/aip";
import { isWeekdayEditionAt, weekdayEditionAppliesTo, zoneIsInForce } from "../../src/lib/geo/weekday-zones";
import { hasServiceKey, loadAipZones } from "./data";
import type { AipReferenceZone } from "../../src/hooks/useAipReferenceZones";

/**
 * Weekday-only areas (ranges, helicopter areas, the 100-ft area) from the weekday edition of the CAAI
 * drone map: hidden/ignored on the weekend, judged by the weekdays inside a requested flight window,
 * and — for the height-limited ones — only relevant to a flight planned above the cap.
 *
 * Israel is UTC+3 in October (summer time) and UTC+2 in December: the instants below are UTC.
 */
const at = (iso: string) => new Date(iso);

test.describe("weekday edition clock (Israel time)", () => {
  test("a weekday is a weekday; Friday flips at 13:00; Saturday is the weekend; Sunday morning is a weekday again", () => {
    expect(isWeekdayEditionAt(at("2026-10-06T09:00:00Z"))).toBe(true); // Tue 12:00
    expect(isWeekdayEditionAt(at("2026-10-09T09:59:00Z"))).toBe(true); // Fri 12:59
    expect(isWeekdayEditionAt(at("2026-10-09T10:00:00Z"))).toBe(false); // Fri 13:00
    expect(isWeekdayEditionAt(at("2026-10-10T08:00:00Z"))).toBe(false); // Sat 11:00
    expect(isWeekdayEditionAt(at("2026-10-10T21:30:00Z"))).toBe(true); // Sun 00:30 (Sat 21:30Z is already Sunday in Israel)
  });

  test("winter time shifts the cut-off with it (UTC+2)", () => {
    expect(isWeekdayEditionAt(at("2026-12-04T10:59:00Z"))).toBe(true); // Fri 12:59
    expect(isWeekdayEditionAt(at("2026-12-04T11:00:00Z"))).toBe(false); // Fri 13:00
  });

  test("a flight window counts if ANY part of it is on a weekday", () => {
    expect(weekdayEditionAppliesTo({ start: at("2026-10-10T06:00:00Z"), end: at("2026-10-10T12:00:00Z") })).toBe(false); // Sat 09–15
    expect(weekdayEditionAppliesTo({ start: at("2026-10-09T06:00:00Z"), end: at("2026-10-10T12:00:00Z") })).toBe(true); // Fri 09:00 → Sat
    expect(weekdayEditionAppliesTo({ start: at("2026-10-10T18:00:00Z"), end: at("2026-10-11T06:00:00Z") })).toBe(true); // Sat evening → Sun morning
    expect(weekdayEditionAppliesTo({ start: at("2026-10-09T10:00:00Z"), end: at("2026-10-10T20:59:00Z") })).toBe(false); // exactly the weekend
    expect(weekdayEditionAppliesTo({ start: at("2026-10-08T00:00:00Z"), end: at("2026-10-13T00:00:00Z") })).toBe(true); // multi-day
  });

  test("with no window the weekday zones follow 'now'", () => {
    expect(weekdayEditionAppliesTo(null, at("2026-10-06T09:00:00Z"))).toBe(true);
    expect(weekdayEditionAppliesTo(undefined, at("2026-10-10T08:00:00Z"))).toBe(false);
    expect(zoneIsInForce({ weekdays_only: false }, null, at("2026-10-10T08:00:00Z"))).toBe(true);
    expect(zoneIsInForce({ weekdays_only: true }, null, at("2026-10-10T08:00:00Z"))).toBe(false);
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

  test("a window checked against several days is judged per request, not once for all requests", () => {
    const friMorning = { start: at("2026-10-09T05:00:00Z"), end: at("2026-10-09T07:00:00Z") }; // Fri 08–10
    const friEvening = { start: at("2026-10-09T15:00:00Z"), end: at("2026-10-09T17:00:00Z") }; // Fri 18–20
    expect(checkFlightAuthorizationRequirement(PT, [range], false, { window: friMorning }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(PT, [range], false, { window: friEvening }).blockLevel).toBe("none");
  });
});

test.describe("height-limited areas (helicopter 60 m, 100-ft area 30 m)", () => {
  const heli = zone({ weekdays_only: true, drone_max_altitude_m: 60 });
  const hundredFt = zone({ weekdays_only: true, drone_max_altitude_m: 30 });

  test("flying at or under the cap needs nothing; above it needs coordination", () => {
    expect(checkFlightAuthorizationRequirement(PT, [heli], false, { window: weekday, plannedAltitudeM: 60 }).blockLevel).toBe("none");
    expect(checkFlightAuthorizationRequirement(PT, [heli], false, { window: weekday, plannedAltitudeM: 61 }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(PT, [hundredFt], false, { window: weekday, plannedAltitudeM: 30 }).blockLevel).toBe("none");
    expect(checkFlightAuthorizationRequirement(PT, [hundredFt], false, { window: weekday, plannedAltitudeM: 50 }).blockLevel).toBe("coordination_ok");
  });

  test("altitude not chosen yet: a hobby pilot is judged at the fixed 50 m ceiling, a commercial pilot is assumed above the cap", () => {
    expect(checkFlightAuthorizationRequirement(PT, [heli], true, { window: weekday }).blockLevel).toBe("none");
    expect(checkFlightAuthorizationRequirement(PT, [hundredFt], true, { window: weekday }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(PT, [heli], false, { window: weekday }).blockLevel).toBe("coordination_ok");
  });

  test("the reason names the cap so the pilot and dispatcher see why", () => {
    const r = checkFlightAuthorizationRequirement(PT, [heli], false, { window: weekday, plannedAltitudeM: 100 });
    expect(r.reasons[0]?.label).toContain("60");
  });

  test("on a weekend the cap is irrelevant — the area is not in force", () => {
    expect(checkFlightAuthorizationRequirement(PT, [heli], false, { window: saturday, plannedAltitudeM: 100 }).blockLevel).toBe("none");
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
    const onlyRanges = ranges;
    expect(checkFlightAuthorizationRequirement(centre, onlyRanges, false, { window: weekday }).blockLevel).toBe("coordination_ok");
    expect(checkFlightAuthorizationRequirement(centre, onlyRanges, false, { window: saturday }).blockLevel).toBe("none");
  });
});
