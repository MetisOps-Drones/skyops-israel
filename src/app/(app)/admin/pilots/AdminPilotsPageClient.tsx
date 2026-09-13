"use client";

import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVerifiablePilots, useSetPilotVerified } from "@/hooks/useAdminPilots";

export function AdminPilotsPageClient() {
  const { data: pilots = [], isLoading } = useVerifiablePilots();
  const setVerified = useSetPilotVerified();

  async function toggle(pilotId: string, verified: boolean) {
    try {
      await setVerified.mutateAsync({ pilot_id: pilotId, verified });
      toast.success(verified ? "המטיס/ה סומן/ה כמאומת/ת" : "האימות הוסר");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>תחום עיסוק</TableHead>
              <TableHead>פעיל במרקטפלייס</TableHead>
              <TableHead>סטטוס אימות</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && pilots.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  אין עדיין מטיסים עצמאיים רשומים
                </TableCell>
              </TableRow>
            )}
            {pilots.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {p.phone ?? "—"}
                </TableCell>
                <TableCell>{p.professional_category ?? "—"}</TableCell>
                <TableCell>
                  {p.freelance_available ? <Badge variant="success">כן</Badge> : <Badge variant="secondary">לא</Badge>}
                </TableCell>
                <TableCell>
                  {p.is_verified_pilot ? (
                    <Badge className="gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      מאומת
                    </Badge>
                  ) : (
                    <Badge variant="secondary">לא מאומת</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={p.is_verified_pilot ? "outline" : "default"}
                    onClick={() => toggle(p.id, !p.is_verified_pilot)}
                    disabled={setVerified.isPending}
                  >
                    {p.is_verified_pilot ? "הסרת אימות" : "אימות"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
