"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "@/lib/constants/nav";
import { useUiStore } from "@/stores/useUiStore";
import type { UserRole } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { MetisOpsLogo } from "./MetisOpsLogo";
import { useMyOrgContext } from "@/hooks/useOrgContext";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { data: ctx } = useMyOrgContext();
  const items = visibleNavItems(role, Boolean(ctx?.orgId), ctx?.isFleetManager ?? false);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-e bg-card transition-all duration-200 md:flex",
        sidebarCollapsed ? "w-[68px]" : "w-64"
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MetisOpsLogo className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && <span className="truncate font-bold">MetisOps</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Button variant="ghost" size="icon" className="w-full" onClick={toggleSidebar}>
          <ChevronsLeftRight className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
