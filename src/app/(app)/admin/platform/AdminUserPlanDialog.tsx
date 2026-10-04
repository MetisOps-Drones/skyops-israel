"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminSetUserPlan, useAdminSetQuotaOverride, type AdminUserRow, type AdminQuotaOverrideRow } from "@/hooks/useAdminPlatform";
import { PRIVATE_PLANS, BUSINESS_PLANS, ORG_PLANS, findPlan } from "@/lib/constants/plans";
import type { CoordinationPeriod } from "@/lib/coordination-quota";

const NO_PLAN = "__none__";

export function AdminUserPlanDialog({ user, override }: { user: AdminUserRow; override: AdminQuotaOverrideRow | undefined }) {
  const [open, setOpen] = useState(false);
  const [planCode, setPlanCode] = useState(user.plan_code ?? NO_PLAN);
  const [overrideOn, setOverrideOn] = useState(Boolean(override));
  const [count, setCount] = useState(String(override?.override_count ?? 5));
  const [period, setPeriod] = useState<CoordinationPeriod>((override?.override_period as CoordinationPeriod) ?? "week");
  const [complexAllowed, setComplexAllowed] = useState(String(override?.override_complex_allowed ?? 0));
  const [note, setNote] = useState(override?.note ?? "");
  const [busy, setBusy] = useState(false);

  const setPlan = useAdminSetUserPlan();
  const setOverride = useAdminSetQuotaOverride();

  function resetToCurrent() {
    setPlanCode(user.plan_code ?? NO_PLAN);
    setOverrideOn(Boolean(override));
    setCount(String(override?.override_count ?? 5));
    setPeriod((override?.override_period as CoordinationPeriod) ?? "week");
    setComplexAllowed(String(override?.override_complex_allowed ?? 0));
    setNote(override?.note ?? "");
  }

  async function handleSave() {
    const parsedCount = Number(count);
    if (overrideOn && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      toast.error("מכסה מותאמת חייבת להיות מספר חיובי");
      return;
    }
    const parsedComplex = Number(complexAllowed);
    setBusy(true);
    try {
      if (planCode !== (user.plan_code ?? NO_PLAN)) {
        await setPlan.mutateAsync({ user_id: user.id, plan_code: planCode === NO_PLAN ? null : planCode });
      }
      if (overrideOn) {
        await setOverride.mutateAsync({
          user_id: user.id,
          override: { count: parsedCount, period, complexAllowed: Number.isFinite(parsedComplex) ? parsedComplex : 0, note },
        });
      } else if (override) {
        await setOverride.mutateAsync({ user_id: user.id, override: null });
      }
      toast.success("העדכון נשמר");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetToCurrent();
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-7 w-7" title="עריכת מנוי ומכסה">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>מנוי ומכסה — {user.full_name}</DialogTitle>
          <DialogDescription>שינוי סוג המנוי ותיאום מכסה אישית. אין חיבור לספק סליקה — זהו עדכון ישיר, לא עסקה בפועל.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>סוג מנוי</Label>
            <Select value={planCode} onValueChange={setPlanCode}>
              <SelectTrigger>
                <SelectValue placeholder="ללא מנוי" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>ללא מנוי</SelectItem>
                <SelectGroup>
                  <SelectLabel>לקוח פרטי</SelectLabel>
                  {PRIVATE_PLANS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>לקוח פרטי עסקי</SelectLabel>
                  {BUSINESS_PLANS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>ארגון</SelectLabel>
                  {ORG_PLANS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {planCode !== NO_PLAN && (
              <p className="text-xs text-muted-foreground">מכסת ברירת המחדל בתוכנית זו: {planDefaultLabel(planCode)}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="override-toggle">מכסה מותאמת (שותף עיצוב)</Label>
                <p className="text-xs text-muted-foreground">עוקפת את מכסת התוכנית — למשל גישה חינמית עם מכסה נדיבה יותר לפני מעבר לתשלום.</p>
              </div>
              <Switch id="override-toggle" checked={overrideOn} onCheckedChange={setOverrideOn} />
            </div>

            {overrideOn && (
              <div className="flex flex-col gap-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="override-count">כמות תיאומים</Label>
                    <Input id="override-count" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>תקופה</Label>
                    <Select value={period} onValueChange={(v) => setPeriod(v as CoordinationPeriod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">בשבוע</SelectItem>
                        <SelectItem value="month">בחודש</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="override-complex">מתוכם — תיאומי בועת NOTAM</Label>
                  <Input
                    id="override-complex"
                    type="number"
                    min={0}
                    value={complexAllowed}
                    onChange={(e) => setComplexAllowed(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="override-note">הערה פנימית (למנהלים בלבד — לא תוצג למשתמש)</Label>
                  <Textarea
                    id="override-note"
                    rows={2}
                    placeholder="לדוגמה: שותף עיצוב מהשקה, לעבור לתשלום בעוד חודש"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function planDefaultLabel(code: string): string {
  const plan = findPlan(code);
  if (!plan?.coordinationLimit) return "ללא הגבלה";
  const { count, period, complexAllowed } = plan.coordinationLimit;
  const periodLabel = period === "week" ? "בשבוע" : "בחודש";
  return complexAllowed > 0 ? `${count} ${periodLabel} (מתוכם ${complexAllowed} בועת NOTAM)` : `${count} ${periodLabel}`;
}
