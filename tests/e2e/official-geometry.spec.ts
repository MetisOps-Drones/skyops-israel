import { test, expect } from "@playwright/test";
import * as turf from "@turf/turf";
import { checkFlightAuthorizationRequirement } from "../../src/lib/geo/flight-rules";
import { hasServiceKey, loadAipZones } from "./data";
import type { AipReferenceZone } from "../../src/hooks/useAipReferenceZones";

/**
 * After migration 0094 the zone layer follows the official CAAI drone map where ours was rougher or
 * incomplete. Skipped until the migration has been run.
 */
test.skip(!hasServiceKey, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to audit the real zone data");

let zones: AipReferenceZone[] = [];
test.beforeAll(async () => {
  zones = (await loadAipZones()).filter((z) => !z.weekdays_only);
});
const migrated = () => zones.some((z) => z.code === "CAAI-LLBG-1");
const level = (pt: [number, number]) => checkFlightAuthorizationRequirement(pt, zones, false, { maxAltitudeAmslM: 100, plannedAltitudeM: 100 }).blockLevel;

test("the Ben Gurion CTR covers the official 484 km² (central Tel Aviv, Ramat Gan, Rishon LeZion need the tower)", () => {
  test.skip(!migrated(), "Migration 0094 has not been run yet");
  const bg = zones.find((z) => z.code === "CAAI-LLBG-1")!;
  expect(turf.area(turf.polygon((bg.geom_geojson as unknown as GeoJSON.Polygon).coordinates)) / 1e6).toBeGreaterThan(450);
  for (const pt of [[34.774, 32.078], [34.824, 32.07], [34.8, 31.97]] as [number, number][]) expect(level(pt)).toBe("controlled_airspace");
});

test("Ovda and Eilat-Ramon have the second and third parts of their control zones", () => {
  test.skip(!migrated(), "Migration 0094 has not been run yet");
  expect(zones.filter((z) => z.code?.startsWith("CAAI-LLOV")).length).toBe(2);
  expect(zones.some((z) => z.code === "CAAI-LLER-1")).toBe(true);
});

test("Dimona (LLP15) is the official, larger outline; Eynvdat (LLP16) the smaller one", () => {
  test.skip(!migrated(), "Migration 0094 has not been run yet");
  const area = (code: string) => turf.area(turf.polygon((zones.find((z) => z.code === code)!.geom_geojson as unknown as GeoJSON.Polygon).coordinates)) / 1e6;
  expect(area("LLP15")).toBeGreaterThan(140);
  expect(area("LLP16")).toBeLessThan(25);
});

test("nothing that was a restriction before 0094 stopped being one: Hatzor runway and a prohibited area are still forbidden", () => {
  test.skip(!migrated(), "Migration 0094 has not been run yet");
  expect(level([34.72732, 31.76168])).toBe("forbidden");
  expect(level([35.2137, 31.7683])).toBe("forbidden");
});
