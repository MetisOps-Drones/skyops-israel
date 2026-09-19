"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Link2, Link2Off, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoModeNotice } from "@/components/shared/DemoModeNotice";
import { useDronePlatformConnections, useInvalidateDronePlatformConnections } from "@/hooks/useDronePlatformSync";
import { connectDronePlatform, disconnectDronePlatform, syncDronePlatformFlights } from "@/actions/drone-platform-sync";
import type { Tables } from "@/lib/types/database.types";

type DronePlatform = Tables<"drone_platform_connections">["platform"];

const PLATFORM_LABELS: Record<DronePlatform, string> = { dji: "DJI", autel: "Autel" };

function PlatformCard({ platform, connection }: { platform: DronePlatform; connection: Tables<"drone_platform_connections"> | undefined }) {
  const invalidate = useInvalidateDronePlatformConnections();
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | "sync" | null>(null);

  const isConnected = connection?.status === "connected";

  function handleConnect() {
    setBusyAction("connect");
    startTransition(async () => {
      const result = await connectDronePlatform(platform);
      if (!result.success) {
        toast.error(result.error ?? "החיבור נכשל");
      } else {
        toast.success(result.simulated ? `${PLATFORM_LABELS[platform]} חובר (מצב הדגמה)` : `${PLATFORM_LABELS[platform]} חובר`);
        invalidate();
      }
      setBusyAction(null);
    });
  }

  function handleDisconnect() {
    setBusyAction("disconnect");
    startTransition(async () => {
      const result = await disconnectDronePlatform(platform);
      if (!result.success) {
        toast.error(result.error ?? "הניתוק נכשל");
      } else {
        toast.success(`${PLATFORM_LABELS[platform]} נותק`);
        invalidate();
      }
      setBusyAction(null);
    });
  }

  function handleSync() {
    setBusyAction("sync");
    startTransition(async () => {
      const result = await syncDronePlatformFlights(platform);
      if (!result.success) {
        toast.error(result.error ?? "הסנכרון נכשל");
      } else {
        toast.success(
          result.simulated
            ? `יובאו ${result.importedCount} טיסות לדוגמה (מצב הדגמה — טרם חובר חשבון ${PLATFORM_LABELS[platform]} אמיתי)`
            : `יובאו ${result.importedCount} טיסות`
        );
        invalidate();
      }
      setBusyAction(null);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{PLATFORM_LABELS[platform]}</CardTitle>
        {isConnected ? (
          <Badge variant="success">מחובר</Badge>
        ) : (
          <Badge variant="outline">לא מחובר</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isConnected ? (
          <>
            <p className="text-xs text-muted-foreground">{connection?.account_label}</p>
            <p className="text-xs text-muted-foreground">
              {connection?.last_synced_at
                ? `סונכרן לאחרונה: ${new Date(connection.last_synced_at).toLocaleString("he-IL")}`
                : "טרם סונכרן"}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSync} disabled={pending}>
                {pending && busyAction === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                סנכרן עכשיו
              </Button>
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={pending}>
                {pending && busyAction === "disconnect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />}
                ניתוק
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={pending}>
            {pending && busyAction === "connect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            חיבור חשבון {PLATFORM_LABELS[platform]}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * DJI/Autel don't offer a self-service public API for an individual pilot's
 * flight-log data (DJI's real path is an enterprise developer program;
 * Autel has no public consumer API at all) — see migration
 * 0079_drone_platform_sync.sql. So every sync here runs in simulated mode,
 * clearly labeled, generating realistic sample flights instead of silently
 * pretending to be a real connection.
 */
export function DronePlatformSyncPanel() {
  const { data: connections = [], isLoading } = useDronePlatformConnections();
  const dji = connections.find((c) => c.platform === "dji");
  const autel = connections.find((c) => c.platform === "autel");

  return (
    <div className="flex flex-col gap-3">
      <DemoModeNotice>
        חיבור DJI/Autel אמיתי דורש אישור יזם עסקי מהיצרן ואינו זמין להרשמה עצמית. עד לקבלת אישור, הסנכרון פועל במצב
        הדגמה — כל טיסה שתיובא מסומנת ככזו ואינה טיסה אמיתית.
      </DemoModeNotice>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlatformCard platform="dji" connection={dji} />
          <PlatformCard platform="autel" connection={autel} />
        </div>
      )}
    </div>
  );
}
