"use server";

import { revalidatePath } from "next/cache";
import * as turf from "@turf/turf";
import { createClient } from "@/lib/supabase/server";
import { createFlightRequestSchema, type CreateFlightRequestInput } from "@/lib/validations/flight-request";
import type { Tables } from "@/lib/types/database.types";
import { pointToWKT, multiPolygonToWKT } from "@/lib/geo/wkt";
import { requiredInfrastructureDistanceM } from "@/lib/geo/flight-rules";
import { isNearBuilding, nearestSupportedBufferM } from "@/lib/geo/proximity-grid";
import { resolveCoordinationLimit, periodStart } from "@/lib/coordination-quota";

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
 * with. Also re-runs the building-proximity check server-side, via the same
 * R2 bitmap grid (proximity-grid.ts) the client uses — the client-side
 * warning in FlightParamsDrawer is advisory only, so without this a request
 * over a building could still auto-clear here as long as it missed the 4
 * demo airspace_zones rows. NOT the `buildings_near_point` RPC/table
 * (0075/0076): that table was never loaded with data (doesn't fit the free
 * tier — see proximity-grid.ts) and always answers "no building nearby". If
 * the grid fails to load, this fails closed (no auto-clear, sent to a
 * dispatcher) rather than assuming "no building".
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id, plan_code")
    .eq("id", user.id)
    .single();
  const isHobby = profile?.role === "pilot_hobby";

  // The client-side check in FlightParamsDrawer (useCoordinationQuota) is
  // advisory only — this is the one that actually can't be skipped by a
  // stale client or a direct call to this action. Checked before the
  // zone-intersection RPC below so an over-quota request fails fast rather
  // than paying for that lookup first.
  const coordinationLimit = resolveCoordinationLimit({
    role: profile?.role ?? null,
    hasOrg: Boolean(profile?.org_id),
    planCode: profile?.plan_code ?? null,
  });
  if (coordinationLimit) {
    const since = periodStart(coordinationLimit.period);
    const { data: recentRequests, error: quotaError } = await supabase
      .from("flight_requests")
      .select("request_type")
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .gte("created_at", since.toISOString());
    if (quotaError) {
      return { success: false, error: `בדיקת מכסת תיאומים נכשלה: ${quotaError.message}` };
    }
    const periodLabel = coordinationLimit.period === "week" ? "השבוע" : "החודש";
    if ((recentRequests?.length ?? 0) >= coordinationLimit.count) {
      return {
        success: false,
        error: `מיצית את מכסת ${coordinationLimit.count} התיאומים ${periodLabel} בתוכנית הנוכחית. ניתן לשדרג דרך "הפרופיל שלי" ← "מנוי".`,
      };
    }
    if (data.request_type === "manual_notam_bubble") {
      const complexUsed = (recentRequests ?? []).filter((r) => r.request_type === "manual_notam_bubble").length;
      if (complexUsed >= coordinationLimit.complexAllowed) {
        return {
          success: false,
          error:
            coordinationLimit.complexAllowed === 0
              ? 'תיאומי בועת NOTAM אינם כלולים בתוכנית הנוכחית. ניתן לשדרג דרך "הפרופיל שלי" ← "מנוי".'
              : `מיצית את מכסת תיאומי בועת NOTAM (${coordinationLimit.complexAllowed}) ${periodLabel} בתוכנית הנוכחית.`,
        };
      }
    }
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

  let autoCleared = false;
  let dispatcherNotes: string | null = null;

  if (data.request_type === "basic_auto_100m" && activeZones.length === 0) {
    const requiredDistanceM = requiredInfrastructureDistanceM(isHobby, data.max_altitude_meters);
    const bufferM = nearestSupportedBufferM(requiredDistanceM);
    const [lng, lat] = data.center_point.coordinates;
    let buildingCheckAvailable = true;
    let nearBuilding = true;
    try {
      nearBuilding = await isNearBuilding(lng, lat, bufferM);
    } catch (err) {
      buildingCheckAvailable = false;
      console.error("isNearBuilding failed during flight request creation:", err);
    }

    if (buildingCheckAvailable && !nearBuilding) {
      autoCleared = true;
      dispatcherNotes = "אושר אוטומטית: אין חפיפה עם מרחב אווירי מוגבל ואין מבנה ידוע בטווח המרחק החוקי מהנקודה.";
    } else {
      dispatcherNotes = buildingCheckAvailable
        ? 'נשלח לבדיקת מוקדן: נמצא מבנה בטווח המרחק החוקי מהנקודה (תקנה 32) — נדרשת הרשאת הפעלה מיוחדת.'
        : "נשלח לבדיקת מוקדן: בדיקת קרבה למבנים לא הייתה זמינה כרגע, יש לאמת קרבה למבנים באופן ידני.";
    }
  }

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
      dispatcher_notes: dispatcherNotes,
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

/**
 * Ties a flight request to a confirmed marketplace booking via the
 * short-lived association code generated on confirm (0060/0062) — lets the
 * hiring org see a flight request the freelancer files for that job, or vice
 * versa, without changing flight_requests' single-owner (`user_id`) shape.
 */
export async function linkFlightRequestToBooking(
  flightRequestId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("link_flight_request_to_booking", {
    target_flight_request_id: flightRequestId,
    code,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/map");
  revalidatePath("/marketplace");
  return { success: true };
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
