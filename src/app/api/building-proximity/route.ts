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
  const bufferM = nearestSupportedBufferM(Number(bufferParam));

  try {
    const near = await isNearBuilding(lon, lat, bufferM);
    return NextResponse.json({ available: true, isNearBuilding: near, bufferM });
  } catch (err) {
    console.error("building-proximity failed:", err);
    return NextResponse.json({ available: false, isNearBuilding: false, bufferM });
  }
}
