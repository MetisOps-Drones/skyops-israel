"use client";

import Link from "next/link";
import { toast } from "sonner";
import { MessageSquare, Check, X, Ban, Loader2, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import {
  useMyMarketplaceBookings,
  useRespondToBooking,
  useCancelBooking,
  type MarketplaceBooking,
} from "@/hooks/useMarketplace";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT } from "@/lib/constants/booking-status";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return `${s.toLocaleDateString("he-IL", dateFmt)} · ${s.toLocaleTimeString("he-IL", timeFmt)}-${e.toLocaleTimeString("he-IL", timeFmt)}`;
  }
  return `${s.toLocaleString("he-IL", { ...dateFmt, ...timeFmt })} — ${e.toLocaleString("he-IL", { ...dateFmt, ...timeFmt })}`;
}

function BookingRow({ booking, userId }: { booking: MarketplaceBooking; userId: string | null }) {
  const isPilotSide = booking.pilot_id === userId;
  const otherPartyName = isPilotSide ? booking.org_name : booking.pilot_full_name;
  const respond = useRespondToBooking();
  const cancel = useCancelBooking();

  async function handleRespond(accept: boolean) {
    try {
      await respond.mutateAsync({ id: booking.id, accept });
      toast.success(accept ? "ההזמנה אושרה — נפתח צ׳אט" : "ההזמנה נדחתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הפעולה נכשלה");
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync(booking.id);
      toast.success("העסקה בוטלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הביטול נכשל");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{otherPartyName?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{booking.title}</p>
              <p className="text-xs text-muted-foreground">
                {isPilotSide ? "מול" : "עם"} {otherPartyName}
              </p>
            </div>
          </div>
          <Badge variant={BOOKING_STATUS_VARIANT[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{booking.description}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {formatRange(booking.start_time, booking.end_time)}
        </p>

        {booking.status === "confirmed" && booking.association_code && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(booking.association_code!);
              toast.success("קוד השיוך הועתק");
            }}
            className="flex w-fit items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success"
          >
            <Copy className="h-3 w-3" />
            קוד שיוך: {booking.association_code}
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {booking.status === "invited" && isPilotSide && (
            <>
              <Button size="sm" onClick={() => handleRespond(true)} disabled={respond.isPending}>
                {respond.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                אישור
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleRespond(false)} disabled={respond.isPending}>
                <X className="h-4 w-4" />
                דחייה
              </Button>
            </>
          )}
          {booking.status === "invited" && !isPilotSide && (
            <p className="text-xs text-muted-foreground">ממתין לתשובת המטיס/ה</p>
          )}
          {(booking.status === "pending" || booking.status === "confirmed") && (
            <>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/marketplace/bookings/${booking.id}`}>
                  <MessageSquare className="h-4 w-4" />
                  פתיחת צ׳אט
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={cancel.isPending}>
                <Ban className="h-4 w-4 text-destructive" />
                ביטול
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BookingsPageClient() {
  const { data: ctx } = useMyOrgContext();
  const { data: bookings = [], isLoading, isError } = useMyMarketplaceBookings();

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען...</p>;

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
        טעינת ההזמנות נכשלה — נסו לרענן את הדף.
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        אין עדיין הזמנות עבודה.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => (
        <BookingRow key={b.id} booking={b} userId={ctx?.userId ?? null} />
      ))}
    </div>
  );
}
