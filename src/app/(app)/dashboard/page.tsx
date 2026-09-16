import Link from "next/link";
import { PlaneTakeoff, ShieldAlert, Wrench, Clock, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { GreetingHero } from "@/components/dashboard/GreetingHero";
import { AlertsList, type DashboardAlert } from "@/components/dashboard/AlertsList";
import { LicenseUploadDialog } from "@/components/dashboard/LicenseUploadDialog";
import { IncomingContactRequestsCard } from "@/components/profile/IncomingContactRequestsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FLIGHT_REQUEST_TYPE_LABELS } from "@/lib/constants/flight-request-type";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";

/** "בשעה 14:05 בתאריך 16/09/26" — Israel-local regardless of where the server runs, matching greetingForIsraelHour below. */
function formatSubmittedAt(iso: string): string {
  const parts = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `בשעה ${get("hour")}:${get("minute")} בתאריך ${get("day")}/${get("month")}/${get("year")}`;
}

const LICENSE_STATUS_LABELS: Record<string, string> = {
  active: "בתוקף",
  expiring_soon: "עומד לפוג",
  expired: "פג תוקף",
};

/** Time-of-day greeting, read in Israel local time regardless of where the server runs. */
function greetingForIsraelHour(): string {
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(
        new Date()
      )
    ) % 24;
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [
    { data: profile },
    { data: licenses },
    { data: drones },
    { data: myRequests },
    { data: batteries },
    { count: orgMembershipCount },
    { count: todayCoordinationsCount },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
    supabase.from("pilot_licenses").select("*").eq("user_id", user.id).order("expires_at"),
    supabase.from("drones").select("*").eq("user_id", user.id),
    supabase
      .from("flight_requests")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending_dispatcher", "submitted_to_iaf", "auto_cleared"])
      .order("start_time"),
    supabase.from("batteries").select("*, drones!inner ( user_id )").eq("drones.user_id", user.id),
    supabase.from("organization_members").select("org_id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("flight_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
  ]);

  const needsFirstDrone = (drones?.length ?? 0) === 0 && (orgMembershipCount ?? 0) === 0;

  const now = new Date();
  const upcomingLicense = (licenses ?? []).find((license) => new Date(license.expires_at) >= now);
  const daysUntilLicenseRenewal = upcomingLicense
    ? Math.ceil((new Date(upcomingLicense.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const firstName = (profile?.full_name ?? "מטיס/ה").split(" ")[0] ?? "מטיס/ה";
  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const alerts: DashboardAlert[] = [];

  for (const license of licenses ?? []) {
    if (license.status === "expired") {
      alerts.push({
        id: `license-${license.id}`,
        kind: "license_expired",
        title: `רישיון ${license.license_type} פג תוקף`,
        description: `תאריך תפוגה: ${new Date(license.expires_at).toLocaleDateString("he-IL")}`,
      });
    } else if (license.status === "expiring_soon") {
      alerts.push({
        id: `license-${license.id}`,
        kind: "license_expiring",
        title: `רישיון ${license.license_type} עומד לפוג`,
        description: `תאריך תפוגה: ${new Date(license.expires_at).toLocaleDateString("he-IL")}`,
      });
    }
  }

  for (const drone of drones ?? []) {
    if (drone.status === "maintenance_required") {
      alerts.push({
        id: `drone-${drone.id}`,
        kind: "inspection_required",
        title: `${drone.nickname}: נדרש טיפול תקופתי`,
        description: `סה״כ שעות טיסה: ${Math.round((drone.total_flight_minutes / 60) * 10) / 10} שעות`,
      });
    }
    if (drone.registration_status === "expired" || drone.registration_status === "expiring_soon") {
      alerts.push({
        id: `drone-registration-${drone.id}`,
        kind: drone.registration_status === "expired" ? "registration_expired" : "registration_expiring",
        title:
          drone.registration_status === "expired"
            ? `${drone.nickname}: רישום CAAI פג תוקף`
            : `${drone.nickname}: רישום CAAI עומד לפוג`,
        description: drone.registration_expires_at
          ? `תוקף רישום: ${new Date(drone.registration_expires_at).toLocaleDateString("he-IL")}`
          : "יש לחדש את הרישום",
      });
    }
  }

  for (const battery of batteries ?? []) {
    if (battery.health_status === "replace_soon" || battery.health_status === "condemned") {
      alerts.push({
        id: `battery-${battery.id}`,
        kind: "battery_wear",
        title: `סוללה ${battery.serial_number}: ${battery.cycle_count} מחזורי טעינה`,
        description: battery.health_status === "condemned" ? "מומלץ להוציא משימוש מיידית" : "מומלץ להחליף בקרוב",
      });
    }
  }

  const totalFlightHours =
    (drones ?? []).reduce((sum, d) => sum + d.total_flight_minutes, 0) / 60;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <GreetingHero
        greeting={greetingForIsraelHour()}
        firstName={firstName}
        formattedDate={formattedDate}
        todayCoordinationsCount={todayCoordinationsCount ?? 0}
        daysUntilLicenseRenewal={daysUntilLicenseRenewal}
      />

      {profile?.role === "pilot_pro" && <IncomingContactRequestsCard />}

      {needsFirstDrone && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Plane className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold">עדיין לא רשמת רחפן</p>
              <p className="text-sm text-muted-foreground">יש לרשום לפחות רחפן אחד כדי שתוכל/י לתאם טיסות.</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/profile">רישום רחפן</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="כלי טיס פעילים" value={drones?.length ?? 0} icon={PlaneTakeoff} />
        <StatCard label="שעות טיסה מצטברות" value={Math.round(totalFlightHours * 10) / 10} icon={Clock} />
        <StatCard
          label="בקשות ממתינות"
          value={myRequests?.length ?? 0}
          icon={ShieldAlert}
          tone={myRequests && myRequests.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="התראות פעילות"
          value={alerts.length}
          icon={Wrench}
          tone={alerts.length > 0 ? "destructive" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>מעקב בקשות תיאום</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>סוג בקשה</TableHead>
                <TableHead>מועד שליחה</TableHead>
                <TableHead>סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(myRequests ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    אין כרגע בקשות תיאום פתוחות
                  </TableCell>
                </TableRow>
              )}
              {(myRequests ?? []).map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{FLIGHT_REQUEST_TYPE_LABELS[request.request_type]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatSubmittedAt(request.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{FLIGHT_REQUEST_STATUS_LABELS[request.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AlertsList alerts={alerts} />

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>רישיונות</CardTitle>
            <LicenseUploadDialog />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>סוג</TableHead>
                  <TableHead>מספר</TableHead>
                  <TableHead>תוקף</TableHead>
                  <TableHead>סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(licenses ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      טרם הועלו רישיונות
                    </TableCell>
                  </TableRow>
                )}
                {(licenses ?? []).map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>{license.license_type}</TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {license.license_number}
                    </TableCell>
                    <TableCell>{new Date(license.expires_at).toLocaleDateString("he-IL")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          license.status === "expired"
                            ? "destructive"
                            : license.status === "expiring_soon"
                              ? "warning"
                              : "success"
                        }
                      >
                        {LICENSE_STATUS_LABELS[license.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
