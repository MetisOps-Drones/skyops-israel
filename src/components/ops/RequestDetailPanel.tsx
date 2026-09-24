"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import { useRejectFlightRequest, useOverlappingFlightRequests, useCancelNotam } from "@/hooks/useFlightRequests";
import { markFlightRequestViewedByDispatcher } from "@/actions/flight-requests";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";
import { AlertTriangle, ChevronRight, Radio } from "lucide-react";
import { usePilotLicensesForDispatcher } from "@/hooks/useLicenses";
import { formatCoordinatesForSubmission } from "@/lib/geo/spatial";
import { FLIGHT_PURPOSE_LABELS } from "@/lib/constants/flight-purpose";
import { buildStaticBubbleMapUrl } from "@/lib/geo/staticMapUrl";
import * as turf from "@turf/turf";
import { PublishNotamModal } from "./PublishNotamModal";
import { CoordinationPanel } from "./CoordinationPanel";
import { DispatcherChecklist } from "./DispatcherChecklist";
import { DecisionHistory } from "./DecisionHistory";
import { REJECT_REASON_TEMPLATES } from "@/lib/constants/dispatcher-quick-replies";
import { useAipReferenceZones } from "@/hooks/useAipReferenceZones";
import { useLiveNotamZones } from "@/hooks/useLiveNotamZones";
import { checkFlightAuthorizationRequirement } from "@/lib/geo/flight-rules";
import { checkLiveNotamOverlap } from "@/lib/geo/live-notams";
import { AIP_ZONE_KIND_LABELS, AIP_ZONE_KIND_DISPATCHER_REQUIREMENT } from "@/lib/constants/aip-reference-zones";

const LICENSE_STATUS_LABELS: Record<string, string> = {
  active: "בתוקף",
  expiring_soon: "עומד לפוג",
  expired: "פג תוקף",
};

/**
 * Replaces a selected request's detail view IN PLACE within the already-open
 * /ops panel, rather than opening it as another overlay on top. It used to be
 * a Sheet sliding in from the side — since a Sheet is viewport-fixed (not
 * contained by its parent), it visually read as a second, competing
 * full-screen layer instead of feeling like part of the queue underneath it.
 * OpsPageClient renders this INSTEAD of the queue view (map + table) while a
 * request is selected, so it's always contained by the one panel AppShell
 * already opened.
 */
export function RequestDetailPanel({
  request,
  onClose,
}: {
  request: FlightRequestWithRelations | null;
  onClose: () => void;
}) {
  const [notamModalOpen, setNotamModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [cancelFormOpen, setCancelFormOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const rejectMutation = useRejectFlightRequest();
  const cancelMutation = useCancelNotam();
  const { data: licenses = [], isLoading: licensesLoading } = usePilotLicensesForDispatcher(request?.user_id ?? null);
  const { data: overlaps = [], isLoading: overlapsLoading } = useOverlappingFlightRequests(request?.id ?? null);
  const { data: aipZones = [] } = useAipReferenceZones();
  const { data: liveNotams = [] } = useLiveNotamZones();

  // Opening this view is the moment the pilot's 30-minute self-edit window
  // closes (see flightRequestEditEligibility) — fire-and-forget, idempotent
  // server-side (only ever sets the timestamp once), so this doesn't need to
  // block rendering or show its own loading state.
  useEffect(() => {
    if (request?.id) {
      markFlightRequestViewedByDispatcher(request.id).catch(() => {});
    }
  }, [request?.id]);

  const requestPoint = request?.center_point_geojson as unknown as GeoJSON.Point | undefined;
  const requestLng = requestPoint?.coordinates[0] ?? 0;
  const requestLat = requestPoint?.coordinates[1] ?? 0;

  // Same authoritative check the map/server run (flight-rules.ts,
  // live-notams.ts) — re-derived here rather than reading dispatcher_notes,
  // since that field is a flat human-readable string with no per-zone kind
  // to key the requirement text off of.
  const authCheck = useMemo(
    () => checkFlightAuthorizationRequirement([requestLng, requestLat], aipZones),
    [requestLng, requestLat, aipZones]
  );
  const notamCheck = useMemo(
    () => checkLiveNotamOverlap([requestLng, requestLat], liveNotams),
    [requestLng, requestLat, liveNotams]
  );

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

  async function handleCancelNotam() {
    if (!cancelReason.trim()) {
      toast.error("יש לציין סיבת ביטול");
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        flight_request_id: request!.id,
        dispatcher_notes: cancelReason,
      });
      if (!result.success) {
        toast.error(result.error ?? "ביטול ה-NOTAM נכשל");
        return;
      }
      toast.success("ה-NOTAM בוטל והמטיס קיבל התראה");
      setCancelFormOpen(false);
      setCancelReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ביטול ה-NOTAM נכשל");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="חזרה לתור"
          title="חזרה לתור"
          className="rounded-md p-2 text-muted-foreground transition-[background-color,color,transform] duration-150 hover:scale-110 hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div>
          <p className="text-sm font-semibold">בקשת תיאום #{request.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{request.profiles?.full_name ?? "—"}</p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
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

        <DispatcherChecklist
          request={request}
          overlaps={overlaps}
          overlapsLoading={overlapsLoading}
          authCheck={authCheck}
          notamCheck={notamCheck}
        />

        {(notamCheck.inside || authCheck.reasons.length > 0) && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <Radio className="h-4 w-4 shrink-0" />
              מרחב אווירי בנקודה — לבדוק לפני אישור
            </div>
            {notamCheck.inside && (
              <div className="rounded-md border bg-background p-2 text-xs">
                <p className="font-medium">נוטאם פעיל חופף לנקודה</p>
                {notamCheck.notams.map((n) => (
                  <p key={n.id} className="mt-0.5 text-muted-foreground">
                    {n.id}: {n.eText}
                  </p>
                ))}
              </div>
            )}
            {authCheck.reasons.map((reason, i) => (
              <div key={i} className="rounded-md border bg-background p-2 text-xs">
                <p className="font-medium">
                  {reason.label}
                  {reason.zone && ` — ${AIP_ZONE_KIND_LABELS[reason.zone.kind]}`}
                </p>
                {reason.zone && (
                  <p className="mt-1 text-muted-foreground">{AIP_ZONE_KIND_DISPATCHER_REQUIREMENT[reason.zone.kind]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <CoordinationPanel request={request} lng={lng} lat={lat} dmsCoordinates={dmsCoordinates} />

        {overlapsLoading ? (
          <p className="text-xs text-muted-foreground">בודק חפיפות עם בקשות אחרות...</p>
        ) : (
          overlaps.length > 0 && (
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
          )
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

        <DecisionHistory requestId={request.id} />

        {request.status !== "notam_published" && request.status !== "rejected" && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <Button onClick={() => setNotamModalOpen(true)}>פרסום NOTAM</Button>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASON_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setRejectReason(template)}
                    className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    {template}
                  </button>
                ))}
              </div>
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

        {request.notam_code && request.status === "notam_published" && (
          <>
            <div className="rounded-lg bg-success/10 p-3 text-sm">
              <span className="font-semibold">NOTAM פורסם:</span> {request.notam_code}
            </div>
            {cancelFormOpen ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-semibold text-destructive">ביטול NOTAM</p>
                <p className="text-xs text-muted-foreground">
                  המטיס יקבל התראה מיידית שה-NOTAM בוטל. פעולה זו אינה הפיכה — לאישור מחדש יש לתאם NOTAM חדש.
                </p>
                <textarea
                  className="w-full rounded-md border border-input p-2 text-sm"
                  placeholder="סיבת ביטול..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleCancelNotam}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? "מבטל..." : "אישור ביטול NOTAM"}
                  </Button>
                  <Button variant="outline" onClick={() => setCancelFormOpen(false)}>
                    ביטול
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="self-start text-destructive hover:text-destructive" onClick={() => setCancelFormOpen(true)}>
                ביטול NOTAM
              </Button>
            )}
          </>
        )}

        {request.notam_code && request.status === "cancelled" && (
          <div className="rounded-lg bg-warning/10 p-3 text-sm">
            <span className="font-semibold">NOTAM בוטל:</span> {request.notam_code} — הבקשה אינה בתוקף עוד
          </div>
        )}
      </div>

      <PublishNotamModal
        flightRequestId={request.id}
        open={notamModalOpen}
        onOpenChange={setNotamModalOpen}
        onPublished={onClose}
      />
    </div>
  );
}
