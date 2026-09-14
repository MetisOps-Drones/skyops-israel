"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyPilotPricing, useUpdatePilotPricing, type EquipmentRate } from "@/hooks/usePilotPricing";

/**
 * Deliberately not part of PilotMarketplaceProfileCard: this data is never
 * shown on the public marketplace (see 0059) — it's a separate visual block
 * so it's obvious to the pilot that this section is private, negotiated
 * in-chat once a booking is open, not something an org browsing sees.
 */
export function PilotPricingCard() {
  const { data: existing, isLoading } = useMyPilotPricing();
  const update = useUpdatePilotPricing();
  const [hourly, setHourly] = useState("");
  const [daily, setDaily] = useState("");
  const [equipment, setEquipment] = useState<EquipmentRate[]>([]);

  useEffect(() => {
    if (existing) {
      setHourly(existing.hourly_rate_ils?.toString() ?? "");
      setDaily(existing.daily_rate_ils?.toString() ?? "");
      setEquipment(existing.equipment_rates ?? []);
    }
  }, [existing]);

  function addEquipmentRow() {
    setEquipment((e) => [...e, { name: "", price_ils: 0 }]);
  }

  function updateEquipmentRow(index: number, patch: Partial<EquipmentRate>) {
    setEquipment((e) => e.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeEquipmentRow(index: number) {
    setEquipment((e) => e.filter((_, i) => i !== index));
  }

  async function handleSave() {
    try {
      await update.mutateAsync({
        hourly_rate_ils: hourly ? Number(hourly) : null,
        daily_rate_ils: daily ? Number(daily) : null,
        equipment_rates: equipment.filter((r) => r.name.trim().length > 0),
      });
      toast.success("המחירון נשמר");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </span>
          מחירון
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          המחירים לא מוצגים במרקטפלייס ולא נחשפים לארגונים — משמשים רק אתכם כבסיס למו״מ בצ׳אט אחרי שהזמנת עבודה
          אושרה.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hourly">מחיר שעתי (₪)</Label>
            <Input id="hourly" type="number" min={0} dir="ltr" value={hourly} onChange={(e) => setHourly(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="daily">מחיר יומי (₪)</Label>
            <Input id="daily" type="number" min={0} dir="ltr" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>ציוד נוסף בתשלום</Label>
            <Button type="button" variant="outline" size="sm" onClick={addEquipmentRow}>
              <Plus className="h-3.5 w-3.5" />
              הוספת פריט
            </Button>
          </div>
          {equipment.length === 0 && <p className="text-xs text-muted-foreground">אין עדיין פריטי ציוד נוספים.</p>}
          {equipment.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="לדוגמה: מצלמה תרמית"
                value={row.name}
                onChange={(e) => updateEquipmentRow(i, { name: e.target.value })}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                dir="ltr"
                placeholder="מחיר (₪)"
                value={row.price_ils || ""}
                onChange={(e) => updateEquipmentRow(i, { price_ils: Number(e.target.value) || 0 })}
                className="w-32"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeEquipmentRow(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={update.isPending} className="self-end">
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          שמירת מחירון
        </Button>
      </CardContent>
    </Card>
  );
}
