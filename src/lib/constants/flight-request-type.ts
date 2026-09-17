import type { FlightRequestType } from "@/lib/types/database.types";

export const FLIGHT_REQUEST_TYPE_LABELS: Record<FlightRequestType, string> = {
  basic_auto_100m: "טיסה בסיסית",
  manual_notam_bubble: "בועת NOTAM",
};
