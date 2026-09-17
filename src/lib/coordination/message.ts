import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import { FLIGHT_PURPOSE_LABELS } from "@/lib/constants/flight-purpose";

/**
 * Formats a request's already-on-screen details into one ready-to-send
 * block — the point is the dispatcher never retypes anything by hand when
 * forwarding to an outside coordinating unit.
 */
export function buildCoordinationMessage(request: FlightRequestWithRelations, dmsCoordinates: string): string {
  const lines = [
    "בקשת תיאום טיסת רחפן",
    `מטיס/ה: ${request.profiles?.full_name ?? "—"} | טלפון: ${request.profiles?.phone ?? "—"}`,
    `כלי טיס: ${request.drones?.nickname ?? "—"} (${request.drones?.model ?? "—"}) | מס' רישום: ${request.drones?.registration_number ?? "—"}`,
    `תאריך ושעה: ${new Date(request.start_time).toLocaleString("he-IL")} — ${new Date(request.end_time).toLocaleString("he-IL")}`,
    `גובה מרבי: ${request.max_altitude_meters} מ'`,
    `מיקום (קואורדינטות): ${dmsCoordinates}`,
    `מטרת הטיסה: ${FLIGHT_PURPOSE_LABELS[request.flight_purpose]}`,
    `טלפון חירום: ${request.emergency_contact_phone}`,
  ];
  return lines.join("\n");
}

/** Israeli local numbers (05X-XXXXXXX) need the 972 country code for wa.me links; anything already prefixed is left alone. */
export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
}
