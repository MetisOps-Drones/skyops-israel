"use client";

import { CheckCircle2, XCircle, Undo2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useRecentlyDecidedFlightRequests, type FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import { cn } from "@/lib/utils";

const STATUS_ICON = { notam_published: CheckCircle2, rejected: XCircle, cancelled: Undo2 } as const;
const STATUS_LABEL: Record<string, string> = {
  notam_published: "פורסם NOTAM",
  rejected: "נדחתה",
  cancelled: "בוטל",
};
const STATUS_COLOR: Record<string, string> = {
  notam_published: "text-success",
  rejected: "text-destructive",
  cancelled: "text-warning",
};

/**
 * The only way to reach an already-decided request again from /ops — the
 * queue view (map + table) only ever shows pending ones. Needed so an
 * already-published NOTAM is actually reachable to cancel (see
 * cancelNotam), and doubles as a quick "what did I just do" reference.
 * Collapsed by default: this is a secondary, occasional-use path, not
 * something that should compete for attention with the live queue above it.
 */
export function RecentlyDecidedList({ onSelect }: { onSelect: (request: FlightRequestWithRelations) => void }) {
  const [open, setOpen] = useState(false);
  const { data: requests = [] } = useRecentlyDecidedFlightRequests();

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 text-sm font-semibold"
      >
        הוחלט לאחרונה ({requests.length})
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-1">
          {requests.length === 0 && <p className="text-xs text-muted-foreground">אין עדיין החלטות רשומות</p>}
          {requests.map((r) => {
            const Icon = STATUS_ICON[r.status as keyof typeof STATUS_ICON] ?? CheckCircle2;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r)}
                className="flex items-center gap-2 rounded-md p-1.5 text-start text-xs transition-colors hover:bg-accent"
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_COLOR[r.status] ?? "text-muted-foreground")} />
                <span className="flex-1 truncate">{r.profiles?.full_name ?? "—"}</span>
                <span className="shrink-0 text-muted-foreground">{STATUS_LABEL[r.status] ?? r.status}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
