"use client";

import { ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { MapHome } from "@/components/layout/MapHome";
import { BubbleLauncher } from "@/components/layout/BubbleLauncher";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useBubbleLauncherStore } from "@/stores/useBubbleLauncherStore";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/types/database.types";

/**
 * The map is the app's permanent home screen. Every other route renders as
 * an overlay on top of it instead of replacing it — MapHome stays mounted
 * for the whole (app) group, so switching sections never reloads the map.
 * "/map" itself is the one route with nothing to overlay (it IS the base
 * layer); every other route gets wrapped — a small centered card for the
 * light profile/settings hub, a large-but-not-full panel (map still visible
 * around the edges) for everything data-heavier. Never true full-screen: a
 * menu item should always feel like it opened a layer over the map, not
 * navigated to a new page.
 */
function overlayStyle(pathname: string): "none" | "card" | "panel" {
  if (pathname === "/map") return "none";
  if (pathname.startsWith("/profile")) return "card";
  return "panel";
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
  const setRingOpen = useBubbleLauncherStore((s) => s.setRingOpen);

  function handleBack() {
    setRingOpen(true);
    router.push("/map");
  }

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
            style === "panel" &&
              "h-[88vh] max-h-[88vh] w-[92vw] max-w-5xl gap-0 overflow-y-auto overflow-x-hidden rounded-xl p-0"
          )}
        >
          <DialogTitle className="sr-only">תוכן העמוד</DialogTitle>
          <DialogDescription className="sr-only">תוכן העמוד שנבחר מהתפריט, מוצג כשכבה מעל המפה</DialogDescription>
          {/* Sits just start-of (i.e. before, in RTL further right of) the X
              from DialogContent's own DialogPrimitive.Close — that one exits
              to the plain map, this one reopens the bubble ring on the way
              out so the pilot lands back on "all the open bubbles" instead
              of having to re-tap the launcher from scratch. */}
          <button
            type="button"
            onClick={handleBack}
            aria-label="חזרה לתפריט הבועות"
            title="חזרה לתפריט הבועות"
            className="absolute end-12 top-2 z-10 rounded-sm p-2.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* min-w-0: DialogContent is display:grid, so this is a grid item —
              without an explicit min-width it defaults to "auto" (its
              content's intrinsic width), which lets any unwrappable child
              (e.g. a Badge with nowrap text inside a shrinking grid-cols-N
              stat row) blow the whole page wider than the panel instead of
              wrapping/shrinking to fit it. Confirmed live: without this, one
              admin page's stat cards rendered ~200px past the panel's left
              edge on a 375px viewport. */}
          <div className="min-w-0">{children}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
