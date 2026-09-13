"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateDrone } from "@/hooks/useDrones";
import { createClient } from "@/lib/supabase/client";
import { droneSchema, type DroneInput } from "@/lib/validations/flight-log";

/**
 * Registering a drone isn't a platform-wide requirement — it only matters at the point a solo
 * (non-org) pilot actually tries to submit a coordination request, since a request needs a real
 * drone_id. FlightParamsDrawer renders this in place of the drone picker when the pilot has none
 * yet, instead of blocking every page behind registration up front (the old DroneRegistrationGate
 * behavior).
 */
export function DroneQuickRegisterCard() {
  const createDrone = useCreateDrone();
  const {
    register,
    handleSubmit,
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
      toast.success("הרחפן נרשם — אפשר לבחור אותו ולהמשיך בתיאום");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "רישום הרחפן נכשל");
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="mb-3 flex items-center gap-2">
        <Plane className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">כדי לתאם טיסה יש לרשום רחפן</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qr-nickname">כינוי</Label>
          <Input id="qr-nickname" placeholder="לדוגמה: מאביק שלי" {...register("nickname")} />
          {errors.nickname && <p className="text-xs text-destructive">{errors.nickname.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-manufacturer">יצרן</Label>
            <Input id="qr-manufacturer" placeholder="DJI" {...register("manufacturer")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-model">דגם</Label>
            <Input id="qr-model" placeholder="Mini 4 Pro" {...register("model")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-serial_number">מספר סידורי</Label>
            <Input id="qr-serial_number" dir="ltr" {...register("serial_number")} />
            {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-mtow_grams">משקל המראה מרבי (גרם)</Label>
            <Input id="qr-mtow_grams" type="number" dir="ltr" {...register("mtow_grams", { valueAsNumber: true })} />
            {errors.mtow_grams && <p className="text-xs text-destructive">{errors.mtow_grams.message}</p>}
          </div>
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          רשום רחפן
        </Button>
      </form>
    </div>
  );
}
