"use client";

import Link from "next/link";
import { MessageSquare, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminBookingsOverview, useAdminRecurringChatPhrases, useAdminAllBookings } from "@/hooks/useAdminMarketplace";
import { BOOKING_STATUS_LABEL as STATUS_LABEL, BOOKING_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/constants/booking-status";

function OverviewCards() {
  const { data: overview = [] } = useAdminBookingsOverview();
  const total = overview.reduce((sum, s) => sum + Number(s.booking_count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendingUp className="h-4 w-4" />
          </span>
          משפך הזמנות עבודה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">סה״כ</p>
          </div>
          {overview.map((s) => (
            <div key={s.status} className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{s.booking_count}</p>
              <Badge variant={STATUS_VARIANT[s.status]} className="mt-1">
                {STATUS_LABEL[s.status]}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecurringPhrasesCard() {
  const { data: phrases = [], isLoading, isError } = useAdminRecurringChatPhrases();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </span>
          בעיות חוזרות בשיחות
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          רצפי מילים שחוזרים בשיחות רבות ושונות — לא ניתוח LLM, ספירת מופעים בין שיחות. מתעדכן פעם ביום.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {isError && <p className="text-sm text-destructive">טעינת הנתונים נכשלה — נסו לרענן את הדף.</p>}
        {!isLoading && !isError && phrases.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עדיין תבניות חוזרות משמעותיות.</p>
        )}
        <div className="flex flex-col gap-2">
          {phrases.map((p) => (
            <div key={`${p.phrase_length}-${p.phrase}`} className="flex items-center justify-between rounded-lg border p-2.5">
              <span className="text-sm font-medium">&ldquo;{p.phrase}&rdquo;</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{p.conversation_count} שיחות</span>
                <span>{p.occurrence_count} מופעים</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AllBookingsTable() {
  const { data: bookings = [], isLoading, isError } = useAdminAllBookings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>כל ההזמנות</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>עבודה</TableHead>
              <TableHead>ארגון</TableHead>
              <TableHead>מטיס/ה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead></TableHead>
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
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive">
                  טעינת ההזמנות נכשלה — נסו לרענן את הדף.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  אין עדיין הזמנות עבודה בפלטפורמה
                </TableCell>
              </TableRow>
            )}
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.org_name ?? "—"}</TableCell>
                <TableCell>{b.pilot_full_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[b.status]} className="max-w-[110px] truncate" title={STATUS_LABEL[b.status]}>
                    {STATUS_LABEL[b.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {b.status !== "invited" && b.status !== "declined" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/marketplace/bookings/${b.id}`}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        צפייה בצ׳אט
                      </Link>
                    </Button>
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

export function AdminMarketplacePageClient() {
  return (
    <div className="flex flex-col gap-4">
      <OverviewCards />
      <RecurringPhrasesCard />
      <AllBookingsTable />
    </div>
  );
}
