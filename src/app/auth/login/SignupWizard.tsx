"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { User, Briefcase, Building2, Loader2, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signUpWithPassword } from "@/actions/auth";
import { initiateCheckout } from "@/actions/billing";
import { PROFESSIONAL_CATEGORIES } from "@/lib/constants/professional-categories";
import { findPlan, recommendOrgPlan, type Plan } from "@/lib/constants/plans";
import { cn } from "@/lib/utils";

type CustomerType = "hobby" | "professional" | "business";
type Step = "basics" | "type" | "business" | "professional" | "confirm";

interface WizardState {
  fullName: string;
  email: string;
  password: string;
  customerType: CustomerType | null;
  // business
  orgName: string;
  employees: string;
  drones: string;
  usesFreelancers: boolean;
  wantsMarketplaceBiz: boolean;
  // professional
  category: string;
  wantsMarketplacePro: boolean;
}

const INITIAL_STATE: WizardState = {
  fullName: "",
  email: "",
  password: "",
  customerType: null,
  orgName: "",
  employees: "",
  drones: "",
  usesFreelancers: false,
  wantsMarketplaceBiz: false,
  category: PROFESSIONAL_CATEGORIES[0],
  wantsMarketplacePro: false,
};

function priceLabel(plan: Plan) {
  if (plan.priceIls === null) return "צור קשר לתמחור";
  if (plan.priceIls === 0) return "חינם";
  return `₪${plan.priceIls.toLocaleString("he-IL")} / ${plan.billingPeriod}`;
}

function TypeCard({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: typeof User;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
        selected ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
      )}
    >
      <Icon className={cn("h-6 w-6", selected ? "text-primary" : "text-muted-foreground")} />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

export function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function goToBasicsNext() {
    if (!state.fullName.trim() || !state.email.trim() || state.password.length < 8) {
      setError("יש למלא שם מלא, אימייל וסיסמה בת 8 תווים לפחות");
      return;
    }
    setError(null);
    setStep("type");
  }

  function selectType(type: CustomerType) {
    patch({ customerType: type });
    if (type === "hobby") setStep("confirm");
    else if (type === "business") setStep("business");
    else setStep("professional");
  }

  function goToBusinessNext() {
    if (!state.orgName.trim() || !state.employees || !state.drones) {
      setError("יש למלא את כל השדות");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  function goToProfessionalNext() {
    setError(null);
    setStep("confirm");
  }

  const recommendedPlan =
    state.customerType === "business"
      ? recommendOrgPlan(Number(state.employees) || 1, Number(state.drones) || 1)
      : state.customerType === "professional"
        ? findPlan(state.wantsMarketplacePro ? "business_standard" : "business_free")!
        : findPlan("private_free")!;

  const freeAlternative =
    state.customerType === "professional" && recommendedPlan.code !== "business_free"
      ? findPlan("business_free")
      : undefined;

  async function finishSignup(planCode: string, trial: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("fullName", state.fullName);
      formData.set("email", state.email);
      formData.set("password", state.password);
      // Only ever request a free-tier plan_code from the signup request itself — the server (0082)
      // ignores anything else anyway, since this metadata is entirely client-controlled. A paid
      // plan/org is granted afterwards through a confirmed Cardcom checkout, below.
      formData.set("planCode", state.customerType === "hobby" ? "private_free" : "business_free");
      if (state.customerType === "professional") {
        formData.set("role", "pilot_pro");
        formData.set("professionalCategory", state.category);
        formData.set("freelanceAvailable", String(state.wantsMarketplacePro && planCode !== "business_free"));
      } else if (state.customerType === "hobby") {
        formData.set("role", "pilot_hobby");
      }
      // business: role left unset — org creation (after payment, in the Cardcom webhook) sets it to fleet_manager.

      const result = await signUpWithPassword({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      const plan = findPlan(planCode);
      const needsPayment = plan && plan.priceIls !== null && plan.priceIls > 0;

      if (needsPayment) {
        const checkoutResult = await initiateCheckout({
          planCode,
          orgName: state.customerType === "business" ? state.orgName.trim() : undefined,
          switchToPro: state.customerType === "professional",
          trialDays: trial ? 7 : undefined,
        });
        if (!checkoutResult.success || !checkoutResult.redirectUrl) {
          toast.error(
            `החשבון נוצר, אך פתיחת עמוד התשלום נכשלה: ${checkoutResult.error ?? ""}. ניתן להשלים דרך "הארגון שלי"/"התוכנית שלי".`
          );
          router.push("/map");
          router.refresh();
          return;
        }
        window.location.href = checkoutResult.redirectUrl;
        return;
      }

      toast.success("החשבון נוצר בהצלחה!");
      router.push("/map");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההרשמה נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {step === "basics" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">שם מלא</Label>
            <Input id="fullName" value={state.fullName} onChange={(e) => patch({ fullName: e.target.value })} autoComplete="name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">אימייל</Label>
            <Input id="signup-email" type="email" value={state.email} onChange={(e) => patch({ email: e.target.value })} autoComplete="email" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">סיסמה</Label>
            <Input id="signup-password" type="password" value={state.password} onChange={(e) => patch({ password: e.target.value })} minLength={8} autoComplete="new-password" dir="ltr" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" onClick={goToBasicsNext} className="w-full">
            המשך
          </Button>
        </>
      )}

      {step === "type" && (
        <>
          <p className="text-sm font-medium">מה מתאר אותך הכי נכון?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TypeCard icon={User} label="חובבן / ספורטיבי" description="טיסה לתחביב ופנאי" selected={state.customerType === "hobby"} onClick={() => selectType("hobby")} />
            <TypeCard icon={Briefcase} label="מטיס מקצועי / מסחרי" description="עצמאי, עובד לבד" selected={state.customerType === "professional"} onClick={() => selectType("professional")} />
            <TypeCard icon={Building2} label="עסק" description="צוות, צי רחפנים משותף" selected={state.customerType === "business"} onClick={() => selectType("business")} />
          </div>
          <Button type="button" variant="ghost" onClick={() => setStep("basics")}>
            <ChevronRight className="h-4 w-4" />
            חזרה
          </Button>
        </>
      )}

      {step === "business" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgName">שם העסק</Label>
            <Input id="orgName" value={state.orgName} onChange={(e) => patch({ orgName: e.target.value })} placeholder="לדוגמה: רחפני הצפון בע״מ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employees">כמה עובדים בעסק?</Label>
              <Input id="employees" type="number" min={1} value={state.employees} onChange={(e) => patch({ employees: e.target.value })} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="drones">כמה רחפנים יש בעסק?</Label>
              <Input id="drones" type="number" min={1} value={state.drones} onChange={(e) => patch({ drones: e.target.value })} dir="ltr" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="usesFreelancers">האם משתמשים בפרילנסרים בעסק?</Label>
            <Switch id="usesFreelancers" checked={state.usesFreelancers} onCheckedChange={(v) => patch({ usesFreelancers: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="wantsMarketplaceBiz">גישה למרקטפלייס מטיסים</Label>
              <p className="text-xs text-muted-foreground">למציאת פרילנסרים לעבודות מזדמנות</p>
            </div>
            <Switch id="wantsMarketplaceBiz" checked={state.wantsMarketplaceBiz} onCheckedChange={(v) => patch({ wantsMarketplaceBiz: v })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("type")}>
              <ChevronRight className="h-4 w-4" />
              חזרה
            </Button>
            <Button type="button" onClick={goToBusinessNext} className="flex-1">
              המשך
            </Button>
          </div>
        </>
      )}

      {step === "professional" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">באיזה תחום אתה מתעסק?</Label>
            <Select value={state.category} onValueChange={(v) => patch({ category: v })}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFESSIONAL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="wantsMarketplacePro">תרצה למצוא עבודות דרך האפליקציה?</Label>
              <p className="text-xs text-muted-foreground">חשיפה לארגונים במרקטפלייס המטיסים</p>
            </div>
            <Switch id="wantsMarketplacePro" checked={state.wantsMarketplacePro} onCheckedChange={(v) => patch({ wantsMarketplacePro: v })} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("type")}>
              <ChevronRight className="h-4 w-4" />
              חזרה
            </Button>
            <Button type="button" onClick={goToProfessionalNext} className="flex-1">
              המשך
            </Button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <>
          <div className="rounded-lg border border-primary bg-primary/5 p-4">
            <p className="text-xs font-medium text-muted-foreground">התוכנית המומלצת עבורך</p>
            <p className="text-lg font-bold">{recommendedPlan.name}</p>
            <p className="text-sm text-muted-foreground">{priceLabel(recommendedPlan)}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {recommendedPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="button" onClick={() => finishSignup(recommendedPlan.code, false)} disabled={submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            הרשמה עם תוכנית {recommendedPlan.name}
          </Button>

          {state.customerType === "business" && recommendedPlan.priceIls !== 0 && (
            <Button type="button" variant="outline" onClick={() => finishSignup(recommendedPlan.code, true)} disabled={submitting} className="w-full">
              התחלה בניסיון חינם לשבוע
            </Button>
          )}

          {freeAlternative && (
            <Button type="button" variant="ghost" onClick={() => finishSignup(freeAlternative.code, false)} disabled={submitting} className="w-full">
              המשך עם תוכנית חינמית
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(state.customerType === "hobby" ? "type" : state.customerType === "business" ? "business" : "professional")}
          >
            <ChevronRight className="h-4 w-4" />
            חזרה
          </Button>
        </>
      )}
    </div>
  );
}
