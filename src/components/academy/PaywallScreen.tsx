"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { LmsCourseId } from "@/lib/types/database.types";
import { DemoModeNotice } from "@/components/shared/DemoModeNotice";

const DEFAULT_FEATURES: Record<LmsCourseId, string[]> = {
  commercial_25kg: [
    "גישה מלאה לקורס התיאוריה באתר academy.rrtd.org",
    "הכנה לבחינת רישיון מטיס — כטב״מ עד 25 ק״ג (תקנות חדשות)",
    "חומרי עזר מעודכנים לפי תקנות CAAI",
    "תמיכה בשאלות מדריך מוסמך",
  ],
  heavy_2000kg: [
    "גישה מלאה לקורס התיאוריה באתר academy.rrtd.org",
    "הכנה לבחינת רישיון מטיס — כטב״מ 25 ק״ג עד שני טון",
    "חומרי עזר מעודכנים לפי תקנות CAAI",
    "תמיכה בשאלות מדריך מוסמך",
  ],
  hobby_exam: [
    "סימולציית מבחן מלאה עם שאלות אקראיות",
    "הסבר מפורט לכל שאלה",
    "מעקב היסטוריית ציונים",
    "התאמה מלאה לתוכן קורס מטיסן באתר MetisOps",
  ],
};

const DEFAULT_TITLES: Record<LmsCourseId, { title: string; description: string }> = {
  commercial_25kg: {
    title: 'כטב"מ עד 25 ק״ג — תקנות חדשות',
    description: "תוכן זה זמין לרוכשי הקורס בלבד",
  },
  heavy_2000kg: {
    title: 'כטב"מ 25 ק״ג - שני טון',
    description: "תוכן זה זמין לרוכשי הקורס בלבד",
  },
  hobby_exam: {
    title: "הכנה לרישיון מטיסן",
    description: "סימולציית המבחן זמינה לכל בעלי הגישה לקורס — ללא עלות",
  },
};

/**
 * Demo subscription gate. Flips `lms_progress.subscription_active` directly
 * rather than integrating a real payment processor — wire a checkout
 * provider (Stripe, etc.) into this handler before shipping to production.
 */
export function PaywallScreen({
  courseId,
  priceLabel,
}: {
  courseId: LmsCourseId;
  /** e.g. "₪900" — shown on the CTA when this course has a fixed price. */
  priceLabel?: string;
}) {
  const [activating, setActivating] = useState(false);
  const queryClient = useQueryClient();
  const features = DEFAULT_FEATURES[courseId];
  const { title, description } = DEFAULT_TITLES[courseId];

  async function handleActivateDemo() {
    setActivating(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר מחדש");
        return;
      }

      const { error } = await supabase.from("lms_progress").upsert(
        {
          user_id: user.id,
          course_id: courseId,
          subscription_active: true,
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_id" }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("המנוי הופעל (מצב הדגמה)");
      queryClient.invalidateQueries({ queryKey: ["lms_progress", courseId] });
    } finally {
      setActivating(false);
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
        <Button onClick={handleActivateDemo} disabled={activating} size="lg">
          {activating && <Loader2 className="h-4 w-4 animate-spin" />}
          {priceLabel ? `רכישת הקורס — ${priceLabel} (הדגמה)` : "הפעלת מנוי (הדגמה)"}
        </Button>
        <DemoModeNotice>אין חיבור לספק סליקה אמיתי — הפעלת המנוי כאן היא תיעוד כוונה בלבד, לא עסקה בפועל.</DemoModeNotice>
      </CardContent>
    </Card>
  );
}
