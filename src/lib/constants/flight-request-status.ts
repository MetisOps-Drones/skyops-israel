import type { FlightRequestStatus } from "@/lib/types/database.types";

/** Bottom-line, one-word status labels — for the map history layer, which deliberately avoids detail (that lives in the flight log). */
export const FLIGHT_REQUEST_STATUS_LABELS: Record<FlightRequestStatus, string> = {
  draft: "טיוטה",
  auto_cleared: "אושר",
  pending_dispatcher: "ממתין לאישור",
  submitted_to_iaf: "בבדיקה",
  notam_published: "אושר",
  rejected: "נדחה",
  completed: "הושלם",
  cancelled: "בוטל",
};

export const FLIGHT_REQUEST_STATUS_COLORS: Record<FlightRequestStatus, string> = {
  draft: "#94a3b8",
  auto_cleared: "#16a34a",
  pending_dispatcher: "#d97706",
  submitted_to_iaf: "#d97706",
  notam_published: "#16a34a",
  rejected: "#dc2626",
  completed: "#2563eb",
  cancelled: "#94a3b8",
};
