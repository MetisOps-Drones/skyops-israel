import { findPlan } from "@/lib/constants/plans";

export type CoordinationPeriod = "week" | "month";

export interface CoordinationLimit {
  /** Total flight requests allowed per period, both types combined. */
  count: number;
  period: CoordinationPeriod;
  /** How many of `count` may be request_type "manual_notam_bubble" (the "בועת NOTAM" / complex type) — 0 means none allowed at all. */
  complexAllowed: number;
}

/** Local start of the current period — Sunday for a week (matches the app's own DAY_LABELS convention elsewhere, ראשון first), the 1st for a month. */
export function periodStart(period: CoordinationPeriod, now = new Date()): Date {
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * The org tier's own pricing catalog says "תיאומים ללא הגבלה, כולל NOTAM"
 * for every org size (see ORG_COMMON_FEATURES in plans.ts) — and there is
 * genuinely nowhere to look up which org tier a given organization is on
 * (the `organizations` table has no plan_code column at all; only
 * `profiles` does, which is meaningless for an org account), so any active
 * org membership is simply unlimited. dispatcher_admin is platform staff
 * coordinating through /ops, not a billing plan, so it's unlimited too.
 */
export function resolveCoordinationLimit(input: {
  role: string | null;
  hasOrg: boolean;
  planCode: string | null;
}): CoordinationLimit | null {
  if (input.hasOrg || input.role === "dispatcher_admin") return null;
  const category = input.role === "pilot_pro" ? "business" : "private";
  const plan = findPlan(input.planCode ?? undefined) ?? findPlan(category === "business" ? "business_free" : "private_free");
  return plan?.coordinationLimit ?? null;
}
