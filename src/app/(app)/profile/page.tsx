import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { ProfilePageClient } from "./ProfilePageClient";

export default async function ProfilePage() {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");
  const { profile } = current;

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
