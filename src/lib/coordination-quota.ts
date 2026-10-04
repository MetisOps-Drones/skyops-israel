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
 *
 * `override` (from my_coordination_override(), see 0085) always wins when
 * present — a dispatcher_admin-granted design-partner quota, which can be
 * more OR less generous than the plan's own limit. It renders through the
 * exact same CoordinationLimit shape as a real plan, so nothing downstream
 * — the quota display, the submit-time block — can tell the difference.
 */
export function resolveCoordinationLimit(input: {
  role: string | null;
  hasOrg: boolean;
  planCode: string | null;
  override?: { count: number; period: CoordinationPeriod; complexAllowed: number } | null;
}): CoordinationLimit | null {
  if (input.override) {
    return { count: input.override.count, period: input.override.period, complexAllowed: input.override.complexAllowed };
  }
  if (input.hasOrg || input.role === "dispatcher_admin") return null;
  const category = input.role === "pilot_pro" ? "business" : "private";
  const plan = findPlan(input.planCode ?? undefined) ?? findPlan(category === "business" ? "business_free" : "private_free");
  return plan?.coordinationLimit ?? null;
}

/** Fetches the signed-in user's own override via the security-definer RPC (0085) — never a raw table select, so note/set_by/set_at can't leak to this session even by accident. */
export async function fetchMyCoordinationOverride(
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<{ count: number; period: CoordinationPeriod; complexAllowed: number } | null> {
  const { data, error } = await supabase.rpc("my_coordination_override");
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { count: row.override_count, period: row.override_period as CoordinationPeriod, complexAllowed: row.override_complex_allowed };
}
