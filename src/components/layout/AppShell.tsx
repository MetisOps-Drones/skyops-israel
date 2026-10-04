"use client";

import { ChevronRight, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { MapHome } from "@/components/layout/MapHome";
import { BubbleLauncher } from "@/components/layout/BubbleLauncher";
import { NewCoordinationRequestToast } from "@/components/layout/NewCoordinationRequestToast";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { useBubbleLauncherStore } from "@/stores/useBubbleLauncherStore";
import { useIdleLogout } from "@/hooks/useIdleLogout";
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
  useIdleLogout();

  function handleBack() {
    setRingOpen(true);
    router.push("/map");
  }

  return (
    <div className="relative h-screen overflow-hidden">
      <MapHome />
      <BubbleLauncher role={profile.role} />
      {profile.role === "dispatcher_admin" && <NewCoordinationRequestToast />}

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
          hideClose
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            style === "panel" ? "h-[88vh] max-h-[88vh] w-[92vw] max-w-5xl rounded-xl" : "max-w-lg"
          )}
        >
          <DialogTitle className="sr-only">תוכן העמוד</DialogTitle>
          <DialogDescription className="sr-only">תוכן העמוד שנבחר מהתפריט, מוצג כשכבה מעל המפה</DialogDescription>

          {/* A real header row, not floating buttons over content: the old
              absolute-positioned back/close pair sat right where a page's
              own heading naturally starts (no reserved clearance for them),
              and — since the OUTER DialogContent used to be the thing that
              scrolled — scrolled away with the content on any tall page
              instead of staying put. This row is a flex sibling of the
              scrollable body below, so it can never overlap or scroll with
              the page's own content, and always looks like a designed
              toolbar rather than two buttons floating over whatever's
              underneath. */}
          <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b px-2">
            {/* Reopens the bubble ring on the way out (unlike the close
                button, which exits straight to the plain map) so the pilot
                lands back on "all the open bubbles" instead of having to
                re-tap the launcher from scratch. */}
            <button
              type="button"
              onClick={handleBack}
              aria-label="חזרה לתפריט הבועות"
              title="חזרה לתפריט הבועות"
              className="rounded-md p-2 text-muted-foreground transition-[background-color,color,transform] duration-150 hover:scale-110 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <DialogClose
              aria-label="סגירה וחזרה למפה"
              title="סגירה וחזרה למפה"
              className="rounded-md p-2 text-muted-foreground transition-[background-color,color,transform] duration-150 hover:scale-110 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          {/* min-w-0: a flex item otherwise defaults to its content's
              intrinsic width, which let any unwrappable child (e.g. a Badge
              with nowrap text inside a shrinking grid-cols-N stat row) blow
              the whole page wider than the panel instead of wrapping/
              shrinking to fit it. Confirmed live: without this, one admin
              page's stat cards rendered ~200px past the panel's left edge
              on a 375px viewport. flex-1 + its own scroll: this is now the
              ONLY thing that scrolls, so the header row above never moves. */}
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
