"use client";

import { useMemo, useState } from "react";
import { FileDown, Search, Building2, Users, BadgeCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminOrganizations, useAdminUsers, useAdminQuotaOverrides } from "@/hooks/useAdminPlatform";
import { downloadCsv } from "@/lib/csv";
import { AdminUserPlanDialog } from "./AdminUserPlanDialog";

const ROLE_LABELS: Record<string, string> = {
  fleet_manager: "מנהל צי",
  pilot_pro: "לקוח פרטי עסקי",
  pilot_hobby: "לקוח פרטי",
  dispatcher_admin: "מוקדן תיאום",
};

function OrganizationsTab() {
  const [search, setSearch] = useState("");
  const { data: orgs = [], isLoading } = useAdminOrganizations(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? orgs.filter((o) => o.name.toLowerCase().includes(q)) : orgs;
  }, [orgs, search]);

  function handleExport() {
    downloadCsv(
      `metisops-organizations-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((o) => ({
        שם: o.name,
        "חברים פעילים": o.member_count,
        "כלי טיס": o.drone_count,
        "תיאומים (30 יום)": o.flight_request_count_30d,
        "נוצר בתאריך": new Date(o.created_at).toLocaleDateString("he-IL"),
      }))
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש ארגון לפי שם"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
          <FileDown className="h-4 w-4" />
          ייצוא CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ארגון</TableHead>
            <TableHead>חברים פעילים</TableHead>
            <TableHead>כלי טיס</TableHead>
            <TableHead>תיאומים (30 יום)</TableHead>
            <TableHead>נוצר בתאריך</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                טוען...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                אין ארגונים תואמים
              </TableCell>
            </TableRow>
          )}
          {filtered.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium">{o.name}</TableCell>
              <TableCell>{o.member_count}</TableCell>
              <TableCell>{o.drone_count}</TableCell>
              <TableCell>{o.flight_request_count_30d}</TableCell>
              <TableCell>{new Date(o.created_at).toLocaleDateString("he-IL")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading } = useAdminUsers(true);
  const { data: overrides = [] } = useAdminQuotaOverrides(true);
  const overrideByUserId = useMemo(() => new Map(overrides.map((o) => [o.user_id, o])), [overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q) ||
        (u.organizations?.name ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  function handleExport() {
    downloadCsv(
      `metisops-users-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((u) => ({
        שם: u.full_name,
        תפקיד: ROLE_LABELS[u.role] ?? u.role,
        ארגון: u.organizations?.name ?? "",
        טלפון: u.phone ?? "",
        תוכנית: u.plan_code ?? "",
        "פעיל במרקטפלייס": u.freelance_available ? "כן" : "לא",
        "מטיס מאומת": u.is_verified_pilot ? "כן" : "לא",
        "נוצר בתאריך": new Date(u.created_at).toLocaleDateString("he-IL"),
      }))
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, טלפון או ארגון"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
          <FileDown className="h-4 w-4" />
          ייצוא CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>שם</TableHead>
            <TableHead>תפקיד</TableHead>
            <TableHead>ארגון</TableHead>
            <TableHead>טלפון</TableHead>
            <TableHead>תוכנית</TableHead>
            <TableHead>נוצר בתאריך</TableHead>
            <TableHead></TableHead>
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
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                אין משתמשים תואמים
              </TableCell>
            </TableRow>
          )}
          {filtered.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {u.full_name}
                  {u.is_verified_pilot && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="מטיס מאומת" />}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
              </TableCell>
              <TableCell>{u.organizations?.name ?? "—"}</TableCell>
              <TableCell dir="ltr" className="text-end">
                {u.phone ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {u.plan_code ?? "—"}
                  {overrideByUserId.has(u.id) && (
                    <Badge variant="outline" className="text-xs">
                      מכסה מותאמת
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{new Date(u.created_at).toLocaleDateString("he-IL")}</TableCell>
              <TableCell>
                <AdminUserPlanDialog user={u} override={overrideByUserId.get(u.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminPlatformPageClient() {
  return (
    <Tabs defaultValue="organizations" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="organizations" className="gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          כל הארגונים
        </TabsTrigger>
        <TabsTrigger value="users" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          כל המשתמשים
        </TabsTrigger>
      </TabsList>
      <TabsContent value="organizations">
        <OrganizationsTab />
      </TabsContent>
      <TabsContent value="users">
        <UsersTab />
      </TabsContent>
    </Tabs>
  );
}
