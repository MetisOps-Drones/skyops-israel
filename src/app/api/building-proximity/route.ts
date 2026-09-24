import { NextRequest, NextResponse } from "next/server";
import { isNearBuilding, nearestSupportedBufferM } from "@/lib/geo/proximity-grid";

/**
 * Authoritative local building-proximity check — backed by the VIDA/Overture
 * buildings dataset (~3.5M buildings, see src/lib/geo/proximity-grid.ts),
 * not the OSM/Overpass-based /api/proximity-check. Complements that route
 * rather than replacing it: Overpass gives category (school, hospital,
 * power plant...) but can miss unmapped buildings or be unreachable;
 * this answers "is there a building at all near this point" from a
 * comprehensive static dataset, in O(1) with no external service call.
 */
export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  const bufferParam = request.nextUrl.searchParams.get("bufferM");
  if (!latParam || !lonParam || !bufferParam) {
    return NextResponse.json({ error: "lat/lon/bufferM נדרשים" }, { status: 400 });
  }

  const lat = Number(latParam);
  const lon = Number(lonParam);
  const requestedM = Number(bufferParam);
  const bufferM = nearestSupportedBufferM(requestedM);

  // null = requestedM exceeds every precomputed grid (150m) — there's no
  // larger radius to check, so this must fail closed (unavailable) rather
  // than silently checking a smaller radius than what was actually asked for.
  if (bufferM === null) {
    return NextResponse.json({ available: false, isNearBuilding: false, bufferM: requestedM });
  }

  try {
    const near = await isNearBuilding(lon, lat, bufferM);
    return NextResponse.json({ available: true, isNearBuilding: near, bufferM });
  } catch (err) {
    console.error("building-proximity failed:", err);
    // TEMPORARY: surfacing the real error message to diagnose a
    // production-only failure that doesn't reproduce locally — revert once
    // root-caused, this isn't meant to stay in the response long-term.
    return NextResponse.json({
      available: false,
      isNearBuilding: false,
      bufferM,
      debugError: err instanceof Error ? err.message : String(err),
    });
  }
}
