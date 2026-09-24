import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { PilotProfilePageClient } from "./PilotProfilePageClient";

export default async function PilotProfilePage({ params }: { params: { pilotId: string } }) {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PilotProfilePageClient pilotId={params.pilotId} />
    </div>
  );
}
