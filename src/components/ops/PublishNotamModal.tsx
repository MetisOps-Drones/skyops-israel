"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePublishNotam } from "@/hooks/useFlightRequests";
import { publishNotamSchema } from "@/lib/validations/flight-request";

export function PublishNotamModal({
  flightRequestId,
  open,
  onOpenChange,
  onPublished,
}: {
  flightRequestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: () => void;
}) {
  const [notamCode, setNotamCode] = useState("");
  const [atcPhone, setAtcPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const publishNotam = usePublishNotam();

  async function handlePublish() {
    setError(null);
    const parsed = publishNotamSchema.safeParse({
      flight_request_id: flightRequestId,
      notam_code: notamCode,
      atc_emergency_phone: atcPhone,
      dispatcher_notes: notes || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "קלט לא תקין");
      return;
    }

    const result = await publishNotam.mutateAsync(parsed.data);
    if (!result.success) {
      setError(result.error ?? "פרסום ה-NOTAM נכשל");
      return;
    }

    toast.success("ה-NOTAM פורסם והמטיס קיבל התראה");
    onPublished();
    onOpenChange(false);
    setNotamCode("");
    setAtcPhone("");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>פרסום NOTAM</DialogTitle>
          <DialogDescription>
            הזנת פרטי ה-NOTAM תשלח התראה מיידית (ובהודעת SMS, אם מוגדר ספק) למטיס.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notamCode">קוד NOTAM</Label>
            <Input
              id="notamCode"
              value={notamCode}
              onChange={(e) => setNotamCode(e.target.value)}
              placeholder="LL W1234/26"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="atcPhone">טלפון חירום ישיר לבקרה (ATC)</Label>
            <Input
              id="atcPhone"
              value={atcPhone}
              onChange={(e) => setAtcPhone(e.target.value)}
              placeholder="03-9711000"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">הערות מוקדן (אופציונלי)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handlePublish} disabled={publishNotam.isPending}>
            {publishNotam.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            פרסם NOTAM ושלח למטיס
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
