import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketplacePageClient } from "./MarketplacePageClient";

export default async function MarketplacePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();

  // The admin's own equivalent of this page is /admin/marketplace (booking
  // monitoring across the platform) — sending them to the org-facing browse
  // view instead just showed staff a customer paywall message with an
  // upgrade CTA that made no sense for an internal account.
  if (profile?.role === "dispatcher_admin") {
    redirect("/admin/marketplace");
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">מרקטפלייס מטיסים</h1>
        <p className="text-sm text-muted-foreground">מטיסים עצמאיים הפנויים לעבודה מול ארגונים</p>
      </div>
      {profile?.org_id ? (
        <MarketplacePageClient />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p>המרקטפלייס זמין לחשבונות ארגון בלבד. ניתן לשדרג דרך &ldquo;הפרופיל שלי&rdquo; ← &ldquo;מנוי&rdquo;.</p>
          <p>
            מחפשים את הזמנות העבודה שקיבלתם כמטיסים?{" "}
            <Link href="/marketplace/bookings" className="font-medium text-primary hover:underline">
              הזמנות עבודה שלי
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
