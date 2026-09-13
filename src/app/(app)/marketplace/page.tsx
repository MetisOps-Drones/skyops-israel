import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketplacePageClient } from "./MarketplacePageClient";

export default async function MarketplacePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">מרקטפלייס מטיסים</h1>
        <p className="text-sm text-muted-foreground">מטיסים עצמאיים הפנויים לעבודה מול ארגונים</p>
      </div>
      {profile?.org_id ? (
        <MarketplacePageClient />
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          המרקטפלייס זמין לחשבונות ארגון בלבד. ניתן לשדרג דרך &ldquo;הפרופיל שלי&rdquo; ← &ldquo;מנוי&rdquo;.
        </div>
      )}
    </div>
  );
}
