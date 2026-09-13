import type { FlightPurpose } from "@/lib/types/database.types";

/** סוג ההטסה — גם רמת ההפעלה (VLOS/BVLOS) וגם מטרת הטיסה בפועל, לצורך תיעוד הבקשה, ה-NOTAM, ואנליטיקה עתידית. */
export const FLIGHT_PURPOSE_LABELS: Record<FlightPurpose, string> = {
  vlos_general: "VLOS — הפעלה כללית בקשר עין",
  bvlos: "BVLOS — מעבר לטווח ראייה",
  photography: "צילום ותיעוד אווירי",
  mapping_survey: "מיפוי וסקר",
  agriculture_spraying: "ריסוס וחקלאות מדייקת",
  infrastructure_inspection: "בדק תשתיות",
  event_production: "אירוע/הפקה",
  delivery: "משלוחים",
  search_and_rescue: "חיפוש והצלה",
  training: "הדרכה/אימון",
  other: "אחר",
};

export const FLIGHT_PURPOSE_OPTIONS: { value: FlightPurpose; label: string }[] = Object.entries(
  FLIGHT_PURPOSE_LABELS
).map(([value, label]) => ({ value: value as FlightPurpose, label }));
