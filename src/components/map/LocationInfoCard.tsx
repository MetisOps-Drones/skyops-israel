"use client";

import Link from "next/link";
import { MapPinned, ShieldAlert, ShieldCheck, ArrowUpToLine, Lock, Ban, Loader2, WifiOff, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { WeatherPanel } from "@/components/map/WeatherPanel";
import { TermTooltip } from "@/components/map/TermTooltip";
import { useAipReferenceZones } from "@/hooks/useAipReferenceZones";
import { useMyGlobalRole, useMyOrgContext } from "@/hooks/useOrgContext";
import { useProximityCheck } from "@/hooks/useProximityCheck";
import { useBuildingProximity } from "@/hooks/useBuildingProximity";
import { useAltitudeCeiling } from "@/hooks/useAltitudeCeiling";
import { InlineAuthorizationPurchase } from "@/components/map/InlineAuthorizationPurchase";
import { AIP_ZONE_KIND_LABELS } from "@/lib/constants/aip-reference-zones";
import {
  checkFlightAuthorizationRequirement,
  PROXIMITY_CATEGORY_REGULATION,
  findingsRequiringAuthorization,
  requiredInfrastructureDistanceM,
} from "@/lib/geo/flight-rules";
import { maxLegalAltitudeAtPoint, formatAltitudeRangeMeters } from "@/lib/geo/aip";
import {
  computeFullAltitudeCeiling,
  HOBBY_GENERAL_CEILING_M,
  COMMERCIAL_GENERAL_CEILING_M,
} from "@/lib/geo/altitude-ceiling";
import { toDMS } from "@/lib/geo/spatial";
import { cn } from "@/lib/utils";

export function LocationInfoCard({
  point,
  open,
  onOpenChange,
  onRequestCoordination,
}: {
  point: [number, number] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestCoordination: (point: [number, number]) => void;
}) {
  const { data: aipZones = [] } = useAipReferenceZones();
  const { data: role } = useMyGlobalRole();
  const { data: orgContext } = useMyOrgContext();
  const proximity = useProximityCheck(point);
  const altitudeCeiling = useAltitudeCeiling(point);
  const isHobby = role === "pilot_hobby";
  const hasOrg = Boolean(orgContext?.orgId);

  const aipCheck = point ? checkFlightAuthorizationRequirement(point, aipZones) : null;
  const altitudeResult = point ? maxLegalAltitudeAtPoint(point, aipZones) : null;
  const fullCeiling = altitudeResult
    ? computeFullAltitudeCeiling(
        altitudeResult,
        altitudeCeiling.data?.terrainElevationM ?? null,
        isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M
      )
    : null;

  // Zone-based restriction (containment/proximity to an AIP zone) and
  // "special operation authorization" (the 9 numbered regulations,
  // triggered here by ground-proximity findings) are two different legal
  // mechanisms — see src/lib/geo/flight-rules.ts. Never conflate them: a
  // hobby pilot can still coordinate in a merely-restricted zone the same
  // as anyone else. Controlled airspace (CTR/ATZ/TMA/CTA) has no exception
  // in the law at all, so it stays blocked for everyone. Prohibited/danger
  // zones legally require a case-by-case CAAI-director approval — an
  // organization is the one tier with the standing process to actually
  // pursue that, so orgs may still submit a request here (the dispatcher
  // will need to chase the director's sign-off manually before it can be
  // approved); a hobby/solo-pro account cannot.
  const zoneBlockLevel = aipCheck?.blockLevel ?? "none";
  const zoneRequiresDirectorApproval = zoneBlockLevel === "director_approval_only" && hasOrg;
  const zoneHardBlocked =
    zoneBlockLevel === "controlled_airspace" || (zoneBlockLevel === "director_approval_only" && !hasOrg);

  // Altitude isn't chosen yet at this pre-planning stage (that happens in
  // FlightParamsDrawer) — use the role's flat general ceiling as the
  // conservative worst case, since that's the highest this account could
  // legally request anyway. For a מטיס (commercial), the legal minimum
  // distance from infrastructure equals the flight altitude itself (תקנה
  // 32), not a fixed number — see src/lib/geo/flight-rules.ts.
  const conservativeAltitudeM = isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M;
  const requiredDistanceM = requiredInfrastructureDistanceM(isHobby, conservativeAltitudeM);
  const buildingProximity = useBuildingProximity(point, requiredDistanceM);
  const proximityFindings = proximity.data?.findings ?? [];
  const relevantProximityFindings = findingsRequiringAuthorization(proximityFindings, isHobby, conservativeAltitudeM);
  // The OSM-based findings above measure distance to a landuse polygon's
  // centroid, not its nearest edge — for a city-scale "residential" way that
  // can read "2,471m" from a point that's visibly ~200m from the nearest
  // houses. The building-grid check is the authoritative signal for "is
  // there a building nearby" (real footprints, not administrative zone
  // centroids), so it drives the same תקנה 32 regardless of what OSM says —
  // OSM's findings are kept only as supplementary detail (named sites).
  const isNearBuildingLocally = buildingProximity.data?.isNearBuilding ?? false;
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
  // A zone can allow a coordination request in principle while the legal altitude ceiling at
  // this exact point is still 0 from the ground — the two checks are independent. Without this,
  // the "request coordination" button could stay active for a point that can never be approved.
  const groundBlockedByAltitude = Boolean(altitudeResult?.blockedFromGround);
  const requiresAttention = zoneBlockLevel !== "none" || needsSpecialAuthorization || groundBlockedByAltitude;
  const cannotSubmit = zoneHardBlocked || blockedForHobby || groundBlockedByAltitude;
  const hasDetails = Boolean(
    (aipCheck && aipCheck.reasons.length > 0) ||
      proximityFindings.length > 0 ||
      needsSpecialAuthorization ||
      buildingProximity.data?.available
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85vh] w-[calc(100%-2rem)] max-w-md grid-rows-[auto_1fr] gap-0 rounded-xl p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPinned className="h-4 w-4" />
            פרטי מיקום
          </DialogTitle>
        </DialogHeader>

        {point && (
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <p className="text-xs text-muted-foreground" dir="ltr">
              {toDMS(point[1], "lat")} {toDMS(point[0], "lng")}
            </p>

            {/* The answer, first — everything below this is "why", collapsed by default so a
                pilot who just wants a yes/no doesn't have to read a legal brief to get it. */}
            {zoneBlockLevel === "controlled_airspace" ? (
              <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-4 text-destructive">
                <Ban className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-base font-semibold">אסור לחלוטין</p>
                  <p className="mt-0.5 text-sm">מרחב פיקוח טיסה (שדה תעופה) — אין אפשרות לתיאום, אין חריג בחוק.</p>
                </div>
              </div>
            ) : zoneBlockLevel === "director_approval_only" ? (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-xl p-4",
                  zoneRequiresDirectorApproval ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                )}
              >
                {zoneRequiresDirectorApproval ? (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Ban className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-base font-semibold">
                    {zoneRequiresDirectorApproval ? 'כן, אך בכפוף לאישור מנהל רת"א' : "לא ניתן לתאם דרך המערכת"}
                  </p>
                  <p className="mt-0.5 text-sm">
                    {zoneRequiresDirectorApproval
                      ? "אזור אסור/מסוכן לטיסה — ניתן להגיש בקשה כחשבון ארגון."
                      : "אזור אסור/מסוכן לטיסה — זמין רק לחשבונות ארגון."}
                  </p>
                  {!zoneRequiresDirectorApproval && (
                    <Link href="/profile?open=subscription" className="mt-1.5 inline-block text-sm font-medium underline">
                      מה כן אפשר: לשדרג לחשבון ארגון ←
                    </Link>
                  )}
                </div>
              </div>
            ) : requiresAttention ? (
              <div className="flex items-start gap-3 rounded-xl bg-warning/10 p-4 text-warning">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-base font-semibold">
                    {needsSpecialAuthorization ? "אפשרי, בכפוף להרשאה מיוחדת" : "אפשרי, בכפוף לתנאי האזור"}
                  </p>
                  <p className="mt-0.5 text-sm">יש לתאם לפני הטיסה — הפרטים המלאים למטה.</p>
                  {blockedForHobby && (
                    <Link href="/profile?open=subscription" className="mt-1.5 inline-block text-sm font-medium underline">
                      מה כן אפשר: לשדרג לחשבון עסקי ←
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-success">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <p className="text-base font-semibold">מותר לטיסה בנקודה זו</p>
              </div>
            )}

            {/* Primary safety signal: distance to the nearest real building footprint
                (src/lib/geo/proximity-grid.ts), not OSM's landuse-polygon centroid — a
                large "residential" way in OSM can read as 2+ km away from a point that's
                visibly ~200m from the nearest houses, because Overpass's `center` is the
                polygon's centroid, not its nearest edge. */}
            {buildingProximity.isLoading ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                בודק מרחק ממבנים (נתוני מבנים מקומיים)...
              </p>
            ) : buildingProximity.data?.available ? (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  buildingProximity.data.isNearBuilding ? "text-destructive" : "text-success"
                )}
              >
                {buildingProximity.data.isNearBuilding ? (
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                )}
                {buildingProximity.data.isNearBuilding
                  ? `נמצא מבנה בטווח ${buildingProximity.data.bufferM} מ' — נדרשת הרשאת הפעלה מיוחדת`
                  : `אין מבנה ידוע בטווח ${buildingProximity.data.bufferM} מ'`}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <WifiOff className="h-3 w-3" />
                בדיקת מרחק ממבנים לא זמינה כרגע — יש לבדוק ידנית.
              </p>
            )}

            {proximity.isLoading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                בודק מוסדות ספציפיים בקרבת מקום (בתי ספר, בתי חולים, מתקנים)...
              </p>
            )}
            {!proximity.isLoading && proximity.data?.available === false && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <WifiOff className="h-3 w-3" />
                לא ניתן היה לבדוק מוסדות ספציפיים כרגע (OpenStreetMap) — הבדיקה מעל מבוססת על נתוני המבנים בלבד.
              </p>
            )}

            {/* Quick facts a pilot actually wants at a glance — kept visible, not buried. */}
            <div className="flex items-center gap-2 text-sm font-medium">
              <ArrowUpToLine className="h-4 w-4 shrink-0 text-muted-foreground" />
              {altitudeResult?.blockedFromGround
                ? "אסור לטיסה מהקרקע בנקודה זו"
                : fullCeiling?.combinedAglM !== null && fullCeiling?.combinedAglM !== undefined
                  ? `תקרת טיסה: עד ${fullCeiling.combinedAglM.toLocaleString("he-IL")} מ' מעל פני הקרקע`
                  : altitudeResult?.maxAltitudeFt !== null && altitudeResult?.maxAltitudeFt !== undefined
                    ? `תקרת מרחב אווירי ידועה (AMSL): ${formatAltitudeRangeMeters(0, altitudeResult.maxAltitudeFt)}`
                    : "אין מגבלת מרחב אווירי ידועה בנקודה זו"}
            </div>

            <WeatherPanel center={point} cloudBase={altitudeCeiling.data?.cloudBase} />

            {(hasDetails || (!altitudeResult?.blockedFromGround && fullCeiling)) && (
              <Disclosure label="למה? — פירוט מלא ומקורות">
                {aipCheck && aipCheck.reasons.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        אזורי <TermTooltip term="AIP">מרחב אווירי</TermTooltip> חופפים
                      </p>
                      <p className="text-xs text-muted-foreground">מרחק נמדד מגבול המרחב הסגור עצמו</p>
                    </div>
                    {aipCheck.reasons.map((reason, i) => {
                      const zone = reason.zone;
                      if (!zone) return null;
                      return (
                        <div key={i} className="rounded-lg border p-3 text-sm">
                          <p className="font-medium">
                            {zone.name}
                            {zone.code ? ` (${zone.code})` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{AIP_ZONE_KIND_LABELS[zone.kind]}</p>
                          <p className="text-xs font-medium">
                            {formatAltitudeRangeMeters(zone.min_altitude_ft, zone.max_altitude_ft)}
                          </p>
                          {(zone.kind === "DANGER" || zone.kind === "PROHIBITED") && (
                            <p className="mt-1 text-xs text-destructive">
                              {hasOrg
                                ? 'נדרש אישור פרטני של מנהל רת"א — תיאום זמין לחשבון ארגון בלבד'
                                : 'נדרש אישור פרטני של מנהל רת"א — לא ניתן לתאם דרך המערכת מחשבון פרטי'}
                            </p>
                          )}
                          {zone.kind === "RESTRICTED" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              ניתן לתאם בכפוף לתנאים שפורסמו לאזור — הבקשה תיבדק ע&quot;י המוקדן
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {proximityFindings.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-medium">מוסדות ואתרים ספציפיים בקרבת מקום (משלים, לא קובע)</p>
                      <p className="text-xs text-muted-foreground">
                        מבוסס OpenStreetMap — מזהה בתי ספר/בתי חולים/מתקנים ספציפיים, אבל המרחק ל&quot;שכונת
                        מגורים&quot; נמדד ממרכז הכובד של האזור המתויג במפה, לא מהבית הקרוב ביותר בפועל — יכול להטעות
                        באזורים גדולים. ההגדרה הקובעת אם צריך הרשאה מיוחדת היא בדיקת המבנים למעלה. הסף החוקי המזערי{" "}
                        {isHobby
                          ? `למטיסן הוא ${requiredDistanceM} מ' קבועים`
                          : `למטיס הוא כגובה ההטסה עצמו (כאן: ${requiredDistanceM} מ׳, לפי תקרת הרישיון — הסף בפועל ישתנה לפי הגובה שתבחרו בטופס הבקשה)`}
                        .
                      </p>
                    </div>
                    {proximityFindings.map((f, i) => {
                      const breaches = f.distanceM < requiredDistanceM;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-lg border p-3 text-sm",
                            breaches && "border-destructive/40 bg-destructive/5"
                          )}
                        >
                          <p className="font-medium">
                            {f.label}
                            {f.name ? ` — ${f.name}` : ""}
                          </p>
                          <p className={cn("text-xs", breaches ? "text-destructive" : "text-muted-foreground")}>
                            כ-{f.distanceM} מטר {breaches ? "— מתחת לסף החוקי" : "— בטווח מותר"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {needsSpecialAuthorization && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      {matchingRegulations.length > 1 ? "הרשאות רלוונטיות למגבלות שנמצאו" : "הרשאה רלוונטית למגבלה שנמצאה"}
                    </p>
                    {blockedForHobby && (
                      <p className="text-xs text-muted-foreground">
                        חשבון פרטי (ספורט ופנאי) אינו זכאי להרשאת הפעלה מיוחדת — התקנות מגדירות אותה רק עבור הפעלה
                        מסחרית/כללית של כטב&quot;ם. הכרטיסים למטה מוצגים לעיון בלבד.
                      </p>
                    )}
                    {matchingRegulations.map((reg) => (
                      <InlineAuthorizationPurchase key={reg} regulationNumber={reg} purchasable={!blockedForHobby} />
                    ))}
                  </div>
                )}

                {altitudeCeiling.isLoading && !altitudeResult?.blockedFromGround && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    מחשב תקרה על בסיס גובה קרקע...
                  </p>
                )}

                {!altitudeResult?.blockedFromGround && fullCeiling && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1.5 text-sm font-medium">חישוב תקרת הטיסה</p>
                    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {fullCeiling.routeAglM !== null && (
                        <li className={fullCeiling.limitingFactor === "route" ? "font-medium text-foreground" : ""}>
                          גובה נתיב מעל הראש ({formatAltitudeRangeMeters(0, altitudeResult!.maxAltitudeFt)}) פחות גובה פני הקרקע
                          {fullCeiling.terrainElevationM !== null ? ` (${fullCeiling.terrainElevationM} מ' מעל פני הים)` : ""}
                          {fullCeiling.routeIsTrafficCorridor ? " פחות הפרדה מתעבורה בנתיב (200 רגל)" : ""} = עד{" "}
                          {fullCeiling.routeAglM.toLocaleString("he-IL")} מ&apos;
                        </li>
                      )}
                      <li className={fullCeiling.limitingFactor === "general_ceiling" ? "font-medium text-foreground" : ""}>
                        תקרה כללית קבועה בתקנות ל{isHobby ? "מטיסן (ספורט ופנאי)" : "כטב״ם קטן"}: עד{" "}
                        {(isHobby ? HOBBY_GENERAL_CEILING_M : COMMERCIAL_GENERAL_CEILING_M).toLocaleString("he-IL")} מ&apos;
                      </li>
                    </ul>
                  </div>
                )}

                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    נדרשת גם ראות טיסה של 3 ק&quot;מ לפחות, ואסור להיכנס לתוך ענן, מעליו או ביניהם. מרחק קבוע מכלי טיס
                    אחרים מחוץ לנתיב מתואם אינו מוגדר בתקנות כמספר — חלה חובת &quot;ראייה והימנעות&quot; (See and Avoid)
                    באחריות המטיס.
                  </span>
                </div>
              </Disclosure>
            )}

            {cannotSubmit ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-destructive">
                  {zoneHardBlocked || (groundBlockedByAltitude && !blockedForHobby) ? (
                    <Ban className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {zoneHardBlocked
                    ? "לא ניתן לתאם דרך המערכת"
                    : blockedForHobby
                      ? "לא ניתן לתאם טיסה באזור זה מחשבון פרטי"
                      : "לא ניתן לבקש תיאום לנקודה זו"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {zoneBlockLevel === "controlled_airspace"
                    ? "מרחב פיקוח טיסה — אין חריג בחוק המאפשר הטסת רחפן כאן, גם לא ארגון עם הרשאות."
                    : zoneBlockLevel === "director_approval_only" && !zoneRequiresDirectorApproval
                      ? "אזור אסור/מסוכן לטיסה — נדרש אישור פרטני של מנהל רת\"א. תיאום כזה זמין רק לחשבונות ארגון, שיש להם תהליך מול הרשות להשיג את האישור."
                      : blockedForHobby
                        ? "התקנות מגדירות הרשאת הפעלה מיוחדת עבור הפעלה מסחרית/כללית של כטב\"ם בלבד — חשבון פרטי (ספורט ופנאי) אינו זכאי לה."
                        : "תקרת הגובה החוקית בנקודה זו היא 0 מטר מעל פני הקרקע — מרחב אווירי חופף מתחיל ממש מהקרקע, כך שאין גובה טיסה חוקי לבקש עליו תיאום."}
                </p>
                {!groundBlockedByAltitude || blockedForHobby || (zoneBlockLevel === "director_approval_only" && !zoneRequiresDirectorApproval) ? (
                  <Link href="/profile?open=subscription" className="text-xs font-medium text-primary underline">
                    {zoneBlockLevel === "director_approval_only" ? "שדרוג לחשבון ארגון" : "שדרוג לחשבון עסקי"} מהפרופיל שלכם ←
                  </Link>
                ) : null}
              </div>
            ) : requiresAttention ? (
              <Button size="lg" onClick={() => onRequestCoordination(point)}>
                בקשת תיאום לנקודה זו
              </Button>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              מבוסס על שכבת מרחב אווירי מקורבת ועל נתוני OpenStreetMap — לא לניווט. האחריות לביצוע הטיסה על פי כל דין
              מוטלת על המטיס.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
