"use client";

import { CheckCircle2, XCircle, Undo2 } from "lucide-react";
import { useFlightRequestDecisions } from "@/hooks/useFlightRequests";
import { cn } from "@/lib/utils";

const ACTION_ICON = { published: CheckCircle2, rejected: XCircle, cancelled: Undo2 } as const;
const ACTION_LABEL: Record<string, string> = { published: "פורסם NOTAM", rejected: "בקשה נדחתה", cancelled: "NOTAM בוטל" };
const ACTION_COLOR: Record<string, string> = {
  published: "text-success",
  rejected: "text-destructive",
  cancelled: "text-warning",
};

/**
 * Every publish/reject/cancel a dispatcher has made on this request, oldest
 * first — the accountability trail a single "last touched" reviewed_by/
 * reviewed_at pair could never give (a request rejected, reconsidered, then
 * published shows only the final state today). See 0086 for why this is
 * its own append-only table rather than more columns on flight_requests.
 */
export function DecisionHistory({ requestId }: { requestId: string }) {
  const { data: decisions = [], isLoading } = useFlightRequestDecisions(requestId);
  if (isLoading || decisions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">היסטוריית החלטות</p>
      <div className="flex flex-col gap-2.5">
        {decisions.map((d) => {
          const Icon = ACTION_ICON[d.action as keyof typeof ACTION_ICON] ?? CheckCircle2;
          return (
            <div key={d.id} className="flex gap-2 text-xs">
              <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ACTION_COLOR[d.action] ?? "text-muted-foreground")} />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">
                  {ACTION_LABEL[d.action] ?? d.action}
                  {d.notam_code ? ` · ${d.notam_code}` : ""}
                  {d.profiles?.full_name ? ` — ${d.profiles.full_name}` : ""}
                </p>
                {d.notes && <p className="text-muted-foreground">{d.notes}</p>}
                <p className="text-muted-foreground" dir="ltr">
                  {new Date(d.decided_at).toLocaleString("he-IL")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
