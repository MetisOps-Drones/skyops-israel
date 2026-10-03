"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import * as turf from "@turf/turf";
import { Loader2, Radius, Waypoints, ShieldAlert, Lock, Gauge } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { Disclosure } from "@/components/ui/disclosure";
import { useMapDrawStore } from "@/stores/useMapDrawStore";
import { useAirspaceCheck } from "@/hooks/useAirspaceCheck";
import { useDrones } from "@/hooks/useDrones";
import { useAipReferenceZones } from "@/hooks/useAipReferenceZones";
import { useLiveNotamZones } from "@/hooks/useLiveNotamZones";
import { useProximityCheck } from "@/hooks/useProximityCheck";
import { useBuildingProximity } from "@/hooks/useBuildingProximity";
import {
  checkFlightAuthorizationRequirement,
  PROXIMITY_CATEGORY_REGULATION,
  findingsRequiringAuthorization,
  requiredInfrastructureDistanceM,
  zoneVerdictFor,
} from "@/lib/geo/flight-rules";
import { checkLiveNotamOverlap, notamsValidUntilLabel } from "@/lib/geo/live-notams";
import { maxLegalAltitudeAtPoint, mToFt, altitudeAmslFt } from "@/lib/geo/aip";
import { InlineAuthorizationPurchase } from "./InlineAuthorizationPurchase";
import { ClearanceBadge } from "./ClearanceBadge";
import { PreFlightChecklist } from "./PreFlightChecklist";
import { WeatherPanel } from "./WeatherPanel";
import { BoundedNumberInput, MIN_RADIUS_M, MAX_RADIUS_M } from "./BoundedNumberInput";
import { createFlightRequest } from "@/actions/flight-requests";
import { DroneQuickRegisterCard } from "@/components/onboarding/DroneQuickRegisterCard";
import {
  altitudeBandForMeters,
  CAMERA_TYPE_LABELS,
  MIN_TAKEDOWN_SECONDS,
  MAX_TAKEDOWN_SECONDS,
  type CameraType,
} from "@/lib/validations/flight-request";
import { HOBBY_GENERAL_CEILING_M, COMMERCIAL_GENERAL_CEILING_M } from "@/lib/geo/altitude-ceiling";
import { useAltitudeCeiling } from "@/hooks/useAltitudeCeiling";
import { FLIGHT_PURPOSE_OPTIONS } from "@/lib/constants/flight-purpose";
import { cn } from "@/lib/utils";
import { useMyGlobalRole, useMyOrgContext } from "@/hooks/useOrgContext";
import { useCoordinationQuota } from "@/hooks/useCoordinationQuota";
import { useMyLicenses, useHasValidInsurance } from "@/hooks/useLicenses";
import { resolveLicenseRequirement } from "@/lib/validations/flight-request-requirements";

export function FlightParamsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const {
    shapeType,
    setShapeType,
    center,
    radiusMeters,
    setRadiusMeters,
    polygon,
    maxAltitudeMeters,
    setMaxAltitudeMeters,
    flightPurpose,
    setFlightPurpose,
    droneId,
    setDroneId,
    emergencyContactPhone,
    setEmergencyContactPhone,
    cameraType,
    setCameraType,
    takedownResponseSeconds,
    setTakedownResponseSeconds,
    reset,
  } = useMapDrawStore();

  const { data: drones = [] } = useDrones();
  const spatialCheck = useAirspaceCheck();
  const { data: role } = useMyGlobalRole();
  const { data: orgContext } = useMyOrgContext();
  const { data: aipZones = [], isLoading: aipZonesLoading } = useAipReferenceZones();
  const { data: liveNotams = [], isLoading: liveNotamsLoading } = useLiveNotamZones();
  const isHobby = role === "pilot_hobby";
  const hasOrg = Boolean(orgContext?.orgId);
  // תקנות הטיס (הפעלת מטיסן), תשפ"ד 2024: 50 מ' קבועים למטיסן — אין ל"ספורט ופנאי" מסלול חוקי לגובה גבוה יותר; לכטב"ם קטן 100 מ'.
  const altitudeCeilingM = isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M;

  const { data: licenses = [], isLoading: licensesLoading } = useMyLicenses();
  const { data: hasValidInsurance, isLoading: insuranceLoading } = useHasValidInsurance();
  const selectedDrone = drones.find((d) => d.id === droneId) ?? null;
  const requestType = shapeType === "circle" ? "basic_auto_100m" : "manual_notam_bubble";
  const licenseCheck = selectedDrone
    ? resolveLicenseRequirement(licenses, selectedDrone.mtow_grams, requestType)
    : null;
  const licenseCheckLoading = Boolean(selectedDrone) && (licensesLoading || (licenseCheck?.needsInsurance && insuranceLoading));
  // Same "never claim clear until we've actually checked" rule as the
  // building/proximity checks below — only block once a drone is selected
  // and the license/insurance query has actually resolved.
  const licenseBlocked =
    Boolean(selectedDrone) &&
    !licenseCheckLoading &&
    (!licenseCheck?.ok || (licenseCheck.needsInsurance && !hasValidInsurance));

  const { data: quota } = useCoordinationQuota();
  const quotaPeriodLabel = quota?.limit?.period === "week" ? "השבוע" : "החודש";
  const quotaExhausted = Boolean(quota?.limit) && quota!.used >= quota!.limit!.count;
  // The "complex" request type is exactly the polygon/NOTAM shape — see the
  // request_type mapping in handleSubmit below.
  const complexExhausted =
    shapeType === "polygon" &&
    Boolean(quota?.limit) &&
    quota!.complexUsed >= quota!.limit!.complexAllowed;

  const checkPoint = useMemo<[number, number] | null>(() => {
    if (shapeType === "circle") return center;
    if (shapeType === "polygon" && polygon) {
      const coords = turf.centroid(polygon).geometry.coordinates;
      return [coords[0] ?? 0, coords[1] ?? 0];
    }
    return null;
  }, [shapeType, center, polygon]);

  // Zone and 2 km runway-distance rules are judged on the requested point
  // (the pin / the polygon's centre), not on the size of the bubble.
  const authCheck = useMemo(
    () => (checkPoint ? checkFlightAuthorizationRequirement(checkPoint, aipZones, isHobby) : null),
    [checkPoint, aipZones, isHobby]
  );
  const altitudeResult = useMemo(
    () => (checkPoint ? maxLegalAltitudeAtPoint(checkPoint, aipZones) : null),
    [checkPoint, aipZones]
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // Once the pilot has picked a flight window, a NOTAM only counts if it overlaps that window (including ones that start later).
  const notamWindow = useMemo(() => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start ? null : { start, end };
  }, [startTime, endTime]);
  const notamCheck = useMemo(
    () => (checkPoint ? checkLiveNotamOverlap(checkPoint, liveNotams, notamWindow) : null),
    [checkPoint, liveNotams, notamWindow]
  );
  const proximity = useProximityCheck(checkPoint);
  const proximityFindings = proximity.data?.findings ?? [];
  // Unlike the map's pre-planning inspector (LocationInfoCard), an actual altitude band is
  // already chosen here — the legal minimum distance from infrastructure for a מטיס (commercial)
  // is the flight altitude itself (תקנה 32), so this uses the real selected altitude, not a
  // conservative placeholder.
  const plannedAltitudeM = maxAltitudeMeters;
  const requiredDistanceM = requiredInfrastructureDistanceM(isHobby, plannedAltitudeM);
  const relevantProximityFindings = findingsRequiringAuthorization(proximityFindings, isHobby, plannedAltitudeM);
  // Primary signal, same reasoning as LocationInfoCard: OSM's "residential"
  // distance is to a landuse polygon's centroid, not its nearest edge, and
  // can badly understate real proximity for a city-scale way. The R2
  // bitmap grid (/api/building-proximity — built from the same VIDA/Overture
  // dataset the map's building tiles render from) drives תקנה 32 regardless
  // of what OSM found.
  const buildingProximity = useBuildingProximity(checkPoint, requiredDistanceM);
  const isNearBuildingLocally = buildingProximity.data?.isNearBuilding ?? false;
  // The grid fetch can still fail (R2 hiccup, etc). That must never read as
  // "confirmed no building nearby"; the server re-runs this same check
  // before actually auto-clearing anything (src/actions/flight-requests.ts),
  // but the UI still needs to say plainly that it couldn't verify, not show
  // a false-clear "מותר לטיסה".
  const buildingCheckUnavailable = !buildingProximity.isLoading && buildingProximity.data?.available === false;

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
  const zoneVerdict = zoneVerdictFor(zoneBlockLevel, hasOrg);
  const zoneHardBlocked = !zoneVerdict.canSubmit;
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
  const requiresAttention =
    zoneBlockLevel !== "none" ||
    Boolean(notamCheck?.inside) ||
    needsSpecialAuthorization ||
    groundBlockedByAltitude ||
    buildingCheckUnavailable;
  const blockedForSolo = zoneHardBlocked || blockedForHobby || groundBlockedByAltitude;
  // Airspace alone (local data, instant) already forbids this point — see the same note in
  // LocationInfoCard: the slower building/OSM checks can't change that, and a purchasable
  // special authorization can't legalize flying inside a CTR or a base restriction.
  const forbiddenByAirspace = !aipZonesLoading && (groundBlockedByAltitude || zoneHardBlocked);
  // Same reasoning as LocationInfoCard: requiresAttention is derived from
  // aipZones/proximity/buildingProximity, all async — while any is still
  // loading, don't show (or let a hobby pilot act on) a premature "fine to
  // submit" state.
  const isChecking = aipZonesLoading || liveNotamsLoading || proximity.isLoading || buildingProximity.isLoading;
  // Same fast-path as LocationInfoCard: the building-footprint check alone
  // is a GIST-indexed spatial query, so once *it* resolves (even while
  // aipZones/proximity are still loading) show that read immediately
  // instead of the generic spinner.
  const buildingsOnlyReady = !buildingProximity.isLoading;

  const [submitting, setSubmitting] = useState(false);

  // The ceiling differs by licence type — if the store still holds an altitude above what this
  // account may legally request (e.g. left over from a previous session), pull it back down
  // instead of silently submitting a request the server will reject anyway.
  useEffect(() => {
    if (maxAltitudeMeters > altitudeCeilingM) setMaxAltitudeMeters(altitudeCeilingM);
  }, [maxAltitudeMeters, altitudeCeilingM, setMaxAltitudeMeters]);

  // The pilot thinks in meters above the ground; ATC and the AIP in feet above sea level (מעפ"י).
  // Shown live so the conversion the coordinator will see is never a surprise.
  const terrain = useAltitudeCeiling(checkPoint);
  const altitudeFt = mToFt(maxAltitudeMeters);
  const altitudeAmsl = altitudeAmslFt(maxAltitudeMeters, terrain.data?.terrainElevationM ?? null);

  const canSubmit =
    !blockedForSolo &&
    !quotaExhausted &&
    !complexExhausted &&
    !licenseBlocked &&
    !(isChecking && isHobby) &&
    Boolean(droneId) &&
    Boolean(emergencyContactPhone) &&
    Boolean(cameraType) &&
    takedownResponseSeconds !== null &&
    Boolean(startTime && endTime) &&
    ((shapeType === "circle" && Boolean(center)) || (shapeType === "polygon" && Boolean(polygon)));

  async function handleSubmit() {
    if (!canSubmit || !center || !cameraType || takedownResponseSeconds === null) return;
    setSubmitting(true);
    try {
      const result = await createFlightRequest({
        drone_id: droneId!,
        request_type: shapeType === "circle" ? "basic_auto_100m" : "manual_notam_bubble",
        center_point: { type: "Point", coordinates: center },
        radius_meters: shapeType === "circle" ? radiusMeters : undefined,
        polygon:
          shapeType === "polygon" && polygon
            ? { type: "Polygon", coordinates: polygon.coordinates as [number, number][][] }
            : undefined,
        altitude_band: altitudeBandForMeters(maxAltitudeMeters),
        flight_purpose: flightPurpose,
        max_altitude_meters: maxAltitudeMeters,
        camera_type: cameraType,
        takedown_response_seconds: takedownResponseSeconds,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[92vw] max-w-md overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>פרטי בקשת טיסה</DialogTitle>
          <DialogDescription className="sr-only">טופס הגשת בקשת תיאום טיסה לנקודה שנבחרה על המפה</DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-5">
          {forbiddenByAirspace && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
              <Lock className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-base font-semibold">
                  {zoneBlockLevel === "forbidden" || !zoneHardBlocked
                    ? zoneVerdictFor("forbidden", hasOrg).headline
                    : zoneVerdict.headline}
                </p>
                <Disclosure label="למה? — פירוט מלא">
                  {authCheck && authCheck.reasons.length > 0 && (
                    <ul className="list-inside list-disc text-sm">
                      {authCheck.reasons.map((reason, i) => (
                        <li key={i}>{reason.label}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm">
                    {zoneBlockLevel === "forbidden" || !zoneHardBlocked
                      ? zoneVerdictFor("forbidden", hasOrg).detail
                      : zoneVerdict.detail}
                  </p>
                </Disclosure>
                {zoneVerdict.upgradeHelps && (
                  <Link href="/profile?open=subscription" className="mt-1.5 inline-block text-sm font-medium underline">
                    מה כן אפשר: לשדרג לחשבון ארגון ←
                  </Link>
                )}
              </div>
            </div>
          )}

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

          {quota?.limit && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                quotaExhausted || complexExhausted ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Gauge className="h-3.5 w-3.5 shrink-0" />
              {quota.used} מתוך {quota.limit.count} תיאומים {quotaPeriodLabel} בתוכנית הנוכחית
              {quota.limit.complexAllowed > 0 &&
                ` (מתוכם ${quota.complexUsed}/${quota.limit.complexAllowed} בועות NOTAM)`}
            </p>
          )}

          {shapeType === "circle" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="radius">רדיוס (מטרים)</Label>
              <BoundedNumberInput
                id="radius"
                value={radiusMeters}
                onChange={setRadiusMeters}
                min={MIN_RADIUS_M}
                max={MAX_RADIUS_M}
                errorText={`הרדיוס חייב להיות בין ${MIN_RADIUS_M} ל-${MAX_RADIUS_M.toLocaleString("he-IL")} מטרים`}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="altitude">גובה טיסה מרבי (מטרים מעל הקרקע)</Label>
            <BoundedNumberInput
              id="altitude"
              value={maxAltitudeMeters}
              onChange={setMaxAltitudeMeters}
              min={1}
              max={altitudeCeilingM}
              errorText={`הגובה חייב להיות בין 1 ל-${altitudeCeilingM} מטרים (התקרה החוקית ${isHobby ? "למטיסן" : "לכטב״ם קטן"})`}
            />
            <p className="text-xs text-muted-foreground" dir="rtl">
              = {altitudeFt.toLocaleString("he-IL")} רגל מעל הקרקע
              {altitudeAmsl !== null
                ? ` · כ-${altitudeAmsl.toLocaleString("he-IL")} רגל מעל פני הים (מעפ״י) — כך יוצג למתאם`
                : terrain.isLoading
                  ? " · מחשב גובה מעל פני הים..."
                  : ""}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cameraType">סוג מצלמה</Label>
            <Select value={cameraType ?? undefined} onValueChange={(v) => setCameraType(v as CameraType)}>
              <SelectTrigger id="cameraType">
                <SelectValue placeholder="בחר סוג מצלמה" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CAMERA_TYPE_LABELS) as [CameraType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="takedown">זמן תגובה לבקשת הורדה (שניות)</Label>
            <BoundedNumberInput
              id="takedown"
              value={takedownResponseSeconds}
              onChange={setTakedownResponseSeconds}
              min={MIN_TAKEDOWN_SECONDS}
              max={MAX_TAKEDOWN_SECONDS}
              placeholder="לדוגמה: 60"
              errorText={`יש להזין בין ${MIN_TAKEDOWN_SECONDS} ל-${MAX_TAKEDOWN_SECONDS.toLocaleString("he-IL")} שניות`}
            />
            <p className="text-xs text-muted-foreground">
              כמה זמן ייקח להוריד את הרחפן לקרקע מהרגע שהתקבלה בקשת הורדה מהמתאם.
            </p>
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
          ) : drones.length === 0 ? (
            // An org pilot/fleet manager with zero org drones — registering
            // one inline here (like DroneQuickRegisterCard does for a solo
            // pilot) would bypass fleet management, which lives under
            // "יומן טיסות" (see OrgPageClient.tsx's own note on this same
            // split). A bare empty <Select> with nothing to pick and no
            // explanation read as broken, not as "nothing registered yet".
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">לארגון שלך עדיין אין כלי טיס רשום</p>
              <p className="mt-1 text-xs text-muted-foreground">
                יש לרשום כלי טיס תחת ניהול הצי לפני שאפשר לבקש תיאום.
              </p>
              <Link href="/logs" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                מעבר לניהול הצי
              </Link>
            </div>
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

          {licenseBlocked && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <Lock className="h-4 w-4" />
                {!licenseCheck?.ok
                  ? "אין רישיון בתוקף המתאים לכלי הטיס שנבחר"
                  : "נדרש אישור ביטוח בתוקף להטסה מסחרית"}
              </div>
              <p className="text-xs text-muted-foreground">
                {!licenseCheck?.ok
                  ? "לא נמצא רישיון טיס בתוקף שמכסה את משקל כלי הטיס שנבחר (ואת סוג הבקשה, עבור בועת NOTAM). הבקשה תיחסם בשרת גם אם תישלח."
                  : "הרישיון שלך מכסה כלי טיס זה, אך נדרש גם אישור ביטוח בתוקף על מנת לשלוח בקשת טיסה מסחרית. הבקשה תיחסם בשרת גם אם תישלח."}
              </p>
              <Link href="/profile" className="text-xs font-medium text-primary hover:underline">
                ניהול רישיונות ומסמכים בפרופיל
              </Link>
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

          {!forbiddenByAirspace && !buildingsOnlyReady && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              בודק את הנקודה...
            </p>
          )}

          {!forbiddenByAirspace && buildingsOnlyReady && isChecking && (
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

          {!forbiddenByAirspace && !isChecking && requiresAttention && (
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
                {blockedForHobby
                  ? "לא ניתן לתאם באזור זה מחשבון פרטי"
                  : zoneVerdict.tone !== "none"
                    ? zoneVerdict.headline
                    : notamCheck?.inside
                      ? `נוטאם פעיל בנקודה זו${notamsValidUntilLabel(notamCheck.notams) ? ` · בתוקף עד ${notamsValidUntilLabel(notamCheck.notams)}` : ""} — נדרש תיאום`
                      : needsSpecialAuthorization
                        ? "אזור זה דורש הרשאת הפעלה מיוחדת"
                        : buildingCheckUnavailable
                          ? "בדיקת קרבה למבנים לא הייתה זמינה — נדרש תיאום עם מוקדן"
                          : "אזור זה דורש תיאום בכפוף לתנאים"}
              </div>
              <Disclosure label="למה? — פירוט מלא">
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {buildingCheckUnavailable && (
                    <li>בדיקת קרבה למבנים אוטומטית לא הייתה זמינה כרגע — לא ניתן לאשר אוטומטית</li>
                  )}
                  {authCheck?.reasons.map((reason, i) => (
                    <li key={`aip-${i}`}>
                      {reason.label}
                      {reason.zone && !reason.zone.geometry_precise && (
                        <span className="text-warning"> * גבול משוער — נדרשת בקשת תיאום לבדיקה מדויקת</span>
                      )}
                    </li>
                  ))}
                  {notamCheck?.notams.map((notam) => (
                    <li key={`notam-${notam.id}`} dir="ltr" className="text-right">
                      {notam.id}: {notam.eText}
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
                {blockedForHobby ? (
                  <p className="text-xs text-muted-foreground">
                    התקנות מגדירות הרשאת הפעלה מיוחדת עבור הפעלה מסחרית/כללית של כטב&quot;ם בלבד — חשבון פרטי (ספורט
                    ופנאי) אינו זכאי לה.
                  </p>
                ) : zoneVerdict.tone !== "none" ? (
                  <p className="text-xs text-muted-foreground">{zoneVerdict.detail}</p>
                ) : notamCheck?.inside ? (
                  <p className="text-xs text-muted-foreground">
                    ניתן לשלוח בקשה — המוקדן יבדוק את הנוטאם הפעיל לפני אישור. מקור: רשות שדות התעופה, לא רשמי.
                  </p>
                ) : needsSpecialAuthorization ? (
                  <p className="text-xs text-muted-foreground">
                    ודאו שברשותכם הרשאת הפעלה מיוחדת מתאימה לפני שליחה — הבקשה תסומן לבדיקה נוספת של המוקדן.
                  </p>
                ) : buildingCheckUnavailable ? (
                  <p className="text-xs text-muted-foreground">
                    לא ניתן היה לבדוק אוטומטית קרבה למבנים בנקודה זו — הבקשה תישלח לבדיקה ידנית של מוקדן במקום אישור
                    אוטומטי.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ניתן לתאם בכפוף לתנאים שפורסמו לאזור — הבקשה תיבדק ע&quot;י המוקדן.
                  </p>
                )}
                {matchingRegulations.map((reg) => (
                  <InlineAuthorizationPurchase key={reg} regulationNumber={reg} purchasable={!blockedForHobby} />
                ))}
              </Disclosure>
            </div>
          )}

          {(quotaExhausted || complexExhausted) && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <Lock className="h-4 w-4" />
                {quotaExhausted ? `מיצית את מכסת התיאומים ${quotaPeriodLabel}` : "בועות NOTAM אינן כלולות בתוכנית הנוכחית"}
              </div>
              <p className="text-xs text-muted-foreground">
                <Link href="/profile" className="font-medium text-primary hover:underline">
                  שדרוג התוכנית
                </Link>{" "}
                דרך &ldquo;הפרופיל שלי&rdquo; ← &ldquo;מנוי&rdquo; מעלה את המכסה.
              </p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            נוטאמים פעילים נבדקים מול פיד לא-רשמי של רשות שדות התעופה, לא תחליף לבדיקה רשמית לפני טיסה. האחריות
            לביצוע הטיסה על פי כל דין מוטלת על המטיס.
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
      </DialogContent>
    </Dialog>
  );
}
