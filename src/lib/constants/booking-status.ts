import type { Enums } from "@/lib/types/database.types";

export type BookingStatus = Enums<"booking_status">;

/** Shared between BookingsPageClient, BookingChatPageClient, and the admin monitoring screen — one source of truth so the same status never reads differently depending on which screen shows it. */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  invited: "ממתין לתשובה",
  pending: "בתיאום (סלוט מוחזק)",
  confirmed: "אושר — סלוט נעול",
  declined: "נדחה",
  cancelled: "בוטל",
  completed: "הושלם",
};

export const BOOKING_STATUS_VARIANT: Record<BookingStatus, "success" | "warning" | "destructive" | "secondary"> = {
  invited: "warning",
  pending: "warning",
  confirmed: "success",
  declined: "destructive",
  cancelled: "destructive",
  completed: "secondary",
};
