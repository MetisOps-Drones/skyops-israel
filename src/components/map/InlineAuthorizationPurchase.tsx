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
      {purchasable ? (
        <Button size="sm" variant="outline" disabled={purchasing} onClick={handlePurchase}>
          {purchasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
          רכישה (הדגמה)
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">לא זמין לחשבון פרטי</span>
      )}
    </div>
  );
}
