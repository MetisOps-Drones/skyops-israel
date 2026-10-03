import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import { FLIGHT_PURPOSE_LABELS } from "@/lib/constants/flight-purpose";
import { mToFt } from "@/lib/geo/aip";
import { CAMERA_TYPE_LABELS, formatTakedownSeconds, type CameraType } from "@/lib/validations/flight-request";

/** "גובה: 80 מ' מעל הקרקע (262 רגל) | 1,150 רגל מעפ"י" — the pilot enters meters AGL; ATC and the AIP speak feet AMSL. */
export function describeFlightAltitude(altitudeM: number, altitudeAmslFt: number | null): string {
  const base = `${altitudeM} מ' מעל הקרקע (${mToFt(altitudeM).toLocaleString("he-IL")} רגל)`;
  return altitudeAmslFt === null ? base : `${base} | ${altitudeAmslFt.toLocaleString("he-IL")} רגל מעפ"י`;
}

/**
 * Formats a request's already-on-screen details into one ready-to-send
 * block — the point is the dispatcher never retypes anything by hand when
 * forwarding to an outside coordinating unit.
 */
export function buildCoordinationMessage(
  request: FlightRequestWithRelations,
  dmsCoordinates: string,
  options?: { altitudeAmslFt?: number | null }
): string {
  const lines = [
    "בקשת תיאום טיסת רחפן",
    `מטיס/ה: ${request.profiles?.full_name ?? "—"} | טלפון: ${request.profiles?.phone ?? "—"}`,
    `כלי טיס: ${request.drones?.nickname ?? "—"} (${request.drones?.model ?? "—"}) | מס' רישום: ${request.drones?.registration_number ?? "—"}`,
    `תאריך ושעה: ${new Date(request.start_time).toLocaleString("he-IL")} — ${new Date(request.end_time).toLocaleString("he-IL")}`,
    `גובה מרבי: ${describeFlightAltitude(Number(request.max_altitude_meters), options?.altitudeAmslFt ?? null)}`,
    `מיקום (קואורדינטות): ${dmsCoordinates}`,
    `מטרת הטיסה: ${FLIGHT_PURPOSE_LABELS[request.flight_purpose]}`,
    ...(request.camera_type ? [`מצלמה: ${CAMERA_TYPE_LABELS[request.camera_type as CameraType] ?? request.camera_type}`] : []),
    ...(request.takedown_response_seconds
      ? [`זמן הורדה מרגע בקשה: ${formatTakedownSeconds(request.takedown_response_seconds)}`]
      : []),
    `טלפון חירום: ${request.emergency_contact_phone}`,
  ];
  return lines.join("\n");
}

/** 0586726900 → 058-672-6900 — the way an Israeli mobile number is read aloud. Anything that doesn't look like one is left as typed. */
export function formatLocalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

/** A bare chat link (no pre-filled text) — tapping it just opens the conversation with that number. */
export function whatsAppChatLink(phone: string): string {
  return `https://wa.me/${normalizePhoneForWhatsApp(phone)}`;
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
