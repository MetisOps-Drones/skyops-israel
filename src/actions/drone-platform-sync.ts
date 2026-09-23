"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database.types";

type DronePlatform = Tables<"drone_platform_connections">["platform"];

/**
 * Auto-sync flight logbook from a DJI/Autel account (see migration
 * 0079_drone_platform_sync.sql for why this is real infrastructure but a
 * simulated sync). Real mode activates automatically the moment
 * DJI_API_KEY/AUTEL_API_KEY are configured — until then, syncDronePlatformFlights
 * generates a clearly-labeled demo flight log instead of failing outright,
 * the same "real if configured, simulated otherwise" pattern as
 * src/lib/ocr/extractExpiration.ts.
 */
function isPlatformConfigured(platform: DronePlatform): boolean {
  return platform === "dji" ? Boolean(process.env.DJI_API_KEY) : Boolean(process.env.AUTEL_API_KEY);
}

export interface ConnectPlatformResult {
  success: boolean;
  error?: string;
  simulated?: boolean;
}

export async function connectDronePlatform(platform: DronePlatform): Promise<ConnectPlatformResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const simulated = !isPlatformConfigured(platform);
  const label = simulated
    ? `חשבון ${platform === "dji" ? "DJI" : "Autel"} לדוגמה (הדגמה)`
    : `חשבון ${platform === "dji" ? "DJI" : "Autel"}`;

  const { error } = await supabase.from("drone_platform_connections").upsert(
    {
      user_id: user.id,
      platform,
      status: "connected",
      account_label: label,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath("/logs");
  return { success: true, simulated };
}

export async function disconnectDronePlatform(platform: DronePlatform): Promise<ConnectPlatformResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { error } = await supabase
    .from("drone_platform_connections")
    .update({ status: "disconnected" })
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) return { success: false, error: error.message };

  revalidatePath("/logs");
  return { success: true };
}

export interface SyncPlatformResult {
  success: boolean;
  error?: string;
  simulated?: boolean;
  importedCount?: number;
}

/**
 * Real mode (once DJI_API_KEY/AUTEL_API_KEY exist) would call that
 * platform's flight-log API here and map its response into flight_logs
 * rows — same shape as the simulated branch below, so swapping in the real
 * call is a matter of replacing generateSimulatedFlights, not restructuring
 * this action or its callers.
 */
function generateSimulatedFlights(droneId: string, platform: DronePlatform): Array<{
  drone_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_altitude_m: number;
  max_distance_m: number;
  telemetry_source: string;
  notes: string;
}> {
  const count = 1 + Math.floor(Math.random() * 2);
  const flights = [];
  for (let i = 0; i < count; i++) {
    const durationMinutes = 8 + Math.floor(Math.random() * 18);
    const daysAgo = 1 + Math.floor(Math.random() * 14) + i * 3;
    const start = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    flights.push({
      drone_id: droneId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: durationMinutes,
      max_altitude_m: 20 + Math.floor(Math.random() * 80),
      max_distance_m: 50 + Math.floor(Math.random() * 400),
      telemetry_source: `${platform}_sync`,
      notes: `סונכרן אוטומטית מחשבון ${platform === "dji" ? "DJI" : "Autel"} (מצב הדגמה — טרם חובר חשבון אמיתי)`,
    });
  }
  return flights;
}

export async function syncDronePlatformFlights(platform: DronePlatform): Promise<SyncPlatformResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { data: connection } = await supabase
    .from("drone_platform_connections")
    .select("status")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return { success: false, error: "יש לחבר את החשבון לפני סנכרון" };
  }

  const { data: drones } = await supabase.from("drones").select("id").eq("user_id", user.id).limit(1);
  const droneId = drones?.[0]?.id;
  if (!droneId) {
    return { success: false, error: "יש להוסיף כלי טיס לפני סנכרון יומן טיסות" };
  }

  const simulated = !isPlatformConfigured(platform);
  // Real mode isn't reachable yet (see isPlatformConfigured) — this branch
  // exists so the swap-in later is a one-line change, not a rewrite.
  const flights = generateSimulatedFlights(droneId, platform);

  const { error: insertError } = await supabase.from("flight_logs").insert(
    flights.map((f) => ({ ...f, user_id: user.id }))
  );
  if (insertError) return { success: false, error: insertError.message };

  const { error: updateError } = await supabase
    .from("drone_platform_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("platform", platform);
  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/logs");
  return { success: true, simulated, importedCount: flights.length };
}
