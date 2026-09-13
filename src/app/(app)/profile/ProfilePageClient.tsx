"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plane, Plus, Loader2, IdCard } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { droneSchema, type DroneInput } from "@/lib/validations/flight-log";
import type { Tables } from "@/lib/types/database.types";

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

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader profile={profile} />

      <SettingsMenu profile={profile} />

      <SpecialAuthorizationsCard role={profile.role} />

      {profile.role === "pilot_pro" && <PilotMarketplaceProfileCard />}
      {profile.role === "pilot_pro" && <PilotPricingCard />}
      {profile.role === "pilot_pro" && <PortfolioCard />}

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
        </CardContent>
      </Card>
    </div>
  );
}
