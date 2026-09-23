"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSpecialAuthorizationTypes,
  usePurchaseSpecialAuthorization,
} from "@/hooks/useSpecialAuthorizations";

/** Inline "buy the specific authorization this spot needs" — shown directly in the blocking warning instead of sending the pilot to hunt for it in their profile. */
export function InlineAuthorizationPurchase({
  regulationNumber,
  purchasable = true,
}: {
  regulationNumber: string;
  /** False for hobby accounts — the regulation itself only exists for commercial/general (כטב"ם) operation, so there's nothing to buy here. */
  purchasable?: boolean;
}) {
  const { data: catalog = [] } = useSpecialAuthorizationTypes();
  const purchase = usePurchaseSpecialAuthorization();
  const [purchasing, setPurchasing] = useState(false);

  const authType = catalog.find((t) => t.regulation_number === regulationNumber);

  // The commercial catalog entry's own regulation_number (e.g. "תקנה 32")
  // only exists for כטב"ם (commercial/general) operation — a hobby account
  // is restricted for a real reason (flying over people/infrastructure),
  // just under a different, uncited מטיסן regulation (see
  // HOBBY_INFRASTRUCTURE_DISTANCE_M in flight-rules.ts). Showing the
  // commercial citation here would attribute the block to a regulation
  // that, by this app's own understanding, doesn't apply to this account.
  if (!purchasable) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm">
        <div>
          <p className="font-medium">הרשאת הפעלה מיוחדת</p>
          <p className="text-xs text-muted-foreground">תקנות הטיס (הפעלת מטיסן) — הפעלה מעל תשתית</p>
        </div>
        <span className="text-xs text-muted-foreground">לא זמין לחשבון פרטי</span>
      </div>
    );
  }

  if (!authType) return null;

  async function handlePurchase() {
    setPurchasing(true);
    try {
      await purchase.mutateAsync(authType!.id);
      toast.success("ההרשאה נרכשה (מצב הדגמה) — קובץ ההרשאה יישלח אליכם במייל בהמשך");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הרכישה נכשלה");
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm">
      <div>
        <p className="font-medium">{authType.name}</p>
        <p className="text-xs text-muted-foreground">{authType.regulation_number}</p>
      </div>
      <Button size="sm" variant="outline" disabled={purchasing} onClick={handlePurchase}>
        {purchasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
        רכישה (הדגמה)
      </Button>
    </div>
  );
}
