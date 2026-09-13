"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, Minus, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useInventory, useCreateInventoryItem, useAdjustInventoryQuantity } from "@/hooks/useEquipment";
import { createClient } from "@/lib/supabase/client";
import { inventoryItemSchema, type InventoryItemInput } from "@/lib/validations/equipment";

const CATEGORY_LABELS: Record<string, string> = {
  propeller: "להבים",
  battery: "סוללות",
  charger: "מטענים",
  gimbal: "גימבל",
  other: "אחר",
};

function AddInventoryItemDialog() {
  const [open, setOpen] = useState(false);
  const createItem = useCreateInventoryItem();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { category: "other", quantity_on_hand: 0, low_stock_threshold: 1 },
  });

  async function onSubmit(values: InventoryItemInput) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("יש להתחבר מחדש");
      return;
    }
    try {
      await createItem.mutateAsync({ ...values, user_id: user.id });
      toast.success("הפריט נוסף למלאי");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הוספת הפריט נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          פריט חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>פריט מלאי חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">שם הפריט</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>קטגוריה</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity_on_hand">כמות במלאי</Label>
              <Input
                id="quantity_on_hand"
                type="number"
                dir="ltr"
                {...register("quantity_on_hand", { valueAsNumber: true })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="low_stock_threshold">סף התראה</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                dir="ltr"
                {...register("low_stock_threshold", { valueAsNumber: true })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              הוסף לפריט
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryPanel() {
  const { data: items = [], isLoading } = useInventory();
  const adjustQuantity = useAdjustInventoryQuantity();

  async function adjust(id: string, current: number, delta: number) {
    const next = Math.max(0, current + delta);
    try {
      await adjustQuantity.mutateAsync({ id, quantity_on_hand: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "עדכון הכמות נכשל");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>מלאי חלפים ואביזרים</CardTitle>
        <AddInventoryItemDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>פריט</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>כמות</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  טרם נוספו פריטי מלאי
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => {
              const low = item.quantity_on_hand <= item.low_stock_threshold;
              return (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                  <TableCell>
                    <Badge variant={low ? "destructive" : "outline"}>
                      {low && <PackageX className="me-1 h-3 w-3" />}
                      {item.quantity_on_hand}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => adjust(item.id, item.quantity_on_hand, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => adjust(item.id, item.quantity_on_hand, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
