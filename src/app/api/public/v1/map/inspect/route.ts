import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/api-keys/verify";
import { checkFlightAuthorizationRequirement } from "@/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint, formatAltitudeRangeMeters } from "@/lib/geo/aip";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";

/**
 * Public "map" layer — the same AIP-zone point check that drives
 * LocationInfoCard internally (src/lib/geo/flight-rules.ts,
 * src/lib/geo/aip.ts are the shared pure logic both call). Scoped to the
 * AIP-zone data only, not the OSM proximity check or live weather — those
 * depend on third-party services this app already rate-limits internally,
 * and aren't safe to expose 1:1 to an arbitrary number of partner callers.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request, ["map", "map_embed"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  const lat = Number(latParam);
  const lon = Number(lonParam);
  if (!latParam || !lonParam || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon נדרשים" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: aipZones, error } = await supabase.from("aip_reference_zones").select("*");
  if (error) return NextResponse.json({ error: "שליפת נתוני מרחב אווירי נכשלה" }, { status: 500 });

  const zones = (aipZones ?? []) as unknown as AipReferenceZone[];
  const point: [number, number] = [lon, lat];

  const zoneCheck = checkFlightAuthorizationRequirement(point, zones);
  const altitude = maxLegalAltitudeAtPoint(point, zones);

  return NextResponse.json({
    point: { lat, lon },
    zoneBlockLevel: zoneCheck.blockLevel,
    reasons: zoneCheck.reasons.map((r) => r.label),
    blockedFromGround: altitude.blockedFromGround,
    maxAltitudeKnown:
      altitude.maxAltitudeFt !== null && altitude.maxAltitudeFt !== undefined
        ? formatAltitudeRangeMeters(0, altitude.maxAltitudeFt)
        : null,
  });
}
