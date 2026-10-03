import { z } from "zod";

export const flightAltitudeBandSchema = z.enum(["under_50m", "under_100m", "over_100m"]);
export type FlightAltitudeBand = z.infer<typeof flightAltitudeBandSchema>;

export const flightPurposeSchema = z.enum([
  "vlos_general",
  "bvlos",
  "photography",
  "mapping_survey",
  "agriculture_spraying",
  "infrastructure_inspection",
  "event_production",
  "delivery",
  "search_and_rescue",
  "training",
  "other",
]);
export type FlightPurposeInput = z.infer<typeof flightPurposeSchema>;

export const ALTITUDE_BAND_METERS: Record<FlightAltitudeBand, number> = {
  under_50m: 50,
  under_100m: 100,
  over_100m: 150,
};

/** The altitude is entered in meters now; the coarse band is only kept for legacy callers and is derived, never asked. */
export function altitudeBandForMeters(meters: number): FlightAltitudeBand {
  if (meters <= 50) return "under_50m";
  if (meters <= 100) return "under_100m";
  return "over_100m";
}

/**
 * צילום אנכי (nadir — מצלמה כלפי מטה, חושף את הקרקע מתחת), אופקי (מצלמה קדימה/הצידה),
 * צילום מרחבי (סקר/מיפוי לאורך שטח). The coordinator needs this because what the camera
 * can see matters as much as where the drone is — especially near bases.
 */
export const cameraTypeSchema = z.enum(["vertical", "horizontal", "aerial_survey", "none"]);
export type CameraType = z.infer<typeof cameraTypeSchema>;

export const CAMERA_TYPE_LABELS: Record<CameraType, string> = {
  vertical: "אנכית (מכוונת כלפי מטה)",
  horizontal: "אופקית (קדימה / הצידה)",
  aerial_survey: "צילום מרחבי (סקר / מיפוי)",
  none: "ללא מצלמה",
};

export const MIN_TAKEDOWN_SECONDS = 5;
export const MAX_TAKEDOWN_SECONDS = 3600;

/** "90" → "דקה וחצי"-style is overkill; this just renders seconds as "2 דק' 30 שנ'" so a coordinator reads a duration, not a raw number. */
export function formatTakedownSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} שנ'`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} דק'` : `${minutes} דק' ${rest} שנ'`;
}

const pointGeoJsonSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

const polygonGeoJsonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

export const createFlightRequestSchema = z
  .object({
    drone_id: z.string().uuid({ message: "יש לבחור כלי טיס" }),
    request_type: z.enum(["basic_auto_100m", "manual_notam_bubble"]),
    center_point: pointGeoJsonSchema,
    radius_meters: z.number().min(10).max(5000).optional(),
    polygon: polygonGeoJsonSchema.optional(),
    altitude_band: flightAltitudeBandSchema.optional(),
    max_altitude_meters: z.number().min(1, "יש להזין גובה טיסה במטרים").max(2000),
    flight_purpose: flightPurposeSchema,
    camera_type: cameraTypeSchema,
    takedown_response_seconds: z
      .number({ invalid_type_error: "יש להזין זמן תגובה לבקשת הורדה" })
      .int()
      .min(MIN_TAKEDOWN_SECONDS, `זמן ההורדה המינימלי הוא ${MIN_TAKEDOWN_SECONDS} שניות`)
      .max(MAX_TAKEDOWN_SECONDS, "זמן ההורדה המרבי הוא שעה"),
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
    emergency_contact_phone: z
      .string()
      .regex(/^0\d{1,2}-?\d{7}$/, "מספר טלפון ישראלי לא תקין"),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["end_time"],
  })
  .refine(
    (data) =>
      data.request_type === "basic_auto_100m" ? data.radius_meters !== undefined : true,
    { message: "יש להגדיר רדיוס לטיסה אוטומטית", path: ["radius_meters"] }
  )
  .refine(
    (data) => (data.request_type === "manual_notam_bubble" ? data.polygon !== undefined : true),
    { message: "יש לצייר פוליגון עבור בקשת NOTAM", path: ["polygon"] }
  );

export type CreateFlightRequestInput = z.infer<typeof createFlightRequestSchema>;

/** Same shape as a fresh submission — editing re-runs every check a create does (see updateFlightRequest), so there's nothing an edit should validate more loosely. */
export const updateFlightRequestSchema = createFlightRequestSchema;
export type UpdateFlightRequestInput = z.infer<typeof updateFlightRequestSchema>;

export const publishNotamSchema = z.object({
  flight_request_id: z.string().uuid(),
  notam_code: z
    .string()
    .trim()
    .min(3, "קוד NOTAM קצר מדי")
    .max(30)
    .regex(/^[A-Z0-9/ -]+$/i, "קוד NOTAM מכיל תווים לא חוקיים"),
  atc_emergency_phone: z.string().regex(/^0\d{1,2}-?\d{7}$/, "מספר טלפון ישראלי לא תקין"),
  dispatcher_notes: z.string().max(2000).optional(),
});

export type PublishNotamInput = z.infer<typeof publishNotamSchema>;

export const rejectFlightRequestSchema = z.object({
  flight_request_id: z.string().uuid(),
  dispatcher_notes: z.string().min(3, "יש לציין סיבת דחייה").max(2000),
});

export type RejectFlightRequestInput = z.infer<typeof rejectFlightRequestSchema>;

export const cancelNotamSchema = z.object({
  flight_request_id: z.string().uuid(),
  dispatcher_notes: z.string().min(3, "יש לציין סיבת ביטול").max(2000),
});

export type CancelNotamInput = z.infer<typeof cancelNotamSchema>;
