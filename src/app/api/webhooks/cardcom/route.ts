import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getLowProfileResult } from "@/lib/cardcom/client";
import { findPlan } from "@/lib/constants/plans";

export const dynamic = "force-dynamic";

/**
 * Cardcom calls this after a checkout completes. This is a public,
 * unauthenticated endpoint (Cardcom has no session with us) — it must
 * NEVER trust the POST body for the actual payment decision, since anyone
 * who learns this URL could otherwise POST a fake "paid" payload. Instead
 * the body is only used to learn which LowProfileId to ask Cardcom about;
 * the real answer always comes from getLowProfileResult(), a server-to-
 * server call authenticated with our own CARDCOM_API_NAME/PASSWORD. A
 * forged webhook call can at worst trigger a redundant, harmless
 * re-confirmation of a real checkout, or a no-op lookup of an ID that
 * doesn't exist.
 *
 * Idempotent by design: Cardcom may retry a webhook delivery, and a
 * checkout already marked 'paid'/consumed is simply skipped.
 */
export async function POST(request: NextRequest) {
  let lowProfileId: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const candidate = body.LowProfileId ?? body.lowProfileId ?? body.LowProfileID;
    if (typeof candidate === "string") lowProfileId = candidate;
  } catch {
    // fall through — some gateways send this as a query param instead of a JSON body
  }
  lowProfileId ??= request.nextUrl.searchParams.get("LowProfileId") ?? undefined;

  if (!lowProfileId) {
    return NextResponse.json({ error: "missing LowProfileId" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: checkout, error: fetchError } = await supabase
    .from("billing_checkouts")
    .select("*")
    .eq("cardcom_low_profile_id", lowProfileId)
    .maybeSingle();

  if (fetchError || !checkout) {
    console.error("cardcom webhook: no matching checkout for LowProfileId", lowProfileId, fetchError);
    // 200, not 404 — an unrecognized LowProfileId isn't an error Cardcom should retry forever.
    return NextResponse.json({ ok: true, matched: false });
  }

  if (checkout.status === "paid" || checkout.consumed_at) {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const result = await getLowProfileResult(lowProfileId);

  // A trial signup used Cardcom's token-only operation (nothing charged) — result.paid checks
  // DealResponse, a charge-transaction concept that may not apply the same way to a token-only
  // save. For a trial checkout, a successful API call (result.ok) that actually returned a token
  // is what "succeeded" means; for a real charge, it must also have DealResponse === 0.
  const isTrialCheckout = Boolean(checkout.trial_ends_at);
  const succeeded = isTrialCheckout ? result.ok && Boolean(result.token) : result.ok && result.paid;

  if (!succeeded) {
    await supabase.from("billing_checkouts").update({ status: "failed" }).eq("id", checkout.id);
    return NextResponse.json({ ok: true, paid: false, description: result.description });
  }

  if (result.returnValue && result.returnValue !== checkout.id) {
    console.error("cardcom webhook: ReturnValue mismatch", { lowProfileId, expected: checkout.id, got: result.returnValue });
    return NextResponse.json({ ok: false, error: "return value mismatch" }, { status: 409 });
  }
  const expectedChargeNowIls = isTrialCheckout ? 0 : Number(checkout.amount_ils);
  if (result.amountIls !== undefined && Math.abs(result.amountIls - expectedChargeNowIls) > 0.01) {
    console.error("cardcom webhook: amount mismatch", { lowProfileId, expected: expectedChargeNowIls, got: result.amountIls });
    return NextResponse.json({ ok: false, error: "amount mismatch" }, { status: 409 });
  }
  if (!result.token) {
    console.error("cardcom webhook: paid but no token returned — cannot set up recurring billing", lowProfileId);
    return NextResponse.json({ ok: false, error: "no token in paid result" }, { status: 502 });
  }

  const plan = findPlan(checkout.plan_code);
  if (!plan) {
    console.error("cardcom webhook: unknown plan_code on checkout", checkout.plan_code);
    return NextResponse.json({ ok: false, error: "unknown plan" }, { status: 500 });
  }

  await supabase
    .from("billing_checkouts")
    .update({ status: "paid", cardcom_token: result.token, cardcom_token_expiry: result.tokenExpiry })
    .eq("id", checkout.id);

  let orgId: string | null = null;

  if (plan.category === "org") {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: checkout.intended_org_name! })
      .select()
      .single();
    if (orgError || !org) {
      console.error("cardcom webhook: org creation failed after payment", orgError);
      return NextResponse.json({ ok: false, error: "org creation failed" }, { status: 500 });
    }
    orgId = org.id;

    const { error: memberError } = await supabase.from("organization_members").insert({
      org_id: org.id,
      user_id: checkout.profile_id,
      status: "active",
      role: "fleet_manager",
      decided_at: new Date().toISOString(),
      decided_by: checkout.profile_id,
    });
    if (memberError) {
      console.error("cardcom webhook: organization_members insert failed after payment", memberError);
      return NextResponse.json({ ok: false, error: "membership creation failed" }, { status: 500 });
    }

    await supabase
      .from("profiles")
      .update({ org_id: org.id, role: "fleet_manager", plan_code: plan.code })
      .eq("id", checkout.profile_id);
  } else {
    await supabase
      .from("profiles")
      .update({
        plan_code: plan.code,
        ...(checkout.switch_to_pro ? { role: "pilot_pro" } : {}),
      })
      .eq("id", checkout.profile_id);
  }

  await supabase.from("billing_checkouts").update({ consumed_at: new Date().toISOString() }).eq("id", checkout.id);

  // Trial: bill for the first time when the trial ends. Otherwise: one month from today.
  let nextBillingDate: Date;
  if (isTrialCheckout) {
    nextBillingDate = new Date(checkout.trial_ends_at!);
  } else {
    nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  }

  const { data: subscription, error: subError } = await supabase
    .from("billing_subscriptions")
    .insert({
      profile_id: orgId ? null : checkout.profile_id,
      org_id: orgId,
      created_by_profile_id: checkout.profile_id,
      plan_code: plan.code,
      cardcom_token: result.token,
      cardcom_token_expiry: result.tokenExpiry,
      amount_ils: checkout.amount_ils,
      next_billing_date: nextBillingDate.toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (subError) {
    console.error("cardcom webhook: billing_subscriptions insert failed", subError);
  }

  // A trial checkout charged nothing (token-only) — there's no real payment to invoice yet; the
  // first invoice is recorded when the recurring cron makes the actual first charge.
  if (!isTrialCheckout) {
    await supabase.from("billing_invoices").insert({
      checkout_id: checkout.id,
      subscription_id: subscription?.id ?? null,
      profile_id: checkout.profile_id,
      amount_ils: checkout.amount_ils,
      cardcom_document_number: result.documentNumber,
      cardcom_document_url: result.documentUrl,
      cardcom_transaction_id: result.transactionId,
    });
  }

  return NextResponse.json({ ok: true, paid: true });
}
