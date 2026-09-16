import type { CoordinationContactStatus } from "@/lib/types/database.types";

export const COORDINATION_STATUS_LABEL: Record<CoordinationContactStatus, string> = {
  not_started: "טרם טופל",
  awaiting_contact: "ממתין ליצירת קשר",
  awaiting_response: "ממתין לתשובת הגורם",
  approved: "אושר",
  denied: "נדחה",
};

export const COORDINATION_STATUS_VARIANT: Record<
  CoordinationContactStatus,
  "success" | "warning" | "destructive" | "secondary"
> = {
  not_started: "secondary",
  awaiting_contact: "warning",
  awaiting_response: "warning",
  approved: "success",
  denied: "destructive",
};
