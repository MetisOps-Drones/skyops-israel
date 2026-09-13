"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Plus, Loader2, FileWarning, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useSpecialAuthorizationTypes,
  useMySpecialAuthorizations,
  usePurchaseSpecialAuthorization,
} from "@/hooks/useSpecialAuthorizations";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "ממתין לתשלום",
  active: "מסומן כפעיל (הדגמה)",
  expired: "פג תוקף",
};

function PurchaseAuthorizationDialog() {
  const [open, setOpen] = useState(false);
  const { data: catalog = [], isLoading } = useSpecialAuthorizationTypes();
  const purchase = usePurchaseSpecialAuthorization();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  async function handlePurchase(id: string) {
    setPurchasingId(id);
    try {
      await purchase.mutateAsync(id);
      toast.success('נשמר במצב "הדגמה" — זה עדיין לא אישור רשמי, ראו הסבר למטה');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הרכישה נכשלה");
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" aria-label="הוספת הרשאה">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>רכישת הרשאת הפעלה מיוחדת</DialogTitle>
          <DialogDescription>המערכת עדיין לא מחוברת לתשלום ולהנפקה ממשלתית אמיתיים</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            זהו כרגע מעקב פנימי בלבד — "רכישה" שומרת שאתם מתכוונים להשתמש בהרשאה זו, אך <b>אינה</b> מנפיקה אישור רשמי
            ואינה שולחת דבר בפועל. יש להגיש בקשה אמיתית מול רת״א/שירות התשלומים הממשלתי בעצמכם עד שתחובר אינטגרציה
            מלאה.
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {!isLoading && catalog.length === 0 && (
          <p className="text-sm text-muted-foreground">אין כרגע סוגי הרשאות זמינים לרכישה — יתעדכן בהמשך.</p>
        )}
        <div className="flex flex-col gap-2">
          {catalog.map((type) => (
            <div key={type.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{type.name}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
              <Button
                size="sm"
                disabled={purchasingId === type.id}
                onClick={() => handlePurchase(type.id)}
              >
                {purchasingId === type.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {type.price_ils !== null ? `₪${type.price_ils} (הדגמה)` : "רכישה (הדגמה)"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SpecialAuthorizationsCard({ role }: { role: string | null | undefined }) {
  const { data: authorizations = [], isLoading } = useMySpecialAuthorizations();

  if (role === "pilot_hobby") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            הרשאות הפעלה מיוחדות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">לא זמין לחשבון פרטי (פנאי וספורט)</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          ההרשאות המיוחדות שלי
        </CardTitle>
        <PurchaseAuthorizationDialog />
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {!isLoading && authorizations.length === 0 && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              אין ברשותכם הרשאות הפעלה מיוחדות. חלק מהאזורים במפת הטיסות דורשים הרשאה כזו לפני תיאום — ניתן לרכוש
              באמצעות כפתור ה־+.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {authorizations.map((auth) => (
            <div key={auth.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{auth.special_authorization_types?.name ?? "הרשאה"}</p>
                <p className="text-xs text-muted-foreground">{auth.special_authorization_types?.description}</p>
              </div>
              <Badge variant={auth.status === "active" ? "success" : auth.status === "expired" ? "destructive" : "warning"}>
                {STATUS_LABELS[auth.status]}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
