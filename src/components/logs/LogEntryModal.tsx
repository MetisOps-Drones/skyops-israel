"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createFlightLogSchema, type CreateFlightLogInput } from "@/lib/validations/flight-log";
import { useDrones, useDroneBatteries } from "@/hooks/useDrones";
import { useCreateFlightLog } from "@/hooks/useFlightLogs";
import { useClients } from "@/hooks/useClients";
import { createClient } from "@/lib/supabase/client";
import { ClientPicker } from "@/components/logs/ClientPicker";

export function LogEntryModal() {
  const [open, setOpen] = useState(false);
  const { data: drones = [] } = useDrones();
  const { data: clients = [] } = useClients();
  const createLog = useCreateFlightLog();

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFlightLogInput>({
    resolver: zodResolver(createFlightLogSchema),
  });

  const selectedDroneId = watch("drone_id");
  const { data: batteries = [] } = useDroneBatteries(selectedDroneId ?? null);

  async function onSubmit(values: CreateFlightLogInput) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("יש להתחבר מחדש");
      return;
    }

    const selectedClient = clients.find((c) => c.id === values.client_id);

    try {
      await createLog.mutateAsync({
        user_id: user.id,
        drone_id: values.drone_id,
        battery_id: values.battery_id ?? null,
        flight_request_id: values.flight_request_id ?? null,
        start_time: values.start_time.toISOString(),
        end_time: values.end_time.toISOString(),
        max_altitude_m: values.max_altitude_m ?? null,
        max_distance_m: values.max_distance_m ?? null,
        notes: values.notes ?? null,
        client_id: values.client_id ?? null,
        client_name: selectedClient?.name ?? null,
        price: values.price ?? null,
        cost: values.cost ?? null,
        telemetry_source: "manual",
      });
      toast.success("רשומת הטיסה נשמרה");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת הרשומה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          רשומה ידנית
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>רשומת טיסה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drone_id">כלי טיס</Label>
            <Controller
              name="drone_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="drone_id">
                    <SelectValue placeholder="בחר כלי טיס" />
                  </SelectTrigger>
                  <SelectContent>
                    {drones.map((drone) => (
                      <SelectItem key={drone.id} value={drone.id}>
                        {drone.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.drone_id && <p className="text-xs text-destructive">{errors.drone_id.message}</p>}
          </div>

          {batteries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="battery_id">סוללה (אופציונלי)</Label>
              <Controller
                name="battery_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="battery_id">
                      <SelectValue placeholder="בחר סוללה" />
                    </SelectTrigger>
                    <SelectContent>
                      {batteries.map((battery) => (
                        <SelectItem key={battery.id} value={battery.id}>
                          {battery.serial_number} ({battery.cycle_count} מחזורים)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_time">התחלה</Label>
              <Input id="start_time" type="datetime-local" dir="ltr" {...register("start_time")} />
              {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_time">סיום</Label>
              <Input id="end_time" type="datetime-local" dir="ltr" {...register("end_time")} />
              {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max_altitude_m">גובה מרבי (מ׳)</Label>
              <Input
                id="max_altitude_m"
                type="number"
                dir="ltr"
                {...register("max_altitude_m", { valueAsNumber: true })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max_distance_m">מרחק מרבי (מ׳)</Label>
              <Input
                id="max_distance_m"
                type="number"
                dir="ltr"
                {...register("max_distance_m", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Label>לקוח (אופציונלי)</Label>
            <Controller
              name="client_id"
              control={control}
              render={({ field }) => <ClientPicker value={field.value} onChange={field.onChange} />}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">מחיר ללקוח (₪)</Label>
              <Input id="price" type="number" dir="ltr" {...register("price", { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">עלות בפועל (₪)</Label>
              <Input id="cost" type="number" dir="ltr" {...register("cost", { valueAsNumber: true })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              שמור רשומה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
