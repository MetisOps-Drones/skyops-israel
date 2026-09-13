import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/notifications/sms";

export const dynamic = "force-dynamic";

/**
 * Module D daily cron. Configure this as a Vercel Cron job (or any scheduler
 * that can send `Authorization: Bearer $CRON_SECRET`) hitting this route
 * once a day. It:
 *   1. Calls `sweep_expiring_licenses()` (supabase/migrations/0010), which
 *      recomputes every license's status and inserts a `license_expiring`
 *      notification row for anything that just crossed the 30-day window.
 *   2. Sends an SMS for each notification created by that sweep that hasn't
 *      been texted yet, then flags it so a re-run of this route doesn't
 *      double-send.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: sweepCount, error: sweepError } = await supabase.rpc("sweep_expiring_licenses");

  if (sweepError) {
    return NextResponse.json({ error: sweepError.message }, { status: 500 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingNotifications, error: fetchError } = await supabase
    .from("notifications")
    .select("id, body, metadata, profiles:user_id ( phone )")
    .eq("kind", "license_expiring")
    .gte("created_at", since);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let smsSentCount = 0;

  for (const notification of pendingNotifications ?? []) {
    const metadata = (notification.metadata ?? {}) as Record<string, unknown>;
    if (metadata.sms_sent) continue;

    const phone = (notification as unknown as { profiles: { phone: string | null } | null }).profiles?.phone;
    if (phone) {
      const { sent } = await sendSms({ toPhone: phone, message: notification.body });
      if (sent) smsSentCount += 1;
    }

    await supabase
      .from("notifications")
      .update({ metadata: { ...metadata, sms_sent: true } })
      .eq("id", notification.id);
  }

  return NextResponse.json({
    ok: true,
    licensesUpdated: sweepCount ?? 0,
    notificationsProcessed: pendingNotifications?.length ?? 0,
    smsSentCount,
  });
}
