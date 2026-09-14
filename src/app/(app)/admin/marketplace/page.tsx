import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminMarketplacePageClient } from "./AdminMarketplacePageClient";

export default async function AdminMarketplacePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "dispatcher_admin") {
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
