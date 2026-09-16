"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import {
  usePendingCoordinationRequests,
  useOverlappingFlightRequests,
  type FlightRequestWithRelations,
} from "@/hooks/useFlightRequests";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";

type SortMode = "urgency" | "start_date";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  basic_auto_100m: "טיסה בסיסית",
  manual_notam_bubble: "בועת NOTAM",
};

function urgencyHours(request: FlightRequestWithRelations): number {
  return (new Date(request.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
}

/** Per-row deconfliction glance — a small badge so a dispatcher doesn't have to open every request just to find the ones that overlap another pilot's. */
function OverlapBadge({ requestId }: { requestId: string }) {
  const { data: overlaps = [] } = useOverlappingFlightRequests(requestId);
  if (overlaps.length === 0) return null;
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      חופפת ({overlaps.length})
    </Badge>
  );
}

export function PendingRequestsTable({
  onSelect,
}: {
  onSelect: (request: FlightRequestWithRelations) => void;
}) {
  const { data: requests = [], isLoading } = usePendingCoordinationRequests();
  const [sortMode, setSortMode] = useState<SortMode>("urgency");

  const sorted = useMemo(() => {
    const copy = [...requests];
    if (sortMode === "urgency") {
      copy.sort((a, b) => urgencyHours(a) - urgencyHours(b));
    } else {
      copy.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return copy;
  }, [requests, sortMode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{requests.length} בקשות ממתינות לתיאום</p>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">מיון לפי דחיפות</SelectItem>
            <SelectItem value="start_date">מיון לפי תאריך התחלה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>מטיס</TableHead>
            <TableHead>סוג בקשה</TableHead>
            <TableHead>כלי טיס</TableHead>
            <TableHead>תחילת חלון טיסה</TableHead>
            <TableHead>דחיפות</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                טוען...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                אין בקשות ממתינות
              </TableCell>
            </TableRow>
          )}
          {sorted.map((request) => {
            const hoursLeft = urgencyHours(request);
            return (
              <TableRow key={request.id} className="cursor-pointer" onClick={() => onSelect(request)}>
                <TableCell>{request.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{REQUEST_TYPE_LABELS[request.request_type]}</TableCell>
                <TableCell>{request.drones?.nickname ?? "—"}</TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(request.start_time), { addSuffix: true, locale: he })}
                </TableCell>
                <TableCell>
                  <Badge variant={hoursLeft < 24 ? "destructive" : hoursLeft < 72 ? "warning" : "secondary"}>
                    {hoursLeft < 24 ? "דחוף" : hoursLeft < 72 ? "השבוע" : "רגיל"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{FLIGHT_REQUEST_STATUS_LABELS[request.status]}</Badge>
                    <OverlapBadge requestId={request.id} />
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => onSelect(request)}>
                    פתח
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
