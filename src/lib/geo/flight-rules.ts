import * as turf from "@turf/turf";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";
import type { ProximityFinding } from "@/lib/geo/proximity-check";

/**
 * תקנות הטיס (הפעלת מטיסן / הפעלת כטב"ם קטן), תשפ"ד 2024 — "לא ניתן להטיס
 * בתחום שהמרחק בין גבולותיו לבין כל נקודה על מסלול שדה תעופה קטן מ-2
 * קילומטרים (או אם נקבע מרחק גדול יותר בפמ"ת)". Measured here from the
 * drawn CTR/ATZ boundary, which sits well outside any runway, so it's the
 * conservative side of the same rule (the 3 km military-airfield clause for
 * a commercial operator is covered the same way — every air force base has
 * a CTR much wider than 3 km, plus the CAAI base-restriction polygons).
 */
const AIRPORT_BUFFER_KM = 2;

/**
 * CTR/ATZ ("אזור פיקוח" / "אזור פיקוח שדה") and PROHIBITED (LLP — "אזור
 * אסור", which also carries the CAAI air-force-base restriction polygons).
 * The regulations are unambiguous: "לא ניתן להטיס באזור פיקוח, באזור פיקוח
 * שדה או באזור שדה" and "אין להטיס באזור אסור". The only way in is an
 * approval the controlling ATC unit/CAAI gives outside this app — so this
 * is a hard "forbidden", never a "requires coordination" with a submit
 * button (that wording is what made a point 4 km from the Hatzor base read
 * as "just coordinate it").
 */
const FORBIDDEN_KINDS = new Set(["CTR", "ATZ", "PROHIBITED"]);

/** Only a real aerodrome's own zones get the 2 km distance rule — a TMA/CTA floor is far above any drone. */
const AIRPORT_BUFFER_KINDS = new Set(["CTR", "ATZ"]);

/** TMA/CTA — controlled airspace that starts above the ground. A warning and a dispatcher check, not a block. */
const CONTROLLED_AIRSPACE_KINDS = new Set(["TMA", "CTA"]);

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
  /** Controlled airspace that starts above the ground (TMA/CTA): flag it, a dispatcher verifies, still submittable. */
  | "controlled_airspace"
  /** Hard block for every account: inside/within 2 km of a CTR/ATZ, a prohibited area, or an air-force-base restriction. */
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
          'לפי הפמ"ת והתקנות: אזור פיקוח / שדה תעופה / בסיס חיל אוויר / אזור אסור. הטסה כאן אפשרית רק באישור מראש של הגורם השולט מחוץ למערכת — אין מסלול בקשת תיאום עבור נקודה זו.',
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
        headline: "מרחב אווירי מבוקר באזור — נדרשת בדיקה ידנית",
        detail: "ניתן להגיש בקשת תיאום — המוקדן יאמת מול הגורם השולט ו-NOTAM עדכני לפני אישור.",
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
 * What an AIP reference zone at this point means for coordination: fully
 * blocked (controlled airspace — no exception exists), blocked pending a
 * manual director approval (prohibited/danger), or a normal
 * conditions-based coordination request (restricted). Also flags
 * proximity to an airport control zone (CTR/ATZ/TMA) even just outside its
 * drawn boundary. Same advisory-data caveat as the AIP layer itself — see
 * 0024_aip_zones_real_polygons.sql.
 */
export function checkFlightAuthorizationRequirement(
  point: [number, number],
  zones: AipReferenceZone[],
  /** The requested flight footprint (circle/drawn polygon). Omit for a bare point inspection. */
  footprint?: GeoJSON.Polygon | null,
  /** Radius of a circular footprint, so the 2 km rule is measured from its edge rather than its centre. */
  radiusM?: number
): FlightAuthorizationCheck {
  const reasons: AuthorizationReason[] = [];
  let blockLevel: ZoneBlockLevel = "none";
  const turfPoint = turf.point(point);
  const footprintEdgeKm = footprint && radiusM ? radiusM / 1000 : 0;

  function raiseTo(level: ZoneBlockLevel) {
    if (BLOCK_LEVEL_SEVERITY[level] > BLOCK_LEVEL_SEVERITY[blockLevel]) blockLevel = level;
  }

  for (const zone of zones) {
    const geom = zone.geom_geojson as unknown as GeoJSON.Geometry;
    if (!geom || geom.type !== "Polygon") continue;

    let inside = false;
    try {
      // A bubble whose edge crosses into the zone is in the zone as far as
      // the rules go — the centre alone can sit outside it.
      inside =
        turf.booleanPointInPolygon(point, geom as GeoJSON.Polygon) ||
        Boolean(footprint && turf.booleanIntersects(footprint, geom as GeoJSON.Polygon));
    } catch {
      continue;
    }

    const zoneLabel = `${zone.name}${zone.code ? ` (${zone.code})` : ""}`;

    if (inside) {
      raiseTo(blockLevelForKind(zone.kind));
      reasons.push({ label: `בתוך ${zoneLabel}`, zone });
      continue;
    }

    if (AIRPORT_BUFFER_KINDS.has(zone.kind)) {
      try {
        const outline = turf.polygonToLine(geom as GeoJSON.Polygon) as GeoJSON.Feature<GeoJSON.LineString>;
        const distanceKm = Math.max(
          0,
          turf.pointToLineDistance(turfPoint, outline, { units: "kilometers" }) - footprintEdgeKm
        );
        if (distanceKm < AIRPORT_BUFFER_KM) {
          raiseTo("forbidden");
          reasons.push({
            label: `במרחק ${distanceKm.toFixed(1)} ק"מ מ${zoneLabel} — נדרשים לפחות ${AIRPORT_BUFFER_KM} ק"מ`,
            zone,
          });
        }
      } catch {
        // degenerate geometry — skip rather than block on a data error
      }
    }
  }

  return { blockLevel, reasons };
}
