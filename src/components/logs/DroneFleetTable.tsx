"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { DroneRegistrationBadge } from "./DroneRegistrationBadge";
import { createClient } from "@/lib/supabase/client";
import { droneSchema, type DroneInput } from "@/lib/validations/flight-log";

const STATUS_LABELS: Record<string, string> = {
  operational: "תקין",
  maintenance_required: "נדרש טיפול",
  grounded: "מקורקע",
  retired: "הוצא משימוש",
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
              <Label htmlFor="nickname">כינוי</Label>
              <Input id="nickname" {...register("nickname")} />
              {errors.nickname && <p className="text-xs text-destructive">{errors.nickname.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mtow_grams">משקל המראה מרבי (גרם)</Label>
              <Input id="mtow_grams" type="number" dir="ltr" {...register("mtow_grams", { valueAsNumber: true })} />
              {errors.mtow_grams && <p className="text-xs text-destructive">{errors.mtow_grams.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturer">יצרן</Label>
              <Input id="manufacturer" {...register("manufacturer")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model">דגם</Label>
              <Input id="model" {...register("model")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serial_number">מספר סידורי</Label>
              <Input id="serial_number" dir="ltr" {...register("serial_number")} />
              {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registration_number">מספר רישום (CAAI)</Label>
              <Input id="registration_number" dir="ltr" {...register("registration_number")} />
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

export function DroneFleetTable() {
  const { data: drones = [], isLoading } = useDrones();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AddDroneDialog />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>כינוי</TableHead>
            <TableHead>דגם</TableHead>
            <TableHead>מספר סידורי</TableHead>
            <TableHead>שעות טיסה</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead>רישום CAAI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                טוען...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && drones.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                טרם נוספו כלי טיס
              </TableCell>
            </TableRow>
          )}
          {drones.map((drone) => (
            <TableRow key={drone.id}>
              <TableCell>{drone.nickname}</TableCell>
              <TableCell>
                {drone.manufacturer} {drone.model}
              </TableCell>
              <TableCell dir="ltr" className="text-end">
                {drone.serial_number}
              </TableCell>
              <TableCell>{Math.round((drone.total_flight_minutes / 60) * 10) / 10} שעות</TableCell>
              <TableCell>
                <Badge variant={drone.status === "operational" ? "success" : "warning"}>
                  {STATUS_LABELS[drone.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <DroneRegistrationBadge
                  status={drone.registration_status}
                  expiresAt={drone.registration_expires_at}
                  droneId={drone.id}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
