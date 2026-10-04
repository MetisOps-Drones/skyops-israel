import { zoneVerdictFor, type ZoneBlockLevel } from "@/lib/geo/flight-rules";

export type LocationStatusTone = "clear" | "caution" | "forbidden";

export interface LocationStatus {
  tone: LocationStatusTone;
  label: string;
}

/**
 * The map's top-bar pill for the pilot's current position. It reads the same zone verdict the
 * location card and the request form use (zoneVerdictFor) — a controlled-airspace or restricted
 * area is "needs coordination", never "forbidden"; only a prohibited area, a runway's forbidden
 * distance, a ground-blocked point (or a dangerous area without an organization) is.
 */
export function locationStatusFor(input: {
  blockLevel: ZoneBlockLevel;
  hasOrg: boolean;
  /** A ground-based prohibited zone zeroes the altitude ceiling at this point. */
  blockedFromGround: boolean;
  /** The legacy per-zone intersection check found a blocking area. */
  legacyBlocked: boolean;
  notamInside: boolean;
}): LocationStatus {
  const forbidden = zoneVerdictFor("forbidden", input.hasOrg);
  if (input.blockedFromGround || input.legacyBlocked || input.blockLevel === "forbidden") {
    return { tone: "forbidden", label: forbidden.shortLabel };
  }
  if (input.blockLevel !== "none") {
    const verdict = zoneVerdictFor(input.blockLevel, input.hasOrg);
    return { tone: verdict.tone === "forbidden" ? "forbidden" : "caution", label: verdict.shortLabel };
  }
  if (input.notamInside) return { tone: "caution", label: "מותר להטיס במיקומך בתיאום בלבד (נוטאם פעיל)" };
  return { tone: "clear", label: "מותר לטיסה במיקומך" };
}
