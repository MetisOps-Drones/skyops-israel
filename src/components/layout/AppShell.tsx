"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MapNavSheet } from "@/components/layout/MapNavSheet";
import type { Tables } from "@/lib/types/database.types";

/**
 * The map page wants a full-bleed canvas — every pixel is the map, no
 * persistent Sidebar/TopNav/MobileBottomNav eating into it — so a pilot
 * standing in a field sees as much of the map as their screen allows.
 * Every other route keeps today's dashboard shell exactly as it was.
 */
export function AppShell({
  profile,
  email,
  children,
}: {
  profile: Tables<"profiles">;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullBleed = pathname === "/map";

  if (isFullBleed) {
    return (
      <div className="relative h-screen overflow-hidden">
        {children}
        <MapNavSheet role={profile.role} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav profile={profile} email={email} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav role={profile.role} />
    </div>
  );
}
