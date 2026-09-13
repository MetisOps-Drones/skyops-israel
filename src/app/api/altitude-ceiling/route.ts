import { NextRequest, NextResponse } from "next/server";
import * as turf from "@turf/turf";

/**
 * Server-side ingredients for the full legal-altitude formula (see
 * src/lib/geo/altitude-ceiling.ts for the actual math): terrain elevation,
 * to turn an AIP zone's AMSL floor into a real AGL number, and cloud base,
 * for the 150m cloud-separation rule. Both are free, keyless public
 * sources — no paid weather-provider account needed:
 *
 * - Terrain: Open Topo Data (SRTM 30m, global). Public instance caps at
 *   1 req/sec and 1000 req/day — fine for this app's volume, but if usage
 *   grows this should move to a self-hosted Open Topo Data instance.
 * - Cloud base: aviationweather.gov's own public METAR API (NOAA/FAA).
 *   Real government aviation data, not a scrape — same data pilots use.
 *   Only as good as the nearest reporting station though: Israel has a
 *   handful of METAR stations (Ben Gurion, Haifa, Ramon/Eilat, etc.), so
 *   this is a regional approximation, not a hyper-local reading.
 */

const SHARED_USER_AGENT = "MetisOps-DroneApp/1.0 (+https://metis-ops.com)";

interface MetarStation {
  icaoId: string;
  name: string;
  lat: number;
  lon: number;
  reportTime: string;
  cover: string;
  clouds: { cover: string; base: number }[];
}

async function fetchTerrainElevationM(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lon}`, {
      headers: { "User-Agent": SHARED_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const elevation = data?.results?.[0]?.elevation;
    return typeof elevation === "number" ? elevation : null;
  } catch {
    return null;
  }
}

/** Widens the search box on the first miss — Israel is small, but a tight box near the coast/desert edges can still come up empty. */
async function fetchNearestMetarWithClouds(
  lat: number,
  lon: number
): Promise<{ station: MetarStation; distanceKm: number } | null> {
  for (const deg of [1.5, 3.5]) {
    try {
      const res = await fetch(
        `https://aviationweather.gov/api/data/metar?bbox=${lat - deg},${lon - deg},${lat + deg},${lon + deg}&format=json`,
        { headers: { "User-Agent": SHARED_USER_AGENT }, signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) continue;
      const data: MetarStation[] | { value?: MetarStation[] } = await res.json();
      // The public endpoint has been observed returning both a bare array and a
      // { value: [...] } envelope for the same query — accept either shape.
      const stations: MetarStation[] = Array.isArray(data) ? data : (data.value ?? []);
      if (stations.length === 0) continue;

      const point = turf.point([lon, lat]);
      const withDistance = stations
        .filter((s) => typeof s.lat === "number" && typeof s.lon === "number")
        .map((s) => ({
          station: s,
          distanceKm: turf.distance(point, turf.point([s.lon, s.lat]), { units: "kilometers" }),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (withDistance.length > 0) return withDistance[0] ?? null;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  if (!latParam || !lonParam) {
    return NextResponse.json({ error: "lat/lon נדרשים" }, { status: 400 });
  }
  const lat = Number(latParam);
  const lon = Number(lonParam);

  const [terrainElevationM, nearestMetar] = await Promise.all([
    fetchTerrainElevationM(lat, lon),
    fetchNearestMetarWithClouds(lat, lon),
  ]);

  const clouds = nearestMetar?.station.clouds ?? [];
  const lowestCloud = clouds.length > 0 ? clouds.reduce((min, c) => (c.base < min.base ? c : min)) : null;

  return NextResponse.json({
    terrainElevationM,
    cloudBase:
      nearestMetar === null
        ? null
        : {
            // null baseFtAgl + a cover like CAVOK/CLR/NCD/SKC means the station reported no
            // significant cloud at all (i.e. none below ~5,000ft) — not "unknown".
            baseFtAgl: lowestCloud?.base ?? null,
            cover: lowestCloud?.cover ?? nearestMetar.station.cover,
            stationId: nearestMetar.station.icaoId,
            stationName: nearestMetar.station.name,
            stationDistanceKm: Math.round(nearestMetar.distanceKm),
            reportTime: nearestMetar.station.reportTime,
          },
  });
}
