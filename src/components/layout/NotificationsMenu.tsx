"use client";

import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkNotificationRead, useNotifications, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const { data: notifications = [] } = useNotifications();
  const unreadCount = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>התראות</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">אין התראות חדשות</p>
        )}
        {notifications.slice(0, 8).map((n) => (
          <DropdownMenuItem
            key={n.id}
            className={cn("flex flex-col items-start gap-0.5", !n.read_at && "bg-accent/50")}
            onClick={() => !n.read_at && markRead.mutate(n.id)}
          >
            <span className="text-sm font-medium">{n.title}</span>
            <span className="text-xs text-muted-foreground">{n.body}</span>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: he })}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
