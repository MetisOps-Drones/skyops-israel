import { test, expect } from "@playwright/test";
import * as turf from "@turf/turf";
import {
  checkFlightAuthorizationRequirement,
  forbiddenRadiusKm,
  nearestRunway,
  zoneVerdictFor,
  type ZoneBlockLevel,
} from "../../src/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint } from "../../src/lib/geo/aip";
import { AERODROME_RUNWAYS } from "../../src/lib/geo/aerodrome-runways";
import { hasServiceKey, loadAipZones } from "./data";
import type { AipReferenceZone } from "../../src/hooks/useAipReferenceZones";

/**
 * Audits the zone/distance rule engine against the real AIP reference layer
 * in production and against an independent re-implementation of the rules as
 * the regulations state them (הפעלת מטיסן / הפעלת כטב"ם קטן, תשפ"ד 2024):
 *   - אזור אסור (LLP)                      -> forbidden
 *   - < 2 km from a runway (3 km from a military airfield, commercial only) -> forbidden
 *   - CTR / ATZ / TMA / CTA beyond that    -> coordination with the tower
 *   - אזור מסוכן (LLD)                     -> CAAI director (org accounts only)
 *   - אזור מוגבל (LLR)                     -> coordination under the area's conditions
 * Read-only against production data; skipped when the service key isn't set.
 */
test.skip(!hasServiceKey, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to audit the real zone data");

let zones: AipReferenceZone[] = [];
test.beforeAll(async () => {
  // The weekday-only / height-capped areas have their own spec (weekday-zones.spec.ts); the oracle below models the standing layer.
  zones = (await loadAipZones()).filter((z) => !z.weekdays_only);
});

const SEVERITY: Record<ZoneBlockLevel, number> = {
  none: 0,
  coordination_ok: 1,
  controlled_airspace: 2,
  director_approval_only: 3,
  forbidden: 4,
};

/** Independent oracle — deliberately written from the regulation text, not from flight-rules.ts. */
function oracle(pt: [number, number], hobby: boolean, maxAltAmslM: number | null = null): ZoneBlockLevel {
  let level: ZoneBlockLevel = "none";
  const raise = (l: ZoneBlockLevel) => {
    if (SEVERITY[l] > SEVERITY[level]) level = l;
  };
  for (const r of AERODROME_RUNWAYS) {
    const d = turf.pointToLineDistance(turf.point(pt), turf.lineString(r.line), { units: "kilometers" });
    const radius = r.military && !hobby ? 3 : 2;
    if (d < radius) raise("forbidden");
  }
  for (const z of zones) {
    if (z.geom_geojson === null || (z.geom_geojson as { type?: string }).type !== "Polygon") continue;
    if (maxAltAmslM !== null && z.min_altitude_ft !== null && z.min_altitude_ft * 0.3048 > maxAltAmslM) continue;
    if (!turf.booleanPointInPolygon(pt, z.geom_geojson as unknown as GeoJSON.Polygon)) continue;
    if (z.kind === "PROHIBITED") raise("forbidden");
    else if (z.kind === "DANGER") raise("director_approval_only");
    else if (z.kind === "CTR" || z.kind === "ATZ" || z.kind === "TMA" || z.kind === "CTA") raise("controlled_airspace");
    else if (z.kind === "RESTRICTED") raise("coordination_ok");
  }
  return level;
}

/** Deterministic pseudo-random so a failure is reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test.describe("AIP reference data integrity", () => {
  // Real, documented data defects — each one is a known finding, not a pass. A NEW offender fails the test.
  const KNOWN_ALTITUDE_DEFECTS = new Set(["LLD42"]); // GND – (-530) ft AMSL stored as min 0 / max -530
  const TINY_BY_DESIGN = (code: string | null) => Boolean(code && /^LLU\d+$/.test(code)) || code === "LLP44";

  test("every zone is a closed Polygon inside Israel with a sane area", () => {
    const problems: string[] = [];
    for (const z of zones) {
      const g = z.geom_geojson as unknown as GeoJSON.Polygon | null;
      if (!g || g.type !== "Polygon") {
        problems.push(`${z.code}: not a Polygon`);
        continue;
      }
      const ring = g.coordinates[0] ?? [];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (ring.length < 4 || !first || !last || first[0] !== last[0] || first[1] !== last[1]) problems.push(`${z.code}: ring not closed`);
      if (ring.some(([x, y]) => (x ?? 0) < 34.1 || (x ?? 0) > 36.1 || (y ?? 0) < 29.3 || (y ?? 0) > 33.6)) problems.push(`${z.code}: vertex outside Israel`);
      if (!TINY_BY_DESIGN(z.code) && turf.area(turf.polygon(g.coordinates)) < 50_000) problems.push(`${z.code}: degenerate area`);
    }
    expect(problems).toEqual([]);
  });

  test("altitude floors/ceilings are consistent (known defects listed)", () => {
    const problems = zones
      .filter((z) => z.max_altitude_ft !== null && z.max_altitude_ft <= (z.min_altitude_ft ?? 0))
      .filter((z) => !KNOWN_ALTITUDE_DEFECTS.has(z.code ?? ""))
      .map((z) => `${z.code}: max ${z.max_altitude_ft} <= min ${z.min_altitude_ft}`);
    expect(problems).toEqual([]);
    expect(zones.some((z) => z.code === "LLD42" && (z.max_altitude_ft ?? 0) < 0), "LLD42 defect still present — remove it from KNOWN_ALTITUDE_DEFECTS once fixed").toBe(true);
  });

  test("codes are unique (LLBG legitimately has a CTR and a TMA row)", () => {
    const seen = new Map<string, string[]>();
    for (const z of zones) if (z.code) seen.set(z.code, [...(seen.get(z.code) ?? []), z.kind]);
    const dup = [...seen.entries()].filter(([, kinds]) => kinds.length > 1).map(([code]) => code);
    expect(dup).toEqual(["LLBG"]);
  });

  test("the layer carries every kind the rules switch on", () => {
    const kinds = new Set(zones.map((z) => z.kind));
    for (const k of ["CTR", "ATZ", "TMA", "RESTRICTED", "DANGER", "PROHIBITED"]) expect(kinds.has(k as never), k).toBe(true);
  });
});

test.describe("rule engine vs the regulations (independent oracle)", () => {
  test("6,000 seeded points across Israel agree for hobby and commercial accounts", () => {
    const rand = rng(20261003);
    const mismatches: string[] = [];
    for (let i = 0; i < 6000; i++) {
      const pt: [number, number] = [34.2 + rand() * 1.7, 29.5 + rand() * 3.8];
      for (const hobby of [true, false]) {
        const got = checkFlightAuthorizationRequirement(pt, zones, hobby).blockLevel;
        const want = oracle(pt, hobby);
        if (got !== want) mismatches.push(`${pt.map((v) => v.toFixed(4))} hobby=${hobby}: got ${got}, want ${want}`);
      }
    }
    expect(mismatches.slice(0, 10)).toEqual([]);
  });

  test("points ringed around every aerodrome at 0.5–6 km agree with the oracle", () => {
    const mismatches: string[] = [];
    for (const r of AERODROME_RUNWAYS) {
      const mid = r.line[Math.floor(r.line.length / 2)] as [number, number];
      for (const km of [0.5, 1.5, 1.95, 2.05, 2.5, 2.95, 3.05, 4, 6]) {
        for (const bearing of [0, 90, 180, 270]) {
          const pt = turf.destination(mid, km, bearing, { units: "kilometers" }).geometry.coordinates as [number, number];
          for (const hobby of [true, false]) {
            const got = checkFlightAuthorizationRequirement(pt, zones, hobby).blockLevel;
            const want = oracle(pt, hobby);
            if (got !== want) mismatches.push(`${r.name} ${km}km@${bearing} hobby=${hobby}: got ${got}, want ${want}`);
          }
        }
      }
    }
    expect(mismatches.slice(0, 10)).toEqual([]);
  });

  test("an interior point of every zone gets that kind's outcome (or a stricter one)", () => {
    const expected: Record<string, ZoneBlockLevel> = {
      PROHIBITED: "forbidden",
      DANGER: "director_approval_only",
      CTR: "controlled_airspace",
      ATZ: "controlled_airspace",
      TMA: "controlled_airspace",
      CTA: "controlled_airspace",
      RESTRICTED: "coordination_ok",
    };
    const problems: string[] = [];
    for (const z of zones) {
      const g = z.geom_geojson as unknown as GeoJSON.Polygon;
      const pt = turf.pointOnFeature(turf.polygon(g.coordinates)).geometry.coordinates as [number, number];
      const got = checkFlightAuthorizationRequirement(pt, zones, false).blockLevel;
      if (SEVERITY[got] < SEVERITY[expected[z.kind] ?? "none"]) problems.push(`${z.code} (${z.kind}): got ${got}`);
    }
    expect(problems).toEqual([]);
  });
});

test.describe("2 km / 3 km runway distance — exact boundaries", () => {
  /** A point `km` from the named runway's nearest segment, on the side away from every other runway. */
  function pointAt(namePart: string, km: number, bearing = 0): { pt: [number, number]; actualKm: number } {
    const rw = AERODROME_RUNWAYS.find((r) => r.name.includes(namePart))!;
    const mid = rw.line[Math.floor(rw.line.length / 2)] as [number, number];
    const pt = turf.destination(mid, km, bearing, { units: "kilometers" }).geometry.coordinates as [number, number];
    return { pt, actualKm: nearestRunway(pt, false)!.distanceKm };
  }

  test("military base (Hatzor): commercial 3 km, hobby 2 km", () => {
    const rw = AERODROME_RUNWAYS.find((r) => r.name.includes("חצור"))!;
    expect(rw.military).toBe(true);
    expect(forbiddenRadiusKm(rw, false)).toBe(3);
    expect(forbiddenRadiusKm(rw, true)).toBe(2);
    const inside = turf.destination(rw.line[0] as [number, number], 0.3, 90, { units: "kilometers" }).geometry.coordinates as [number, number];
    expect(checkFlightAuthorizationRequirement(inside, zones, true).blockLevel).toBe("forbidden");
    expect(checkFlightAuthorizationRequirement(inside, zones, false).blockLevel).toBe("forbidden");
  });

  test("a point 2.2–2.8 km from a military runway is forbidden for a commercial pilot but only coordination for a hobby pilot", () => {
    const rw = AERODROME_RUNWAYS.find((r) => r.name.includes("חצור"))!;
    for (const km of [2.3, 2.5, 2.7]) {
      for (let bearing = 0; bearing < 360; bearing += 15) {
        for (const anchor of [rw.line[0], rw.line[rw.line.length - 1]] as [number, number][]) {
          const pt = turf.destination(anchor, km, bearing, { units: "kilometers" }).geometry.coordinates as [number, number];
          const near = nearestRunway(pt, false)!;
          if (!near.runway.military || near.distanceKm < 2.2 || near.distanceKm > 2.8) continue;
          if (zones.some((z) => z.kind === "PROHIBITED" && turf.booleanPointInPolygon(pt, z.geom_geojson as unknown as GeoJSON.Polygon))) continue;
          expect(checkFlightAuthorizationRequirement(pt, zones, false).blockLevel).toBe("forbidden");
          expect(checkFlightAuthorizationRequirement(pt, zones, true).blockLevel).toBe("controlled_airspace");
          return;
        }
      }
    }
    throw new Error("no point found in the 2.2–2.8 km band around the Hatzor runway");
  });

  test("civil aerodrome (Herzliya): 2 km for everyone", () => {
    const rw = AERODROME_RUNWAYS.find((r) => r.icao === "LLHZ" && !r.military)!;
    expect(forbiddenRadiusKm(rw, false)).toBe(2);
    expect(forbiddenRadiusKm(rw, true)).toBe(2);
  });

  test("Shapir (inside the Hatzor CTR, 3.1 km from the nearest runway) is coordination, not forbidden", () => {
    const shapir: [number, number] = [34.7272, 31.6983];
    for (const hobby of [true, false]) {
      const check = checkFlightAuthorizationRequirement(shapir, zones, hobby);
      expect(check.blockLevel).toBe("controlled_airspace");
      expect(zoneVerdictFor(check.blockLevel, false).canSubmit).toBe(true);
    }
  });

  test("a point on the Hatzor runway itself is forbidden", () => {
    const rw = AERODROME_RUNWAYS.find((r) => r.name.includes("חצור"))!;
    const mid = rw.line[Math.floor(rw.line.length / 2)] as [number, number];
    expect(checkFlightAuthorizationRequirement(mid, zones, true).blockLevel).toBe("forbidden");
  });

  test("no junk runway stubs: every runway is at least 150 m", () => {
    for (const r of AERODROME_RUNWAYS) {
      expect(turf.length(turf.lineString(r.line), { units: "kilometers" }), `${r.name} ${r.ref ?? ""}`).toBeGreaterThanOrEqual(0.15);
    }
  });
});

test.describe("zone floors (a zone above the drone's reach doesn't apply)", () => {
  const zoneByCode = (code: string) => zones.find((z) => z.code === code)!;
  /** An interior point as far from every runway as the polygon allows — so the runway rule can't mask the zone rule under test. */
  const interior = (z: AipReferenceZone) => {
    const poly = turf.polygon((z.geom_geojson as unknown as GeoJSON.Polygon).coordinates);
    const [minX, minY, maxX, maxY] = turf.bbox(poly) as [number, number, number, number];
    const rand = rng(7);
    let best = turf.pointOnFeature(poly).geometry.coordinates as [number, number];
    let bestKm = nearestRunway(best, false)!.distanceKm;
    for (let i = 0; i < 300; i++) {
      const p: [number, number] = [minX + rand() * (maxX - minX), minY + rand() * (maxY - minY)];
      if (!turf.booleanPointInPolygon(p, poly)) continue;
      const km = nearestRunway(p, false)!.distanceKm;
      if (km > bestKm) {
        best = p;
        bestKm = km;
      }
    }
    return best;
  };

  test("Tel Aviv upper-control sector (floor 9,000 ft) is ignored once the ground is known, kept when it isn't", () => {
    const z = zoneByCode("LLTA");
    const pt = interior(z);
    expect(checkFlightAuthorizationRequirement(pt, [z], false).blockLevel).toBe("controlled_airspace"); // unknown ground: conservative
    expect(checkFlightAuthorizationRequirement(pt, [z], false, { maxAltitudeAmslM: 30 + 100 }).blockLevel).toBe("none");
  });

  test("a dangerous area whose floor is 5,000 ft doesn't touch a 100 m flight at sea level", () => {
    const z = zoneByCode("LLD29");
    const pt = interior(z);
    expect(checkFlightAuthorizationRequirement(pt, [z], false).blockLevel).toBe("director_approval_only");
    expect(checkFlightAuthorizationRequirement(pt, [z], false, { maxAltitudeAmslM: 280 + 100 }).blockLevel).toBe("none");
  });

  test("a ground-based zone is never skipped", () => {
    const z = zones.find((x) => x.kind === "PROHIBITED" && x.min_altitude_ft === 0)!;
    const pt = interior(z);
    expect(checkFlightAuthorizationRequirement(pt, [z], false, { maxAltitudeAmslM: 5 }).blockLevel).toBe("forbidden");
  });
});

test.describe("altitude ceiling semantics", () => {
  const pick = (kind: string) => zones.find((z) => z.kind === kind && (z.min_altitude_ft ?? 0) === 0)!;
  const interior = (z: AipReferenceZone) =>
    turf.pointOnFeature(turf.polygon((z.geom_geojson as unknown as GeoJSON.Polygon).coordinates)).geometry.coordinates as [number, number];

  test("only a prohibited area zeroes the ceiling from the ground", () => {
    expect(maxLegalAltitudeAtPoint(interior(pick("PROHIBITED")), [pick("PROHIBITED")]).blockedFromGround).toBe(true);
    for (const kind of ["CTR", "ATZ", "RESTRICTED", "DANGER"]) {
      const z = zones.find((x) => x.kind === kind && (x.min_altitude_ft ?? 0) === 0);
      if (!z) continue;
      expect(maxLegalAltitudeAtPoint(interior(z), [z]).blockedFromGround, kind).toBe(false);
    }
  });
});

test.describe("verdict wording matrix", () => {
  test("who can submit, per level and account type", () => {
    expect(zoneVerdictFor("forbidden", true).canSubmit).toBe(false);
    expect(zoneVerdictFor("forbidden", false).canSubmit).toBe(false);
    expect(zoneVerdictFor("director_approval_only", true).canSubmit).toBe(true);
    expect(zoneVerdictFor("director_approval_only", false).canSubmit).toBe(false);
    expect(zoneVerdictFor("director_approval_only", false).upgradeHelps).toBe(true);
    expect(zoneVerdictFor("controlled_airspace", false).canSubmit).toBe(true);
    expect(zoneVerdictFor("coordination_ok", false).canSubmit).toBe(true);
    expect(zoneVerdictFor("none", false).canSubmit).toBe(true);
    expect(zoneVerdictFor("controlled_airspace", false).headline).toContain("תיאום");
    expect(zoneVerdictFor("forbidden", false).headline).toContain("אסור");
  });
});
