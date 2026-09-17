"use client";

import { usePathname, useRouter } from "next/navigation";
import { MapHome } from "@/components/layout/MapHome";
import { BubbleLauncher } from "@/components/layout/BubbleLauncher";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/types/database.types";

/**
 * The map is the app's permanent home screen. Every other route renders as
 * an overlay on top of it instead of replacing it — MapHome stays mounted
 * for the whole (app) group, so switching sections never reloads the map.
 * "/map" itself is the one route with nothing to overlay (it IS the base
 * layer); every other route gets wrapped, card-sized for the light
 * profile/settings hub and full-screen for everything data-heavier.
 */
function overlayStyle(pathname: string): "none" | "card" | "full" {
  if (pathname === "/map") return "none";
  if (pathname.startsWith("/profile")) return "card";
  return "full";
}

export function AppShell({
  profile,
  children,
}: {
  profile: Tables<"profiles">;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const style = overlayStyle(pathname);

  return (
    <div className="relative h-screen overflow-hidden">
      <MapHome />
      <BubbleLauncher role={profile.role} />

      <Dialog
        open={style !== "none"}
        onOpenChange={(open) => {
          if (!open) router.push("/map");
        }}
      >
        <DialogContent
          className={cn(
            style === "full" &&
              "inset-0 left-0 top-0 h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none p-0"
          )}
        >
          <DialogTitle className="sr-only">תוכן העמוד</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}
