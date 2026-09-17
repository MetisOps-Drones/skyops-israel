"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { visibleNavItems } from "@/lib/constants/nav";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { MetisOpsLogo } from "./MetisOpsLogo";
import type { UserRole } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

/**
 * The map page goes full-bleed (AppShell hides Sidebar/TopNav there) —
 * this floating button + slide-in panel is the only way back to the rest
 * of the app from it. Reuses visibleNavItems, the same list Sidebar reads,
 * rather than a second hardcoded nav that could drift from it.
 */
export function MapNavSheet({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: ctx } = useMyOrgContext();
  const items = visibleNavItems(role, Boolean(ctx?.orgId), ctx?.isFleetManager ?? false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="תפריט ניווט"
        title="תפריט ניווט"
        className="absolute top-16 end-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-input bg-card text-foreground shadow-md transition-colors hover:bg-accent"
      >
        <Menu className="h-4 w-4" />
      </button>
      <SheetContent side="start" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MetisOpsLogo className="h-4 w-4" />
            </div>
            MetisOps
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-2">
          {items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
