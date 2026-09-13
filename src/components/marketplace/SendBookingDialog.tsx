"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCreateBooking } from "@/hooks/useMarketplace";

/** The primary "hire this pilot" action: an org proposes a specific job + time window. If the pilot approves, a chat opens (0060/0061); the window is only actually locked once the deal is confirmed there. */
export function SendBookingDialog({ pilotId, orgId, name }: { pilotId: string; orgId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const createBooking = useCreateBooking();

  async function handleSend() {
    if (!title.trim() || !description.trim() || !startTime || !endTime) {
      toast.error("יש למלא את כל השדות");
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    try {
      await createBooking.mutateAsync({
        org_id: orgId,
        pilot_id: pilotId,
        title: title.trim(),
        description: description.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      });
      toast.success("ההזמנה נשלחה למטיס/ה");
      setOpen(false);
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
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
            אם המטיס/ה יאשר/תאשר, ייפתח צ׳אט לתיאום פרטים וסגירת המחיר. השעות ננעלות בלוח הזמנים שלו/ה רק לאחר
            שהעסקה תאושר סופית בצ׳אט.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-title">שם העבודה</Label>
            <Input id="booking-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: צילום אווירי לאתר בנייה" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-description">פירוט העבודה</Label>
            <Textarea
              id="booking-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="מיקום, דרישות ציוד, מטרת הטיסה וכל פרט רלוונטי"
            />
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
