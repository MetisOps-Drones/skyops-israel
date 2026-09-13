"use server";

import { revalidatePath } from "next/cache";
import * as turf from "@turf/turf";
import { createClient } from "@/lib/supabase/server";
import { createFlightRequestSchema, type CreateFlightRequestInput } from "@/lib/validations/flight-request";
import type { Tables } from "@/lib/types/database.types";
import { pointToWKT, multiPolygonToWKT } from "@/lib/geo/wkt";

export interface CreateFlightRequestResult {
  success: boolean;
  error?: string;
  flightRequest?: Tables<"flight_requests">;
  intersectingZones?: Tables<"airspace_zones">[];
  autoCleared?: boolean;
}

/**
 * Authoritative server-side counterpart to the client-side check in
 * `src/hooks/useAirspaceCheck.ts`. Runs the real PostGIS `ST_Intersects`
 * query (`find_intersecting_zones`, defined in
 * supabase/migrations/0005_airspace_zones.sql) against the live
 * `airspace_zones` table rather than the bundled mock GeoJSON, so a stale
 * client can never talk its way into an auto-clearance the server disagrees
 * with.
 */
export async function createFlightRequest(
  input: CreateFlightRequestInput
): Promise<CreateFlightRequestResult> {
  const parsed = createFlightRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }
  const data = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "יש להתחבר מחדש" };
  }

  const footprint =
    data.request_type === "manual_notam_bubble" && data.polygon
      ? data.polygon
      : turf.circle(data.center_point.coordinates, (data.radius_meters ?? 100) / 1000, {
          units: "kilometers",
        }).geometry;

  const { data: intersectingZones, error: rpcError } = await supabase.rpc("find_intersecting_zones", {
    candidate_geom_geojson: footprint as never,
    candidate_min_alt: 0,
    candidate_max_alt: data.max_altitude_meters,
  });

  if (rpcError) {
    return { success: false, error: `בדיקת מרחב אווירי נכשלה: ${rpcError.message}` };
  }

  const activeZones = (intersectingZones ?? []) as Tables<"airspace_zones">[];
  const autoCleared = data.request_type === "basic_auto_100m" && activeZones.length === 0;

  const { data: flightRequest, error: insertError } = await supabase
    .from("flight_requests")
    .insert({
      user_id: user.id,
      drone_id: data.drone_id,
      request_type: data.request_type,
      center_point: pointToWKT(data.center_point.coordinates),
      radius_meters: data.radius_meters ?? null,
      polygon:
        data.request_type === "manual_notam_bubble" && data.polygon
          ? multiPolygonToWKT([data.polygon.coordinates])
          : null,
      max_altitude_meters: data.max_altitude_meters,
      flight_purpose: data.flight_purpose,
      start_time: data.start_time.toISOString(),
      end_time: data.end_time.toISOString(),
      status: autoCleared ? "auto_cleared" : "pending_dispatcher",
      emergency_contact_phone: data.emergency_contact_phone,
      intersecting_zone_ids: activeZones.map((z) => z.id),
      dispatcher_notes: autoCleared
        ? "אושר אוטומטית: אין חפיפה עם מרחב אווירי מוגבל."
        : null,
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, error: `שמירת הבקשה נכשלה: ${insertError.message}` };
  }

  revalidatePath("/map");
  revalidatePath("/ops");
  revalidatePath("/dashboard");

  return { success: true, flightRequest, intersectingZones: activeZones, autoCleared };
}

export async function cancelFlightRequest(flightRequestId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("flight_requests")
    .update({ status: "cancelled" })
    .eq("id", flightRequestId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/map");
  revalidatePath("/ops");
  return { success: true };
}
