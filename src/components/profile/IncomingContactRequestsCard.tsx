"use client";

import { toast } from "sonner";
import { Check, X, MessageSquareHeart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyIncomingContactRequests, useDecideContactRequest } from "@/hooks/useMarketplace";

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  pending: { label: "ממתין לתשובה", variant: "warning" },
  accepted: { label: "אושרה", variant: "success" },
  declined: { label: "נדחתה", variant: "destructive" },
};

export function IncomingContactRequestsCard() {
  const { data: requests = [], isLoading } = useMyIncomingContactRequests();
  const decide = useDecideContactRequest();

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending").slice(0, 5);

  async function respond(id: string, accept: boolean) {
    try {
      await decide.mutateAsync({ id, accept });
      toast.success(accept ? "הבקשה אושרה — פרטי הקשר שלכם נחשפו לארגון" : "הבקשה נדחתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  if (!isLoading && requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquareHeart className="h-4 w-4" />
          </span>
          בקשות יצירת קשר מהמרקטפלייס
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {pending.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{r.organizations?.name ?? "ארגון"}</p>
              <Badge variant="warning">ממתין לתשובה</Badge>
            </div>
            {r.message && <p className="text-sm text-muted-foreground">{r.message}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => respond(r.id, true)} disabled={decide.isPending}>
                <Check className="h-4 w-4" />
                אישור
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(r.id, false)} disabled={decide.isPending}>
                <X className="h-4 w-4" />
                דחייה
              </Button>
            </div>
          </div>
        ))}
        {decided.map((r) => {
          const info = STATUS_LABELS[r.status] ?? { label: r.status, variant: "warning" as const };
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{r.organizations?.name ?? "ארגון"}</span>
              <Badge variant={info.variant}>{info.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
