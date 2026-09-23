import type { AipZoneKind } from "@/lib/types/database.types";

export const AIP_ZONE_KIND_LABELS: Record<AipZoneKind, string> = {
  CTR: "אזור בקרת טיסה (CTR)",
  ATZ: "אזור תעבורת שדה (ATZ)",
  TMA: "אזור בקרת טרמינל (TMA)",
  CTA: "אזור בקרה (CTA)",
  RESTRICTED: "שטח מוגבל (LLR)",
  DANGER: "שטח סכנה (LLD)",
  PROHIBITED: "שטח אסור (LLP)",
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
