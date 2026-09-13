"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { useDrones } from "@/hooks/useDrones";
import { useMaintenanceLog, useAddMaintenanceLog } from "@/hooks/useEquipment";
import { createClient } from "@/lib/supabase/client";
import { maintenanceLogSchema, type MaintenanceLogInput } from "@/lib/validations/equipment";

const KIND_LABELS: Record<string, string> = {
  inspection: "בדיקה",
  repair: "תיקון",
  part_replacement: "החלפת חלק",
  other: "אחר",
};

function AddMaintenanceLogDialog() {
  const [open, setOpen] = useState(false);
  const { data: drones = [] } = useDrones();
  const addLog = useAddMaintenanceLog();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceLogInput>({
    resolver: zodResolver(maintenanceLogSchema),
    defaultValues: { kind: "inspection", performed_at: new Date() },
  });

  async function onSubmit(values: MaintenanceLogInput) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    try {
      await addLog.mutateAsync({
        drone_id: values.drone_id,
        kind: values.kind,
        description: values.description,
        cost: values.cost ?? null,
        performed_at: values.performed_at.toISOString().slice(0, 10),
        logged_by: user?.id ?? null,
      });
      toast.success("הרשומה נוספה ליומן הטכני");
      if (values.kind === "inspection" || values.kind === "repair") {
        toast.message("סטטוס כלי הטיס עודכן ל'תקין' וספירת שעות התחזוקה אופסה");
      }
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת הרשומה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          רשומה טכנית חדשה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>רשומה טכנית חדשה</DialogTitle>
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
            <Label>סוג פעולה</Label>
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">תיאור</Label>
            <Textarea id="description" rows={3} {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="performed_at">תאריך ביצוע</Label>
              <Input id="performed_at" type="date" dir="ltr" {...register("performed_at")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">עלות (₪)</Label>
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

export function MaintenanceLogPanel() {
  const { data: entries = [], isLoading } = useMaintenanceLog();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          יומן טכני
        </CardTitle>
        <AddMaintenanceLogDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>כלי טיס</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>עלות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  אין עדיין רשומות ביומן הטכני
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell dir="ltr" className="text-end">
                  {entry.performed_at}
                </TableCell>
                <TableCell>{entry.drones?.nickname ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{KIND_LABELS[entry.kind]}</Badge>
                </TableCell>
                <TableCell className="max-w-[320px] truncate">{entry.description}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {entry.cost ? `₪${entry.cost}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
