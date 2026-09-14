import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SpatialCheckResult } from "@/lib/geo/spatial";
import { AIRSPACE_ZONE_LABELS } from "@/lib/constants/airspace-zones";

export function ClearanceBadge({
  result,
  hasAdvisoryWarning = false,
}: {
  result: SpatialCheckResult | null;
  /**
   * True while the separate AIP-reference-layer check (a different, advisory
   * zone source — see LocationInfoCard/FlightParamsDrawer) is still loading
   * or has flagged something. This badge only reflects the authoritative
   * `airspace_zones` table, so on its own it can't promise "ניתן לטוס" while
   * that other check might still say otherwise a moment later.
   */
  hasAdvisoryWarning?: boolean;
}) {
  if (!result) {
    return (
      <Badge variant="outline" className="gap-1.5">
        ממתין לסימון בועת טיסה
      </Badge>
    );
  }

  if (result.clear) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="success" className="w-fit gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          אישור מיידי — פנוי מאזורי הבדיקה
        </Badge>
        <p className="text-xs text-muted-foreground">
          {hasAdvisoryWarning
            ? "אין חפיפה עם אזורי מרחב אווירי מוגבלים — יש להתייחס גם להתראה שמופיעה למטה לפני אישור."
            : "אין חפיפה עם אזורי מרחב אווירי מוגבלים (הדגמה). ניתן לטוס לאחר השלמת רשימת הבדיקה."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="destructive" className="w-fit gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        דורש תיאום תפעולי
      </Badge>
      <p className="text-xs text-muted-foreground">
        חפיפה עם: {result.intersectingZones.map((z) => AIRSPACE_ZONE_LABELS[z.type]).join(", ")}. הבקשה תועבר
        לתור המוקדן.
      </p>
    </div>
  );
}
