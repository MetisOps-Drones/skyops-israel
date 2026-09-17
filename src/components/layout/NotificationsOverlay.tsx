"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/types/database.types";

const BOOKING_NOTIFICATION_KINDS = new Set([
  "booking_invited",
  "booking_accepted",
  "booking_declined",
  "booking_confirmed",
  "booking_cancelled",
  "booking_message_received",
]);

/** Every booking-lifecycle kind carries booking_id in metadata (see supabase/migrations/0062_marketplace_bookings.sql) — this used to only cover booking_message_received, so a new job offer (booking_invited) or an org's booking getting accepted/declined/confirmed rendered as an unclickable notification with no way to reach it. contact_request_received has no dedicated page — /dashboard is where IncomingContactRequestsCard actually shows it. Other kinds (license expiry, NOTAM, etc.) don't point at one page. */
function notificationHref(n: Tables<"notifications">): string | null {
  if (BOOKING_NOTIFICATION_KINDS.has(n.kind)) {
    const bookingId = (n.metadata as { booking_id?: string } | null)?.booking_id;
    return bookingId ? `/marketplace/bookings/${bookingId}` : null;
  }
  if (n.kind === "coordination_requested") {
    return "/ops";
  }
  if (n.kind === "contact_request_received") {
    return "/dashboard";
  }
  return null;
}

/** The notifications bubble's overlay — same content as the old TopNav dropdown, now a standalone card since there's no top nav to drop down from anymore. */
export function NotificationsOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>התראות</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {notifications.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">אין התראות חדשות</p>
          )}
          {notifications.slice(0, 20).map((n) => {
            const href = notificationHref(n);
            const content = (
              <>
                <span className="text-sm font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.body}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: he })}
                </span>
              </>
            );
            const itemClass = cn(
              "flex flex-col items-start gap-0.5 rounded-md px-2 py-2 text-start",
              !n.read_at && "bg-accent/50"
            );
            return href ? (
              <Link
                key={n.id}
                href={href}
                onClick={() => {
                  if (!n.read_at) markRead.mutate(n.id);
                  onOpenChange(false);
                }}
                className={cn(itemClass, "transition-colors hover:bg-accent")}
              >
                {content}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read_at && markRead.mutate(n.id)}
                className={itemClass}
              >
                {content}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
