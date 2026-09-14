"use client";

import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRenewDroneRegistration } from "@/hooks/useDrones";

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  active: "רישום בתוקף",
  expiring_soon: "רישום עומד לפוג",
  expired: "רישום פג תוקף",
};

/**
 * CAAI drone-registration validity (4 years, renewable) — shared between the
 * personal drone card (ProfilePageClient) and the fleet table (DroneFleetTable)
 * so the renew action and status wording stay in one place.
 */
export function DroneRegistrationBadge({
  status,
  expiresAt,
  droneId,
}: {
  status: string;
  expiresAt: string | null;
  droneId: string;
}) {
  const renew = useRenewDroneRegistration();

  if (!expiresAt) return null;

  async function handleRenew() {
    try {
      const newExpiry = await renew.mutateAsync({ droneId, currentExpiresAt: expiresAt });
      toast.success(`הרישום חודש עד ${new Date(newExpiry).toLocaleDateString("he-IL")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "חידוש הרישום נכשל");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant={status === "expired" ? "destructive" : status === "expiring_soon" ? "warning" : "secondary"}
        title={`בתוקף עד ${new Date(expiresAt).toLocaleDateString("he-IL")} — מבוסס על התאריך שהוזן, לא אימות ממשלתי מקוון (הדגמה)`}
      >
        {REGISTRATION_STATUS_LABELS[status] ?? status}
      </Badge>
      {status !== "active" && (
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleRenew} disabled={renew.isPending}>
          {renew.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
