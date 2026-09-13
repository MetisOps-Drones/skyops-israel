"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Disclosure } from "@/components/ui/disclosure";
import { useFlightLogs, type FlightLogWithDrone } from "@/hooks/useFlightLogs";

function money(n: number) {
  return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

interface ClientGroup {
  key: string;
  name: string;
  revenue: number;
  cost: number;
  jobs: FlightLogWithDrone[];
}

export function ProfitabilityPanel() {
  const { data: logs = [], isLoading } = useFlightLogs();

  const priced = logs.filter((l) => l.price !== null || l.cost !== null);
  const totalRevenue = priced.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const totalCost = priced.reduce((sum, l) => sum + (l.cost ?? 0), 0);
  const totalMargin = totalRevenue - totalCost;

  const byClient = new Map<string, ClientGroup>();
  for (const l of priced) {
    // A linked client is grouped by its stable id even if renamed later; an unlinked legacy row
    // still falls back to grouping by the raw string it was typed as.
    const key = l.client_id ?? `name:${l.client_name?.trim() || "ללא לקוח משויך"}`;
    const name = l.clients?.name ?? l.client_name?.trim() ?? "ללא לקוח משויך";
    const entry = byClient.get(key) ?? { key, name, revenue: 0, cost: 0, jobs: [] };
    entry.revenue += l.price ?? 0;
    entry.cost += l.cost ?? 0;
    entry.jobs.push(l);
    byClient.set(key, entry);
  }
  const clientGroups = Array.from(byClient.values()).sort(
    (a, b) => b.revenue - b.cost - (a.revenue - a.cost)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold tabular-nums">{money(totalRevenue)}</p>
            <p className="text-sm text-muted-foreground">הכנסות</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold tabular-nums">{money(totalCost)}</p>
            <p className="text-sm text-muted-foreground">עלויות</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className={`text-2xl font-bold tabular-nums ${totalMargin >= 0 ? "text-success" : "text-destructive"}`}>
              {money(totalMargin)}
            </p>
            <p className="text-sm text-muted-foreground">רווח</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>רווחיות לפי לקוח</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
          {!isLoading && clientGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">אין עדיין רשומות עם מחיר או עלות</p>
          )}
          {clientGroups.map((group) => (
            <Disclosure
              key={group.key}
              label={
                <div className="grid flex-1 grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 text-sm min-w-0">
                  <span className="truncate text-start font-medium text-foreground">{group.name}</span>
                  <span className="text-muted-foreground">{group.jobs.length} עבודות</span>
                  <span className="tabular-nums text-muted-foreground">{money(group.revenue)}</span>
                  <span className="tabular-nums text-muted-foreground">{money(group.cost)}</span>
                  <span
                    className={`tabular-nums font-medium ${
                      group.revenue - group.cost >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {money(group.revenue - group.cost)}
                  </span>
                </div>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>כלי טיס</TableHead>
                    <TableHead>הכנסה</TableHead>
                    <TableHead>עלות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.jobs
                    .slice()
                    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                    .map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{new Date(job.start_time).toLocaleDateString("he-IL")}</TableCell>
                        <TableCell>{job.drones?.nickname ?? "—"}</TableCell>
                        <TableCell>{job.price !== null ? money(job.price) : "—"}</TableCell>
                        <TableCell>{job.cost !== null ? money(job.cost) : "—"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Disclosure>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
