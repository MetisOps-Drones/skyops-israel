import { NextRequest, NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Checks a point against the generic Israeli hobby-drone proximity rules
 * that aren't captured by the AIP reference layer (see
 * src/lib/geo/flight-rules.ts for the AIP/airport rules — those measure
 * distance from a drawn *airspace* boundary, e.g. a CTR polygon, which is
 * correct there). Everything checked in THIS file is a ground-level point
 * of interest — a specific building or site — so it's always measured as
 * straight-line distance to that point/way, never to any AIP zone
 * boundary. Don't blur the two: "250m from a police station" means from
 * the station itself, not from whatever airspace zone happens to overlap
 * the area (a firing-zone polygon can be huge and unrelated to where the
 * actual base gate is).
 *
 * Source: OpenStreetMap via the public Overpass API — free, no key, but a
 * shared third-party service, so treat outages/timeouts as "no data
 * available" rather than "clear". Note Israeli military sites are
 * frequently left unmapped in OSM for security reasons, so the `military`
 * category here is necessarily incomplete — it's a floor, not a
 * guarantee.
 */

const RADIUS_M = 250;
/** ~111m per 0.001° — coarser than the check radius on purpose, so nearby clicks reuse one cached lookup instead of each firing its own Overpass call. */
const CACHE_GRID_DECIMALS = 3;
const CACHE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** [osmKey, osmValues[]] — expanded into one exact-match statement per value (Overpass's regex `~` alternation isn't reliably parsed by the public instance, so this avoids it entirely). */
const TAG_FILTERS: [string, string[]][] = [
  ["landuse", ["residential", "retail"]],
  ["amenity", ["school", "hospital", "place_of_worship", "kindergarten"]],
  ["aeroway", ["gliderport"]],
  ["sport", ["gliding", "paragliding", "hang_gliding"]],
  ["power", ["plant"]],
  ["amenity", ["prison"]],
  ["amenity", ["police"]],
  ["leisure", ["stadium"]],
  ["landuse", ["military"]],
  ["military", ["base", "airfield", "training_area", "range"]],
];

function buildOverpassQuery(lat: number, lon: number): string {
  const statements = TAG_FILTERS.flatMap(([key, values]) =>
    values.flatMap((value) => [
      `way(around:${RADIUS_M},${lat},${lon})["${key}"="${value}"];`,
      `node(around:${RADIUS_M},${lat},${lon})["${key}"="${value}"];`,
    ])
  ).join("");
  return `[out:json][timeout:20];(${statements});out center tags;`;
}

export interface ProximityFinding {
  category: string;
  label: string;
  name: string | null;
  distanceM: number;
}

function gridKeyFor(lat: number, lon: number): string {
  return `${lat.toFixed(CACHE_GRID_DECIMALS)}_${lon.toFixed(CACHE_GRID_DECIMALS)}`;
}

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  if (!latParam || !lonParam) {
    return NextResponse.json({ error: "lat/lon נדרשים" }, { status: 400 });
  }
  const lat = Number(latParam);
  const lon = Number(lonParam);
  const gridKey = gridKeyFor(lat, lon);

  const supabase = createServiceRoleClient();

  const { data: cached } = await supabase
    .from("proximity_check_cache")
    .select("findings, checked_at")
    .eq("grid_key", gridKey)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.checked_at).getTime() < CACHE_MAX_AGE_MS) {
    return NextResponse.json({ available: true, findings: cached.findings, cached: true });
  }

  const overpassQuery = buildOverpassQuery(lat, lon);

  let response: Response;
  try {
    response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // The public instance's front proxy 406s requests with no User-Agent at all.
        "User-Agent": "MetisOps-DroneApp/1.0 (+https://metis-ops.com)",
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // Overpass unreachable — fall back to a stale cache entry if we have one, rather than claiming "clear".
    if (cached) return NextResponse.json({ available: true, findings: cached.findings, cached: true, stale: true });
    return NextResponse.json({ available: false, findings: [] });
  }

  if (!response.ok) {
    if (cached) return NextResponse.json({ available: true, findings: cached.findings, cached: true, stale: true });
    return NextResponse.json({ available: false, findings: [] });
  }

  const data = await response.json();
  const elements: Array<{
    type: string;
    tags?: Record<string, string>;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
  }> = data.elements ?? [];

  const point = turf.point([lon, lat]);
  const findings: ProximityFinding[] = [];

  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat === undefined || elLon === undefined) continue;

    const distanceM = turf.distance(point, turf.point([elLon, elLat]), { units: "kilometers" }) * 1000;
    const tags = el.tags ?? {};
    const category = categorize(tags);
    if (!category) continue;

    findings.push({
      category: category.category,
      label: category.label,
      name: tags.name ?? null,
      distanceM: Math.round(distanceM),
    });
  }

  findings.sort((a, b) => a.distanceM - b.distanceM);

  await supabase.from("proximity_check_cache").upsert(
    {
      grid_key: gridKey,
      center_lat: lat,
      center_lng: lon,
      findings: findings as never,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "grid_key" }
  );

  return NextResponse.json({ available: true, findings, cached: false });
}

function categorize(tags: Record<string, string>): { category: string; label: string } | null {
  if (tags.landuse === "residential" || tags.landuse === "retail") {
    return { category: "residential", label: "שכונת מגורים" };
  }
  if (["school", "hospital", "place_of_worship", "kindergarten"].includes(tags.amenity ?? "")) {
    return { category: "residential", label: "מבנה ציבור" };
  }
  if (tags.aeroway === "gliderport" || ["gliding", "paragliding", "hang_gliding"].includes(tags.sport ?? "")) {
    return { category: "aviation_sports", label: "אתר ספורט תעופתי" };
  }
  if (tags.power === "plant") {
    return { category: "power_station", label: "תחנת כוח" };
  }
  if (tags.amenity === "prison") {
    return { category: "prison", label: "בית כלא" };
  }
  if (tags.amenity === "police") {
    return { category: "police", label: "תחנת/מתקן משטרה" };
  }
  if (tags.leisure === "stadium") {
    return { category: "stadium", label: "אצטדיון" };
  }
  if (tags.landuse === "military" || ["base", "airfield", "training_area", "range"].includes(tags.military ?? "")) {
    return { category: "military", label: "מתקן צבאי" };
  }
  return null;
}
