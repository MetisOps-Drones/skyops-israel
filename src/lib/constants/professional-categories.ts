/**
 * Commercial drone service categories, shown to a "מטיס מקצועי/מסחרי" during signup. Grounded
 * against how the drone-services industry actually segments itself (data collection/mapping is
 * the largest service segment, inspection the fastest-growing — see aerial-photography, mapping,
 * and inspection industry reports), not invented from scratch. Not exhaustive — flagged to the
 * product owner as an easy list to extend rather than something requiring a schema change
 * (stored as free text on profiles.professional_category, not a DB enum).
 */
export const PROFESSIONAL_CATEGORIES = [
  "צילום וידאו אווירי",
  "מיפוי וסקר קרקע",
  "חקלאות (ריסוס ומעקב יבולים)",
  "בדק מבנים ותשתיות",
  "בנייה ונדל״ן",
  "אנרגיה (פאנלים סולאריים, טורבינות)",
  "ביטחון ופיקוח שטח",
  "הפקות קולנוע וטלוויזיה",
  "אירועים",
  "חיפוש, הצלה וחירום",
  "הערכת נזקי ביטוח",
  "אחר",
] as const;
