import { z } from "zod";

export const maintenanceLogSchema = z.object({
  drone_id: z.string().uuid({ message: "יש לבחור כלי טיס" }),
  kind: z.enum(["inspection", "repair", "part_replacement", "other"]),
  description: z.string().trim().min(1, "יש לתאר את הפעולה").max(2000),
  cost: z.preprocess(
    (val) => (typeof val === "number" && Number.isNaN(val) ? undefined : val),
    z.number().min(0).max(1_000_000).optional()
  ),
  performed_at: z.coerce.date(),
});

export type MaintenanceLogInput = z.infer<typeof maintenanceLogSchema>;

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(1, "שם חובה").max(120),
  category: z.enum(["propeller", "battery", "charger", "gimbal", "other"]),
  quantity_on_hand: z.number().int().min(0).max(100_000),
  low_stock_threshold: z.number().int().min(0).max(100_000),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const batteryReadingSchema = z.object({
  battery_id: z.string().uuid(),
  voltage: z.preprocess(
    (val) => (typeof val === "number" && Number.isNaN(val) ? undefined : val),
    z.number().min(0).max(60).optional()
  ),
  capacity_percent: z.preprocess(
    (val) => (typeof val === "number" && Number.isNaN(val) ? undefined : val),
    z.number().min(0).max(100).optional()
  ),
});

export type BatteryReadingInput = z.infer<typeof batteryReadingSchema>;
