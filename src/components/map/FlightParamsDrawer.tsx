"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import * as turf from "@turf/turf";
import { Loader2, Radius, Waypoints, ShieldAlert, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMapDrawStore } from "@/stores/useMapDrawStore";
import { useAirspaceCheck } from "@/hooks/useAirspaceCheck";
import { useDrones } from "@/hooks/useDrones";
import { useAipReferenceZones } from "@/hooks/useAipReferenceZones";
import { useProximityCheck } from "@/hooks/useProximityCheck";
import { useBuildingProximity } from "@/hooks/useBuildingProximity";
import {
  checkFlightAuthorizationRequirement,
  PROXIMITY_CATEGORY_REGULATION,
  findingsRequiringAuthorization,
  requiredInfrastructureDistanceM,
} from "@/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint } from "@/lib/geo/aip";
import { InlineAuthorizationPurchase } from "./InlineAuthorizationPurchase";
import { ClearanceBadge } from "./ClearanceBadge";
import { PreFlightChecklist } from "./PreFlightChecklist";
import { WeatherPanel } from "./WeatherPanel";
import { createFlightRequest } from "@/actions/flight-requests";
import { DroneQuickRegisterCard } from "@/components/onboarding/DroneQuickRegisterCard";
import { ALTITUDE_BAND_METERS, type FlightAltitudeBand } from "@/lib/validations/flight-request";
import { FLIGHT_PURPOSE_OPTIONS } from "@/lib/constants/flight-purpose";
import { cn } from "@/lib/utils";
import { useMyGlobalRole, useMyOrgContext } from "@/hooks/useOrgContext";

const ALTITUDE_OPTIONS: { value: FlightAltitudeBand; label: string }[] = [
  { value: "under_50m", label: "עד 50 מטר" },
  { value: "under_100m", label: "עד 100 מטר" },
  { value: "over_100m", label: "מעל 100 מטר (דורש אישור מיוחד)" },
];

/** תקנות הטיס (הפעלת מטיסן), תשפ"ד 2024: תקרת הגובה למטיסן היא 50 מ' קבועים — אין ל"ספורט ופנאי" מסלול חוקי לגובה גבוה יותר, לא רק "מעל 100 מ' דורש אישור" כמו בכטב"ם המסחרי. */
const HOBBY_ALTITUDE_OPTIONS = ALTITUDE_OPTIONS.filter((opt) => opt.value === "under_50m");

export function FlightParamsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const {
    shapeType,
    setShapeType,
    center,
    radiusMeters,
    setRadiusMeters,
    polygon,
    altitudeBand,
    setAltitudeBand,
    flightPurpose,
    setFlightPurpose,
    droneId,
    setDroneId,
    emergencyContactPhone,
    setEmergencyContactPhone,
    reset,
  } = useMapDrawStore();

  const { data: drones = [] } = useDrones();
  const spatialCheck = useAirspaceCheck();
  const { data: role } = useMyGlobalRole();
  const { data: orgContext } = useMyOrgContext();
  const { data: aipZones = [], isLoading: aipZonesLoading } = useAipReferenceZones();
  const isHobby = role === "pilot_hobby";
  const hasOrg = Boolean(orgContext?.orgId);
  const altitudeOptions = isHobby ? HOBBY_ALTITUDE_OPTIONS : ALTITUDE_OPTIONS;

  const checkPoint = useMemo<[number, number] | null>(() => {
    if (shapeType === "circle") return center;
    if (shapeType === "polygon" && polygon) {
      const coords = turf.centroid(polygon).geometry.coordinates;
      return [coords[0] ?? 0, coords[1] ?? 0];
    }
    return null;
  }, [shapeType, center, polygon]);

  const authCheck = useMemo(
    () => (checkPoint ? checkFlightAuthorizationRequirement(checkPoint, aipZones) : null),
    [checkPoint, aipZones]
  );
  const altitudeResult = useMemo(
    () => (checkPoint ? maxLegalAltitudeAtPoint(checkPoint, aipZones) : null),
    [checkPoint, aipZones]
  );
  const proximity = useProximityCheck(checkPoint);
  const proximityFindings = proximity.data?.findings ?? [];
  // Unlike the map's pre-planning inspector (LocationInfoCard), an actual altitude band is
  // already chosen here — the legal minimum distance from infrastructure for a מטיס (commercial)
  // is the flight altitude itself (תקנה 32), so this uses the real selected altitude, not a
  // conservative placeholder.
  const plannedAltitudeM = ALTITUDE_BAND_METERS[altitudeBand];
  const requiredDistanceM = requiredInfrastructureDistanceM(isHobby, plannedAltitudeM);
  const relevantProximityFindings = findingsRequiringAuthorization(proximityFindings, isHobby, plannedAltitudeM);
  // Primary signal, same reasoning as LocationInfoCard: OSM's "residential"
  // distance is to a landuse polygon's centroid, not its nearest edge, and
  // can badly understate real proximity for a city-scale way. The building
  // grid (real footprints) drives תקנה 32 regardless of what OSM found.
  const buildingProximity = useBuildingProximity(checkPoint, requiredDistanceM);
  const isNearBuildingLocally = buildingProximity.data?.isNearBuilding ?? false;

  // Zone-based restriction and "special operation authorization" (the 9
  // numbered regulations) are two different legal mechanisms — see
  // src/lib/geo/flight-rules.ts. Controlled airspace (CTR/ATZ/TMA/CTA) is a
  // strong warning, not a hard block — most `aip_reference_zones` rows now
  // carry real geometry from the official AIP (see useAipReferenceZones.ts),
  // but there's no live NOTAM feed, so the dispatcher still confirms before
  // approving. Prohibited/danger zones require a case-by-case CAAI-director
  // approval — only an organization account may submit here (the dispatcher
  // still has to chase that approval manually); hobby/solo-pro cannot.
  const zoneBlockLevel = authCheck?.blockLevel ?? "none";
  const zoneRequiresDirectorApproval = zoneBlockLevel === "director_approval_only" && hasOrg;
  const zoneHardBlocked = zoneBlockLevel === "director_approval_only" && !hasOrg;
  const matchingRegulations = Array.from(
    new Set([
      ...relevantProximityFindings
        .map((f) => PROXIMITY_CATEGORY_REGULATION[f.category])
        .filter((reg): reg is string => Boolean(reg)),
      ...(isNearBuildingLocally ? ["תקנה 32"] : []),
    ])
  );
  const needsSpecialAuthorization = matchingRegulations.length > 0;
  const blockedForHobby = needsSpecialAuthorization && isHobby;
  // Independent of zone-based blocking — the legal altitude ceiling at this exact point can be 0
  // from the ground even when the zone itself would otherwise allow a coordination request.
  const groundBlockedByAltitude = Boolean(altitudeResult?.blockedFromGround);
  const requiresAttention = zoneBlockLevel !== "none" || needsSpecialAuthorization || groundBlockedByAltitude;
  const blockedForSolo = zoneHardBlocked || blockedForHobby || groundBlockedByAltitude;
  // Same reasoning as LocationInfoCard: requiresAttention is derived from
  // aipZones/proximity/buildingProximity, all async — while any is still
  // loading, don't show (or let a hobby pilot act on) a premature "fine to
  // submit" state.
  const isChecking = aipZonesLoading || proximity.isLoading || buildingProximity.isLoading;
  // Same fast-path as LocationInfoCard: the building-footprint check alone
  // is an O(1) local lookup, so once *it* resolves (even while aipZones/
  // proximity are still loading) show that read immediately instead of the
  // generic spinner.
  const buildingsOnlyReady = !buildingProximity.isLoading;

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Coordination is arbitrarily capped for hobby pilots — if the store still
  // holds a band they're no longer allowed to pick (e.g. left over from a
  // previous session), pull it back down instead of silently submitting a
  // request the server will reject anyway.
  useEffect(() => {
    if (isHobby && altitudeBand !== "under_50m") {
      setAltitudeBand("under_50m");
    }
  }, [isHobby, altitudeBand, setAltitudeBand]);

  const canSubmit =
    !blockedForSolo &&
    !(isChecking && isHobby) &&
    Boolean(droneId) &&
    Boolean(emergencyContactPhone) &&
    Boolean(startTime && endTime) &&
    ((shapeType === "circle" && Boolean(center)) || (shapeType === "polygon" && Boolean(polygon)));

  async function handleSubmit() {
    if (!canSubmit || !center) return;
    setSubmitting(true);
    try {
      const altitudeMeters = ALTITUDE_BAND_METERS[altitudeBand];

      const result = await createFlightRequest({
        drone_id: droneId!,
        request_type: shapeType === "circle" ? "basic_auto_100m" : "manual_notam_bubble",
        center_point: { type: "Point", coordinates: center },
        radius_meters: shapeType === "circle" ? radiusMeters : undefined,
        polygon:
          shapeType === "polygon" && polygon
            ? { type: "Polygon", coordinates: polygon.coordinates as [number, number][][] }
            : undefined,
        altitude_band: altitudeBand,
        flight_purpose: flightPurpose,
        max_altitude_meters: altitudeMeters,
        start_time: new Date(startTime),
        end_time: new Date(endTime),
        emergency_contact_phone: emergencyContactPhone,
      });

      if (!result.success) {
        toast.error(result.error ?? "שליחת הבקשה נכשלה");
        return;
      }

      toast.success(
        result.autoCleared
          ? "אושר אוטומטית! ניתן לטוס לאחר השלמת רשימת הבדיקה."
          : "הבקשה נשלחה לתור המוקדן לתיאום."
      );
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>פרטי בקשת טיסה</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShapeType("circle")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm",
                shapeType === "circle" ? "border-primary bg-primary/5" : "border-input"
              )}
            >
              <Radius className="h-5 w-5" />
              טיסה בסיסית (רדיוס)
            </button>
            <button
              type="button"
              onClick={() => setShapeType("polygon")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm",
                shapeType === "polygon" ? "border-primary bg-primary/5" : "border-input"
              )}
            >
              <Waypoints className="h-5 w-5" />
              בועת NOTAM (פוליגון)
            </button>
          </div>

          {shapeType === "circle" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="radius">רדיוס (מטרים)</Label>
              <Input
                id="radius"
                type="number"
                min={10}
                max={5000}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                dir="ltr"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="altitude">גובה מרבי</Label>
            <Select value={altitudeBand} onValueChange={(v) => setAltitudeBand(v as FlightAltitudeBand)}>
              <SelectTrigger id="altitude">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {altitudeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flightPurpose">סוג ההטסה</Label>
            <Select value={flightPurpose} onValueChange={(v) => setFlightPurpose(v as typeof flightPurpose)}>
              <SelectTrigger id="flightPurpose">
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
              <Label htmlFor="start">שעת התחלה</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end">שעת סיום</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {drones.length === 0 && !hasOrg ? (
            <DroneQuickRegisterCard />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="drone">כלי טיס</Label>
              <Select value={droneId ?? undefined} onValueChange={setDroneId}>
                <SelectTrigger id="drone">
                  <SelectValue placeholder="בחר כלי טיס" />
                </SelectTrigger>
                <SelectContent>
                  {drones.map((drone) => (
                    <SelectItem key={drone.id} value={drone.id}>
                      {drone.nickname} · {drone.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">טלפון ליצירת קשר בשעת חירום</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="050-1234567"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              dir="ltr"
            />
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-sm font-medium">סטטוס בדיקת מרחב אווירי</p>
            <ClearanceBadge result={spatialCheck} hasAdvisoryWarning={isChecking || requiresAttention} />
          </div>

          <WeatherPanel center={center} />

          {spatialCheck?.clear && !isChecking && !requiresAttention && <PreFlightChecklist />}

          {!buildingsOnlyReady && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              בודק את הנקודה...
            </p>
          )}

          {buildingsOnlyReady && isChecking && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                isNearBuildingLocally ? "text-warning" : "text-muted-foreground"
              )}
            >
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              {isNearBuildingLocally
                ? "נמצא מבנה בקרבת מקום (בדיקה מיידית) — בודק גם מרחב אווירי..."
                : "אין מבנה בקרבת מקום (בדיקה מיידית) — בודק גם מרחב אווירי..."}
            </p>
          )}

          {!isChecking && requiresAttention && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 text-sm",
                blockedForSolo ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/10"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 font-medium",
                  blockedForSolo ? "text-destructive" : "text-warning"
                )}
              >
                {blockedForSolo ? <Lock className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {zoneHardBlocked
                  ? "לא ניתן לתאם דרך המערכת"
                  : blockedForHobby
                    ? "לא ניתן לתאם באזור זה מחשבון פרטי"
                    : groundBlockedByAltitude
                      ? "לא ניתן לבקש תיאום לנקודה זו"
                      : zoneBlockLevel === "controlled_airspace"
                        ? "קרוב למרחב פיקוח טיסה — נדרשת בדיקה ידנית"
                        : zoneRequiresDirectorApproval
                          ? 'כן — בכפוף לאישור פרטני של מנהל רת"א'
                          : needsSpecialAuthorization
                            ? "אזור זה דורש הרשאת הפעלה מיוחדת"
                            : "אזור זה דורש תיאום בכפוף לתנאים"}
              </div>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {groundBlockedByAltitude && <li>תקרת גובה חוקית של 0 מ&apos; מהקרקע בנקודה זו</li>}
                {authCheck?.reasons.map((reason, i) => (
                  <li key={`aip-${i}`}>
                    {reason.label}
                    {reason.zone && !reason.zone.geometry_precise && (
                      <span className="text-warning"> * גבול משוער — נדרשת בקשת תיאום לבדיקה מדויקת</span>
                    )}
                  </li>
                ))}
                {isNearBuildingLocally && (
                  <li>נמצא מבנה בטווח {requiredDistanceM} מ&apos;</li>
                )}
                {relevantProximityFindings.map((f, i) => (
                  <li key={`prox-${i}`}>
                    {f.label}
                    {f.name ? ` (${f.name})` : ""} — כ-{f.distanceM} מ&apos; (הסף החוקי בגובה שנבחר: {requiredDistanceM} מ&apos;)
                  </li>
                ))}
              </ul>
              {zoneBlockLevel === "controlled_airspace" ? (
                <p className="text-xs text-muted-foreground">
                  ניתן לשלוח בקשה — המוקדן יאמת מול NOTAM עדכני לפני אישור.
                </p>
              ) : blockedForHobby ? (
                <p className="text-xs text-muted-foreground">
                  התקנות מגדירות הרשאת הפעלה מיוחדת עבור הפעלה מסחרית/כללית של כטב&quot;ם בלבד — חשבון פרטי (ספורט
                  ופנאי) אינו זכאי לה.
                </p>
              ) : groundBlockedByAltitude ? (
                <p className="text-xs text-muted-foreground">
                  תקרת הגובה החוקית בנקודה זו היא 0 מטר מעל פני הקרקע — מרחב אווירי חופף מתחיל ממש מהקרקע, כך שאין
                  גובה טיסה חוקי לבקש עליו תיאום, גם לחשבון ארגון.
                </p>
              ) : zoneRequiresDirectorApproval ? (
                <p className="text-xs text-muted-foreground">
                  אזור אסור/מסוכן לטיסה — האישור הסופי מותנה באישור פרטני של מנהל רת&quot;א שהמוקדן יצטרך להשיג מול
                  הרשות לפני אישור הבקשה.
                </p>
              ) : zoneBlockLevel === "director_approval_only" ? (
                <p className="text-xs text-muted-foreground">
                  אזור אסור/מסוכן לטיסה — נדרש אישור פרטני של מנהל רת&quot;א. תיאום כזה זמין רק לחשבונות ארגון.
                </p>
              ) : needsSpecialAuthorization ? (
                <p className="text-xs text-muted-foreground">
                  ודאו שברשותכם הרשאת הפעלה מיוחדת מתאימה לפני שליחה — הבקשה תסומן לבדיקה נוספת של המוקדן.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ניתן לתאם בכפוף לתנאים שפורסמו לאזור — הבקשה תיבדק ע&quot;י המוקדן.
                </p>
              )}
              {matchingRegulations.map((reg) => (
                <InlineAuthorizationPurchase key={reg} regulationNumber={reg} purchasable={!blockedForHobby} />
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            המידע אינו כולל NOTAM בזמן אמת ואינו תחליף לבדיקה רשמית לפני טיסה. האחריות לביצוע הטיסה על פי כל דין
            מוטלת על המטיס.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting} size="lg" className="flex-1">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "שולח..." : "שליחת בקשה"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
