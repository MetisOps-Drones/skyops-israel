import { NextRequest, NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/api-keys/verify";
import type { Tables } from "@/lib/types/database.types";

const LIVE_STATUSES = ["pending_dispatcher", "submitted_to_iaf", "notam_published", "auto_cleared"] as const;

/**
 * Public "live operations" layer — the CAAI-facing idea from the design
 * review: every currently-active or upcoming approved/pending coordination
 * bubble, as one GeoJSON feed. Deliberately anonymized (no pilot name,
 * phone, or org) — this is meant for a common-operating-picture consumer
 * (a regulator, a partner airspace-management tool), not for identifying
 * who's flying where. Read-only, refreshed by the consumer on their own
 * schedule (no push/websocket in v1).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request, "live_ops");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("flight_requests")
    .select("id, status, request_type, center_point_geojson, polygon_geojson, radius_meters, max_altitude_meters, start_time, end_time, notam_code")
    .in("status", LIVE_STATUSES)
    .gte("end_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (error) return NextResponse.json({ error: "שליפת נתוני התפעול החי נכשלה" }, { status: 500 });

  const rows = (data ?? []) as unknown as Array<
    Pick<
      Tables<"flight_requests">,
      | "id"
      | "status"
      | "request_type"
      | "center_point_geojson"
      | "polygon_geojson"
      | "radius_meters"
      | "max_altitude_meters"
      | "start_time"
      | "end_time"
      | "notam_code"
    >
  >;

  const features = rows
    .map((r) => {
      const polygon = r.polygon_geojson as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
      const center = r.center_point_geojson as unknown as GeoJSON.Point | null;
      const geometry: GeoJSON.Geometry | null = polygon
        ? polygon
        : center?.type === "Point"
          ? turf.circle(center.coordinates as [number, number], Math.max(r.radius_meters ?? 100, 10) / 1000, {
              units: "kilometers",
            }).geometry
          : null;
      if (!geometry) return null;

      return {
        type: "Feature" as const,
        geometry,
        properties: {
          id: r.id,
          status: r.status,
          max_altitude_meters: r.max_altitude_meters,
          start_time: r.start_time,
          end_time: r.end_time,
          notam_code: r.notam_code,
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return NextResponse.json({ type: "FeatureCollection", features });
}
