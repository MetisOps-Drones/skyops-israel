"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BatteryWarning, Plus, Loader2, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDrones, useCreateBattery } from "@/hooks/useDrones";
import { useAddBatteryReading } from "@/hooks/useEquipment";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { batterySchema, type BatteryInput } from "@/lib/validations/flight-log";
import { batteryReadingSchema, type BatteryReadingInput } from "@/lib/validations/equipment";
import type { Tables } from "@/lib/types/database.types";

const BATTERY_WEAR_LIMIT = 200;

const HEALTH_LABELS: Record<string, string> = {
  healthy: "תקינה",
  degraded: "בירידה",
  replace_soon: "להחלפה בקרוב",
  condemned: "פסולה לשימוש",
};

function useAllBatteries() {
  return useQuery({
    queryKey: ["batteries", "all"],
    queryFn: async (): Promise<(Tables<"batteries"> & { drones: { nickname: string } | null })[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("batteries")
        .select("*, drones ( nickname )")
        .order("cycle_count", { ascending: false });
      if (error) throw error;
      return data as unknown as (Tables<"batteries"> & { drones: { nickname: string } | null })[];
    },
  });
}

function AddBatteryDialog() {
  const [open, setOpen] = useState(false);
  const { data: drones = [] } = useDrones();
  const createBattery = useCreateBattery();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatteryInput>({ resolver: zodResolver(batterySchema), defaultValues: { cycle_count: 0 } });

  async function onSubmit(values: BatteryInput) {
    try {
      await createBattery.mutateAsync({
        drone_id: values.drone_id,
        serial_number: values.serial_number,
        cycle_count: values.cycle_count,
        last_voltage_reading: values.last_voltage_reading ?? null,
        purchased_at: values.purchased_at?.toISOString().slice(0, 10) ?? null,
      });
      toast.success("הסוללה נוספה");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת הסוללה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          הוספת סוללה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>סוללה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>כלי טיס</Label>
            <Controller
              name="drone_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר כלי טיס" />
                  </SelectTrigger>
                  <SelectContent>
                    {drones.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.drone_id && <p className="text-xs text-destructive">{errors.drone_id.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serial_number">מספר סידורי</Label>
            <Input id="serial_number" dir="ltr" {...register("serial_number")} />
            {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle_count">מחזורי טעינה נוכחיים</Label>
            <Input id="cycle_count" type="number" dir="ltr" {...register("cycle_count", { valueAsNumber: true })} />
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
        <Button size="icon" variant="outline" className="h-7 w-7">
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
              <Label htmlFor="voltage">מתח (V)</Label>
              <Input id="voltage" type="number" step="0.1" dir="ltr" {...register("voltage", { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capacity_percent">קיבולת (%)</Label>
              <Input
                id="capacity_percent"
                type="number"
                dir="ltr"
                {...register("capacity_percent", { valueAsNumber: true })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ירידה של 15% ומעלה בקיבולת לעומת מדידה שלפני 30 יום תסמן את הסוללה אוטומטית כ&quot;בירידה&quot;.
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

export function BatteryTracker() {
  const { data: batteries = [], isLoading } = useAllBatteries();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>מעקב סוללות</CardTitle>
        <AddBatteryDialog />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {!isLoading && batteries.length === 0 && (
          <p className="text-sm text-muted-foreground">טרם נוספו סוללות</p>
        )}
        {batteries.map((battery) => {
          const wearPercent = Math.min(100, Math.round((battery.cycle_count / BATTERY_WEAR_LIMIT) * 100));
          return (
            <div key={battery.id} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {battery.serial_number} · {battery.drones?.nickname ?? "—"}
                </span>
                <div className="flex items-center gap-2">
                <AddReadingDialog batteryId={battery.id} />
                <Badge
                  variant={
                    battery.health_status === "healthy"
                      ? "success"
                      : battery.health_status === "condemned"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {battery.cycle_count > BATTERY_WEAR_LIMIT && <BatteryWarning className="me-1 h-3 w-3" />}
                  {HEALTH_LABELS[battery.health_status]}
                </Badge>
                </div>
              </div>
              <Progress value={wearPercent} />
              <p className="mt-1 text-xs text-muted-foreground">
                {battery.cycle_count} מחזורים {battery.cycle_count > BATTERY_WEAR_LIMIT && "— חורג מהמומלץ (200)"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
