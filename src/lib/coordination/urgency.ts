import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";

export type UrgencyTier = "urgent" | "soon" | "normal";

/** Hours until the request's flight window starts — negative once it's already begun. Shared by the ops queue table (urgency badge/sort) and its map (urgency-colored shapes) so both always agree on the same cutoffs. */
export function urgencyHours(request: Pick<FlightRequestWithRelations, "start_time">): number {
  return (new Date(request.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function urgencyTier(hours: number): UrgencyTier {
  if (hours < 24) return "urgent";
  if (hours < 72) return "soon";
  return "normal";
}

/** Same hex values as the badge variants they mirror (destructive/warning/secondary — see badge.tsx and FLIGHT_REQUEST_STATUS_COLORS), so the queue map's shape colors read as the same visual language as the table's urgency badges. */
export const URGENCY_COLOR: Record<UrgencyTier, string> = {
  urgent: "#dc2626",
  soon: "#d97706",
  normal: "#94a3b8",
};

export const URGENCY_LABEL: Record<UrgencyTier, string> = {
  urgent: "דחוף",
  soon: "השבוע",
  normal: "רגיל",
};

export const URGENCY_BADGE_VARIANT: Record<UrgencyTier, "destructive" | "warning" | "secondary"> = {
  urgent: "destructive",
  soon: "warning",
  normal: "secondary",
};
