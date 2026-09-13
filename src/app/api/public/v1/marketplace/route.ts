import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/api-keys/verify";
import { ALL_PLANS } from "@/lib/constants/plans";

const MARKETPLACE_ELIGIBLE_PLAN_CODES = ALL_PLANS.filter((p) => p.marketplaceEligible).map((p) => p.code);

/**
 * Public marketplace directory feed — the data behind the embeddable
 * marketplace widget (/embed/marketplace). Mirrors the `marketplace_freelancers`
 * RPC (which is gated to logged-in org accounts) but for an unauthenticated
 * partner-site visitor: same no-phone/no-business_id privacy rule, and no
 * `my_contact_request_status` since there's no calling org to scope it to.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request, "marketplace_embed");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServiceRoleClient();
  const { data: freelancers, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, bio, business_hours, professional_category, is_verified_pilot, pilot_profiles ( headline, years_experience, specializations, skills, service_areas )"
    )
    .eq("role", "pilot_pro")
    .eq("freelance_available", true)
    .in("plan_code", MARKETPLACE_ELIGIBLE_PLAN_CODES)
    .order("full_name");

  if (error) return NextResponse.json({ error: "שליפת המרקטפלייס נכשלה" }, { status: 500 });

  const pilotIds = (freelancers ?? []).map((f) => f.id);
  const { data: reviewRows } = await supabase.from("pilot_reviews").select("pilot_id, rating").in("pilot_id", pilotIds);

  const ratingsByPilot = new Map<string, { sum: number; count: number }>();
  for (const r of reviewRows ?? []) {
    const entry = ratingsByPilot.get(r.pilot_id) ?? { sum: 0, count: 0 };
    entry.sum += r.rating;
    entry.count += 1;
    ratingsByPilot.set(r.pilot_id, entry);
  }

  const result = (freelancers ?? []).map((f) => {
    const pp = Array.isArray(f.pilot_profiles) ? f.pilot_profiles[0] : f.pilot_profiles;
    const ratings = ratingsByPilot.get(f.id);
    return {
      id: f.id,
      full_name: f.full_name,
      avatar_url: f.avatar_url,
      bio: f.bio,
      business_hours: f.business_hours,
      professional_category: f.professional_category,
      is_verified_pilot: f.is_verified_pilot,
      avg_rating: ratings ? Math.round((ratings.sum / ratings.count) * 100) / 100 : null,
      review_count: ratings?.count ?? 0,
      headline: pp?.headline ?? null,
      years_experience: pp?.years_experience ?? null,
      specializations: pp?.specializations ?? [],
      skills: pp?.skills ?? [],
      service_areas: pp?.service_areas ?? [],
    };
  });

  return NextResponse.json({ freelancers: result });
}
