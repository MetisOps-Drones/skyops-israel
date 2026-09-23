import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { chargeToken } from "@/lib/cardcom/client";
import { findPlan } from "@/lib/constants/plans";

export const dynamic = "force-dynamic";

const MAX_FAILED_ATTEMPTS = 3;

/**
 * Daily cron (same CRON_SECRET-gated pattern as
 * check-license-expirations): charges every active subscription whose
 * next_billing_date has arrived, using the card token saved at checkout.
 * A failed charge doesn't cancel immediately — failed_attempts increments
 * and next_billing_date moves 1 day out for a quick retry; after
 * MAX_FAILED_ATTEMPTS consecutive failures the subscription is cancelled
 * and the profile/org is downgraded to the free tier, with a notification
 * either way.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  // Include 'past_due', not just 'active': a failed charge below moves a
  // subscription to 'past_due' with next_billing_date pushed out 1 day for
  // retry — querying "active" only would mean that row never gets picked up
  // again by any future run, so it would neither retry nor ever reach
  // MAX_FAILED_ATTEMPTS to actually cancel/downgrade it.
  const { data: dueSubscriptions, error } = await supabase
    .from("billing_subscriptions")
    .select("*, profiles:profile_id ( id, full_name ), organizations:org_id ( id, name )")
    .in("status", ["active", "past_due"])
    .lte("next_billing_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let charged = 0;
  let failed = 0;
  let cancelled = 0;

  for (const sub of dueSubscriptions ?? []) {
    const plan = findPlan(sub.plan_code);
    const buyerName =
      (sub.profiles as { full_name?: string } | null)?.full_name ??
      (sub.organizations as { name?: string } | null)?.name ??
      "לקוח SkyOps Israel";

    const result = await chargeToken({
      token: sub.cardcom_token,
      amountIls: Number(sub.amount_ils),
      productName: `SkyOps Israel — ${plan?.name ?? sub.plan_code} (חידוש חודשי)`,
      document: { name: buyerName, productDescription: `חידוש מנוי חודשי — ${plan?.name ?? sub.plan_code}` },
    });

    if (result.ok) {
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      await supabase
        .from("billing_subscriptions")
        .update({ next_billing_date: nextBillingDate.toISOString().slice(0, 10), failed_attempts: 0 })
        .eq("id", sub.id);
      await supabase.from("billing_invoices").insert({
        subscription_id: sub.id,
        profile_id: sub.created_by_profile_id,
        amount_ils: sub.amount_ils,
        cardcom_document_number: result.documentNumber,
        cardcom_document_url: result.documentUrl,
        cardcom_transaction_id: result.transactionId,
      });
      charged += 1;
      continue;
    }

    const failedAttempts = sub.failed_attempts + 1;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await supabase
        .from("billing_subscriptions")
        .update({ status: "cancelled", failed_attempts: failedAttempts, cancelled_at: new Date().toISOString() })
        .eq("id", sub.id);

      const freeCode = plan?.category === "business" ? "business_free" : "private_free";
      if (sub.profile_id) {
        await supabase.from("profiles").update({ plan_code: freeCode }).eq("id", sub.profile_id);
      }
      // An org subscription failing doesn't delete the org — there's no plan-limit enforcement
      // in the app today to downgrade it to (see the real-integration checklist); it's left
      // cancelled/flagged for a human to follow up on rather than silently locking anyone out.

      const notifyProfileIds = sub.profile_id
        ? [sub.profile_id]
        : (
            await supabase
              .from("organization_members")
              .select("user_id")
              .eq("org_id", sub.org_id!)
              .eq("role", "fleet_manager")
              .eq("status", "active")
          ).data?.map((m) => m.user_id) ?? [];

      for (const userId of notifyProfileIds) {
        await supabase.from("notifications").insert({
          user_id: userId,
          kind: "subscription_cancelled",
          title: "המנוי בוטל עקב כשלי חיוב חוזרים",
          body: `החיוב החודשי עבור "${plan?.name ?? sub.plan_code}" נכשל ${MAX_FAILED_ATTEMPTS} פעמים ברציפות. המנוי בוטל.`,
        });
      }
      cancelled += 1;
    } else {
      const retryDate = new Date();
      retryDate.setDate(retryDate.getDate() + 1);
      await supabase
        .from("billing_subscriptions")
        .update({
          status: "past_due",
          failed_attempts: failedAttempts,
          next_billing_date: retryDate.toISOString().slice(0, 10),
        })
        .eq("id", sub.id);

      const notifyProfileIds = sub.profile_id
        ? [sub.profile_id]
        : (
            await supabase
              .from("organization_members")
              .select("user_id")
              .eq("org_id", sub.org_id!)
              .eq("role", "fleet_manager")
              .eq("status", "active")
          ).data?.map((m) => m.user_id) ?? [];

      for (const userId of notifyProfileIds) {
        await supabase.from("notifications").insert({
          user_id: userId,
          kind: "subscription_payment_failed",
          title: "חיוב חודשי נכשל",
          body: `החיוב החודשי עבור "${plan?.name ?? sub.plan_code}" נכשל (ניסיון ${failedAttempts}/${MAX_FAILED_ATTEMPTS}). ${result.description}`,
        });
      }
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, total: dueSubscriptions?.length ?? 0, charged, failed, cancelled });
}
