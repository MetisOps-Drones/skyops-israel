"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, PackageCheck, PackageOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useMyOrgContext } from "@/hooks/useOrgContext";
import {
  useOrgDrones,
  useOrgActiveHandoffs,
  useMyHandoffs,
  useCheckOutDrone,
  useCheckInDrone,
} from "@/hooks/useEquipmentHandoffs";
import { createClient } from "@/lib/supabase/client";

const CONDITION_LABELS: Record<string, string> = {
  good: "תקין",
  minor_issue: "תקלה קלה",
  damaged: "פגום",
};

type ConditionForm = { condition: "good" | "minor_issue" | "damaged"; notes: string };

function CheckOutDialog({ droneId, droneName }: { droneId: string; droneName: string }) {
  const [open, setOpen] = useState(false);
  const checkOut = useCheckOutDrone();
  const { control, register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ConditionForm>({
    defaultValues: { condition: "good", notes: "" },
  });

  async function onSubmit(values: ConditionForm) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("יש להתחבר מחדש");
      return;
    }
    try {
      await checkOut.mutateAsync({
        drone_id: droneId,
        user_id: user.id,
        checked_out_condition: values.condition,
        checked_out_notes: values.notes || undefined,
      });
      toast.success(`${droneName} נלקח בהצלחה`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "לקיחת הציוד נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackageOpen className="h-3.5 w-3.5" />
          קח ציוד
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>לקיחת {droneName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>מצב הציוד עם הלקיחה</Label>
            <Controller
              name="condition"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONDITION_LABELS).map(([value, label]) => (
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
            <Label htmlFor="notes">הערות (אופציונלי)</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              אשר לקיחה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckInDialog({ handoffId, droneName }: { handoffId: string; droneName: string }) {
  const [open, setOpen] = useState(false);
  const checkIn = useCheckInDrone();
  const { control, register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm<ConditionForm>({
    defaultValues: { condition: "good", notes: "" },
  });
  const condition = watch("condition");

  async function onSubmit(values: ConditionForm) {
    if (values.condition === "damaged" && !values.notes.trim()) {
      toast.error("יש לתאר את הנזק כשמחזירים ציוד פגום");
      return;
    }
    try {
      await checkIn.mutateAsync({
        id: handoffId,
        checked_in_condition: values.condition,
        checked_in_notes: values.notes || undefined,
      });
      toast.success(`${droneName} הוחזר`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "החזרת הציוד נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PackageCheck className="h-3.5 w-3.5" />
          החזר ציוד
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>החזרת {droneName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>מצב הציוד בהחזרה</Label>
            <Controller
              name="condition"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONDITION_LABELS).map(([value, label]) => (
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
            <Label htmlFor="notes">
              {condition === "damaged" ? "תיאור הנזק (חובה)" : "הערות (אופציונלי)"}
            </Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          {condition === "damaged" && (
            <p className="text-xs text-muted-foreground">
              הדיווח ייכנס אוטומטית ליומן הטכני של כלי הטיס.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              אשר החזרה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EquipmentCheckoutPanel() {
  const { data: ctx } = useMyOrgContext();
  const orgId = ctx?.orgId ?? null;
  const { data: drones = [], isLoading: dronesLoading } = useOrgDrones(orgId);
  const { data: activeHandoffs = [] } = useOrgActiveHandoffs(orgId);
  const { data: myHandoffs = [], isLoading: mineLoading } = useMyHandoffs();

  const takenDroneIds = new Set(activeHandoffs.map((h) => h.drone_id));
  const myActive = myHandoffs.filter((h) => h.status === "checked_out");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>ההשאלות שלי</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>כלי טיס</TableHead>
                <TableHead>נלקח</TableHead>
                <TableHead>מצב בלקיחה</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mineLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    טוען...
                  </TableCell>
                </TableRow>
              )}
              {!mineLoading && myActive.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    אין ברשותך ציוד כרגע
                  </TableCell>
                </TableRow>
              )}
              {myActive.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.drones?.nickname ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-end">
                    {new Date(h.checked_out_at).toLocaleString("he-IL")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{CONDITION_LABELS[h.checked_out_condition]}</Badge>
                  </TableCell>
                  <TableCell>
                    <CheckInDialog handoffId={h.id} droneName={h.drones?.nickname ?? "כלי הטיס"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ציוד הארגון{ctx?.orgName ? ` — ${ctx.orgName}` : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>כלי טיס</TableHead>
                <TableHead>דגם</TableHead>
                <TableHead>זמינות</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dronesLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    טוען...
                  </TableCell>
                </TableRow>
              )}
              {!dronesLoading && drones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    אין כלי טיס רשומים בארגון
                  </TableCell>
                </TableRow>
              )}
              {drones.map((drone) => {
                const taken = takenDroneIds.has(drone.id);
                return (
                  <TableRow key={drone.id}>
                    <TableCell>{drone.nickname}</TableCell>
                    <TableCell>
                      {drone.manufacturer} {drone.model}
                    </TableCell>
                    <TableCell>
                      <Badge variant={taken ? "secondary" : "success"}>{taken ? "בשימוש" : "פנוי"}</Badge>
                    </TableCell>
                    <TableCell>
                      {!taken && drone.status === "operational" && (
                        <CheckOutDialog droneId={drone.id} droneName={drone.nickname} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
