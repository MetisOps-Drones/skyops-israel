"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import { useRejectFlightRequest, useOverlappingFlightRequests } from "@/hooks/useFlightRequests";
import { markFlightRequestViewedByDispatcher } from "@/actions/flight-requests";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";
import { AlertTriangle } from "lucide-react";
import { usePilotLicensesForDispatcher } from "@/hooks/useLicenses";
import { formatCoordinatesForSubmission } from "@/lib/geo/spatial";
import { FLIGHT_PURPOSE_LABELS } from "@/lib/constants/flight-purpose";
import { buildStaticBubbleMapUrl } from "@/lib/geo/staticMapUrl";
import * as turf from "@turf/turf";
import { PublishNotamModal } from "./PublishNotamModal";
import { CoordinationPanel } from "./CoordinationPanel";

const LICENSE_STATUS_LABELS: Record<string, string> = {
  active: "בתוקף",
  expiring_soon: "עומד לפוג",
  expired: "פג תוקף",
};

export function RequestDetailDrawer({
  request,
  onClose,
}: {
  request: FlightRequestWithRelations | null;
  onClose: () => void;
}) {
  const [notamModalOpen, setNotamModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const rejectMutation = useRejectFlightRequest();
  const { data: licenses = [], isLoading: licensesLoading } = usePilotLicensesForDispatcher(request?.user_id ?? null);
  const { data: overlaps = [], isLoading: overlapsLoading } = useOverlappingFlightRequests(request?.id ?? null);

  // Opening this drawer is the moment the pilot's 30-minute self-edit
  // window closes (see flightRequestEditEligibility) — fire-and-forget,
  // idempotent server-side (only ever sets the timestamp once), so this
  // doesn't need to block the drawer opening or show its own loading state.
  useEffect(() => {
    if (request?.id) {
      markFlightRequestViewedByDispatcher(request.id).catch(() => {});
    }
  }, [request?.id]);

  if (!request) return null;

  const centerPoint = request.center_point_geojson as unknown as GeoJSON.Point;
  const lng = centerPoint.coordinates[0] ?? 0;
  const lat = centerPoint.coordinates[1] ?? 0;
  const dmsCoordinates = formatCoordinatesForSubmission(lng, lat);

  const polygonGeojson = request.polygon_geojson as unknown as GeoJSON.MultiPolygon | null;
  const footprint =
    request.request_type === "manual_notam_bubble" && polygonGeojson
      ? turf.multiPolygon(polygonGeojson.coordinates)
      : turf.circle([lng, lat], (request.radius_meters ?? 100) / 1000, { units: "kilometers" });

  const staticMapUrl = buildStaticBubbleMapUrl({ center: [lng, lat], geojsonOverlay: footprint });

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("יש לציין סיבת דחייה");
      return;
    }
    setRejecting(true);
    try {
      const result = await rejectMutation.mutateAsync({
        flight_request_id: request!.id,
        dispatcher_notes: rejectReason,
      });
      if (!result.success) {
        toast.error(result.error ?? "דחיית הבקשה נכשלה");
        return;
      }
      toast.success("הבקשה נדחתה והמטיס קיבל התראה");
      onClose();
    } finally {
      setRejecting(false);
    }
  }

  return (
    <Sheet open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>בקשת תיאום #{request.id.slice(0, 8)}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-5">
          {process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
            <Image
              src={staticMapUrl}
              alt="מפת בועת הטיסה"
              width={600}
              height={320}
              className="w-full rounded-lg border object-cover"
              unoptimized
            />
          )}

          <div>
            <p className="text-sm font-semibold">קואורדינטות להגשה (CAAI/IAF)</p>
            <p className="font-mono text-sm" dir="ltr">
              {dmsCoordinates}
            </p>
          </div>

          <CoordinationPanel request={request} lng={lng} lat={lat} dmsCoordinates={dmsCoordinates} />

          {overlapsLoading ? (
            <p className="text-xs text-muted-foreground">בודק חפיפות עם בקשות אחרות...</p>
          ) : overlaps.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                חופפת עם {overlaps.length} {overlaps.length === 1 ? "בקשה אחרת" : "בקשות אחרות"} בשטח ובזמן
              </div>
              <div className="flex flex-col gap-1.5">
                {overlaps.map((o) => (
                  <div key={o.id} className="rounded-md border bg-background p-2 text-xs">
                    <p className="font-medium">
                      {o.full_name}
                      {o.org_name ? ` · ${o.org_name}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {FLIGHT_REQUEST_STATUS_LABELS[o.status]} ·{" "}
                      {new Date(o.start_time).toLocaleString("he-IL")} – {new Date(o.end_time).toLocaleString("he-IL")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <p className="mb-2 text-sm font-semibold">פרטי מטיס</p>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-muted-foreground">שם</span>
              <span>{request.profiles?.full_name ?? "—"}</span>
              <span className="text-muted-foreground">טלפון</span>
              <span dir="ltr">{request.profiles?.phone ?? "—"}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {licenses.map((license) => (
                <Badge
                  key={license.id}
                  variant={
                    license.status === "expired" ? "destructive" : license.status === "expiring_soon" ? "warning" : "success"
                  }
                >
                  {license.license_type}: {LICENSE_STATUS_LABELS[license.status]}
                </Badge>
              ))}
              {licensesLoading ? (
                <span className="text-xs text-muted-foreground">בודק רישיונות...</span>
              ) : (
                licenses.length === 0 && <span className="text-xs text-muted-foreground">אין רישיונות רשומים</span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-sm font-semibold">פרטי כלי טיס</p>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-muted-foreground">כינוי</span>
              <span>{request.drones?.nickname ?? "—"}</span>
              <span className="text-muted-foreground">דגם</span>
              <span>{request.drones?.model ?? "—"}</span>
              <span className="text-muted-foreground">מספר רישום</span>
              <span dir="ltr">{request.drones?.registration_number ?? "—"}</span>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-sm font-semibold">פרטי טיסה</p>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-muted-foreground">סוג הטסה</span>
              <span>{FLIGHT_PURPOSE_LABELS[request.flight_purpose]}</span>
              <span className="text-muted-foreground">גובה מרבי</span>
              <span>{request.max_altitude_meters} מ׳</span>
              {request.radius_meters && (
                <>
                  <span className="text-muted-foreground">רדיוס</span>
                  <span>{request.radius_meters} מ׳</span>
                </>
              )}
              <span className="text-muted-foreground">התחלה</span>
              <span>{new Date(request.start_time).toLocaleString("he-IL")}</span>
              <span className="text-muted-foreground">סיום</span>
              <span>{new Date(request.end_time).toLocaleString("he-IL")}</span>
              <span className="text-muted-foreground">טלפון חירום</span>
              <span dir="ltr">{request.emergency_contact_phone}</span>
            </div>
          </div>

          {request.status !== "notam_published" && request.status !== "rejected" && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <Button onClick={() => setNotamModalOpen(true)}>פרסום NOTAM</Button>
                <textarea
                  className="w-full rounded-md border border-input p-2 text-sm"
                  placeholder="סיבת דחייה..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                />
                <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
                  {rejecting ? "דוחה..." : "דחיית בקשה"}
                </Button>
              </div>
            </>
          )}

          {request.notam_code && (
            <div className="rounded-lg bg-success/10 p-3 text-sm">
              <span className="font-semibold">NOTAM פורסם:</span> {request.notam_code}
            </div>
          )}
        </div>
      </SheetContent>

      <PublishNotamModal
        flightRequestId={request.id}
        open={notamModalOpen}
        onOpenChange={setNotamModalOpen}
        onPublished={onClose}
      />
    </Sheet>
  );
}
