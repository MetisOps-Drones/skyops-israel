"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BatteryWarning, Gauge, Loader2, Plus, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { useDrones, useDroneBatteries, useCreateDrone, useCreateBattery } from "@/hooks/useDrones";
import { useAddBatteryReading } from "@/hooks/useEquipment";
import { createClient } from "@/lib/supabase/client";
import { droneSchema, type DroneInput, batterySchema, type BatteryInput } from "@/lib/validations/flight-log";
import { batteryReadingSchema, type BatteryReadingInput } from "@/lib/validations/equipment";
import { DroneRegistrationBadge } from "./DroneRegistrationBadge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/types/database.types";

const BATTERY_WEAR_LIMIT = 200;

const DRONE_STATUS_LABELS: Record<string, string> = {
  operational: "תקין",
  maintenance_required: "נדרש טיפול",
  grounded: "מקורקע",
  retired: "הוצא משימוש",
};

const BATTERY_HEALTH_LABELS: Record<string, string> = {
  healthy: "תקינה",
  degraded: "בירידה",
  replace_soon: "להחלפה בקרוב",
  condemned: "פסולה לשימוש",
};

/** % of the maintenance interval used up since the last service, by flight minutes. */
function maintenancePercent(drone: Tables<"drones">): number {
  if (drone.maintenance_interval_minutes <= 0) return 0;
  const used = drone.total_flight_minutes - drone.last_maintenance_flight_minutes;
  return Math.min(100, Math.max(0, Math.round((used / drone.maintenance_interval_minutes) * 100)));
}

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
      toast.success("כלי הטיס נוסף");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת כלי הטיס נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          כלי טיס חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>כלי טיס חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-nickname">כינוי</Label>
              <Input id="fh-nickname" {...register("nickname")} />
              {errors.nickname && <p className="text-xs text-destructive">{errors.nickname.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-mtow">משקל המראה מרבי (גרם)</Label>
              <Input id="fh-mtow" type="number" dir="ltr" {...register("mtow_grams", { valueAsNumber: true })} />
              {errors.mtow_grams && <p className="text-xs text-destructive">{errors.mtow_grams.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-manufacturer">יצרן</Label>
              <Input id="fh-manufacturer" {...register("manufacturer")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-model">דגם</Label>
              <Input id="fh-model" {...register("model")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-serial">מספר סידורי</Label>
              <Input id="fh-serial" dir="ltr" {...register("serial_number")} />
              {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-registration">מספר רישום (CAAI)</Label>
              <Input id="fh-registration" dir="ltr" {...register("registration_number")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              הוסף כלי טיס
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Drone is preselected from the card it's launched from, so no drone picker here. */
function AddBatteryDialog({ droneId }: { droneId: string }) {
  const [open, setOpen] = useState(false);
  const createBattery = useCreateBattery();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatteryInput>({
    resolver: zodResolver(batterySchema),
    defaultValues: { drone_id: droneId, cycle_count: 0 },
  });

  async function onSubmit(values: BatteryInput) {
    try {
      await createBattery.mutateAsync({
        drone_id: droneId,
        serial_number: values.serial_number,
        cycle_count: values.cycle_count,
        last_voltage_reading: values.last_voltage_reading ?? null,
        purchased_at: values.purchased_at?.toISOString().slice(0, 10) ?? null,
      });
      toast.success("הסוללה נוספה");
      reset({ drone_id: droneId, cycle_count: 0 });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת הסוללה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
          <Plus className="h-3 w-3" />
          סוללה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>סוללה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fh-battery-serial">מספר סידורי</Label>
            <Input id="fh-battery-serial" dir="ltr" {...register("serial_number")} />
            {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fh-battery-cycles">מחזורי טעינה נוכחיים</Label>
            <Input id="fh-battery-cycles" type="number" dir="ltr" {...register("cycle_count", { valueAsNumber: true })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              הוסף
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddReadingDialog({ batteryId }: { batteryId: string }) {
  const [open, setOpen] = useState(false);
  const addReading = useAddBatteryReading();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<BatteryReadingInput>({
    resolver: zodResolver(batteryReadingSchema),
    defaultValues: { battery_id: batteryId },
  });

  async function onSubmit(values: BatteryReadingInput) {
    try {
      await addReading.mutateAsync({
        battery_id: batteryId,
        voltage: values.voltage ?? null,
        capacity_percent: values.capacity_percent ?? null,
        source: "manual",
      });
      toast.success("המדידה נשמרה");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת המדידה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6">
          <Gauge className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מדידת קיבולת</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-voltage">מתח (V)</Label>
              <Input id="fh-voltage" type="number" step="0.1" dir="ltr" {...register("voltage", { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fh-capacity">קיבולת (%)</Label>
              <Input id="fh-capacity" type="number" dir="ltr" {...register("capacity_percent", { valueAsNumber: true })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ירידה של 15% ומעלה בקיבולת לעומת מדידה שלפני 30 יום תסמן את הסוללה אוטומטית כ&ldquo;בירידה&rdquo;.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              שמור מדידה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BatteryRow({ battery }: { battery: Tables<"batteries"> }) {
  const wearPercent = Math.min(100, Math.round((battery.cycle_count / BATTERY_WEAR_LIMIT) * 100));
  const needsAttention = battery.health_status === "replace_soon" || battery.health_status === "condemned";

  return (
    <div className="rounded-md border p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium" dir="ltr">
          {battery.serial_number}
        </span>
        <div className="flex items-center gap-1">
          <AddReadingDialog batteryId={battery.id} />
          <Badge
            variant={battery.health_status === "healthy" ? "success" : battery.health_status === "condemned" ? "destructive" : "warning"}
            className="text-[10px]"
          >
            {needsAttention && <BatteryWarning className="me-1 h-3 w-3" />}
            {BATTERY_HEALTH_LABELS[battery.health_status]}
          </Badge>
        </div>
      </div>
      <Progress value={wearPercent} className={cn(needsAttention && "[&>div]:bg-destructive")} />
      <p className="mt-1 text-[11px] text-muted-foreground">{battery.cycle_count} מחזורים</p>
    </div>
  );
}

function EquipmentCard({ drone }: { drone: Tables<"drones"> }) {
  const { data: batteries = [] } = useDroneBatteries(drone.id);
  const pct = maintenancePercent(drone);
  const needsMaintenance = drone.status === "maintenance_required" || pct >= 100;

  return (
    <Card className={cn(needsMaintenance && "border-destructive/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{drone.nickname}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {drone.manufacturer} {drone.model}
            </p>
          </div>
          <Badge variant={drone.status === "operational" ? "success" : "warning"}>{DRONE_STATUS_LABELS[drone.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {needsMaintenance && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs font-semibold text-destructive">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            נדרשת תחזוקה/כיול
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>שחיקת מרווח תחזוקה</span>
            <span>{pct}%</span>
          </div>
          <Progress
            value={pct}
            className={cn(pct >= 100 ? "[&>div]:bg-destructive" : pct >= 75 && "[&>div]:bg-warning")}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {Math.round((drone.total_flight_minutes / 60) * 10) / 10} שעות טיסה סה&quot;כ
            {drone.last_maintenance_at && ` · טיפול אחרון ${new Date(drone.last_maintenance_at).toLocaleDateString("he-IL")}`}
          </p>
        </div>

        <DroneRegistrationBadge status={drone.registration_status} expiresAt={drone.registration_expires_at} droneId={drone.id} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">סוללות</p>
            <AddBatteryDialog droneId={drone.id} />
          </div>
          {batteries.length === 0 && <p className="text-xs text-muted-foreground">אין סוללות רשומות</p>}
          {batteries.map((b) => (
            <BatteryRow key={b.id} battery={b} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * "Classic equipment cards" fleet-health view — one card per drone combining
 * its maintenance-interval gauge (by flight minutes, mirrors MaintenanceBanner's
 * status check) with its batteries' wear gauges (by charge cycles), so a
 * pilot/fleet manager sees what needs attention at a glance instead of
 * cross-referencing the separate fleet table and battery list.
 */
export function FleetHealthDashboard() {
  const { data: drones = [], isLoading } = useDrones();
  const flaggedCount = drones.filter((d) => d.status === "maintenance_required" || maintenancePercent(d) >= 100).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm", flaggedCount > 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
          {flaggedCount > 0 ? `${flaggedCount} כלי טיס דורשים תחזוקה` : "כל כלי הטיס תקינים"}
        </p>
        <AddDroneDialog />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
      {!isLoading && drones.length === 0 && <p className="text-sm text-muted-foreground">טרם נוספו כלי טיס</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {drones.map((drone) => (
          <EquipmentCard key={drone.id} drone={drone} />
        ))}
      </div>
    </div>
  );
}
