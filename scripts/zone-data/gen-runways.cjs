const fs = require("fs");
const turf = require("@turf/turf");
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const aerodromes = j.elements
  .filter((e) => e.tags?.aeroway === "aerodrome")
  .map((e) => {
    const c = e.type === "node" ? [e.lon, e.lat] : [e.center.lon, e.center.lat];
    const icao = e.tags.icao || null;
    const name = e.tags.name || e.tags["name:he"] || e.tags["name:en"] || null;
    return { c, icao, name, military: e.tags.military === "airfield" || /בסיס חיל/.test(name || "") };
  })
  // Israeli + Palestinian-administered airfields only: Jordan (OJ*), Egypt (HE*), unnamed Arabic-only strips are not in scope
  .filter((a) => (a.icao ? a.icao.startsWith("LL") : /[\u0590-\u05FF]/.test(a.name || "")))
  // "\u05D8\u05D9\u05E1\u05E0\u05D9\u05DD" fields are model-aircraft strips, not aerodromes the 2 km runway rule is about
  .filter((a) => !/\u05D8\u05D9\u05E1\u05E0\u05D9\u05DD/.test(a.name || ""));

const out = [];
const runways = j.elements.filter((e) => e.tags?.aeroway === "runway" && !e.tags["disused:aeroway"] && !e.tags["abandoned:aeroway"] && !e.tags.disused);
console.error("candidate runways", runways.length, "with geometry", runways.filter((e) => e.geometry).length, "aerodromes in scope", aerodromes.length);
for (const e of runways.filter((e) => e.geometry)) {
  const pts = e.geometry.map((g) => [+g.lon.toFixed(5), +g.lat.toFixed(5)]);
  // OSM has a few stub ways tagged runway (taxiway stubs, a 60 m piece 4 km from Herzliya) — real runways
  // in the data are 190 m and up, so anything shorter than 150 m is noise that would draw a false 2 km circle.
  if (turf.length(turf.lineString(pts), { units: "kilometers" }) < 0.15) continue;
  const mid = pts[Math.floor(pts.length / 2)];
  let best = null, bd = Infinity;
  for (const a of aerodromes) {
    const d = turf.distance(mid, a.c, { units: "kilometers" });
    if (d < bd) { bd = d; best = a; }
  }
  if (!best || bd > 6) continue; // runway of an out-of-scope (e.g. Jordanian) airfield
  out.push({ name: best.name || best.icao, icao: best.icao, military: best.military, ref: e.tags.ref || null, line: pts });
}
out.sort((a, b) => (a.icao || a.name || "").localeCompare(b.icao || b.name || ""));
console.error("runways kept", out.length, "of", j.elements.filter((e) => e.tags?.aeroway === "runway").length);
const byName = {};
for (const r of out) byName[r.name] = (byName[r.name] || 0) + 1;
console.error(byName);

const ts = `/**
 * Runways of every Israeli aerodrome and air force base, from OpenStreetMap
 * (aeroway=runway, fetched 2026-10-03). The regulations measure the
 * 2 km safety distance from "any point on the aerodrome's runway" — not from
 * the control zone boundary and not from the drawn flight bubble — so the
 * rule needs the runway geometry itself. Static on purpose: runways don't
 * move, and this keeps the check local and instant (map card, request form
 * and server action all use the same data).
 *
 * Each line is [lng, lat] points along the runway centreline.
 */
export interface AerodromeRunway {
  /** Hebrew name of the aerodrome/base this runway belongs to. */
  name: string;
  icao: string | null;
  /** Air force base — the commercial-operator rule is 3 km for a military airfield. */
  military: boolean;
  /** Runway designator like "08/26", when mapped. */
  ref: string | null;
  line: [number, number][];
}

export const AERODROME_RUNWAYS: AerodromeRunway[] = ${JSON.stringify(out, null, 0).replace(/\},\{/g, "},\n  {")};
`;
fs.writeFileSync("src/lib/geo/aerodrome-runways.ts", ts, "utf8");
