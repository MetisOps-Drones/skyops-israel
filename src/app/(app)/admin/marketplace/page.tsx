import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { AdminMarketplacePageClient } from "./AdminMarketplacePageClient";

export default async function AdminMarketplacePage() {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");
  const { profile } = current;

  if (profile.role !== "dispatcher_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">ניטור מרקטפלייס</h1>
        <p className="text-sm text-muted-foreground">
          מצב הזמנות העבודה בפלטפורמה, וסוגיות שחוזרות על עצמן בשיחות בין ארגונים למטיסים.
        </p>
      </div>
      <AdminMarketplacePageClient />
    </div>
  );
}
