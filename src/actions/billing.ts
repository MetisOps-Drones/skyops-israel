"use server";

import { createClient } from "@/lib/supabase/server";
import { createLowProfile } from "@/lib/cardcom/client";
import { findPlan } from "@/lib/constants/plans";

export interface InitiateCheckoutResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

/**
 * Starts a real Cardcom checkout for a paid plan/org tier — replaces the
 * old "write plan_code, show a demo toast" flow. Nothing is granted here:
 * this only creates a pending billing_checkouts row and hands back
 * Cardcom's hosted payment page URL. The org/plan only actually activates
 * once the webhook (src/app/api/webhooks/cardcom/route.ts) independently
 * re-confirms payment against Cardcom's own API.
 */
export async function initiateCheckout(input: {
  planCode: string;
  /** Only for an org-tier checkout — the org doesn't exist yet, so its name travels with the checkout row. */
  orgName?: string;
  /** Whether a successful payment should also switch the profile's role to pilot_pro (business-tier upgrade from a private account). */
  switchToPro?: boolean;
  /** Business/org "free week trial" signup — saves a card via Cardcom's token-only operation instead of charging now; the recurring cron makes the real first charge when the trial ends. */
  trialDays?: number;
}): Promise<InitiateCheckoutResult> {
  const plan = findPlan(input.planCode);
  if (!plan) return { success: false, error: "תוכנית לא ידועה" };
  if (plan.priceIls === null) return { success: false, error: "תוכנית זו דורשת יצירת קשר לתמחור, לא ניתן לרכוש ישירות" };
  if (plan.priceIls === 0) return { success: false, error: "תוכנית זו חינמית — אין צורך בסליקה" };
  if (plan.category === "org" && !input.orgName?.trim()) return { success: false, error: "יש להזין שם ארגון" };

  const isTrial = Boolean(input.trialDays);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const { data: checkout, error: insertError } = await supabase
    .from("billing_checkouts")
    .insert({
      profile_id: user.id,
      plan_code: plan.code,
      intended_org_name: plan.category === "org" ? input.orgName!.trim() : null,
      switch_to_pro: Boolean(input.switchToPro),
      amount_ils: plan.priceIls,
      trial_ends_at: isTrial ? new Date(Date.now() + input.trialDays! * 24 * 60 * 60 * 1000).toISOString() : null,
    })
    .select()
    .single();

  if (insertError || !checkout) {
    return { success: false, error: insertError?.message ?? "יצירת עסקה נכשלה" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const result = await createLowProfile({
    amountIls: isTrial ? 0 : plan.priceIls,
    productName: `SkyOps Israel — ${plan.name}`,
    returnValue: checkout.id,
    successRedirectUrl: `${siteUrl}/profile?checkout=success`,
    failedRedirectUrl: `${siteUrl}/profile?checkout=failed`,
    webhookUrl: `${siteUrl}/api/webhooks/cardcom`,
    createToken: true,
    tokenOnly: isTrial,
    document: isTrial
      ? undefined
      : {
          name: profile?.full_name ?? "לקוח SkyOps Israel",
          email: user.email,
          productDescription: `מנוי חודשי — ${plan.name}`,
        },
  });

  if (!result.ok || !result.redirectUrl) {
    await supabase.from("billing_checkouts").update({ status: "failed" }).eq("id", checkout.id);
    return { success: false, error: `יצירת עמוד תשלום נכשלה: ${result.description}` };
  }

  await supabase
    .from("billing_checkouts")
    .update({ cardcom_low_profile_id: result.lowProfileId })
    .eq("id", checkout.id);

  return { success: true, redirectUrl: result.redirectUrl };
}
