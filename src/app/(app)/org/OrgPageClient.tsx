"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, X, Copy, Loader2, Building2, UserMinus, Plane, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import {
  useMyMemberships,
  usePendingMembershipRequests,
  useActiveOrgMembers,
  useJoinOrgByCode,
  useSwitchActiveOrg,
  useDecideMembership,
  useRemoveMember,
} from "@/hooks/useOrgMembership";

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  pending: { label: "ממתין לאישור", variant: "warning" },
  active: { label: "פעיל", variant: "success" },
  rejected: { label: "נדחה", variant: "destructive" },
  removed: { label: "הוסר", variant: "secondary" },
};

const ROLE_LABELS: Record<string, string> = {
  fleet_manager: "מנהל צי",
  pilot_pro: "מטיס קבלן",
  pilot_hobby: "מטיסן",
  dispatcher_admin: "מוקדן תיאום",
};

function JoinOrgCard() {
  const [code, setCode] = useState("");
  const joinOrg = useJoinOrgByCode();

  async function handleSubmit() {
    if (!code.trim()) return;
    try {
      const org = await joinOrg.mutateAsync(code.trim());
      toast.success(`בקשת ההצטרפות ל-${org.name} נשלחה, ותמתין לאישור מנהל הצי`);
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת הבקשה נכשלה");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>הצטרפות לארגון</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          קיבלתם קוד הזמנה מארגון? הזינו אותו כאן — הבקשה תישלח למנהל הצי לאישור.
        </p>
        <div className="flex gap-2">
          <Input
            dir="ltr"
            placeholder="ABCD1234"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="max-w-[200px]"
          />
          <Button onClick={handleSubmit} disabled={joinOrg.isPending || !code.trim()}>
            {joinOrg.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            שלח בקשה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MyMembershipsCard() {
  const { data: ctx } = useMyOrgContext();
  const { data: memberships = [], isLoading } = useMyMemberships();
  const switchOrg = useSwitchActiveOrg();

  async function handleSwitch(orgId: string) {
    try {
      await switchOrg.mutateAsync(orgId);
      toast.success("הארגון הפעיל עודכן");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "המעבר נכשל");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>החברויות שלי</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ארגון</TableHead>
              <TableHead>תפקיד</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && memberships.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  אינך משויך/ת לאף ארגון
                </TableCell>
              </TableRow>
            )}
            {memberships.map((m) => {
              const isActiveContext = ctx?.orgId === m.org_id;
              return (
                <TableRow key={`${m.org_id}-${m.user_id}`}>
                  <TableCell>{m.organizations?.name ?? "—"}</TableCell>
                  <TableCell>{m.role ? ROLE_LABELS[m.role] : "—"}</TableCell>
                  <TableCell>
                    {(() => {
                      const statusInfo = STATUS_LABELS[m.status] ?? { label: m.status, variant: "secondary" as const };
                      return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {m.status === "active" && !isActiveContext && (
                      <Button size="sm" variant="outline" onClick={() => handleSwitch(m.org_id)}>
                        הפוך לפעיל
                      </Button>
                    )}
                    {isActiveContext && <span className="text-xs text-muted-foreground">פעיל כרגע</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PendingRequestsCard({ orgId }: { orgId: string }) {
  const { data: requests = [], isLoading } = usePendingMembershipRequests(orgId);
  const decide = useDecideMembership();
  const [roleChoice, setRoleChoice] = useState<Record<string, string>>({});

  async function approve(orgId: string, userId: string) {
    const key = `${orgId}-${userId}`;
    const role = roleChoice[key] ?? "pilot_pro";
    try {
      await decide.mutateAsync({ org_id: orgId, user_id: userId, approve: true, role });
      toast.success("הבקשה אושרה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "האישור נכשל");
    }
  }

  async function reject(orgId: string, userId: string) {
    try {
      await decide.mutateAsync({ org_id: orgId, user_id: userId, approve: false });
      toast.success("הבקשה נדחתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הדחייה נכשלה");
    }
  }

  if (!isLoading && requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>בקשות הצטרפות ממתינות</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>תפקיד לאישור</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => {
              const key = `${req.org_id}-${req.user_id}`;
              return (
                <TableRow key={key}>
                  <TableCell>{req.profiles?.full_name ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-end">
                    {req.profiles?.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={roleChoice[key] ?? "pilot_pro"}
                      onValueChange={(v) => setRoleChoice((s) => ({ ...s, [key]: v }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pilot_pro">מטיס קבלן</SelectItem>
                        <SelectItem value="fleet_manager">מנהל צי</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="h-8 w-8" onClick={() => approve(req.org_id, req.user_id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => reject(req.org_id, req.user_id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RemoveMemberDialog({
  orgId,
  userId,
  memberName,
}: {
  orgId: string;
  userId: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const removeMember = useRemoveMember();

  async function handleConfirm() {
    try {
      await removeMember.mutateAsync({ org_id: orgId, user_id: userId });
      toast.success(`${memberName} הוסר/ה מהארגון`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההסרה נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setOpen(true)}>
        <UserMinus className="h-4 w-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הסרת {memberName} מהארגון</DialogTitle>
          <DialogDescription>
            הפעולה תבטל את הגישה שלו/ה לצי, לרישום הטיסות ולנתוני הארגון. ניתן לחבר אותו/ה מחדש בעתיד עם קוד ההזמנה.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={removeMember.isPending}>
            {removeMember.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            הסרה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveMembersCard({ orgId, myUserId }: { orgId: string; myUserId: string | null }) {
  const { data: members = [], isLoading } = useActiveOrgMembers(orgId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>חברי הארגון</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>תפקיד</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  אין חברים פעילים בארגון עדיין
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={`${m.org_id}-${m.user_id}`}>
                <TableCell>{m.profiles?.full_name ?? "—"}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {m.profiles?.phone ?? "—"}
                </TableCell>
                <TableCell>{m.role ? ROLE_LABELS[m.role] : "—"}</TableCell>
                <TableCell>
                  {m.user_id !== myUserId && (
                    <RemoveMemberDialog
                      orgId={m.org_id}
                      userId={m.user_id}
                      memberName={m.profiles?.full_name ?? "החבר/ה"}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ActiveOrgCard() {
  const { data: ctx, isLoading } = useMyOrgContext();

  function copyCode() {
    if (!ctx?.inviteCode) return;
    navigator.clipboard.writeText(ctx.inviteCode);
    toast.success("קוד ההזמנה הועתק");
  }

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          הארגון הפעיל שלי
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!ctx?.orgId ? (
          <p className="text-sm text-muted-foreground">אין לך כרגע ארגון פעיל — אתה פועל כלקוח פרטי.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              <span className="font-medium">{ctx.orgName}</span> · תפקידך: {ctx.orgRole ? ROLE_LABELS[ctx.orgRole] : "—"}
            </p>
            {ctx.isFleetManager && ctx.inviteCode && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">קוד הזמנה לשיתוף:</Label>
                <code dir="ltr" className="rounded bg-muted px-2 py-1 text-sm">
                  {ctx.inviteCode}
                </code>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyCode}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** This page only ever managed the team roster — fleet management (drones, maintenance, inventory) lives under the "יומן טיסות" bubble instead, a jump a fleet manager wouldn't guess from "הארגון שלי" alone. */
function FleetManagementLink() {
  return (
    <Link
      href="/logs"
      className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plane className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium">ניהול הצי</p>
        <p className="text-xs text-muted-foreground">כלי טיס, תחזוקה ומלאי — תחת &ldquo;יומן טיסות&rdquo;</p>
      </div>
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function OrgPageClient() {
  const { data: ctx } = useMyOrgContext();

  return (
    <div className="flex flex-col gap-4">
      <ActiveOrgCard />
      {ctx?.isFleetManager && ctx.orgId && <FleetManagementLink />}
      {ctx?.isFleetManager && ctx.orgId && <PendingRequestsCard orgId={ctx.orgId} />}
      {ctx?.isFleetManager && ctx.orgId && <ActiveMembersCard orgId={ctx.orgId} myUserId={ctx.userId} />}
      <JoinOrgCard />
      <MyMembershipsCard />
    </div>
  );
}
