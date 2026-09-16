"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyFlightRequests } from "@/hooks/useFlightRequests";
import { FLIGHT_REQUEST_TYPE_LABELS } from "@/lib/constants/flight-request-type";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";

const OPEN_STATUSES = new Set(["pending_dispatcher", "submitted_to_iaf", "auto_cleared"]);

/** "בשעה 14:05 בתאריך 16/09/26" — Israel-local regardless of where the browser/server runs. */
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

/**
 * Client component (not server-fetched like the rest of /dashboard) so it
 * can poll — matches the 30s cadence already used on the dispatcher's
 * /ops queue, so a status change (approved, rejected, NOTAM published)
 * shows up here without the pilot having to reload the page.
 */
export function MyCoordinationRequestsCard() {
  const { data: requests = [], isLoading } = useMyFlightRequests();

  const openRequests = useMemo(() => requests.filter((r) => OPEN_STATUSES.has(r.status)), [requests]);

  return (
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
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && openRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  אין כרגע בקשות תיאום פתוחות
                </TableCell>
              </TableRow>
            )}
            {openRequests.map((request) => (
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
  );
}
