"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  BadgeCheck,
  Phone,
  MessageSquarePlus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { useMarketplacePilotProfile, useRequestContact, usePilotContactPhone, usePilotReviews } from "@/hooks/useMarketplace";
import { StarRow } from "@/components/marketplace/StarRow";
import { ReviewButton } from "@/components/marketplace/ReviewButton";

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function hoursSummary(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const openDays = raw.filter((d): d is { day: number; open: boolean; from: string; to: string } => Boolean(d?.open));
  if (openDays.length === 0) return null;
  return openDays.map((d) => `${DAY_LABELS[d.day]} ${d.from}-${d.to}`).join(" · ");
}

function TagSection({ title, tags }: { title: string; tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ContactRequestButton({ pilotId, orgId, name }: { pilotId: string; orgId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const requestContact = useRequestContact();

  async function handleSend() {
    try {
      await requestContact.mutateAsync({ org_id: orgId, pilot_id: pilotId, message: message.trim() || undefined });
      toast.success("בקשת יצירת הקשר נשלחה");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת הבקשה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <MessageSquarePlus className="h-4 w-4" />
        בקשת יצירת קשר
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>בקשת יצירת קשר עם {name}</DialogTitle>
          <DialogDescription>
            הבקשה תישלח למטיס/ה. פרטי הקשר יתגלו לכם רק לאחר שהמטיס/ה יאשר/תאשר את הבקשה.
          </DialogDescription>
        </DialogHeader>
        <Textarea placeholder="פרטו בקצרה על העבודה המוצעת (אופציונלי)" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button onClick={handleSend} disabled={requestContact.isPending}>
            {requestContact.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            שליחת בקשה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PilotProfilePageClient({ pilotId }: { pilotId: string }) {
  const { data: ctx } = useMyOrgContext();
  const { data: pilot, isLoading, error } = useMarketplacePilotProfile(pilotId);
  const status = pilot?.my_contact_request_status;
  const accepted = status === "accepted";
  const { data: phone } = usePilotContactPhone(pilotId, accepted);
  const { data: reviews = [] } = usePilotReviews(pilotId);

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען...</p>;

  if (error || !pilot) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        לא ניתן להציג את הפרופיל הזה.
      </div>
    );
  }

  const hours = hoursSummary(pilot.business_hours);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/marketplace" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" />
        חזרה למרקטפלייס
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {pilot.avatar_url && <AvatarImage src={pilot.avatar_url} alt={pilot.full_name} />}
                <AvatarFallback className="text-lg">{initials(pilot.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl font-bold">{pilot.full_name}</h1>
                  {pilot.is_verified_pilot && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label="מטיס מאומת" />}
                </div>
                {pilot.headline && <p className="text-sm text-muted-foreground">{pilot.headline}</p>}
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary">{pilot.professional_category ?? "מטיס עצמאי"}</Badge>
                  {pilot.years_experience !== null && (
                    <span className="text-xs text-muted-foreground">{pilot.years_experience} שנות ניסיון</span>
                  )}
                </div>
              </div>
            </div>

            {ctx?.orgId && (
              <div className="flex flex-col items-end gap-2">
                {status === "pending" && <Badge variant="warning">בקשת יצירת קשר ממתינה לתשובה</Badge>}
                {(status === null || status === "declined" || status === undefined) && (
                  <ContactRequestButton pilotId={pilot.id} orgId={ctx.orgId} name={pilot.full_name} />
                )}
                {accepted && (
                  <div className="flex flex-col items-end gap-2">
                    {phone && (
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Phone className="h-4 w-4" />
                        <span dir="ltr">{phone}</span>
                      </div>
                    )}
                    <ReviewButton pilotId={pilot.id} orgId={ctx.orgId} name={pilot.full_name} />
                  </div>
                )}
              </div>
            )}
          </div>

          {pilot.review_count > 0 ? (
            <div className="flex items-center gap-2">
              <StarRow rating={pilot.avg_rating ?? 0} />
              <span className="text-sm text-muted-foreground">
                {pilot.avg_rating?.toFixed(1)} ({pilot.review_count} ביקורות)
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">אין עדיין דירוגים</p>
          )}

          {pilot.bio && <p className="text-sm">{pilot.bio}</p>}

          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {hours && (
              <div className="flex items-start gap-1.5">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{hours}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ניסיון והתמחות</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TagSection title="אזורי שירות" tags={pilot.service_areas} />
          <TagSection title="תפקידים" tags={pilot.specializations} />
          <TagSection title="תחומי התמחות" tags={pilot.skills} />
          <TagSection title="סוגי כטב״ם" tags={pilot.uav_categories} />
          <TagSection title="דגמי רחפנים" tags={pilot.drone_models} />
          <TagSection title="מצבי הטסה ידניים" tags={pilot.flight_modes} />
          <TagSection title="תוכנות" tags={pilot.software} />
          {pilot.service_areas.length === 0 &&
            pilot.specializations.length === 0 &&
            pilot.skills.length === 0 &&
            pilot.uav_categories.length === 0 &&
            pilot.drone_models.length === 0 &&
            pilot.flight_modes.length === 0 &&
            pilot.software.length === 0 && <p className="text-sm text-muted-foreground">המטיס/ה עדיין לא מילא/ה פרטי ניסיון.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>המלצות</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין המלצות</p>}
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.organizations?.name ?? "ארגון"}</span>
                <StarRow rating={r.rating} size="h-3.5 w-3.5" />
              </div>
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
