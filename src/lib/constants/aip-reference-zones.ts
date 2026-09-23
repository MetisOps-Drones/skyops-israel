import type { AipZoneKind } from "@/lib/types/database.types";

/**
 * Plain-language names, not ICAO/AIP jargon — a hobby pilot with a מטיסן
 * license, not an air-traffic controller, is the reader. Each one still
 * keeps the official code in parentheses for anyone who wants to look it
 * up, but the words themselves should make sense on a first read.
 */
export const AIP_ZONE_KIND_LABELS: Record<AipZoneKind, string> = {
  CTR: "מרחב פיקוח שדה תעופה (CTR)",
  ATZ: "מרחב תעבורה של שדה תעופה קטן (ATZ)",
  TMA: "מרחב פיקוח גבוה ליד שדה תעופה (TMA)",
  CTA: "מרחב טיסה מבוקר למטוסים (CTA)",
  RESTRICTED: "אזור עם הגבלות טיסה (LLR)",
  DANGER: "אזור מסוכן לטיסה (LLD)",
  PROHIBITED: "אזור אסור לטיסה לגמרי (LLP)",
};

/** Amber/purple family — distinct from AIRSPACE_ZONE_COLORS so the two layers never look interchangeable. */
export const AIP_ZONE_KIND_COLORS: Record<AipZoneKind, string> = {
  CTR: "#7c3aed",
  ATZ: "#c026d3",
  TMA: "#0891b2",
  CTA: "#0e7490",
  RESTRICTED: "#b45309",
  DANGER: "#b91c1c",
  PROHIBITED: "#78350f",
};

/** Bright, distinct from both zone color families above — a live NOTAM is time-sensitive and current, not a standing classification. */
export const LIVE_NOTAM_COLOR = "#ea580c";
