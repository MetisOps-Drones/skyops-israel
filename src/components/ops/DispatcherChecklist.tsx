"use client";

import { CheckCircle2, AlertTriangle, XCircle, Circle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import type { OverlappingFlightRequest } from "@/hooks/useFlightRequests";
import { usePilotLicensesForDispatcher, useHasValidInsuranceForDispatcher } from "@/hooks/useLicenses";
import { useFlightRequestCoordination } from "@/hooks/useCoordinationAuthorities";
import { resolveLicenseRequirement } from "@/lib/validations/flight-request-requirements";
import type { FlightAuthorizationCheck } from "@/lib/geo/flight-rules";
import type { LiveNotamOverlapCheck } from "@/lib/geo/live-notams";

type ItemStatus = "ok" | "warning" | "blocked" | "pending" | "not_applicable";

interface ChecklistItem {
  key: string;
  label: string;
  status: ItemStatus;
  detail?: string;
}

const STATUS_ICON: Record<ItemStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  blocked: XCircle,
  pending: Circle,
  not_applicable: MinusCircle,
};

const STATUS_CLASS: Record<ItemStatus, string> = {
  ok: "text-success",
  warning: "text-warning",
  blocked: "text-destructive",
  pending: "text-muted-foreground",
  not_applicable: "text-muted-foreground",
};

/**
 * V1 draft of a per-request "what the dispatcher needs to do" checklist —
 * explicitly a starting point to be refined together with Ohad
 * (real-world contact channels per authority, exact step wording, whether
 * some steps should be dispatcher-editable rather than fully derived),
 * not a finished spec. Every item here is *computed* from data the drawer
 * already loads rather than its own persisted checked/unchecked state, on
 * purpose: the actual source of truth for "is this done" already exists
 * (a valid license row, the coordination status, the request's own
 * status) — a separate checkbox that can drift out of sync with that
 * would be worse than no checklist at all. The one item without an
 * existing status to read (contacting the area authority) reads the same
 * coordination.status CoordinationPanel itself writes, so checking it off
 * there checks it off here too.
 */
export function DispatcherChecklist({
  request,
  overlaps,
  overlapsLoading,
  authCheck,
  notamCheck,
}: {
  request: FlightRequestWithRelations;
  overlaps: OverlappingFlightRequest[];
  overlapsLoading: boolean;
  authCheck: FlightAuthorizationCheck;
  notamCheck: LiveNotamOverlapCheck;
}) {
  const { data: licenses = [], isLoading: licensesLoading } = usePilotLicensesForDispatcher(request.user_id);
  const { data: hasValidInsurance, isLoading: insuranceLoading } = useHasValidInsuranceForDispatcher(request.user_id);
  const { data: coordination } = useFlightRequestCoordination(request.id);

  const droneMtow = request.drones?.mtow_grams ?? null;
  const licenseCheck =
    droneMtow !== null ? resolveLicenseRequirement(licenses, droneMtow, request.request_type) : null;

  const airspaceNeedsAttention = authCheck.reasons.length > 0 || notamCheck.inside;
  const decided = request.status === "notam_published" || request.status === "rejected";

  const items: ChecklistItem[] = [
    {
      key: "license",
      label: "רישיון טייס תואם למשקל כלי הטיס",
      status: licensesLoading || droneMtow === null ? "pending" : licenseCheck?.ok ? "ok" : "blocked",
      detail:
        !licensesLoading && droneMtow !== null && !licenseCheck?.ok
          ? "אין רישיון בתוקף שמכסה את משקל כלי הטיס הזה — הבקשה תיחסם בשרת אם תנסה לפרסם NOTAM."
          : undefined,
    },
    ...(licenseCheck?.needsInsurance
      ? [
          {
            key: "insurance",
            label: "ביטוח בתוקף (נדרש לרישיון מסחרי/כבד)",
            status: insuranceLoading ? "pending" : hasValidInsurance ? "ok" : "blocked",
          } satisfies ChecklistItem,
        ]
      : []),
    {
      key: "overlaps",
      label: "אין חפיפה עם בקשות אחרות באותו שטח וזמן",
      status: overlapsLoading ? "pending" : overlaps.length === 0 ? "ok" : "warning",
      detail: overlaps.length > 0 ? `חופפת עם ${overlaps.length} ${overlaps.length === 1 ? "בקשה" : "בקשות"} — פירוט בהמשך` : undefined,
    },
    {
      key: "airspace",
      label: "מרחב אווירי ונוטאמים פעילים נבדקו",
      status: airspaceNeedsAttention ? "warning" : "ok",
      detail: airspaceNeedsAttention ? 'יש חפיפה/קרבה שדורשת התייחסות — פירוט ב"מרחב אווירי בנקודה" בהמשך' : undefined,
    },
    {
      key: "coordination",
      label: "תיאום מול גורם אחראי לאזור",
      status: !airspaceNeedsAttention
        ? "not_applicable"
        : coordination?.status === "approved"
          ? "ok"
          : coordination?.status === "denied"
            ? "blocked"
            : "pending",
      detail: !airspaceNeedsAttention ? "לא נדרש — אין חפיפה עם מרחב מוגבל" : undefined,
    },
    {
      key: "decision",
      label: "החלטה סופית — פרסום NOTAM או דחייה",
      status: decided ? "ok" : "pending",
    },
  ];

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">סד״פ לבקשה זו (טיוטה — נעדכן יחד)</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = STATUS_ICON[item.status];
          return (
            <div key={item.key} className="flex items-start gap-2 text-sm">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_CLASS[item.status])} />
              <div>
                <p className={item.status === "not_applicable" ? "text-muted-foreground line-through" : undefined}>
                  {item.label}
                </p>
                {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
