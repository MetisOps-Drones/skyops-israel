import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { AdminApiPageClient } from "./AdminApiPageClient";

export default async function AdminApiPage() {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");
  const { profile } = current;

  if (profile.role !== "dispatcher_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">API לשותפים</h1>
        <p className="text-sm text-muted-foreground">
          הנפקת מפתחות API לכל שכבה בנפרד, והגדרת מקור נתונים חלופי (API של שותף) לשכבה במקום הנתונים הפנימיים.
        </p>
      </div>
      <AdminApiPageClient />
    </div>
  );
}
