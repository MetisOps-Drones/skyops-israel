"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyOrgContext, useSwitchToProAccount } from "@/hooks/useOrgContext";
import { useUpdateProfileDetails } from "@/hooks/useProfileSettings";
import { initiateCheckout } from "@/actions/billing";
import { cn } from "@/lib/utils";
import {
  PRIVATE_PLANS,
  BUSINESS_PLANS,
  ORG_PLANS,
  ORG_COMMON_FEATURES,
  findPlan,
  type Plan,
  type PlanCategory,
} from "@/lib/constants/plans";
import type { Tables } from "@/lib/types/database.types";

function priceLabel(plan: Plan) {
  if (plan.priceIls === null) return "צור קשר לתמחור";
  if (plan.priceIls === 0) return "חינם";
  return `₪${plan.priceIls.toLocaleString("he-IL")}`;
}

/** A comparative-pricing column: highlights the recommended tier and, for tiers that build on a
 * previous one, frames the list as "everything in {previous}, plus" so the reader can see the
 * incremental value at each step rather than re-reading a full feature list per column. */
function PlanColumn({ plan, isCurrent, children }: { plan: Plan; isCurrent: boolean; children: React.ReactNode }) {
  const base = plan.inheritsFrom ? findPlan(plan.inheritsFrom) : undefined;
  const isHighlighted = Boolean(plan.highlight) && !isCurrent;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card",
        isCurrent ? "border-primary ring-1 ring-primary" : isHighlighted ? "border-brand-gold ring-1 ring-brand-gold" : "border-border"
      )}
    >
      {(isHighlighted || isCurrent) && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold",
            isCurrent ? "bg-primary text-primary-foreground" : "bg-brand-gold text-brand-gold-foreground"
          )}
        >
          {isCurrent ? "התוכנית הנוכחית" : plan.highlight}
        </div>
      )}

      <div className="flex flex-col gap-1 border-b p-4 pt-5">
        <p className="font-semibold">{plan.name}</p>
        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">{priceLabel(plan)}</span>
          {plan.priceIls !== null && plan.priceIls > 0 && <span className="text-xs text-muted-foreground">/ {plan.billingPeriod}</span>}
        </p>
        {plan.overageNote && <p className="text-xs text-muted-foreground">{plan.overageNote}</p>}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {base && <p className="text-xs font-medium text-muted-foreground">הכל מ״{base.name}״, ועוד:</p>}
        <ul className="flex flex-1 flex-col gap-1.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  );
}

function CreateOrgButton({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCheckout() {
    if (!orgName.trim()) {
      toast.error("יש להזין שם לארגון");
      return;
    }
    if (plan.priceIls === null) {
      toast.error("תוכנית זו דורשת יצירת קשר לתמחור");
      return;
    }
    setBusy(true);
    try {
      const result = await initiateCheckout({ planCode: plan.code, orgName: orgName.trim() });
      if (!result.success || !result.redirectUrl) {
        toast.error(result.error ?? "יצירת עמוד התשלום נכשלה");
        return;
      }
      window.location.href = result.redirectUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "יצירת עמוד התשלום נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="mt-1 w-full">
          <Lock className="h-3.5 w-3.5" />
          שדרוג לתוכנית זו
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>יצירת ארגון — {plan.name}</DialogTitle>
          <DialogDescription>
            {priceLabel(plan)} / {plan.billingPeriod ?? "מותאם אישית"}. הארגון ייווצר רק לאחר תשלום מאושר — תועברו לעמוד
            סליקה מאובטח.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-name">שם הארגון</Label>
          <Input id="org-name" placeholder="לדוגמה: רחפני הצפון בע״מ" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={handleCheckout} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            מעבר לתשלום
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanCatalog({ profile }: { profile: Tables<"profiles"> }) {
  const { data: orgContext } = useMyOrgContext();
  const switchToPro = useSwitchToProAccount();
  const update = useUpdateProfileDetails();
  const [selecting, setSelecting] = useState<string | null>(null);
  // Until the org-context query resolves, `orgContext` is undefined and `currentCategory` would
  // momentarily read as "business" for a fleet manager — using it as an *uncontrolled* Tabs
  // defaultValue would lock the dialog onto that wrong tab even after the query settles. Track
  // the active tab explicitly instead, following currentCategory live until the user picks one.
  const [userSelectedTab, setUserSelectedTab] = useState<PlanCategory | null>(null);

  const hasOrg = Boolean(orgContext?.orgId);
  const currentCategory: PlanCategory = hasOrg ? "org" : profile.role === "pilot_pro" || profile.role === "fleet_manager" ? "business" : "private";
  const activeTab = userSelectedTab ?? currentCategory;

  async function selectPlan(plan: Plan) {
    setSelecting(plan.code);
    try {
      const switchingToPro = plan.category === "business" && currentCategory === "private";
      if (plan.priceIls === 0) {
        // Free tier — no payment step, matches the price shown.
        if (switchingToPro) await switchToPro.mutateAsync("pilot_pro");
        await update.mutateAsync({ fullName: profile.full_name, planCode: plan.code });
        toast.success(`נבחרה תוכנית "${plan.name}"`);
        return;
      }
      const result = await initiateCheckout({ planCode: plan.code, switchToPro: switchingToPro });
      if (!result.success || !result.redirectUrl) {
        toast.error(result.error ?? "יצירת עמוד התשלום נכשלה");
        return;
      }
      window.location.href = result.redirectUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "בחירת התוכנית נכשלה");
    } finally {
      setSelecting(null);
    }
  }

  function renderAction(plan: Plan) {
    const isCurrent = profile.plan_code === plan.code;
    if (isCurrent) return null;
    if (plan.category === "org" && !hasOrg) return <CreateOrgButton plan={plan} />;
    return (
      <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => selectPlan(plan)} disabled={selecting === plan.code}>
        {selecting === plan.code && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {plan.priceIls === 0 ? "בחירת תוכנית" : "מעבר לתשלום"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={activeTab} onValueChange={(v) => setUserSelectedTab(v as PlanCategory)} dir="rtl">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="private">לקוח פרטי</TabsTrigger>
        <TabsTrigger value="business">לקוח פרטי עסקי</TabsTrigger>
        <TabsTrigger value="org">ארגון</TabsTrigger>
      </TabsList>

      {/* TabsContent itself must never carry a "grid"/"flex" display class — Radix hides an
          inactive tab via the native `hidden` attribute, and a same-specificity utility class
          later in the cascade (like "grid") wins over the browser's `[hidden]{display:none}`,
          silently leaving every inactive panel's content still taking up full layout height. All
          layout classes live on an inner wrapper div instead. Every category uses the same
          4-column template so each card ends up the same width, and a shared min-height keeps
          the dialog from jumping when switching between tabs with different content lengths. */}
      <TabsContent value="private" className="pt-3">
        <div className="grid min-h-[26rem] grid-cols-1 content-start gap-3 sm:grid-cols-4">
          {PRIVATE_PLANS.map((plan) => (
            <PlanColumn key={plan.code} plan={plan} isCurrent={profile.plan_code === plan.code}>
              {renderAction(plan)}
            </PlanColumn>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="business" className="pt-3">
        <div className="grid min-h-[26rem] grid-cols-1 content-start gap-3 sm:grid-cols-4">
          {BUSINESS_PLANS.map((plan) => (
            <PlanColumn key={plan.code} plan={plan} isCurrent={profile.plan_code === plan.code}>
              {renderAction(plan)}
            </PlanColumn>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="org" className="pt-3">
        <div className="flex min-h-[26rem] flex-col gap-3">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {ORG_COMMON_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-4">
            {ORG_PLANS.map((plan) => (
              <PlanColumn key={plan.code} plan={plan} isCurrent={profile.plan_code === plan.code}>
                {renderAction(plan)}
              </PlanColumn>
            ))}
          </div>
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );
}
