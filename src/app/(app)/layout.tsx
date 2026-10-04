import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUserProfile();

  if (!current) {
    redirect("/auth/login");
  }
  const { user, profile } = current;

  return (
    <AppShell profile={profile} email={user.email ?? null}>
      {children}
    </AppShell>
  );
}
