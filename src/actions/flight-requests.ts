"use server";

import { revalidatePath } from "next/cache";
import * as turf from "@turf/turf";
import { createClient } from "@/lib/supabase/server";
import { createFlightRequestSchema, type CreateFlightRequestInput } from "@/lib/validations/flight-request";
import type { Tables } from "@/lib/types/database.types";
import { pointToWKT, multiPolygonToWKT } from "@/lib/geo/wkt";
import {
  requiredInfrastructureDistanceM,
  checkFlightAuthorizationRequirement,
  findingsRequiringAuthorization,
} from "@/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint } from "@/lib/geo/aip";
import { HOBBY_GENERAL_CEILING_M, COMMERCIAL_GENERAL_CEILING_M } from "@/lib/geo/altitude-ceiling";
import { isNearBuilding, nearestSupportedBufferM } from "@/lib/geo/proximity-grid";
import { checkProximity } from "@/lib/geo/proximity-check";
import { resolveCoordinationLimit, periodStart } from "@/lib/coordination-quota";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";

export interface CreateFlightRequestResult {
  success: boolean;
  error?: string;
  flightRequest?: Tables<"flight_requests">;
  intersectingZones?: Tables<"airspace_zones">[];
  autoCleared?: boolean;
}

/**
 * Authoritative server-side counterpart to every client-side check the map
 * runs (useAirspaceCheck, checkFlightAuthorizationRequirement,
 * useBuildingProximity, useProximityCheck) — re-verified here so a stale or
 * tampered client can never talk its way into an auto-clearance the server
 * would otherwise disagree with. Until this pass, that authoritative-ness
 * was only true for the mock `airspace_zones` table and building
 * proximity — the *real* AIP reference-zone data (aip_reference_zones, 179
 * of 185 zones with precise geometry from the official AIP) was checked
 * and shown to the pilot client-side only, meaning a genuinely
 * prohibited/danger/controlled-airspace point could still auto-clear here
 * as long as it missed the 4 airspace_zones demo rows. This now runs the
 * same checkFlightAuthorizationRequirement the map uses, plus the flat
 * legal altitude ceiling, plus the OSM-based proximity categories
 * (schools, prisons, police, power stations, stadiums) that
 * useProximityCheck flags client-side. Policy for anything the AIP layer
 * flags: never auto-clear, always route to a dispatcher for a manual
 * decision — except a zone that reaches the ground (no legal altitude to
 * fly at, at all) and a prohibited/danger zone for a solo/non-org account
 * (needs a case-by-case CAAI-director approval this app can't grant),
 * which have no coordination path per the regulations and are rejected
 * outright instead.
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

  const hasOrg = Boolean(profile?.org_id);
  const centerPoint = data.center_point.coordinates as [number, number];

  // Flat legal altitude ceiling — the client only ever offers 50/100/150m
  // bands and restricts hobby to 50m, but nothing enforced that server-side
  // until now, so a direct call to this action could request any altitude
  // up to the schema's raw 2000m cap regardless of role.
  const generalCeilingM = isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M;
  if (data.max_altitude_meters > generalCeilingM) {
    return {
      success: false,
      error: `תקרת הגובה החוקית הכללית עבורך היא ${generalCeilingM} מ' — לא ניתן לבקש תיאום מעל גובה זה.`,
    };
  }

  // The real AIP reference-zone data (179/185 zones with precise official
  // geometry) — checkFlightAuthorizationRequirement is the same function
  // the map itself runs client-side to decide what to show a pilot; running
  // it here too is what makes those warnings actually mean something for
  // what gets auto-cleared, not just what gets displayed.
  const { data: aipZonesRaw, error: aipError } = await supabase.from("aip_reference_zones").select("*");
  if (aipError) {
    return { success: false, error: `בדיקת אזורי AIP נכשלה: ${aipError.message}` };
  }
  const aipZones = (aipZonesRaw ?? []) as AipReferenceZone[];
  const authCheck = checkFlightAuthorizationRequirement(centerPoint, aipZones);
  const altitudeAtPoint = maxLegalAltitudeAtPoint(centerPoint, aipZones);

  if (altitudeAtPoint.blockedFromGround) {
    return {
      success: false,
      error: "תקרת הגובה החוקית בנקודה זו היא 0 מ' מהקרקע (מרחב אווירי חופף מהקרקע) — לא ניתן לבקש תיאום לנקודה זו, גם לחשבון ארגון.",
    };
  }

  if (authCheck.blockLevel === "director_approval_only" && !hasOrg) {
    return {
      success: false,
      error: 'אזור אסור/מסוכן לטיסה — נדרש אישור פרטני של מנהל רת"א. תיאום כזה זמין רק לחשבונות ארגון.',
    };
  }

  // Everything else the AIP layer flags (restricted zones, proximity to
  // controlled airspace, or a prohibited/danger zone for an org account
  // that can chase the director approval externally) must never
  // auto-clear — always a dispatcher's manual call, the same way it's
  // already presented as a warning rather than a block in the UI.
  const aipRequiresDispatcher = authCheck.blockLevel !== "none";

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

  if (aipRequiresDispatcher) {
    const zoneNames = authCheck.reasons.map((r) => r.label).join("; ");
    dispatcherNotes = `נשלח לבדיקת מוקדן: חפיפה/קרבה לאזור AIP — ${zoneNames || "ראו פרטי האזור בבקשה"}.`;
  } else if (data.request_type === "basic_auto_100m" && activeZones.length === 0) {
    const requiredDistanceM = requiredInfrastructureDistanceM(isHobby, data.max_altitude_meters);
    const bufferM = nearestSupportedBufferM(requiredDistanceM);
    const [lng, lat] = centerPoint;

    let buildingCheckAvailable = true;
    let nearBuilding = true;
    if (bufferM === null) {
      // requiredDistanceM exceeds every precomputed grid (150m) — no larger
      // radius to check against, so this can't be verified as clear.
      buildingCheckAvailable = false;
    } else {
      try {
        nearBuilding = await isNearBuilding(lng, lat, bufferM);
      } catch (err) {
        buildingCheckAvailable = false;
        console.error("isNearBuilding failed during flight request creation:", err);
      }
    }

    // The OSM-based categories (residential areas, schools, prisons, police,
    // power stations, stadiums) that useProximityCheck/findingsRequiringAuthorization
    // flag client-side — previously only advisory, never re-checked here, so
    // a point missing a building in the grid but sitting next to e.g. a
    // police station could still auto-clear. Overpass is a shared
    // third-party service that can be slow/unreachable — treat "couldn't
    // check" the same as "found something", not as "clear".
    let osmCheckAvailable = true;
    let osmNeedsAuthorization = false;
    try {
      const proximityResult = await checkProximity(lat, lng);
      if (proximityResult.available) {
        const relevant = findingsRequiringAuthorization(proximityResult.findings, isHobby, data.max_altitude_meters);
        osmNeedsAuthorization = relevant.length > 0;
      } else {
        osmCheckAvailable = false;
      }
    } catch (err) {
      osmCheckAvailable = false;
      console.error("checkProximity failed during flight request creation:", err);
    }

    if (buildingCheckAvailable && !nearBuilding && osmCheckAvailable && !osmNeedsAuthorization) {
      autoCleared = true;
      dispatcherNotes = "אושר אוטומטית: אין חפיפה עם מרחב אווירי מוגבל ואין מבנה/אתר רגיש ידוע בטווח המרחק החוקי מהנקודה.";
    } else if (!buildingCheckAvailable) {
      dispatcherNotes = "נשלח לבדיקת מוקדן: בדיקת קרבה למבנים לא הייתה זמינה כרגע, יש לאמת קרבה למבנים באופן ידני.";
    } else if (nearBuilding) {
      dispatcherNotes = "נשלח לבדיקת מוקדן: נמצא מבנה בטווח המרחק החוקי מהנקודה — נדרשת הרשאת הפעלה מיוחדת.";
    } else if (!osmCheckAvailable) {
      dispatcherNotes = "נשלח לבדיקת מוקדן: בדיקת קרבה לאתרים רגישים (בתי ספר, מתקני ציבור וכו') לא הייתה זמינה כרגע.";
    } else {
      dispatcherNotes = "נשלח לבדיקת מוקדן: נמצא אתר רגיש (מגורים/מוסד ציבורי/תשתית) בטווח המרחק החוקי מהנקודה — נדרשת הרשאת הפעלה מיוחדת.";
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
