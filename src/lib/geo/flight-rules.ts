import * as turf from "@turf/turf";
import type { AipReferenceZone } from "@/hooks/useAipReferenceZones";
import type { ProximityFinding } from "@/app/api/proximity-check/route";

const AIRPORT_BUFFER_KM = 2;

/**
 * CTR/ATZ/TMA/CTA — controlled airspace around an airport/airfield
 * ("אזור פיקוח, אזור פיקוח שדה או אזור שדה"). Both the hobby (מטיסן, תקנות
 * הטיס (הפעלת מטיסן) התשפ"ד 2024) and commercial (כטב"ם קטן, תקנות הטיס
 * (הפעלת כטב"ם קטן) התשפ"ד 2024) regulations prohibit this outright with
 * no exception clause at all — unlike the next category, there's no
 * director-approval escape hatch mentioned in either law. Nobody, org or
 * not, gets a coordination path here.
 */
const CONTROLLED_AIRSPACE_KINDS = new Set(["CTR", "ATZ", "TMA", "CTA"]);

/**
 * PROHIBITED/DANGER (LLP/LLD — "אזור אסור" / "אזור מסוכן"). Both laws use
 * the identical clause: "אין להטיס באזור אסור או באזור מסוכן לטיסה אלא אם
 * כן אישר מנהל רת"א את ההפעלה הנדרשת" — a case-by-case sign-off from the
 * CAAI director, not a standing/self-service exemption. This is NOT the
 * same mechanism as the special-authorization catalog (which only covers
 * the 9 numbered operational regulations, 2(ב)/25/26(ג)/27/28/29/30/32/35)
 * and it applies equally to every account tier — an organization can't buy
 * its way into a prohibited/danger zone through this app either.
 */
const DIRECTOR_APPROVAL_ONLY_KINDS = new Set(["PROHIBITED", "DANGER"]);

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
  /** Absolute block, no path in-app or otherwise mentioned in the regulations. */
  | "controlled_airspace"
  /** Blocked in-app; only escape hatch is a manual, case-by-case CAAI-director approval outside the system. */
  | "director_approval_only"
  /** Flyable through the normal coordination-request flow, subject to the area's published conditions. */
  | "coordination_ok";

const BLOCK_LEVEL_SEVERITY: Record<ZoneBlockLevel, number> = {
  none: 0,
  coordination_ok: 1,
  director_approval_only: 2,
  controlled_airspace: 3,
};

function blockLevelForKind(kind: string): ZoneBlockLevel {
  if (CONTROLLED_AIRSPACE_KINDS.has(kind)) return "controlled_airspace";
  if (DIRECTOR_APPROVAL_ONLY_KINDS.has(kind)) return "director_approval_only";
  if (COORDINATION_OK_KINDS.has(kind)) return "coordination_ok";
  return "none";
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
  zones: AipReferenceZone[]
): FlightAuthorizationCheck {
  const reasons: AuthorizationReason[] = [];
  let blockLevel: ZoneBlockLevel = "none";
  const turfPoint = turf.point(point);

  function raiseTo(level: ZoneBlockLevel) {
    if (BLOCK_LEVEL_SEVERITY[level] > BLOCK_LEVEL_SEVERITY[blockLevel]) blockLevel = level;
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
      continue;
    }

    if (CONTROLLED_AIRSPACE_KINDS.has(zone.kind)) {
      try {
        const outline = turf.polygonToLine(geom as GeoJSON.Polygon) as GeoJSON.Feature<GeoJSON.LineString>;
        const distanceKm = turf.pointToLineDistance(turfPoint, outline, { units: "kilometers" });
        if (distanceKm >= 0 && distanceKm < AIRPORT_BUFFER_KM) {
          raiseTo("controlled_airspace");
          reasons.push({
            label: `במרחק ${distanceKm.toFixed(1)} ק"מ מ${zone.name}${zone.code ? ` (${zone.code})` : ""} (נדרשים 2 ק"מ)`,
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
