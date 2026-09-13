import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/api-keys/verify";

/**
 * Public "zones" layer feed — everything the map's zone overlays render,
 * as one GeoJSON FeatureCollection. Read-only, no PII, safe to hand to a
 * partner with a zones-scoped API key (see src/lib/api-keys and the admin
 * page at /admin/api). This is the same data BubbleMap renders internally
 * via useAirspaceZones/useAipReferenceZones — kept as a separate query
 * here rather than reusing those client hooks, which assume a browser
 * Supabase session this server route doesn't have.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request, ["zones", "map_embed"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServiceRoleClient();
  const [{ data: airspaceZones, error: airspaceError }, { data: aipZones, error: aipError }] = await Promise.all([
    supabase.from("airspace_zones").select("id, name, type, geom_geojson"),
    supabase
      .from("aip_reference_zones")
      .select("id, name, code, kind, altitude_text, min_altitude_ft, max_altitude_ft, geom_geojson"),
  ]);

  if (airspaceError || aipError) {
    return NextResponse.json({ error: "שליפת שכבת האזורים נכשלה" }, { status: 500 });
  }

  return NextResponse.json({
    type: "FeatureCollection",
    features: [
      ...(airspaceZones ?? []).map((z) => ({
        type: "Feature",
        geometry: z.geom_geojson,
        properties: { id: z.id, name: z.name, category: z.type, source: "airspace_zones" },
      })),
      ...(aipZones ?? []).map((z) => ({
        type: "Feature",
        geometry: z.geom_geojson,
        properties: {
          id: z.id,
          name: z.name,
          code: z.code,
          kind: z.kind,
          altitude_text: z.altitude_text,
          min_altitude_ft: z.min_altitude_ft,
          max_altitude_ft: z.max_altitude_ft,
          source: "aip_reference_zones",
        },
      })),
    ],
  });
}
