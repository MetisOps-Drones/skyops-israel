import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { AdminPilotsPageClient } from "./AdminPilotsPageClient";

export default async function AdminPilotsPage() {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");
  const { profile } = current;

  if (profile.role !== "dispatcher_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">אימות מטיסים</h1>
        <p className="text-sm text-muted-foreground">
          סימון &ldquo;מטיס מאומת&rdquo; מוצג במרקטפלייס לצד מטיסים עצמאיים — לאחר בדיקה ידנית של הרישיון והפרטים שלהם.
        </p>
      </div>
      <AdminPilotsPageClient />
    </div>
  );
}
