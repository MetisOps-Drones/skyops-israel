import * as turf from "@turf/turf";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";
import type { ProximityFinding } from "@/lib/geo/proximity-check";
import { AERODROME_RUNWAYS, type AerodromeRunway } from "@/lib/geo/aerodrome-runways";

/**
 * תקנות הטיס (הפעלת מטיסן / הפעלת כטב"ם קטן), תשפ"ד 2024 — "לא ניתן להטיס
 * בתחום שהמרחק בין גבולותיו לבין כל נקודה על מסלול שדה תעופה קטן מ-2
 * קילומטרים (או אם נקבע מרחק גדול יותר בפמ"ת)". Measured from the requested
 * point to the nearest point on the aerodrome/base RUNWAY (see
 * aerodrome-runways.ts) — not from the control zone's boundary and not from
 * the drawn bubble. Inside that distance: forbidden. Further out but still
 * inside the CTR/ATZ: flyable only with the tower's coordination.
 */
export const AERODROME_FORBIDDEN_RADIUS_KM = 2;

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
          'לפי הפמ"ת והתקנות: אזור אסור, או מרחק קטן מ-2 ק"מ ממסלול של שדה תעופה / בסיס חיל אוויר. הטסה כאן אפשרית רק באישור מראש של הגורם השולט מחוץ למערכת — אין מסלול בקשת תיאום עבור נקודה זו.',
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
          'מעבר ל-2 ק"מ מהמסלול, טיסה בתוך המרחב המבוקר מותרת רק באישור מראש של מגדל הפיקוח. ניתן להגיש בקשת תיאום — המוקדן יתאם מול המגדל ויאמת מול NOTAM עדכני לפני אישור.',
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
 * The nearest aerodrome/base runway to a point, and how far away it is —
 * the distance the 2 km rule is about. Measured from the point itself.
 */
export function nearestRunway(point: [number, number]): { runway: AerodromeRunway; distanceKm: number } | null {
  const turfPoint = turf.point(point);
  let best: { runway: AerodromeRunway; distanceKm: number } | null = null;
  for (const runway of AERODROME_RUNWAYS) {
    if (runway.line.length < 2) continue;
    const distanceKm = turf.pointToLineDistance(turfPoint, turf.lineString(runway.line), { units: "kilometers" });
    if (!best || distanceKm < best.distanceKm) best = { runway, distanceKm };
  }
  return best;
}

/**
 * What the airspace at a point means for a flight request:
 *   - within 2 km of any aerodrome/base runway, or inside a prohibited area:
 *     forbidden, no submit path;
 *   - inside a CTR/ATZ but 2 km or more from the runway: coordination with
 *     the tower;
 *   - dangerous area: director approval (organization accounts only);
 *   - restricted area: coordination under the area's conditions.
 * Always judged on the requested point (the pin), never on the size of the
 * bubble drawn around it. Same advisory-data caveat as the AIP layer itself
 * — see 0024_aip_zones_real_polygons.sql.
 */
export function checkFlightAuthorizationRequirement(
  point: [number, number],
  zones: AipReferenceZone[]
): FlightAuthorizationCheck {
  const reasons: AuthorizationReason[] = [];
  let blockLevel: ZoneBlockLevel = "none";

  function raiseTo(level: ZoneBlockLevel) {
    if (BLOCK_LEVEL_SEVERITY[level] > BLOCK_LEVEL_SEVERITY[blockLevel]) blockLevel = level;
  }

  const near = nearestRunway(point);
  if (near && near.distanceKm < AERODROME_FORBIDDEN_RADIUS_KM) {
    raiseTo("forbidden");
    reasons.push({
      label: `במרחק ${near.distanceKm.toFixed(1)} ק"מ ממסלול ${near.runway.name} — נדרשים לפחות ${AERODROME_FORBIDDEN_RADIUS_KM} ק"מ`,
      zone: null,
    });
  }

  for (const zone of zones) {
    const geom = zone.geom_geojson as unknown as GeoJSON.Geometry;
    if (!geom || geom.type !== "Polygon") continue;

    let inside = false;
    try {
      inside = turf.booleanPointInPolygon(point, geom as GeoJSON.Polygon);
    } catch {
      continue;
    }

    if (inside) {
      raiseTo(blockLevelForKind(zone.kind));
      reasons.push({ label: `בתוך ${zone.name}${zone.code ? ` (${zone.code})` : ""}`, zone });
    }
  }

  return { blockLevel, reasons };
}
