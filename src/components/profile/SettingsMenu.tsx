"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { UserRound, Bell, CreditCard, Briefcase, Building2, Loader2, ExternalLink, LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Disclosure } from "@/components/ui/disclosure";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlanCatalog } from "@/components/profile/PlanCatalog";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { useUpdateProfileDetails } from "@/hooks/useProfileSettings";
import { findPlan } from "@/lib/constants/plans";
import type { Tables } from "@/lib/types/database.types";

type Profile = Tables<"profiles">;

interface DayHours {
  day: number;
  open: boolean;
  from: string;
  to: string;
}

const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function defaultHours(): DayHours[] {
  return DAY_LABELS.map((_, day) => ({ day, open: day >= 0 && day <= 4, from: "08:00", to: "18:00" }));
}

function parseBusinessHours(raw: unknown): DayHours[] {
  if (!Array.isArray(raw) || raw.length !== 7) return defaultHours();
  return raw.map((row, day) => {
    const r = row as Partial<DayHours>;
    return { day, open: Boolean(r?.open), from: r?.from ?? "08:00", to: r?.to ?? "18:00" };
  });
}

function WeeklyHoursEditor({ value, onChange }: { value: DayHours[]; onChange: (v: DayHours[]) => void }) {
  function update(day: number, patch: Partial<DayHours>) {
    onChange(value.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  }
  return (
    <div className="flex flex-col gap-1.5">
      {value.map((d) => (
        <div key={d.day} className="flex items-center gap-2">
          <Switch checked={d.open} onCheckedChange={(v) => update(d.day, { open: v })} />
          <span className="w-12 text-xs text-muted-foreground">{DAY_LABELS[d.day]}</span>
          {d.open ? (
            <div className="flex flex-1 items-center gap-1.5">
              <Input
                type="time"
                value={d.from}
                onChange={(e) => update(d.day, { from: e.target.value })}
                className="h-8 px-2 text-xs"
                dir="ltr"
              />
              <span className="text-xs text-muted-foreground">עד</span>
              <Input
                type="time"
                value={d.to}
                onChange={(e) => update(d.day, { to: e.target.value })}
                className="h-8 px-2 text-xs"
                dir="ltr"
              />
            </div>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">סגור</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionIcon({ icon: Icon, accent = "navy" }: { icon: typeof UserRound; accent?: "navy" | "gold" }) {
  return (
    <span
      className={
        accent === "gold"
          ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      }
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function PersonalDetailsSection({ profile }: { profile: Profile }) {
  const update = useUpdateProfileDetails();
  const { register, handleSubmit } = useForm({
    defaultValues: { fullName: profile.full_name, phone: profile.phone ?? "" },
  });

  async function onSubmit(values: { fullName: string; phone: string }) {
    try {
      await update.mutateAsync(values);
      toast.success("הפרטים עודכנו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">שם מלא</Label>
        <Input id="fullName" {...register("fullName")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">טלפון</Label>
        <Input id="phone" dir="ltr" {...register("phone")} />
      </div>
      <Button type="submit" disabled={update.isPending} className="self-end">
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        שמירה
      </Button>
    </form>
  );
}

function NotificationsSection({ profile }: { profile: Profile }) {
  const update = useUpdateProfileDetails();
  const [notifyEmail, setNotifyEmail] = useState(profile.notify_email);
  const [notifySms, setNotifySms] = useState(profile.notify_sms);

  async function handleSave() {
    try {
      await update.mutateAsync({ fullName: profile.full_name, notifyEmail, notifySms });
      toast.success("העדפות ההתראות נשמרו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="notify-email">התראות במייל</Label>
        <Switch id="notify-email" checked={notifyEmail} onCheckedChange={setNotifyEmail} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="notify-sms">התראות ב-SMS</Label>
        <Switch id="notify-sms" checked={notifySms} onCheckedChange={setNotifySms} />
      </div>
      <Button onClick={handleSave} disabled={update.isPending} className="self-end">
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        שמירה
      </Button>
    </div>
  );
}

function BusinessDetailsSection({
  profile,
  isPro,
  marketplaceEligible,
  onOpenSubscription,
}: {
  profile: Profile;
  isPro: boolean;
  marketplaceEligible: boolean;
  onOpenSubscription: () => void;
}) {
  const update = useUpdateProfileDetails();
  const { register, handleSubmit } = useForm({
    defaultValues: { businessId: profile.business_id ?? "", bio: profile.bio ?? "" },
  });
  const [freelanceAvailable, setFreelanceAvailable] = useState(profile.freelance_available);
  const [hours, setHours] = useState<DayHours[]>(() => parseBusinessHours(profile.business_hours));

  async function onSubmit(values: { businessId: string; bio: string }) {
    try {
      await update.mutateAsync({ fullName: profile.full_name, ...values, freelanceAvailable, businessHours: hours });
      toast.success("פרטי העסק עודכנו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessId">מספר עוסק מורשה / ח.פ</Label>
        <Input id="businessId" dir="ltr" {...register("businessId")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">קצת עליי</Label>
        <Textarea id="bio" rows={3} placeholder="ניסיון, התמחות, אזורי פעילות..." {...register("bio")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>שעות פעילות וזמינות</Label>
        <WeeklyHoursEditor value={hours} onChange={setHours} />
      </div>
      {isPro && marketplaceEligible && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="freelance">פנוי לעבודה עם ארגונים (מרקטפלייס)</Label>
            <p className="text-xs text-muted-foreground">
              ארגונים במרקטפלייס המטיסים יראו את הפרופיל שלך ויוכלו לבקש ליצור קשר — הפנייה מגיעה אליך לאישור, ואינך
              יכול לגלוש במרקטפלייס בעצמך (זו תצוגה של חשבונות ארגון בלבד). את התמחור ותיק העבודות שהם יראו עורכים
              בהמשך העמוד הזה, בכרטיסי &ldquo;פרופיל מרקטפלייס&rdquo;, &ldquo;תמחור&rdquo; ו&ldquo;תיק עבודות&rdquo;.
            </p>
          </div>
          <Switch id="freelance" checked={freelanceAvailable} onCheckedChange={setFreelanceAvailable} />
        </div>
      )}
      {isPro && !marketplaceEligible && (
        <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
          <div>
            <p className="text-sm font-medium">מרקטפלייס מטיסים</p>
            <p className="text-xs text-muted-foreground">זמין החל מתוכנית סטנדרטי</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onOpenSubscription}>
            שדרוג
          </Button>
        </div>
      )}
      <Button type="submit" disabled={update.isPending} className="self-end">
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        שמירה
      </Button>
    </form>
  );
}

function OrgRoleSection({ profile }: { profile: Profile }) {
  const update = useUpdateProfileDetails();
  const { register, handleSubmit } = useForm({ defaultValues: { title: profile.title ?? "" } });

  async function onSubmit(values: { title: string }) {
    try {
      await update.mutateAsync({ fullName: profile.full_name, ...values });
      toast.success("הפרטים עודכנו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">תפקיד</Label>
        <Input id="title" placeholder="לדוגמה: מטיס ראשי, מנהל בטיחות" {...register("title")} />
      </div>
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        בקרוב: אבטחה (כניסה דו-שלבית, ניהול התחברויות), העדפות התראה מתקדמות, והיסטוריית פעילות אישית. ניהול הצוות
        נמצא ב״הארגון שלי״, וניהול הצי (כלי טיס, תחזוקה ומלאי) תחת ״יומן טיסות״.
      </p>
      <Button type="submit" disabled={update.isPending} className="self-end">
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        שמירה
      </Button>
    </form>
  );
}

function SubscriptionDialog({ profile, open, onOpenChange }: { profile: Profile; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>מנוי וסוג חשבון</DialogTitle>
          <DialogDescription>שדרוג לתוכנית בתשלום מעביר לעמוד סליקה מאובטח של Cardcom</DialogDescription>
        </DialogHeader>
        <PlanCatalog profile={profile} />
      </DialogContent>
    </Dialog>
  );
}

export function SettingsMenu({ profile }: { profile: Profile }) {
  const { data: orgContext } = useMyOrgContext();
  const hasOrg = Boolean(orgContext?.orgId);
  const isPro = profile.role === "pilot_pro" || profile.role === "fleet_manager";
  const showBusinessSection = isPro || hasOrg;

  const searchParams = useSearchParams();
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("open") === "subscription") setSubscriptionOpen(true);
  }, [searchParams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <Disclosure
          defaultOpen
          label={
            <span className="flex items-center gap-3">
              <SectionIcon icon={UserRound} />
              פרטים אישיים
            </span>
          }
        >
          <PersonalDetailsSection profile={profile} />
        </Disclosure>

        <Disclosure
          label={
            <span className="flex items-center gap-3">
              <SectionIcon icon={Bell} />
              התראות
            </span>
          }
        >
          <NotificationsSection profile={profile} />
        </Disclosure>

        <button
          type="button"
          onClick={() => setSubscriptionOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-right transition-colors hover:bg-accent"
        >
          <SectionIcon icon={CreditCard} accent="gold" />
          <div className="flex-1">
            <p className="text-sm font-medium">מנוי</p>
            <p className="text-xs text-muted-foreground">סוג חשבון ושדרוג — נפתח בחלון נפרד</p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {showBusinessSection && (
          <Disclosure
            label={
              <span className="flex items-center gap-3">
                <SectionIcon icon={Briefcase} />
                פרטי עסק
              </span>
            }
          >
            <BusinessDetailsSection
              profile={profile}
              isPro={profile.role === "pilot_pro"}
              marketplaceEligible={Boolean(findPlan(profile.plan_code)?.marketplaceEligible)}
              onOpenSubscription={() => setSubscriptionOpen(true)}
            />
          </Disclosure>
        )}

        {hasOrg && (
          <Disclosure
            label={
              <span className="flex items-center gap-3">
                <SectionIcon icon={Building2} accent="gold" />
                הגדרות ארגון מתקדמות
              </span>
            }
          >
            <OrgRoleSection profile={profile} />
          </Disclosure>
        )}

        {/* There was previously no way to reach this at all — signOut()
            existed as a server action with nothing in the UI calling it. */}
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-destructive/30 px-3 py-2.5 text-right text-destructive transition-colors hover:bg-destructive/10"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium">התנתקות</span>
        </button>
      </CardContent>

      <SubscriptionDialog profile={profile} open={subscriptionOpen} onOpenChange={setSubscriptionOpen} />
    </Card>
  );
}
