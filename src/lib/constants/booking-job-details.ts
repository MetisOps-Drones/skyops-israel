/**
 * Structured choices for the booking invitation dialog (SendBookingDialog),
 * replacing free-text prose for the job's operational basics. Purpose list
 * mirrors FLIGHT_PURPOSE_LABELS (flight-purpose.ts) minus its two
 * operation-level entries (vlos_general/bvlos) — those became their own
 * "operation type" field here so a business filling this in doesn't have
 * to interpret one merged concept.
 */

export const BOOKING_OPERATION_TYPE_OPTIONS = [
  { value: "vlos", label: "VLOS — קשר עין" },
  { value: "bvlos", label: "BVLOS — מעבר לטווח ראייה" },
  { value: "night", label: "טיסת לילה" },
  { value: "indoor", label: "הטסה במבנה סגור" },
  { value: "other", label: "אחר" },
] as const;

export const BOOKING_PURPOSE_OPTIONS = [
  { value: "photography", label: "צילום ותיעוד אווירי" },
  { value: "mapping_survey", label: "מיפוי וסקר" },
  { value: "agriculture_spraying", label: "ריסוס וחקלאות מדייקת" },
  { value: "infrastructure_inspection", label: "בדק תשתיות" },
  { value: "event_production", label: "אירוע/הפקה" },
  { value: "delivery", label: "משלוחים" },
  { value: "search_and_rescue", label: "חיפוש והצלה" },
  { value: "training", label: "הדרכה/אימון" },
  { value: "other", label: "אחר" },
] as const;

/** Reverse lookups for displaying a stored value (e.g. in BookingsPageClient/BookingChatPageClient) without re-scanning the options array. */
export const BOOKING_OPERATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BOOKING_OPERATION_TYPE_OPTIONS.map((o) => [o.value, o.label])
);
export const BOOKING_PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  BOOKING_PURPOSE_OPTIONS.map((o) => [o.value, o.label])
);
