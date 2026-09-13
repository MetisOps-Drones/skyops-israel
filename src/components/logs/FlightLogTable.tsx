"use client";

import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFlightLogs, useShareFlightLog } from "@/hooks/useFlightLogs";

const SOURCE_LABELS: Record<string, string> = {
  manual: "ידני",
  dji_csv: "טלמטריית DJI",
  dji_txt: "טלמטריית DJI",
};

function ShareButton({ logId, shareToken }: { logId: string; shareToken: string | null }) {
  const share = useShareFlightLog();

  async function handleShare() {
    try {
      const token = shareToken ?? (await share.mutateAsync(logId));
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("קישור לשיתוף עם הלקוח הועתק");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "יצירת הקישור נכשלה");
    }
  }

  return (
    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleShare} disabled={share.isPending}>
      <Share2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function FlightLogTable() {
  const { data: logs = [], isLoading } = useFlightLogs();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>תאריך</TableHead>
          <TableHead>כלי טיס</TableHead>
          <TableHead>לקוח</TableHead>
          <TableHead>משך (דק׳)</TableHead>
          <TableHead>גובה מרבי</TableHead>
          <TableHead>מרחק מרבי</TableHead>
          <TableHead>מקור</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              טוען...
            </TableCell>
          </TableRow>
        )}
        {!isLoading && logs.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              אין רשומות טיסה
            </TableCell>
          </TableRow>
        )}
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{new Date(log.start_time).toLocaleDateString("he-IL")}</TableCell>
            <TableCell>{log.drones?.nickname ?? "—"}</TableCell>
            <TableCell>{log.clients?.name ?? log.client_name ?? "—"}</TableCell>
            <TableCell>{log.duration_minutes}</TableCell>
            <TableCell>{log.max_altitude_m ?? "—"}</TableCell>
            <TableCell>{log.max_distance_m ?? "—"}</TableCell>
            <TableCell>
              <Badge variant="outline">{SOURCE_LABELS[log.telemetry_source]}</Badge>
            </TableCell>
            <TableCell>
              <ShareButton logId={log.id} shareToken={log.share_token} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
