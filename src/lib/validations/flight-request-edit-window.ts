import type { Tables } from "@/lib/types/database.types";

/** Pilots can edit a request for this long after submitting it — see 0080_flight_request_edit_window.sql. */
export const FLIGHT_REQUEST_EDIT_WINDOW_MINUTES = 30;

export interface EditEligibility {
  editable: boolean;
  reason?: "expired" | "viewed_by_dispatcher";
  minutesRemaining?: number;
}

/**
 * Pure — kept out of actions/flight-requests.ts ("use server") specifically
 * so client components can call it synchronously for display (a "use
 * server" file's exports must all be async Server Actions; a plain sync
 * function there would either fail to build or get wrapped as an RPC).
 * updateFlightRequest re-checks the same two conditions server-side before
 * actually writing anything, since this is advisory-only from the client.
 */
export function flightRequestEditEligibility(
  request: Pick<Tables<"flight_requests">, "created_at" | "first_viewed_by_dispatcher_at">,
  now: Date = new Date()
): EditEligibility {
  if (request.first_viewed_by_dispatcher_at) {
    return { editable: false, reason: "viewed_by_dispatcher" };
  }
  const ageMinutes = (now.getTime() - new Date(request.created_at).getTime()) / 60_000;
  if (ageMinutes > FLIGHT_REQUEST_EDIT_WINDOW_MINUTES) {
    return { editable: false, reason: "expired" };
  }
  return { editable: true, minutesRemaining: Math.max(0, Math.round(FLIGHT_REQUEST_EDIT_WINDOW_MINUTES - ageMinutes)) };
}
