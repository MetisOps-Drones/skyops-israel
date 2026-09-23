import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogsPageClient } from "./LogsPageClient";

export default async function LogsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role, org_id").eq("id", user.id).single();

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
