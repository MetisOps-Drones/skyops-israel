"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Phone, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import {
  useCoordinationAuthorityLookup,
  useFlightRequestCoordination,
  useUpsertFlightRequestCoordination,
  type CoordinationAuthority,
} from "@/hooks/useCoordinationAuthorities";
import { buildCoordinationMessage, whatsAppLink } from "@/lib/coordination/message";
import { COORDINATION_STATUS_LABEL, COORDINATION_STATUS_VARIANT } from "@/lib/constants/coordination-status";
import type { CoordinationContactStatus } from "@/lib/types/database.types";

function AuthorityRow({ authority, message }: { authority: CoordinationAuthority; message: string }) {
  function handleCopy() {
    navigator.clipboard.writeText(message);
    toast.success("ההודעה הועתקה");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-semibold">
          {authority.name} <span className="text-xs font-normal text-muted-foreground">· {authority.unit_type}</span>
        </p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {authority.phone}
          {authority.backup_phone && <span className="text-xs">(גיבוי: {authority.backup_phone})</span>}
        </p>
        {authority.notes && <p className="text-xs text-muted-foreground">{authority.notes}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          העתקת הודעה
        </Button>
        <Button size="sm" asChild>
          <a href={whatsAppLink(authority.phone, message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            שליחה בוואטסאפ
          </a>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={`tel:${authority.phone}`}>
            <Phone className="h-3.5 w-3.5" />
            חיוג
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Admin-only ("מוקד תיאום" is already gated server-side to dispatcher_admin)
 * — never rendered anywhere an org/pilot can reach. Auto-identifies who to
 * coordinate with for this request's location (0072), lets the dispatcher
 * forward everything with one click instead of retyping it, and tracks the
 * *external* coordination's own status separately from the request's
 * CAAI-facing status/dispatcher_notes.
 */
export function CoordinationPanel({
  request,
  lng,
  lat,
  dmsCoordinates,
}: {
  request: FlightRequestWithRelations;
  lng: number;
  lat: number;
  dmsCoordinates: string;
}) {
  const { data: authorities = [], isLoading: authoritiesLoading } = useCoordinationAuthorityLookup(lng, lat);
  const { data: coordination } = useFlightRequestCoordination(request.id);
  const upsert = useUpsertFlightRequestCoordination();

  const [status, setStatus] = useState<CoordinationContactStatus>("not_started");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setStatus(coordination?.status ?? "not_started");
    setNotes(coordination?.notes ?? "");
  }, [coordination?.status, coordination?.notes, request.id]);

  const message = buildCoordinationMessage(request, dmsCoordinates);

  async function handleSave(newStatus: CoordinationContactStatus) {
    setStatus(newStatus);
    try {
      await upsert.mutateAsync({
        flight_request_id: request.id,
        authority_id: coordination?.authority_id ?? authorities[0]?.id ?? null,
        status: newStatus,
        notes: notes.trim() || null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "עדכון הסטטוס נכשל");
    }
  }

  async function handleSaveNotes() {
    try {
      await upsert.mutateAsync({
        flight_request_id: request.id,
        authority_id: coordination?.authority_id ?? authorities[0]?.id ?? null,
        status,
        notes: notes.trim() || null,
      });
      toast.success("ההערות נשמרו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-semibold">תיאום מול גורם חיצוני (פנימי — לא מוצג למטיס/לארגון)</p>

      {authoritiesLoading && <p className="text-sm text-muted-foreground">מזהה גורם אחראי...</p>}
      {!authoritiesLoading && authorities.length === 0 && (
        <p className="text-sm text-muted-foreground">
          לא נמצא גורם תיאום רשום לאזור זה — יש לבדוק ידנית מי אחראי, או להוסיף אותו לרשימת הגורמים למטה.
        </p>
      )}
      {authorities.map((a) => (
        <AuthorityRow key={a.id} authority={a} message={message} />
      ))}

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">סטטוס התיאום החיצוני</p>
          <Badge variant={COORDINATION_STATUS_VARIANT[status]}>{COORDINATION_STATUS_LABEL[status]}</Badge>
        </div>
        {coordination?.updated_at && (
          <p className="text-[11px] text-muted-foreground">
            עודכן לאחרונה{coordination.profiles?.full_name ? ` ע"י ${coordination.profiles.full_name}` : ""} ·{" "}
            {new Date(coordination.updated_at).toLocaleString("he-IL")}
          </p>
        )}
        <Select value={status} onValueChange={(v) => handleSave(v as CoordinationContactStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(COORDINATION_STATUS_LABEL) as [CoordinationContactStatus, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות מהשיחה עם הגורם..."
          rows={2}
        />
        <Button size="sm" variant="outline" className="self-start" onClick={handleSaveNotes} disabled={upsert.isPending}>
          {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          שמירת הערות
        </Button>
      </div>
    </div>
  );
}
