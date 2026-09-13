import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilePageClient } from "./ProfilePageClient";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">הפרופיל שלי</h1>
        <p className="text-sm text-muted-foreground">הרחפנים והרישיון שלך, במקום אחד</p>
      </div>
      <ProfilePageClient profile={profile} />
    </div>
  );
}
