"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type EventCount = { event_name: string; count: number };
export type DailyCount = { day: string; count: number };
export type DateRange = { start: Date; end: Date };
export type Trend = { current: number; previous: number; deltaPct: number | null };

/** The period immediately preceding `range`, of equal length — what "trend" compares against. */
function previousPeriod({ start, end }: DateRange): DateRange {
  const lengthMs = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - lengthMs), end: start };
}

function toRpcArgs(orgId: string | null, range: DateRange) {
  return {
    target_org_id: orgId,
    range_start: range.start.toISOString(),
    range_end: range.end.toISOString(),
    // The generated Supabase types mark target_org_id as non-nullable — the SQL side accepts
    // null (platform-wide scope for dispatcher_admin) just fine, so this widens the literal type.
  } as unknown as { target_org_id: string; range_start: string; range_end: string };
}

/** Scope is either a specific org (fleet manager) or null for platform-wide (dispatcher admin). Aggregated server-side. */
export function useEventBreakdown(orgId: string | null, range: DateRange) {
  return useQuery({
    queryKey: ["app_events", "breakdown", orgId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<EventCount[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("analytics_event_breakdown", toRpcArgs(orgId, range));
      if (error) throw error;
      return data;
    },
  });
}

export function useDailyActivity(orgId: string | null, range: DateRange) {
  return useQuery({
    queryKey: ["app_events", "daily", orgId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<DailyCount[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("analytics_daily_activity", toRpcArgs(orgId, range));
      if (error) throw error;
      return data;
    },
  });
}

export function useActiveUserCount(orgId: string | null, range: DateRange) {
  return useQuery({
    queryKey: ["app_events", "active_users", orgId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("analytics_active_user_count", toRpcArgs(orgId, range));
      if (error) throw error;
      return data;
    },
  });
}

/** Total events this period vs. the equal-length period right before it. */
export function useTotalEventsTrend(orgId: string | null, range: DateRange) {
  const prev = previousPeriod(range);
  return useQuery({
    queryKey: ["app_events", "total_trend", orgId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<Trend> => {
      const supabase = createClient();
      const [currentRes, previousRes] = await Promise.all([
        supabase.rpc("analytics_total_event_count", toRpcArgs(orgId, range)),
        supabase.rpc("analytics_total_event_count", toRpcArgs(orgId, prev)),
      ]);
      if (currentRes.error) throw currentRes.error;
      if (previousRes.error) throw previousRes.error;
      const current = currentRes.data ?? 0;
      const previous = previousRes.data ?? 0;
      return { current, previous, deltaPct: previous > 0 ? ((current - previous) / previous) * 100 : null };
    },
  });
}

/** Active users this period vs. the equal-length period right before it. */
export function useActiveUserTrend(orgId: string | null, range: DateRange) {
  const prev = previousPeriod(range);
  return useQuery({
    queryKey: ["app_events", "active_users_trend", orgId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<Trend> => {
      const supabase = createClient();
      const [currentRes, previousRes] = await Promise.all([
        supabase.rpc("analytics_active_user_count", toRpcArgs(orgId, range)),
        supabase.rpc("analytics_active_user_count", toRpcArgs(orgId, prev)),
      ]);
      if (currentRes.error) throw currentRes.error;
      if (previousRes.error) throw previousRes.error;
      const current = currentRes.data ?? 0;
      const previous = previousRes.data ?? 0;
      return { current, previous, deltaPct: previous > 0 ? ((current - previous) / previous) * 100 : null };
    },
  });
}
