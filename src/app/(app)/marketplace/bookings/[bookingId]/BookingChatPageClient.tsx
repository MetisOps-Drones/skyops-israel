"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Send, Ban, Copy, Link2, Eye, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import {
  useMarketplaceBooking,
  useRespondToBooking,
  useConfirmBooking,
  useCancelBooking,
  type MarketplaceBooking,
} from "@/hooks/useMarketplace";
import { useBookingMessages, useSendBookingMessage } from "@/hooks/useBookingChat";
import { useMyFlightRequests } from "@/hooks/useFlightRequests";
import { linkFlightRequestToBooking } from "@/actions/flight-requests";
import { SwipeToConfirm } from "@/components/marketplace/SwipeToConfirm";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT } from "@/lib/constants/booking-status";
import { BOOKING_OPERATION_TYPE_LABELS, BOOKING_PURPOSE_LABELS } from "@/lib/constants/booking-job-details";

function JobDetailBadges({ booking }: { booking: MarketplaceBooking }) {
  const items = [
    booking.location,
    booking.operation_type ? BOOKING_OPERATION_TYPE_LABELS[booking.operation_type] : null,
    booking.drone_type,
    booking.purpose ? BOOKING_PURPOSE_LABELS[booking.purpose] : null,
    booking.budget_ils != null ? `תקציב: ₪${booking.budget_ils.toLocaleString("he-IL")}` : null,
  ].filter((v): v is string => Boolean(v));

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="text-[11px]">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function AssociationSection({ booking, isPilotSide }: { booking: MarketplaceBooking; isPilotSide: boolean }) {
  const { data: flightRequests = [] } = useMyFlightRequests();
  const [selectedId, setSelectedId] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const unlinked = flightRequests.filter((fr) => !fr.booking_id);

  async function handleLink() {
    if (!selectedId || !booking.association_code) return;
    setLinking(true);
    try {
      const result = await linkFlightRequestToBooking(selectedId, booking.association_code);
      if (!result.success) {
        toast.error(result.error ?? "השיוך נכשל");
        return;
      }
      toast.success("בקשת הטיסה שויכה לעסקה");
      setSelectedId("");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(booking.association_code!);
          toast.success("קוד השיוך הועתק");
        }}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-success"
      >
        <Copy className="h-3.5 w-3.5" />
        קוד שיוך: {booking.association_code}
      </button>
      <p className="text-xs text-muted-foreground">
        הקוד מקשר בין המטיס/ה לארגון עבור העבודה הזו — לדוגמה כשהארגון מספק רחפן או מתאם את השטח, כדי שבקשת הטיסה
        תוצג לשני הצדדים. בתוקף עד {new Date(booking.association_expires_at!).toLocaleString("he-IL")}.
      </p>
      {isPilotSide && unlinked.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="שיוך בקשת טיסה קיימת" />
            </SelectTrigger>
            <SelectContent>
              {unlinked.map((fr) => (
                <SelectItem key={fr.id} value={fr.id}>
                  {new Date(fr.start_time).toLocaleDateString("he-IL")} · {fr.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleLink} disabled={!selectedId || linking}>
            <Link2 className="h-3.5 w-3.5" />
            שיוך
          </Button>
        </div>
      )}
    </div>
  );
}

export function BookingChatPageClient({ bookingId }: { bookingId: string }) {
  const { data: ctx } = useMyOrgContext();
  const { data: booking, isLoading } = useMarketplaceBooking(bookingId);
  const { data: messages = [] } = useBookingMessages(bookingId);
  const sendMessage = useSendBookingMessage();
  const respond = useRespondToBooking();
  const confirm = useConfirmBooking();
  const cancel = useCancelBooking();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען...</p>;
  if (!booking) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        לא ניתן להציג את ההזמנה הזו.
      </div>
    );
  }

  const isPilotSide = booking.pilot_id === ctx?.userId;
  const isOrgSide = Boolean(ctx?.orgId) && booking.org_id === ctx?.orgId;
  const isParticipant = isPilotSide || isOrgSide;
  // RLS already guarantees a non-participant who can read this booking at
  // all is a dispatcher_admin — show the thread read-only for them.
  const canViewChat = booking.status !== "invited" && booking.status !== "declined";
  const otherPartyName = isPilotSide ? booking.org_name : booking.pilot_full_name;

  async function handleSend() {
    if (!text.trim()) return;
    try {
      await sendMessage.mutateAsync({ bookingId, body: text.trim() });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת ההודעה נכשלה");
    }
  }

  async function handleRespond(accept: boolean) {
    try {
      await respond.mutateAsync({ id: bookingId, accept });
      toast.success(accept ? "ההזמנה אושרה" : "ההזמנה נדחתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הפעולה נכשלה");
    }
  }

  async function handleConfirm() {
    try {
      await confirm.mutateAsync(bookingId);
      toast.success("העסקה אושרה סופית!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "האישור נכשל");
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync(bookingId);
      toast.success("העסקה בוטלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הביטול נכשל");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/marketplace/bookings" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" />
        חזרה להזמנות
      </Link>

      <Card>
        <CardHeader className="flex flex-col flex-wrap items-start justify-between gap-3 sm:flex-row">
          <div className="min-w-0">
            <CardTitle className="truncate">{booking.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isPilotSide ? "מול" : "עם"} {otherPartyName}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <Badge variant={BOOKING_STATUS_VARIANT[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</Badge>
            {!isParticipant && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                מצב צפייה — בקרה ראשית
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {booking.description && <p className="text-sm">{booking.description}</p>}
          <JobDetailBadges booking={booking} />
          <p className="text-xs text-muted-foreground" dir="ltr">
            {new Date(booking.start_time).toLocaleString("he-IL")} — {new Date(booking.end_time).toLocaleString("he-IL")}
          </p>

          {booking.status === "invited" && isPilotSide && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => handleRespond(true)} disabled={respond.isPending}>
                <Check className="h-4 w-4" />
                אישור ההזמנה
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleRespond(false)} disabled={respond.isPending}>
                <X className="h-4 w-4" />
                דחייה
              </Button>
            </div>
          )}

          {booking.status === "confirmed" && booking.association_code && (
            <AssociationSection booking={booking} isPilotSide={isPilotSide} />
          )}
        </CardContent>
      </Card>

      {canViewChat && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex max-h-[50vh] min-h-[240px] flex-col gap-2 overflow-y-auto rounded-lg border p-3">
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">אין עדיין הודעות — אפשר להתחיל לתאם פרטים.</p>}
              {messages.map((m) => {
                const mine = m.sender_id === ctx?.userId;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {isParticipant ? (
              <>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="הקלידו הודעה..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={sendMessage.isPending || !text.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {isPilotSide && booking.status === "pending" && <SwipeToConfirm onConfirm={handleConfirm} pending={confirm.isPending} />}

                {(booking.status === "pending" || booking.status === "confirmed") && (
                  <Button variant="ghost" size="sm" className="self-start" onClick={handleCancel} disabled={cancel.isPending}>
                    <Ban className="h-4 w-4 text-destructive" />
                    ביטול העסקה
                  </Button>
                )}
              </>
            ) : (
              <p className="text-center text-xs text-muted-foreground">צפייה בלבד — הודעות אינן ניתנות לשליחה במצב זה.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
