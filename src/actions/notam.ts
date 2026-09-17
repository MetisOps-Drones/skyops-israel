"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { publishNotamSchema, rejectFlightRequestSchema } from "@/lib/validations/flight-request";
import type { PublishNotamInput, RejectFlightRequestInput } from "@/lib/validations/flight-request";
import { sendSms } from "@/lib/notifications/sms";

async function requireDispatcherAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("יש להתחבר מחדש");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "dispatcher_admin") {
    throw new Error("פעולה זו מוגבלת למוקדני תיאום");
  }

  return { supabase, dispatcherId: user.id };
}

export interface NotamActionResult {
  success: boolean;
  error?: string;
}

/**
 * Module B "Publish NOTAM" modal action: stamps the flight_request with the
 * dispatcher-entered NOTAM code + ATC contact, then pushes a real-time
 * notification (and SMS, if a provider is configured) to the pilot. Uses
 * the service-role client for the notification insert only, since a pilot
 * has no RLS write access to their own `notifications` row (server-authored
 * only) — the flight_request update itself still runs through the
 * dispatcher's own RLS-scoped session so `is_dispatcher_admin()` is enforced.
 */
export async function publishNotam(input: PublishNotamInput): Promise<NotamActionResult> {
  const parsed = publishNotamSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }
  const data = parsed.data;

  try {
    const { supabase, dispatcherId } = await requireDispatcherAdmin();

    const { data: flightRequest, error: updateError } = await supabase
      .from("flight_requests")
      .update({
        status: "notam_published",
        notam_code: data.notam_code.toUpperCase(),
        dispatcher_notes: data.dispatcher_notes ?? null,
        reviewed_by: dispatcherId,
      })
      .eq("id", data.flight_request_id)
      .select("*, profiles!flight_requests_user_id_fkey ( id, full_name, phone )")
      .single();

    if (updateError) {
      return { success: false, error: `פרסום ה-NOTAM נכשל: ${updateError.message}` };
    }

    const pilot = (flightRequest as unknown as { profiles: { id: string; full_name: string; phone: string | null } }).profiles;

    const serviceClient = createServiceRoleClient();
    await serviceClient.from("notifications").insert({
      user_id: pilot.id,
      kind: "notam_published",
      title: "ה-NOTAM שלך פורסם",
      body: `בקשת הטיסה אושרה. קוד NOTAM: ${data.notam_code.toUpperCase()}. טלפון חירום לבקרה: ${data.atc_emergency_phone}.`,
      metadata: {
        flight_request_id: data.flight_request_id,
        notam_code: data.notam_code.toUpperCase(),
        atc_emergency_phone: data.atc_emergency_phone,
      },
    });

    if (pilot.phone) {
      await sendSms({
        toPhone: pilot.phone,
        message: `MetisOps: ה-NOTAM שלך אושר. קוד: ${data.notam_code.toUpperCase()}. חירום בקרה: ${data.atc_emergency_phone}`,
      });
    }

    revalidatePath("/ops");
    revalidatePath("/map");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה לא צפויה" };
  }
}

export async function rejectFlightRequest(input: RejectFlightRequestInput): Promise<NotamActionResult> {
  const parsed = rejectFlightRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }
  const data = parsed.data;

  try {
    const { supabase, dispatcherId } = await requireDispatcherAdmin();

    const { data: flightRequest, error: updateError } = await supabase
      .from("flight_requests")
      .update({
        status: "rejected",
        dispatcher_notes: data.dispatcher_notes,
        reviewed_by: dispatcherId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.flight_request_id)
      .select("user_id")
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    const serviceClient = createServiceRoleClient();
    await serviceClient.from("notifications").insert({
      user_id: flightRequest.user_id,
      kind: "flight_request_rejected",
      title: "בקשת הטיסה נדחתה",
      body: data.dispatcher_notes,
      metadata: { flight_request_id: data.flight_request_id },
    });

    revalidatePath("/ops");
    revalidatePath("/map");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה לא צפויה" };
  }
}
