"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDrones } from "@/hooks/useDrones";
import { useQueryClient } from "@tanstack/react-query";
import { updateFlightRequest } from "@/actions/flight-requests";
import { flightRequestEditEligibility, FLIGHT_REQUEST_EDIT_WINDOW_MINUTES } from "@/lib/validations/flight-request-edit-window";
import { ALTITUDE_BAND_METERS, type FlightAltitudeBand } from "@/lib/validations/flight-request";
import { FLIGHT_PURPOSE_OPTIONS } from "@/lib/constants/flight-purpose";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import type { FlightPurpose } from "@/lib/types/database.types";

const ALTITUDE_OPTIONS: { value: FlightAltitudeBand; label: string }[] = [
  { value: "under_50m", label: "עד 50 מטר" },
  { value: "under_100m", label: "עד 100 מטר" },
  { value: "over_100m", label: "מעל 100 מטר" },
];

function bandForAltitude(m: number): FlightAltitudeBand {
  if (m <= 50) return "under_50m";
  if (m <= 100) return "under_100m";
  return "over_100m";
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Only offered for basic_auto_100m (circle) requests — a manual_notam_bubble
 * (polygon) edit would need the full map-drawing UI, out of scope for this
 * quick-fix dialog. The center point itself is never editable here either:
 * moving the whole location is close enough to "a different request" that
 * cancel-and-resubmit is the more honest path for that case.
 */
export function EditFlightRequestDialog({ request }: { request: FlightRequestWithRelations }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { data: drones = [] } = useDrones();
  const queryClient = useQueryClient();

  const [droneId, setDroneId] = useState(request.drone_id ?? "");
  const [altitudeBand, setAltitudeBand] = useState<FlightAltitudeBand>(bandForAltitude(request.max_altitude_meters));
  const [flightPurpose, setFlightPurpose] = useState<FlightPurpose>(request.flight_purpose);
  const [radiusMeters, setRadiusMeters] = useState(request.radius_meters ?? 100);
  const [startTime, setStartTime] = useState(toDatetimeLocal(request.start_time));
  const [endTime, setEndTime] = useState(toDatetimeLocal(request.end_time));
  const [emergencyPhone, setEmergencyPhone] = useState(request.emergency_contact_phone ?? "");
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function tick() {
      const eligibility = flightRequestEditEligibility(request);
      setMinutesLeft(eligibility.editable ? (eligibility.minutesRemaining ?? 0) : 0);
      if (!eligibility.editable) {
        toast.error(
          eligibility.reason === "viewed_by_dispatcher"
            ? "מוקדן כבר פתח את הבקשה — לא ניתן לערוך אותה יותר"
            : "חלון העריכה חלף"
        );
        setOpen(false);
      }
    }
    tick();
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
  }, [open, request]);

  const centerPoint = request.center_point_geojson as unknown as GeoJSON.Point;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await updateFlightRequest(request.id, {
        drone_id: droneId,
        request_type: "basic_auto_100m",
        center_point: { type: "Point", coordinates: centerPoint.coordinates as [number, number] },
        radius_meters: radiusMeters,
        altitude_band: altitudeBand,
        max_altitude_meters: ALTITUDE_BAND_METERS[altitudeBand],
        flight_purpose: flightPurpose,
        start_time: new Date(startTime),
        end_time: new Date(endTime),
        emergency_contact_phone: emergencyPhone,
      });

      if (!result.success) {
        toast.error(result.error ?? "עדכון הבקשה נכשל");
        return;
      }

      toast.success(
        result.autoCleared ? "הבקשה עודכנה ואושרה אוטומטית" : "הבקשה עודכנה ונשלחה שוב לבדיקת מוקדן"
      );
      queryClient.invalidateQueries({ queryKey: ["flight_requests"] });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="h-3.5 w-3.5" />
          עריכה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת בקשת תיאום</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          ניתן לערוך עד {FLIGHT_REQUEST_EDIT_WINDOW_MINUTES} דקות מההגשה, וכל עוד מוקדן לא פתח את הבקשה.
          {minutesLeft !== null && ` נותרו כ-${minutesLeft} דקות לעריכה.`} המיקום עצמו אינו ניתן לשינוי כאן — לשינוי
          מיקום יש לבטל ולשלוח בקשה חדשה.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>כלי טיס</Label>
            <Select value={droneId} onValueChange={setDroneId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר כלי טיס" />
              </SelectTrigger>
              <SelectContent>
                {drones.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nickname} · {d.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-radius">רדיוס (מטרים)</Label>
            <Input
              id="edit-radius"
              type="number"
              min={10}
              max={5000}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>גובה מרבי</Label>
            <Select value={altitudeBand} onValueChange={(v) => setAltitudeBand(v as FlightAltitudeBand)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALTITUDE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>סוג ההטסה</Label>
            <Select value={flightPurpose} onValueChange={(v) => setFlightPurpose(v as FlightPurpose)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLIGHT_PURPOSE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-start">שעת התחלה</Label>
              <Input id="edit-start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-end">שעת סיום</Label>
              <Input id="edit-end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-phone">טלפון ליצירת קשר בשעת חירום</Label>
            <Input id="edit-phone" type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} dir="ltr" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            שמירת שינויים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
