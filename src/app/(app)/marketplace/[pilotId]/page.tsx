import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PilotProfilePageClient } from "./PilotProfilePageClient";

export default async function PilotProfilePage({ params }: { params: { pilotId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PilotProfilePageClient pilotId={params.pilotId} />
    </div>
  );
}
