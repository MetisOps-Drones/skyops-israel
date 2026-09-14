"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMyOrgContext, useMyGlobalRole } from "@/hooks/useOrgContext";
import {
  useEventBreakdown,
  useDailyActivity,
  useActiveUserCount,
  useTotalEventsTrend,
  useActiveUserTrend,
  type DateRange,
  type Trend,
} from "@/hooks/useAnalytics";

const EVENT_LABELS: Record<string, string> = {
  page_view: "צפייה במסך",
  "flight_request.draft": "בקשת טיסה נוצרה",
  "flight_request.pending_dispatcher": "בקשה הועברה לתיאום",
  "flight_request.notam_published": "נוטאם פורסם",
  "flight_request.rejected": "בקשה נדחתה",
  "flight_request.completed": "טיסה הושלמה",
  "membership.requested": "בקשת הצטרפות לארגון",
  "membership.active": "הצטרפות לארגון אושרה",
  "membership.rejected": "בקשת הצטרפות נדחתה",
  "membership.removed": "הוסר מהארגון",
  "equipment.checked_out": "ציוד נלקח",
  "equipment.returned": "ציוד הוחזר",
  "license.active": "רישיון הועלה",
  "license.expired": "רישיון פג תוקף",
};

function eventLabel(name: string) {
  return EVENT_LABELS[name] ?? name;
}

const RANGE_PRESETS = [
  { label: "7 ימים", days: 7 },
  { label: "30 ימים", days: 30 },
  { label: "90 ימים", days: 90 },
  { label: "חצי שנה", days: 180 },
  { label: "שנה", days: 365 },
];

function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`);
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function TrendBadge({ trend }: { trend: Trend | undefined }) {
  if (!trend || trend.deltaPct === null) return null;
  const isUp = trend.deltaPct >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isUp ? "text-success" : "text-destructive"
      )}
      title={`בתקופה הקודמת: ${trend.previous}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(trend.deltaPct).toFixed(0)}% לעומת התקופה הקודמת
    </span>
  );
}

function StatCard({ label, value, trend }: { label: string; value: number | string; trend?: Trend }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        <TrendBadge trend={trend} />
      </CardContent>
    </Card>
  );
}

function DailyActivityChart({ orgId, range }: { orgId: string | null; range: DateRange }) {
  const { data = [], isLoading } = useDailyActivity(orgId, range);
  const chartData = useMemo(
    () => data.map((d) => ({ ...d, label: d.day.slice(5) })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>פעילות יומית</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען...</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.day ?? ""}
                formatter={(value) => [value ?? 0, "פעולות"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EventBreakdownTable({ orgId, range }: { orgId: string | null; range: DateRange }) {
  const { data = [], isLoading } = useEventBreakdown(orgId, range);
  const total = data.reduce((sum, e) => sum + e.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>פעולות לפי סוג</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {!isLoading && data.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין נתונים</p>}
        {data.map((e) => (
          <div key={e.event_name} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm">{eventLabel(e.event_name)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${total ? (e.count / total) * 100 : 0}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-end text-sm tabular-nums text-muted-foreground">{e.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RangePicker({
  days,
  onDaysChange,
  customRange,
  onCustomRangeChange,
}: {
  days: number;
  onDaysChange: (days: number) => void;
  customRange: { start: string; end: string } | null;
  onCustomRangeChange: (range: { start: string; end: string } | null) => void;
}) {
  const [showCustom, setShowCustom] = useState(Boolean(customRange));

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {RANGE_PRESETS.map((preset) => (
          <Button
            key={preset.days}
            size="sm"
            variant={!customRange && preset.days === days ? "default" : "outline"}
            onClick={() => {
              onDaysChange(preset.days);
              onCustomRangeChange(null);
              setShowCustom(false);
            }}
            className={cn(!customRange && preset.days === days && "pointer-events-none")}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={customRange ? "default" : "outline"}
          onClick={() => setShowCustom((v) => !v)}
        >
          טווח מותאם אישית
        </Button>
      </div>
      {showCustom && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">מתאריך</Label>
            <Input
              type="date"
              className="h-8 w-36"
              value={customRange?.start ?? ""}
              max={customRange?.end}
              onChange={(e) => onCustomRangeChange({ start: e.target.value, end: customRange?.end ?? e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">עד תאריך</Label>
            <Input
              type="date"
              className="h-8 w-36"
              value={customRange?.end ?? ""}
              min={customRange?.start}
              max={formatDateInput(new Date())}
              onChange={(e) => onCustomRangeChange({ start: customRange?.start ?? e.target.value, end: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsDashboard({ orgId, title }: { orgId: string | null; title: string }) {
  const [days, setDays] = useState(30);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);

  const range: DateRange = useMemo(() => {
    if (customRange?.start && customRange?.end) {
      return { start: startOfDay(customRange.start), end: endOfDay(customRange.end) };
    }
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { start, end };
  }, [days, customRange]);

  const { data: totalEventsTrend } = useTotalEventsTrend(orgId, range);
  const { data: activeUsersTrend } = useActiveUserTrend(orgId, range);
  const { data: breakdown = [] } = useEventBreakdown(orgId, range);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-end justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <RangePicker
          days={days}
          onDaysChange={setDays}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="פעולות סה״כ" value={totalEventsTrend?.current ?? 0} trend={totalEventsTrend} />
        <StatCard label="משתמשים פעילים" value={activeUsersTrend?.current ?? 0} trend={activeUsersTrend} />
        <StatCard label="סוגי פעולות" value={breakdown.length} />
      </div>
      <DailyActivityChart orgId={orgId} range={range} />
      <EventBreakdownTable orgId={orgId} range={range} />
    </div>
  );
}

export function AnalyticsPageClient() {
  const { data: globalRole } = useMyGlobalRole();
  const { data: ctx } = useMyOrgContext();

  if (globalRole === "dispatcher_admin") {
    return <AnalyticsDashboard orgId={null} title="כל הפלטפורמה — MetisOps" />;
  }

  if (ctx?.isFleetManager && ctx.orgId) {
    return <AnalyticsDashboard orgId={ctx.orgId} title={ctx.orgName ?? "הארגון שלי"} />;
  }

  return (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        אנליטיקס זמין למנהלי צי ולמוקדני תיאום. אם אתם מנהלים ארגון, ודאו שהוא מוגדר כארגון הפעיל שלכם ב&ldquo;הארגון שלי&rdquo;.
      </CardContent>
    </Card>
  );
}
