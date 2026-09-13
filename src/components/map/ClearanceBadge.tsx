import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SpatialCheckResult } from "@/lib/geo/spatial";
import { AIRSPACE_ZONE_LABELS } from "@/lib/constants/airspace-zones";

export function ClearanceBadge({ result }: { result: SpatialCheckResult | null }) {
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
          אישור מיידי — מרחב אווירי פנוי
        </Badge>
        <p className="text-xs text-muted-foreground">
          אין חפיפה עם אזורי מרחב אווירי מוגבלים. ניתן לטוס לאחר השלמת רשימת הבדיקה.
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
