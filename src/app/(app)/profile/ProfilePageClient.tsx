"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plane, Plus, Loader2, IdCard, Building2, GraduationCap, BarChart3, Briefcase, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDrones, useCreateDrone } from "@/hooks/useDrones";
import { useMyLicenses } from "@/hooks/useLicenses";
import { LicenseUploadDialog } from "@/components/dashboard/LicenseUploadDialog";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { SettingsMenu } from "@/components/profile/SettingsMenu";
import { SpecialAuthorizationsCard } from "@/components/profile/SpecialAuthorizationsCard";
import { PilotMarketplaceProfileCard } from "@/components/profile/PilotMarketplaceProfileCard";
import { PilotPricingCard } from "@/components/profile/PilotPricingCard";
import { PortfolioCard } from "@/components/profile/PortfolioCard";
import { DroneRegistrationBadge } from "@/components/logs/DroneRegistrationBadge";
import { DemoModeNotice } from "@/components/shared/DemoModeNotice";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { createClient } from "@/lib/supabase/client";
import { droneSchema, type DroneInput } from "@/lib/validations/flight-log";
import type { Tables } from "@/lib/types/database.types";

/** The "profile & settings" bubble is a small hub, not just this page — these are the sections that live one tap deeper rather than crowding this page itself. Visibility mirrors visibleNavItems in lib/constants/nav.ts. */
function QuickLinksRow({
  hasOrg,
  canSeeAnalytics,
}: {
  hasOrg: boolean;
  canSeeAnalytics: boolean;
}) {
  const links = [
    // No role/org gate — this was a permanently-visible nav item before the
    // bubble-launcher redesign (src/lib/constants/nav.ts), and lost every
    // reachable path to it in that redesign (confirmed across all 4 persona
    // audits). Keeping it unconditional here guarantees a way back to it
    // regardless of role, org membership, or plan.
    { href: "/marketplace/bookings", label: "הזמנות עבודה", icon: Briefcase, show: true },
    { href: "/org", label: "הארגון שלי", icon: Building2, show: hasOrg },
    { href: "/academy", label: "אקדמיה", icon: GraduationCap, show: true },
    { href: "/analytics", label: "אנליטיקס", icon: BarChart3, show: canSeeAnalytics },
  ].filter((l) => l.show);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <l.icon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-medium">{l.label}</span>
          <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}

const DRONE_STATUS_LABELS: Record<string, string> = {
  operational: "תקין",
  maintenance_required: "נדרש טיפול",
  grounded: "מקורקע",
  retired: "הוצא משימוש",
};

const LICENSE_TYPE_LABELS: Record<string, string> = {
  hobby: "תחביב",
  commercial_25kg: "מסחרי עד 25 ק״ג",
  heavy_2000kg: "כבד עד 2000 ק״ג",
};

const LICENSE_STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  active: "success",
  expiring_soon: "warning",
  expired: "destructive",
};

const LICENSE_STATUS_LABELS: Record<string, string> = {
  active: "בתוקף",
  expiring_soon: "פג בקרוב",
  expired: "פג תוקף",
};

function AddDroneDialog() {
  const [open, setOpen] = useState(false);
  const createDrone = useCreateDrone();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DroneInput>({ resolver: zodResolver(droneSchema) });

  async function onSubmit(values: DroneInput) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("יש להתחבר מחדש");
      return;
    }
    try {
      await createDrone.mutateAsync({ ...values, user_id: user.id });
      toast.success("הרחפן נוסף לפרופיל שלך");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת הרחפן נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          רחפן חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>רישום רחפן</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nickname">כינוי</Label>
            <Input id="nickname" placeholder="לדוגמה: מאביק שלי" {...register("nickname")} />
            {errors.nickname && <p className="text-xs text-destructive">{errors.nickname.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturer">יצרן</Label>
              <Input id="manufacturer" placeholder="DJI" {...register("manufacturer")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model">דגם</Label>
              <Input id="model" placeholder="Mini 4 Pro" {...register("model")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serial_number">מספר סידורי</Label>
              <Input id="serial_number" dir="ltr" {...register("serial_number")} />
              {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mtow_grams">משקל המראה מרבי (גרם)</Label>
              <Input id="mtow_grams" type="number" dir="ltr" {...register("mtow_grams", { valueAsNumber: true })} />
              {errors.mtow_grams && <p className="text-xs text-destructive">{errors.mtow_grams.message}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registration_number">מספר רישום (CAAI, אופציונלי)</Label>
            <Input id="registration_number" dir="ltr" {...register("registration_number")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              רשום רחפן
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfilePageClient({ profile }: { profile: Tables<"profiles"> }) {
  const { data: drones = [], isLoading: dronesLoading } = useDrones();
  const { data: licenses = [], isLoading: licensesLoading } = useMyLicenses();
  const { data: orgContext } = useMyOrgContext();

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader profile={profile} />

      <QuickLinksRow
        hasOrg={Boolean(orgContext?.orgId)}
        canSeeAnalytics={Boolean(orgContext?.isFleetManager) || profile.role === "dispatcher_admin"}
      />

      <SettingsMenu profile={profile} />

      <SpecialAuthorizationsCard role={profile.role} />

      {profile.role === "pilot_pro" && <PilotMarketplaceProfileCard />}
      {profile.role === "pilot_pro" && <PilotPricingCard />}
      {profile.role === "pilot_pro" && <PortfolioCard />}

      {/* An admin account doesn't itself own drones or hold a pilot license — these two cards only ever rendered as their own "you haven't registered anything yet" empty state for dispatcher_admin. */}
      {profile.role !== "dispatcher_admin" && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plane className="h-4 w-4" />
                </span>
                הרחפנים שלי
              </CardTitle>
              <AddDroneDialog />
            </CardHeader>
            <CardContent>
              {dronesLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
              {!dronesLoading && drones.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  עדיין לא רשמת רחפן. יש לרשום לפחות רחפן אחד כדי שתוכל/י לתאם טיסות.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {drones.map((drone) => (
                  <div key={drone.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{drone.nickname}</p>
                        <p className="text-xs text-muted-foreground">
                          {drone.manufacturer} {drone.model} · {(drone.mtow_grams / 1000).toFixed(2)} ק״ג
                        </p>
                      </div>
                      <Badge variant={drone.status === "operational" ? "success" : "warning"}>
                        {DRONE_STATUS_LABELS[drone.status]}
                      </Badge>
                    </div>
                    <DroneRegistrationBadge
                      status={drone.registration_status}
                      expiresAt={drone.registration_expires_at}
                      droneId={drone.id}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
                  <IdCard className="h-4 w-4" />
                </span>
                הרישיון שלי
              </CardTitle>
              <LicenseUploadDialog />
            </CardHeader>
            <CardContent>
              {licensesLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
              {!licensesLoading && licenses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  עדיין לא הועלה רישיון טיס. יש להעלות רישיון בתוקף כדי לתאם טיסות.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {licenses.map((license) => (
                  <div key={license.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{LICENSE_TYPE_LABELS[license.license_type]}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {license.license_number} · בתוקף עד {license.expires_at}
                      </p>
                    </div>
                    <Badge variant={LICENSE_STATUS_VARIANT[license.status]}>
                      {LICENSE_STATUS_LABELS[license.status]}
                    </Badge>
                  </div>
                ))}
              </div>
              {licenses.length > 0 && (
                <DemoModeNotice compact className="mt-2">
                  הסטטוס מבוסס על התאריך שזוהה/הוזן — לא אימות ממשלתי מקוון מול רת&quot;א
                </DemoModeNotice>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
