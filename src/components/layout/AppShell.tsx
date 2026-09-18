"use client";

import { usePathname, useRouter } from "next/navigation";
import { MapHome } from "@/components/layout/MapHome";
import { BubbleLauncher } from "@/components/layout/BubbleLauncher";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
        {/* key={pathname}: this Dialog stays open continuously across every
            navigation between two non-/map routes (only /map ever sets
            open=false) — Radix's data-state never re-toggles false→open for
            those transitions, so its CSS enter animation (zoom-in-95) never
            cleanly restarts and gets stuck mid-keyframe (scale 0.95, no
            translate — confirmed live: the dialog rendered ~330px below and
            ~250px right of correct, clipped past the viewport). Forcing a
            fresh mount per pathname makes every section-to-section jump —
            not just the close-to-map path — replay the animation from a
            clean, correctly-centered start every time. */}
        <DialogContent
          key={pathname}
          className={cn(
            style === "full" &&
              "inset-0 left-0 top-0 h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none p-0"
          )}
        >
          <DialogTitle className="sr-only">תוכן העמוד</DialogTitle>
          <DialogDescription className="sr-only">תוכן העמוד שנבחר מהתפריט, מוצג כשכבה מעל המפה</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}
