"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Store, ClipboardCheck, ShieldCheck, UserCircle, Bell } from "lucide-react";
import { MetisOpsLogo } from "./MetisOpsLogo";
import { NotificationsOverlay } from "./NotificationsOverlay";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import type { UserRole } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

interface BubbleItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: () => void;
  badge?: number;
}

/**
 * The app's only persistent chrome over the map: one logo bubble that
 * bursts open into a ring of section bubbles around it. Each one either
 * navigates (AppShell then shows that route as an overlay on top of the
 * still-mounted map) or, for notifications, opens its own small card
 * directly — there's no dedicated "notifications" page to navigate to.
 */
/** Fallback for the very first render, before the viewport effect below runs — matches a typical desktop window, and only ever briefly visible since the ring starts closed. */
const DEFAULT_VIEWPORT = { width: 1024, height: 768 };

export function BubbleLauncher({ role }: { role: UserRole }) {
  const [ringOpen, setRingOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const router = useRouter();
  const unreadCount = useUnreadNotificationCount();
  const isAdmin = role === "dispatcher_admin";

  // The ring's geometry has to fit whatever window it's actually shown in —
  // a fixed radius/offset looked right on a normal desktop window but sent
  // the bottom bubbles off-screen on a shorter one. Recomputed on resize so
  // rotating a phone or resizing a window doesn't leave it stale.
  useEffect(() => {
    function updateViewport() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const bubbles: BubbleItem[] = [
    { key: "logs", label: "יומן טיסות", icon: BookOpen, href: "/logs" },
    { key: "marketplace", label: "מארקטפלייס", icon: Store, href: "/marketplace" },
    { key: "coordination", label: "תיאומים", icon: ClipboardCheck, href: "/dashboard" },
    ...(isAdmin ? [{ key: "admin", label: "ניהול אדמין", icon: ShieldCheck, href: "/admin" }] : []),
    { key: "profile", label: "פרופיל והגדרות", icon: UserCircle, href: "/profile" },
    {
      key: "notifications",
      label: "התראות",
      icon: Bell,
      action: () => setNotificationsOpen(true),
      badge: unreadCount,
    },
  ];

  function handleBubbleClick(bubble: BubbleItem) {
    setRingOpen(false);
    if (bubble.action) bubble.action();
    else if (bubble.href) router.push(bubble.href);
  }

  const count = bubbles.length;

  // Center bottom offset: 160px is comfortable on a normal window, but
  // never more than 40% of the viewport height so it doesn't get pushed
  // absurdly high (or past the top edge) on a very short one.
  const centerBottom = Math.min(160, viewport.height * 0.4);
  const satelliteHalf = 24; // h-12 button, half its size
  const margin = 12;
  // Largest radius that still leaves every satellite fully on-screen in
  // every direction — the actual bug reported live: a fixed 104px radius
  // around a button pinned 32px from the bottom edge left no room below it
  // at all, so the bottom third of the ring rendered off-screen.
  const radius = Math.max(
    40,
    Math.min(
      96,
      centerBottom - satelliteHalf - margin,
      viewport.height - centerBottom - satelliteHalf - margin,
      viewport.width / 2 - satelliteHalf - margin
    )
  );

  return (
    <>
      {ringOpen && (
        <button
          type="button"
          aria-label="סגירת התפריט"
          className="fixed inset-0 z-30 bg-black/10"
          onClick={() => setRingOpen(false)}
        />
      )}

      {/* left-1/2, not start-1/2: this is physical screen-center math (the
          circular layout below), not text-direction-relative flow — on this
          RTL site, start-1/2 resolves to right:50%, which combined with the
          physical -translate-x-1/2 silently shifts the whole ring away from
          true center instead of centering it (the actual cause of bubbles
          clipping off the left edge on narrow screens). */}
      <div className="fixed left-1/2 z-40 -translate-x-1/2" style={{ bottom: `${centerBottom}px` }}>
        <div className="relative h-14 w-14">
          {bubbles.map((bubble, i) => {
            // Full circle around the center bubble, starting straight up and going clockwise.
            const angleDeg = -90 + (360 * i) / count;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.cos(angleRad) * radius;
            const y = Math.sin(angleRad) * radius;
            const Icon = bubble.icon;
            return (
              <button
                key={bubble.key}
                type="button"
                onClick={() => handleBubbleClick(bubble)}
                aria-label={bubble.label}
                title={bubble.label}
                tabIndex={ringOpen ? 0 : -1}
                className={cn(
                  "absolute left-1/2 top-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-input bg-card text-foreground shadow-lg transition-all duration-300 ease-out",
                  ringOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                )}
                style={{
                  // Combines the button's own centering offset with its ring
                  // position and open/closed scale into one transform —
                  // mixing this with Tailwind's translate/scale utility
                  // classes would silently drop whichever set it last.
                  transform: ringOpen
                    ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                    : "translate(-50%, -50%) scale(0)",
                  transitionDelay: ringOpen ? `${i * 30}ms` : "0ms",
                }}
              >
                <Icon className="h-5 w-5" />
                {Boolean(bubble.badge) && (
                  <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {bubble.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setRingOpen((v) => !v)}
            aria-label="תפריט MetisOps"
            title="תפריט MetisOps"
            aria-expanded={ringOpen}
            className={cn(
              "relative z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform duration-300",
              ringOpen && "rotate-90"
            )}
          >
            <MetisOpsLogo className="h-7 w-7" />
            {!ringOpen && unreadCount > 0 && (
              <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <NotificationsOverlay open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  );
}
