import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { LogsPageClient } from "./LogsPageClient";

export default async function LogsPage() {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");
  const { profile } = current;

  // Flight logs are a paid feature (private_standard and up — see
  // src/lib/constants/plans.ts) that a pure hobby pilot on the free tier
  // shouldn't reach at all: it surfaces business tooling (client
  // management, profitability) that isn't part of their plan. A hobby
  // pilot who's actually contracting for an org still needs it — the
  // gate is on org membership, same as hideForPureHobby used to be in the
  // now-removed nav.ts.
  if (profile?.role === "pilot_hobby" && !profile.org_id) {
    redirect("/dashboard");
  }

  return <LogsPageClient />;
}
