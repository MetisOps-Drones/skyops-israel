"use server";

import { revalidatePath } from "next/cache";
import * as turf from "@turf/turf";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  createFlightRequestSchema,
  updateFlightRequestSchema,
  type CreateFlightRequestInput,
  type UpdateFlightRequestInput,
} from "@/lib/validations/flight-request";
import type { Database, Tables } from "@/lib/types/database.types";
import { pointToWKT, multiPolygonToWKT } from "@/lib/geo/wkt";
import {
  requiredInfrastructureDistanceM,
  checkFlightAuthorizationRequirement,
  findingsRequiringAuthorization,
} from "@/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint } from "@/lib/geo/aip";
import { checkLiveNotamOverlap } from "@/lib/geo/live-notams";
import { fetchLiveNotams } from "@/lib/notams/live-feed";
import { HOBBY_GENERAL_CEILING_M, COMMERCIAL_GENERAL_CEILING_M } from "@/lib/geo/altitude-ceiling";
import { isNearBuilding, nearestSupportedBufferM } from "@/lib/geo/proximity-grid";
import { checkProximity } from "@/lib/geo/proximity-check";
import { resolveCoordinationLimit, periodStart, fetchMyCoordinationOverride } from "@/lib/coordination-quota";
import { flightRequestEditEligibility } from "@/lib/validations/flight-request-edit-window";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";

export interface CreateFlightRequestResult {
  success: boolean;
  error?: string;
  flightRequest?: Tables<"flight_requests">;
  intersectingZones?: Tables<"airspace_zones">[];
  autoCleared?: boolean;
}

interface SafetyEvalOk {
  autoCleared: boolean;
  dispatcherNotes: string | null;
  activeZones: Tables<"airspace_zones">[];
}
interface SafetyEvalError {
  error: string;
}

/**
 * The full server-side safety/regulatory evaluation — shared between
 * createFlightRequest and updateFlightRequest so an edit gets exactly the
 * same authoritative re-check a fresh submission does (the point/altitude/
 * shape can all change on edit, so the original evaluation can't just be
 * carried over). See createFlightRequest's own doc comment for what each
 * check does and why; this is that logic, unchanged, just callable twice.
 */
async function evaluateFlightRequestSafety(
  supabase: SupabaseClient<Database>,
  data: CreateFlightRequestInput,
  isHobby: boolean,
  hasOrg: boolean
): Promise<SafetyEvalOk | SafetyEvalError> {
  const centerPoint = data.center_point.coordinates as [number, number];

  const generalCeilingM = isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M;
  if (data.max_altitude_meters > generalCeilingM) {
    return { error: `תקרת הגובה החוקית הכללית עבורך היא ${generalCeilingM} מ' — לא ניתן לבקש תיאום מעל גובה זה.` };
  }

  const { data: aipZonesRaw, error: aipError } = await supabase.from("aip_reference_zones").select("*");
  if (aipError) {
    return { error: `בדיקת אזורי AIP נכשלה: ${aipError.message}` };
  }
  const aipZones = (aipZonesRaw ?? []) as AipReferenceZone[];
  const authCheck = checkFlightAuthorizationRequirement(centerPoint, aipZones);
  const altitudeAtPoint = maxLegalAltitudeAtPoint(centerPoint, aipZones);

  if (altitudeAtPoint.blockedFromGround) {
    return {
      error: "תקרת הגובה החוקית בנקודה זו היא 0 מ' מהקרקע (מרחב אווירי חופף מהקרקע) — לא ניתן לבקש תיאום לנקודה זו, גם לחשבון ארגון.",
    };
  }

  if (authCheck.blockLevel === "director_approval_only" && !hasOrg) {
    return { error: 'אזור אסור/מסוכן לטיסה — נדרש אישור פרטני של מנהל רת"א. תיאום כזה זמין רק לחשבונות ארגון.' };
  }

  // Never trust a client-supplied "no active NOTAM" claim — fetched fresh
  // here regardless of what the client's own check (FlightParamsDrawer)
  // showed, same "authoritative, re-verified" policy as the AIP check
  // above. A fetch failure fails toward "requires dispatcher review", never
  // toward auto-clear — see src/lib/notams/live-feed.ts for the source.
  let notamCheck: { inside: boolean; notams: { id: string }[] } = { inside: false, notams: [] };
  let notamCheckFailed = false;
  try {
    const liveNotams = await fetchLiveNotams();
    notamCheck = checkLiveNotamOverlap(centerPoint, liveNotams);
  } catch (err) {
    notamCheckFailed = true;
    console.error("fetchLiveNotams failed during flight request evaluation:", err);
  }

  const aipRequiresDispatcher = authCheck.blockLevel !== "none" || notamCheck.inside || notamCheckFailed;

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
    return { error: `בדיקת מרחב אווירי נכשלה: ${rpcError.message}` };
  }

  const activeZones = (intersectingZones ?? []) as Tables<"airspace_zones">[];

  let autoCleared = false;
  let dispatcherNotes: string | null = null;

  if (notamCheck.inside) {
    const notamIds = notamCheck.notams.map((n) => n.id).join(", ");
    dispatcherNotes = `נשלח לבדיקת מוקדן: נוטאם פעיל חופף לנקודה — ${notamIds}.`;
  } else if (notamCheckFailed) {
    dispatcherNotes = "נשלח לבדיקת מוקדן: בדיקת נוטאמים פעילים לא הייתה זמינה כרגע.";
  } else if (authCheck.blockLevel !== "none") {
    const zoneNames = authCheck.reasons.map((r) => r.label).join("; ");
    dispatcherNotes = `נשלח לבדיקת מוקדן: חפיפה/קרבה לאזור AIP — ${zoneNames || "ראו פרטי האזור בבקשה"}.`;
  } else if (data.request_type === "basic_auto_100m" && activeZones.length === 0) {
    const requiredDistanceM = requiredInfrastructureDistanceM(isHobby, data.max_altitude_meters);
    const bufferM = nearestSupportedBufferM(requiredDistanceM);
    const [lng, lat] = centerPoint;

    let buildingCheckAvailable = true;
    let nearBuilding = true;
    if (bufferM === null) {
      buildingCheckAvailable = false;
    } else {
      try {
        nearBuilding = await isNearBuilding(lng, lat, bufferM);
      } catch (err) {
        buildingCheckAvailable = false;
        console.error("isNearBuilding failed during flight request evaluation:", err);
      }
    }

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
      console.error("checkProximity failed during flight request evaluation:", err);
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

  return { autoCleared, dispatcherNotes, activeZones };
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
    override: await fetchMyCoordinationOverride(supabase),
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
  const evaluation = await evaluateFlightRequestSafety(supabase, data, isHobby, hasOrg);
  if ("error" in evaluation) {
    return { success: false, error: evaluation.error };
  }
  const { autoCleared, dispatcherNotes, activeZones } = evaluation;

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
 * Edits a still-fresh request in place, re-running the full safety
 * evaluation against the (possibly changed) point/altitude/shape — an edit
 * is not exempt from any check a fresh submission goes through. Blocked
 * once the 30-minute window has passed OR a dispatcher has already opened
 * the request (first_viewed_by_dispatcher_at), whichever comes first; both
 * conditions are re-checked here server-side, not just reflected in the UI.
 */
export async function updateFlightRequest(
  flightRequestId: string,
  input: UpdateFlightRequestInput
): Promise<CreateFlightRequestResult> {
  const parsed = updateFlightRequestSchema.safeParse(input);
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

  const { data: existing, error: fetchError } = await supabase
    .from("flight_requests")
    .select("user_id, created_at, first_viewed_by_dispatcher_at, status")
    .eq("id", flightRequestId)
    .single();
  if (fetchError || !existing) {
    return { success: false, error: "הבקשה לא נמצאה" };
  }
  if (existing.user_id !== user.id) {
    return { success: false, error: "אין הרשאה לערוך בקשה זו" };
  }
  if (existing.status === "cancelled") {
    return { success: false, error: "לא ניתן לערוך בקשה שבוטלה" };
  }

  const eligibility = flightRequestEditEligibility(existing);
  if (!eligibility.editable) {
    return {
      success: false,
      error:
        eligibility.reason === "viewed_by_dispatcher"
          ? "מוקדן כבר פתח את הבקשה — לא ניתן לערוך אותה יותר. ניתן לבטל ולשלוח בקשה חדשה."
          : `חלון העריכה (30 דקות מההגשה) חלף. ניתן לבטל ולשלוח בקשה חדשה.`,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
  const isHobby = profile?.role === "pilot_hobby";
  const hasOrg = Boolean(profile?.org_id);

  const evaluation = await evaluateFlightRequestSafety(supabase, data, isHobby, hasOrg);
  if ("error" in evaluation) {
    return { success: false, error: evaluation.error };
  }
  const { autoCleared, dispatcherNotes, activeZones } = evaluation;

  const { data: flightRequest, error: updateError } = await supabase
    .from("flight_requests")
    .update({
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
    .eq("id", flightRequestId)
    .select()
    .single();

  if (updateError) {
    return { success: false, error: `עדכון הבקשה נכשל: ${updateError.message}` };
  }

  revalidatePath("/map");
  revalidatePath("/ops");
  revalidatePath("/dashboard");

  return { success: true, flightRequest, intersectingZones: activeZones, autoCleared };
}

/**
 * Called when a dispatcher opens a specific request's detail (see /ops) —
 * records the moment editing stops being allowed. Idempotent: only ever
 * sets the timestamp once, so re-opening the same request later doesn't
 * keep pushing it forward.
 */
export async function markFlightRequestViewedByDispatcher(
  flightRequestId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("flight_requests")
    .update({ first_viewed_by_dispatcher_at: new Date().toISOString() })
    .eq("id", flightRequestId)
    .is("first_viewed_by_dispatcher_at", null);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
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
