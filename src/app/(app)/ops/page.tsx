import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { OpsPageClient } from "./OpsPageClient";

export default async function OpsPage() {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");
  const { profile } = current;

  if (profile.role !== "dispatcher_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">מוקד תיאום</h1>
        <p className="text-sm text-muted-foreground">בקשות NOTAM ותיאום מרחב אווירי הממתינות לטיפול</p>
      </div>
      <OpsPageClient />
    </div>
  );
}
