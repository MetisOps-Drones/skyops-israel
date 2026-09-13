import { z } from "zod";

/** An optional numeric form field: an empty/NaN input (from `valueAsNumber` on a blank <input>) is treated as "not provided" rather than a validation error. */
const optionalFormNumber = (min: number, max: number) =>
  z.preprocess(
    (val) => (typeof val === "number" && Number.isNaN(val) ? undefined : val),
    z.number().min(min).max(max).optional()
  );

export const createFlightLogSchema = z
  .object({
    flight_request_id: z.string().uuid().optional().nullable(),
    drone_id: z.string().uuid({ message: "יש לבחור כלי טיס" }),
    battery_id: z.string().uuid().optional().nullable(),
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
    max_altitude_m: optionalFormNumber(0, 3000),
    max_distance_m: optionalFormNumber(0, 20000),
    notes: z.string().max(2000).optional(),
    client_id: z.string().uuid().optional(),
    price: optionalFormNumber(0, 1_000_000),
    cost: optionalFormNumber(0, 1_000_000),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["end_time"],
  });

export type CreateFlightLogInput = z.infer<typeof createFlightLogSchema>;

export const droneSchema = z.object({
  nickname: z.string().trim().min(1, "שם חובה").max(80),
  manufacturer: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  serial_number: z.string().trim().min(3).max(120),
  registration_number: z.string().trim().max(60).optional(),
  mtow_grams: z.number().int().min(1).max(2_000_000),
});

export type DroneInput = z.infer<typeof droneSchema>;

export const batterySchema = z.object({
  drone_id: z.string().uuid(),
  serial_number: z.string().trim().min(3).max(120),
  cycle_count: z.number().int().min(0).max(10000).default(0),
  last_voltage_reading: z.number().min(0).max(60).optional(),
  purchased_at: z.coerce.date().optional(),
});

export type BatteryInput = z.infer<typeof batterySchema>;
