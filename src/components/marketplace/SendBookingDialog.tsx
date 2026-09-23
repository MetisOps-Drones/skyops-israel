"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCreateBooking } from "@/hooks/useMarketplace";
import { SERVICE_AREAS, DRONE_MODELS } from "@/lib/constants/pilot-skills";
import { BOOKING_OPERATION_TYPE_OPTIONS, BOOKING_PURPOSE_OPTIONS } from "@/lib/constants/booking-job-details";

const ANY_DRONE = "__any__";

/** The primary "hire this pilot" action: an org proposes a specific job + time window. If the pilot approves, a chat opens (0060/0061); the window is only actually locked once the deal is confirmed there. Fields are mostly quick selects rather than free text (0065) — the org fills this out fast, and the pilot can see the job's basics before ever opening the chat. */
export function SendBookingDialog({ pilotId, orgId, name }: { pilotId: string; orgId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [operationType, setOperationType] = useState("");
  const [droneType, setDroneType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const createBooking = useCreateBooking();
  const router = useRouter();

  function reset() {
    setTitle("");
    setDescription("");
    setLocation("");
    setBudget("");
    setOperationType("");
    setDroneType("");
    setPurpose("");
    setStartTime("");
    setEndTime("");
  }

  async function handleSend() {
    if (!title.trim() || !location || !operationType || !droneType || !purpose || !startTime || !endTime) {
      toast.error("יש למלא את כל השדות המסומנים");
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    const budgetValue = budget.trim() ? Number(budget) : null;
    if (budgetValue !== null && (Number.isNaN(budgetValue) || budgetValue < 0)) {
      toast.error("תקציב לא תקין");
      return;
    }
    try {
      const booking = await createBooking.mutateAsync({
        org_id: orgId,
        pilot_id: pilotId,
        title: title.trim(),
        description: description.trim(),
        location,
        budget_ils: budgetValue,
        operation_type: operationType,
        drone_type: droneType === ANY_DRONE ? null : droneType,
        purpose,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      });
      toast.success("ההזמנה נשלחה למטיס/ה");
      setOpen(false);
      reset();
      // Otherwise there was nowhere to actually track the booking's status
      // afterward — /marketplace/bookings isn't reachable from any bubble.
      router.push(`/marketplace/bookings/${booking.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת ההזמנה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        שליחת הזמנת עבודה
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הזמנת עבודה עבור {name}</DialogTitle>
          <DialogDescription>
            אם המטיס/ה יאשר/תאשר, ייפתח צ׳אט לתיאום פרטים וסגירת המחיר הסופי. השעות ננעלות בלוח הזמנים שלו/ה רק
            לאחר שהעסקה תאושר סופית בצ׳אט. הפרטים כאן הם הצעה ראשונית — ניתן לדייק אותם בהמשך בצ׳אט.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-title">שם העבודה</Label>
            <Input id="booking-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: צילום אווירי לאתר בנייה" />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-location">מיקום</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger id="booking-location">
                  <SelectValue placeholder="בחירת אזור" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-budget">תקציב מוצע (₪, אופציונלי)</Label>
              <Input
                id="booking-budget"
                type="number"
                min="0"
                dir="ltr"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="לדוגמה: 1500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-operation-type">סוג ההפעלה</Label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger id="booking-operation-type">
                  <SelectValue placeholder="בחירה" />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_OPERATION_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-drone-type">סוג הכטב״ם</Label>
              <Select value={droneType} onValueChange={setDroneType}>
                <SelectTrigger id="booking-drone-type">
                  <SelectValue placeholder="בחירה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_DRONE}>לא משנה / לפי הפרילנסר</SelectItem>
                  {DRONE_MODELS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-purpose">מטרת ההפעלה</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger id="booking-purpose">
                <SelectValue placeholder="בחירה" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_PURPOSE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-start">התחלה</Label>
              <Input id="booking-start" type="datetime-local" dir="ltr" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-end">סיום</Label>
              <Input id="booking-end" type="datetime-local" dir="ltr" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-description">פרטים נוספים (אופציונלי)</Label>
            <Textarea
              id="booking-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="דרישות ציוד מיוחדות, נקודת מפגש מדויקת וכל פרט נוסף"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button onClick={handleSend} disabled={createBooking.isPending}>
            {createBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            שליחת הזמנה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
