import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OpsPageClient } from "./OpsPageClient";

export default async function OpsPage() {
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
        <h1 className="text-2xl font-bold">מוקד תיאום</h1>
        <p className="text-sm text-muted-foreground">בקשות NOTAM ותיאום מרחב אווירי הממתינות לטיפול</p>
      </div>
      <OpsPageClient />
    </div>
  );
}
