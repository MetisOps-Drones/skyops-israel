"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "@/lib/constants/nav";
import type { UserRole } from "@/lib/types/database.types";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * לקוח פרטי (pilot_hobby) has ~5 nav items — the full row fits comfortably.
 * Everyone else (pilot_pro ומעלה) has accumulated up to 10 across this
 * session's additions (מרקטפלייס, ניהול פלטפורמה, API, אנליטיקס...) —
 * cramming all of those into one bottom row is exactly the "menu isn't
 * good enough" complaint. Those roles get a single hamburger button that
 * opens the full list in a bottom sheet instead.
 */
const FULL_ROW_ROLES: UserRole[] = ["pilot_hobby"];

function HamburgerNav({ items, pathname }: { items: ReturnType<typeof visibleNavItems>; pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = items.find((item) => pathname.startsWith(item.href));
  const ActiveIcon = active?.icon ?? Menu;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t bg-card px-4 py-2 md:hidden">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ActiveIcon className="h-5 w-5 text-primary" />
          {active?.label ?? "תפריט"}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="פתיחת תפריט ניווט"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
      </nav>

      <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl md:hidden">
        <SheetHeader>
          <SheetTitle>ניווט</SheetTitle>
        </SheetHeader>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-[11px] font-medium",
                  isActive ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { data: ctx } = useMyOrgContext();
  const items = visibleNavItems(role, Boolean(ctx?.orgId), ctx?.isFleetManager ?? false);

  if (FULL_ROW_ROLES.includes(role)) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card md:hidden">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return <HamburgerNav items={items} pathname={pathname} />;
}
