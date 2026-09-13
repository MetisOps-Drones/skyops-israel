import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";

const SOURCE_LABELS: Record<string, string> = {
  manual: "ידני",
  dji_csv: "טלמטריית DJI",
  dji_txt: "טלמטריית DJI",
};

/**
 * Public, unauthenticated client-facing flight report (F-02). Reached only
 * by knowing the random share token — deliberately outside the (app)
 * layout group so it renders with no sidebar, no nav, and no session
 * requirement. Uses the service-role client because an anonymous visitor
 * has no RLS-visible session; the token itself (looked up server-side, not
 * filtered client-side) is what scopes this to exactly one flight log.
 */
export default async function SharedFlightReportPage({ params }: { params: { token: string } }) {
  const supabase = createServiceRoleClient();

  const { data: log } = await supabase
    .from("flight_logs")
    .select("*, drones ( nickname, model, manufacturer )")
    .eq("share_token", params.token)
    .single();

  if (!log) {
    notFound();
  }

  const drone = log.drones as unknown as { nickname: string; model: string; manufacturer: string } | null;

  return (
    <div dir="rtl" className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-background p-6">
      <div>
        <p className="text-sm text-muted-foreground">דוח טיסה</p>
        <h1 className="text-2xl font-bold">{drone?.nickname ?? "כלי טיס"}</h1>
        <p className="text-sm text-muted-foreground">
          {drone?.manufacturer} {drone?.model}
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">תאריך</dt>
            <dd className="font-medium">{new Date(log.start_time).toLocaleDateString("he-IL")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">משך טיסה</dt>
            <dd className="font-medium">{log.duration_minutes} דקות</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">גובה מרבי</dt>
            <dd className="font-medium">{log.max_altitude_m ? `${log.max_altitude_m} מ׳` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">מרחק מרבי</dt>
            <dd className="font-medium">{log.max_distance_m ? `${log.max_distance_m} מ׳` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">מקור נתונים</dt>
            <dd className="font-medium">{SOURCE_LABELS[log.telemetry_source] ?? log.telemetry_source}</dd>
          </div>
        </dl>
      </div>

      {log.notes && (
        <div className="rounded-lg border p-4">
          <p className="mb-1 text-sm text-muted-foreground">הערות</p>
          <p className="text-sm">{log.notes}</p>
        </div>
      )}

      <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">הופק על ידי MetisOps</p>
    </div>
  );
}
