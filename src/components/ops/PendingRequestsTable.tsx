"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, PhoneCall, Search } from "lucide-react";
import {
  usePendingCoordinationRequests,
  useControlTowerFlightRequests,
  type FlightRequestWithRelations,
} from "@/hooks/useFlightRequests";
import { useCoordinationAuthorities } from "@/hooks/useCoordinationAuthorities";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";
import { FLIGHT_REQUEST_TYPE_LABELS } from "@/lib/constants/flight-request-type";
import { urgencyHours, urgencyTier, URGENCY_LABEL, URGENCY_BADGE_VARIANT } from "@/lib/coordination/urgency";
import { computeOverlapCounts, authoritiesNear } from "@/lib/coordination/queue-analysis";
import { cn } from "@/lib/utils";

type SortMode = "urgency" | "start_date";
type TypeFilter = "all" | FlightRequestWithRelations["request_type"];

export function PendingRequestsTable({
  onSelect,
}: {
  onSelect: (request: FlightRequestWithRelations) => void;
}) {
  const { data: requests = [], isLoading } = usePendingCoordinationRequests();
  // Same active/pending status set the overlap RPC itself checks against
  // (0055) — already fetched elsewhere for the map's own control-tower
  // layer, reused here so deconfliction is one shared computation instead
  // of a separate network round trip per row.
  const { data: allActive = [] } = useControlTowerFlightRequests(true);
  const { data: authorities = [] } = useCoordinationAuthorities();
  const [sortMode, setSortMode] = useState<SortMode>("urgency");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [needsCoordinationOnly, setNeedsCoordinationOnly] = useState(false);

  const overlapCounts = useMemo(() => computeOverlapCounts(allActive), [allActive]);

  const withComputed = useMemo(
    () =>
      requests.map((request) => {
        const centerPoint = request.center_point_geojson as unknown as GeoJSON.Point | null;
        const lng = centerPoint?.coordinates[0] ?? null;
        const lat = centerPoint?.coordinates[1] ?? null;
        const needsCoordination = lng !== null && lat !== null && authoritiesNear(lng, lat, authorities).length > 0;
        return { request, overlapCount: overlapCounts.get(request.id) ?? 0, needsCoordination };
      }),
    [requests, authorities, overlapCounts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withComputed.filter(({ request, needsCoordination }) => {
      if (q && !(request.profiles?.full_name ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && request.request_type !== typeFilter) return false;
      if (needsCoordinationOnly && !needsCoordination) return false;
      return true;
    });
  }, [withComputed, search, typeFilter, needsCoordinationOnly]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortMode === "urgency") {
      copy.sort((a, b) => urgencyHours(a.request) - urgencyHours(b.request));
    } else {
      copy.sort((a, b) => new Date(a.request.start_time).getTime() - new Date(b.request.start_time).getTime());
    }
    return copy;
  }, [filtered, sortMode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 basis-40">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם מטיס"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל סוגי הבקשה</SelectItem>
            <SelectItem value="basic_auto_100m">{FLIGHT_REQUEST_TYPE_LABELS.basic_auto_100m}</SelectItem>
            <SelectItem value="manual_notam_bubble">{FLIGHT_REQUEST_TYPE_LABELS.manual_notam_bubble}</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setNeedsCoordinationOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            needsCoordinationOnly ? "border-warning bg-warning/10 text-warning" : "border-input text-muted-foreground hover:bg-accent"
          )}
        >
          <PhoneCall className="h-3.5 w-3.5" />
          דורש תיאום חיצוני בלבד
        </button>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">מיון לפי דחיפות</SelectItem>
            <SelectItem value="start_date">מיון לפי תאריך התחלה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {sorted.length === requests.length ? `${requests.length} בקשות ממתינות לתיאום` : `${sorted.length} מתוך ${requests.length} בקשות ממתינות`}
      </p>

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
                {requests.length === 0 ? "אין בקשות ממתינות" : "אין בקשות תואמות לסינון"}
              </TableCell>
            </TableRow>
          )}
          {sorted.map(({ request, overlapCount, needsCoordination }) => {
            const tier = urgencyTier(urgencyHours(request));
            return (
              <TableRow key={request.id} className="cursor-pointer" onClick={() => onSelect(request)}>
                <TableCell>{request.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{FLIGHT_REQUEST_TYPE_LABELS[request.request_type]}</TableCell>
                <TableCell>{request.drones?.nickname ?? "—"}</TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(request.start_time), { addSuffix: true, locale: he })}
                </TableCell>
                <TableCell>
                  <Badge variant={URGENCY_BADGE_VARIANT[tier]}>{URGENCY_LABEL[tier]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{FLIGHT_REQUEST_STATUS_LABELS[request.status]}</Badge>
                    {overlapCount > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        חופפת ({overlapCount})
                      </Badge>
                    )}
                    {needsCoordination && (
                      <Badge variant="warning" className="gap-1">
                        <PhoneCall className="h-3 w-3" />
                        דורש תיאום חיצוני
                      </Badge>
                    )}
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
