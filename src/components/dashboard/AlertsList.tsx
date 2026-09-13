import { AlertTriangle, Ban, BatteryWarning, Wrench, FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface DashboardAlert {
  id: string;
  kind:
    | "license_expiring"
    | "license_expired"
    | "inspection_required"
    | "battery_wear"
    | "registration_expiring"
    | "registration_expired";
  title: string;
  description: string;
}

const ALERT_ICONS = {
  license_expiring: AlertTriangle,
  license_expired: Ban,
  inspection_required: Wrench,
  battery_wear: BatteryWarning,
  registration_expiring: FileWarning,
  registration_expired: Ban,
} as const;

const ALERT_TONE: Record<DashboardAlert["kind"], "warning" | "destructive"> = {
  license_expiring: "warning",
  license_expired: "destructive",
  inspection_required: "warning",
  battery_wear: "warning",
  registration_expiring: "warning",
  registration_expired: "destructive",
};

export function AlertsList({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>התראות פעילות</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {alerts.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">אין התראות פעילות כרגע 🎉</p>
        )}
        {alerts.map((alert) => {
          const Icon = ALERT_ICONS[alert.kind];
          const tone = ALERT_TONE[alert.kind];
          return (
            <div key={alert.id} className="flex items-start gap-3 rounded-lg border p-3">
              <Icon className={tone === "destructive" ? "h-5 w-5 text-destructive" : "h-5 w-5 text-warning"} />
              <div className="flex-1">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
              <Badge variant={tone}>{tone === "destructive" ? "דחוף" : "לתשומת לב"}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
