import * as turf from "@turf/turf";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";
import type { ProximityFinding } from "@/lib/geo/proximity-check";
import { AERODROME_RUNWAYS, type AerodromeRunway } from "@/lib/geo/aerodrome-runways";
import { ftToM } from "@/lib/geo/aip";
import { HOBBY_GENERAL_CEILING_M } from "@/lib/geo/altitude-ceiling";
import { zoneIsInForce } from "@/lib/geo/weekday-zones";

/**
 * תקנות הטיס (הפעלת מטיסן / הפעלת כטב"ם קטן), תשפ"ד 2024 — "לא ניתן להטיס
 * בתחום שהמרחק בין גבולותיו לבין כל נקודה על מסלול שדה תעופה קטן מ-2
 * קילומטרים (או אם נקבע מרחק גדול יותר בפמ"ת)". Measured from the requested
 * point to the nearest point on the aerodrome/base RUNWAY (see
 * aerodrome-runways.ts) — not from the control zone's boundary and not from
 * the drawn bubble. Inside that distance: forbidden. Further out but still
 * inside the CTR/ATZ: flyable only with the tower's coordination.
 *
 * The commercial-operator regulation (הפעלת כטב"ם קטן) adds: "או צבאית
 * במרחק שקטן מ-3 קילומטרים" — 3 km from a military airfield. The hobby
 * regulation (הפעלת מטיסן) has only the 2 km.
 */
export const AERODROME_FORBIDDEN_RADIUS_KM = 2;
export const MILITARY_AERODROME_FORBIDDEN_RADIUS_KM = 3;

/** The forbidden radius for one runway, by the kind of airfield and the licence type of the requester. */
export function forbiddenRadiusKm(runway: AerodromeRunway, isHobby: boolean): number {
  return runway.military && !isHobby ? MILITARY_AERODROME_FORBIDDEN_RADIUS_KM : AERODROME_FORBIDDEN_RADIUS_KM;
}

/**
 * PROHIBITED (LLP — "אזור אסור"): "אין להטיס באזור אסור". The only way in is
 * an approval the CAAI gives outside this app, so this is a hard "forbidden"
 * with no submit path — same as being within 2 km of a runway.
 */
const FORBIDDEN_KINDS = new Set(["PROHIBITED"]);

/**
 * CTR/ATZ ("אזור פיקוח" / "אזור פיקוח שדה") and TMA/CTA. Past the 2 km
 * runway distance above, a flight inside is allowed "על בסיס האישור" the
 * controlling ATC unit gives — i.e. exactly a coordination request the
 * dispatcher takes to the tower. A warning with a submit path, never
 * auto-cleared (see actions/flight-requests.ts).
 */
const CONTROLLED_AIRSPACE_KINDS = new Set(["CTR", "ATZ", "TMA", "CTA"]);

/**
 * DANGER (LLD — "אזור מסוכן"). Same clause as PROHIBITED in the law ("אין
 * להטיס באזור אסור או באזור מסוכן לטיסה אלא אם כן אישר מנהל רת"א") — a
 * case-by-case sign-off from the CAAI director, not a standing/self-service
 * exemption, and not the special-authorization catalog (which only covers
 * the 9 numbered operational regulations). Only an organization account has
 * the standing process to pursue that approval, so only it may submit.
 */
const DIRECTOR_APPROVAL_ONLY_KINDS = new Set(["DANGER"]);

/**
 * RESTRICTED (LLR — "אזור מוגבל"). Both laws allow this "לפי התנאים
 * והמגבלות שנקבעו לגבי אותו אזור או באישור הגורם השולט באותו אזור" — i.e.
 * flyable subject to the area's published conditions or its controlling
 * authority's sign-off. That's exactly what a normal dispatcher-reviewed
 * coordination request already does, for every account tier including
 * hobby — no special-authorization purchase needed for the zone itself.
 */
const COORDINATION_OK_KINDS = new Set(["RESTRICTED"]);

/**
 * Which special_authorization_types.regulation_number a proximity finding
 * category maps to, so a blocked request can offer the *specific*
 * exemption inline instead of a generic "you need an authorization"
 * prompt. aviation_sports/military have no matching regulation in the
 * current catalog (they're not about flying over people/infrastructure) —
 * left unmapped on purpose rather than guessing.
 */
export const PROXIMITY_CATEGORY_REGULATION: Record<string, string> = {
  residential: "תקנה 32",
  power_station: "תקנה 32",
  prison: "תקנה 32",
  police: "תקנה 32",
  stadium: "תקנה 32",
};

/**
 * תקנות הטיס (הפעלת מטיסן), תשפ"ד 2024, תקנה בעניין הפעלה מעל תשתית: מרחק
 * קבוע מתשתית, ללא תלות בגובה הטיסה בפועל (לטיסן ממילא תקרה קבועה של 50 מ').
 */
export const HOBBY_INFRASTRUCTURE_DISTANCE_M = 150;

/**
 * המרחק המזערי החוקי מתשתית תלוי ברישיון:
 * - מטיסן (תחביב, "sport and pnay"): מספר קבוע — 150 מ', ללא תלות בגובה.
 * - מטיס (מסחרי/כטב"ם קטן, תקנה 32 לתקנות הטיס (הפעלת כטב"ם קטן), תשפ"ד 2024):
 *   "המרחק בין הכטב"ם הקטן לבין תשתית קטן מגובה הטיסה שלו" — כלומר המרחק
 *   הנדרש שווה לגובה ההטסה המתוכנן עצמו, בלי רצפה נוספת (בשונה מהמרחק
 *   הנדרש מאדם, ששם יש רצפה של 50 מ').
 */
export function requiredInfrastructureDistanceM(isHobby: boolean, altitudeM: number): number {
  return isHobby ? HOBBY_INFRASTRUCTURE_DISTANCE_M : altitudeM;
}

/**
 * מסנן את ממצאי הקרבה (proximity findings) לאלה שבאמת חוצים את המרחק
 * החוקי המזערי לרישיון/לגובה הנתונים — לא כל מתקן שנמצא בטווח החיפוש של
 * ה-API (250 מ', ראה src/app/api/proximity-check/route.ts). טווח החיפוש
 * הוא רק "עד כמה רחוק לחפש", לא הסף המשפטי בפועל.
 */
export function findingsRequiringAuthorization(
  findings: ProximityFinding[],
  isHobby: boolean,
  altitudeM: number
): ProximityFinding[] {
  const requiredM = requiredInfrastructureDistanceM(isHobby, altitudeM);
  return findings.filter((f) => f.distanceM < requiredM);
}

export type ZoneBlockLevel =
  | "none"
  /** Inside a controlled zone (CTR/ATZ/TMA/CTA) but 2 km or more from the runway: needs the tower's coordination, still submittable. */
  | "controlled_airspace"
  /** Hard block for every account: a prohibited area, or within 2 km of an aerodrome/base runway. */
  | "forbidden"
  /** Dangerous area: blocked in-app for a solo account; an org may submit while the dispatcher chases the CAAI director's sign-off. */
  | "director_approval_only"
  /** Restricted area: flyable through the normal coordination-request flow, subject to the area's published conditions. */
  | "coordination_ok";

const BLOCK_LEVEL_SEVERITY: Record<ZoneBlockLevel, number> = {
  none: 0,
  coordination_ok: 1,
  controlled_airspace: 2,
  director_approval_only: 3,
  forbidden: 4,
};

function blockLevelForKind(kind: string): ZoneBlockLevel {
  if (FORBIDDEN_KINDS.has(kind)) return "forbidden";
  if (DIRECTOR_APPROVAL_ONLY_KINDS.has(kind)) return "director_approval_only";
  if (CONTROLLED_AIRSPACE_KINDS.has(kind)) return "controlled_airspace";
  if (COORDINATION_OK_KINDS.has(kind)) return "coordination_ok";
  return "none";
}

export interface ZoneVerdict {
  tone: "forbidden" | "approval" | "warning" | "conditions" | "none";
  headline: string;
  detail: string;
  /** Whether a coordination request may still be submitted for this account. */
  canSubmit: boolean;
  /** A solo account blocked only because it isn't an organization — upgrading actually changes the outcome. */
  upgradeHelps: boolean;
}

/**
 * The one place that decides what a zone level means for a given account
 * and how to say it — LocationInfoCard, FlightParamsDrawer and the server
 * action all read this instead of each re-deriving (and drifting on) their
 * own wording. Deliberately names the *type* of restriction: אסור / מסוכן /
 * מוגבל are three different legal outcomes, not one generic "zone".
 */
export function zoneVerdictFor(level: ZoneBlockLevel, hasOrg: boolean): ZoneVerdict {
  switch (level) {
    case "forbidden":
      return {
        tone: "forbidden",
        headline: "אסור להטיס באזור זה",
        detail:
          'לפי הפמ"ת והתקנות: אזור אסור, או מרחק קטן מ-2 ק"מ ממסלול של שדה תעופה (3 ק"מ משדה צבאי למפעיל מסחרי). הטסה כאן אפשרית רק באישור מראש של הגורם השולט מחוץ למערכת — אין מסלול בקשת תיאום עבור נקודה זו.',
        canSubmit: false,
        upgradeHelps: false,
      };
    case "director_approval_only":
      return hasOrg
        ? {
            tone: "approval",
            headline: 'אזור מסוכן — אסור להטיס אלא באישור מנהל רת"א',
            detail: "ניתן להגיש בקשה כחשבון ארגון — המוקדן ישיג את האישור הפרטני לפני כל אישור.",
            canSubmit: true,
            upgradeHelps: false,
          }
        : {
            tone: "forbidden",
            headline: "אזור מסוכן — אסור להטיס",
            detail: 'נדרש אישור פרטני של מנהל רת"א. תיאום כזה זמין רק לחשבונות ארגון, שיש להם תהליך מול הרשות להשיג אותו.',
            canSubmit: false,
            upgradeHelps: true,
          };
    case "controlled_airspace":
      return {
        tone: "warning",
        headline: "בתוך מרחב מבוקר (CTR/ATZ) — נדרש תיאום מול מגדל הפיקוח",
        detail:
          'מעבר למרחק האסור מהמסלול (2 ק"מ, ו-3 ק"מ משדה צבאי למפעיל מסחרי), טיסה בתוך המרחב המבוקר מותרת רק באישור מראש של מגדל הפיקוח. ניתן להגיש בקשת תיאום — המוקדן יתאם מול המגדל ויאמת מול NOTAM עדכני לפני אישור.',
        canSubmit: true,
        upgradeHelps: false,
      };
    case "coordination_ok":
      return {
        tone: "conditions",
        headline: "אזור מוגבל — טיסה רק לפי תנאי האזור או באישור הגורם השולט",
        detail: "ניתן להגיש בקשת תיאום — המוקדן יתאם מול הגורם השולט באזור ויבדוק את התנאים שפורסמו.",
        canSubmit: true,
        upgradeHelps: false,
      };
    default:
      return { tone: "none", headline: "", detail: "", canSubmit: true, upgradeHelps: false };
  }
}

export interface AuthorizationReason {
  label: string;
  zone: AipReferenceZone | null;
}

export interface FlightAuthorizationCheck {
  /** The most restrictive level triggered by any overlapping/nearby zone. */
  blockLevel: ZoneBlockLevel;
  reasons: AuthorizationReason[];
}

/**
 * The aerodrome/base runway the point is most inside the forbidden distance
 * of (smallest distance minus that runway's own radius — a military base's
 * 3 km can outrank a civil strip that is closer in absolute terms), with the
 * distance and the radius that applies. Measured from the point itself.
 */
export function nearestRunway(
  point: [number, number],
  isHobby: boolean
): { runway: AerodromeRunway; distanceKm: number; radiusKm: number } | null {
  const turfPoint = turf.point(point);
  let best: { runway: AerodromeRunway; distanceKm: number; radiusKm: number } | null = null;
  for (const runway of AERODROME_RUNWAYS) {
    if (runway.line.length < 2) continue;
    const distanceKm = turf.pointToLineDistance(turfPoint, turf.lineString(runway.line), { units: "kilometers" });
    const radiusKm = forbiddenRadiusKm(runway, isHobby);
    if (!best || distanceKm - radiusKm < best.distanceKm - best.radiusKm) best = { runway, distanceKm, radiusKm };
  }
  return best;
}

/**
 * What the airspace at a point means for a flight request:
 *   - within 2 km of any aerodrome runway (3 km of a military airfield for a
 *     commercial operator), or inside a prohibited area: forbidden, no
 *     submit path;
 *   - inside a CTR/ATZ but beyond that distance: coordination with the
 *     tower;
 *   - dangerous area: director approval (organization accounts only);
 *   - restricted area: coordination under the area's conditions.
 * Always judged on the requested point (the pin), never on the size of the
 * bubble drawn around it. Same advisory-data caveat as the AIP layer itself
 * — see 0024_aip_zones_real_polygons.sql.
 */
export function checkFlightAuthorizationRequirement(
  point: [number, number],
  zones: AipReferenceZone[],
  /** Hobby (מטיסן) has only the 2 km runway rule; any other caller gets the stricter commercial 3 km military rule (the safe default when the licence type isn't known). */
  isHobby = false,
  options?: {
    /**
     * Highest altitude the drone can be at, in meters AMSL (ground elevation + planned altitude). A zone whose
     * floor is above that can't touch the flight — e.g. the 9,000 ft Tel Aviv upper-control sector covers
     * Tel Aviv, but no drone ever reaches it. Omitted/null = unknown, and every zone then counts (the
     * conservative default; never guess the ground).
     */
    maxAltitudeAmslM?: number | null;
    /**
     * Planned flight height above the ground, in meters. Areas that only limit small drones to a height
     * (helicopter areas, the 100-ft area — `drone_max_altitude_m`) count only when this exceeds that cap.
     * Omitted/null = not chosen yet: a hobby account is judged at its fixed ceiling, anyone else is assumed
     * to fly above the cap.
     */
    plannedAltitudeM?: number | null;
    /**
     * The requested flight window. Weekday-only areas (`weekdays_only`) count only if the window touches a
     * weekday; omitted = judged at the current moment (a point inspected on the map).
     */
    window?: { start: Date; end: Date } | null;
  }
): FlightAuthorizationCheck {
  const reasons: AuthorizationReason[] = [];
  let blockLevel: ZoneBlockLevel = "none";

  function raiseTo(level: ZoneBlockLevel) {
    if (BLOCK_LEVEL_SEVERITY[level] > BLOCK_LEVEL_SEVERITY[blockLevel]) blockLevel = level;
  }

  const near = nearestRunway(point, isHobby);
  if (near && near.distanceKm < near.radiusKm) {
    raiseTo("forbidden");
    reasons.push({
      label: `במרחק ${near.distanceKm.toFixed(1)} ק"מ ממסלול ${near.runway.name} — נדרשים לפחות ${near.radiusKm} ק"מ`,
      zone: null,
    });
  }

  const ceilingAmslM = options?.maxAltitudeAmslM ?? null;
  const plannedAltitudeM = options?.plannedAltitudeM ?? (isHobby ? HOBBY_GENERAL_CEILING_M : null);

  for (const zone of zones) {
    const geom = zone.geom_geojson as unknown as GeoJSON.Geometry;
    if (!geom || geom.type !== "Polygon") continue;
    if (!zoneIsInForce(zone, options?.window)) continue;
    if (zone.drone_max_altitude_m != null && plannedAltitudeM !== null && plannedAltitudeM <= zone.drone_max_altitude_m) continue;
    if (ceilingAmslM !== null && zone.min_altitude_ft !== null && ftToM(zone.min_altitude_ft) > ceilingAmslM) continue;

    let inside = false;
    try {
      inside = turf.booleanPointInPolygon(point, geom as GeoJSON.Polygon);
    } catch {
      continue;
    }

    if (inside) {
      raiseTo(blockLevelForKind(zone.kind));
      const capNote = zone.drone_max_altitude_m != null ? ` — כטב"ם מעל ${zone.drone_max_altitude_m} מ' טעון תיאום` : "";
      reasons.push({ label: `בתוך ${zone.name}${zone.code ? ` (${zone.code})` : ""}${capNote}`, zone });
    }
  }

  return { blockLevel, reasons };
}
