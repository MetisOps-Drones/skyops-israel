import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminPilotsPageClient } from "./AdminPilotsPageClient";

export default async function AdminPilotsPage() {
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
        <h1 className="text-2xl font-bold">אימות מטיסים</h1>
        <p className="text-sm text-muted-foreground">
          סימון "מטיס מאומת" מוצג במרקטפלייס לצד מטיסים עצמאיים — לאחר בדיקה ידנית של הרישיון והפרטים שלהם.
        </p>
      </div>
      <AdminPilotsPageClient />
    </div>
  );
}
