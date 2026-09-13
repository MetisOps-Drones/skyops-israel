"use client";

import { ExternalLink, GraduationCap, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaywallScreen } from "@/components/academy/PaywallScreen";
import { useLmsProgress } from "@/hooks/useLmsProgress";
import { useMyGlobalRole } from "@/hooks/useOrgContext";
import type { LmsCourseId } from "@/lib/types/database.types";

const RRTD_ACADEMY_URL = "https://academy.rrtd.org/";

const COMMERCIAL_COURSES: { id: Extract<LmsCourseId, "commercial_25kg" | "heavy_2000kg">; label: string }[] = [
  { id: "commercial_25kg", label: 'כטב״מ עד 25 ק״ג — תקנות חדשות' },
  { id: "heavy_2000kg", label: 'כטב״מ 25 ק״ג - שני טון' },
];

function CommercialCourseCard({ id, label }: { id: LmsCourseId; label: string }) {
  const { data: progress, isLoading } = useLmsProgress(id);
  const active = progress?.subscription_active ?? false;

  if (isLoading) return null;

  if (!active) return <PaywallScreen courseId={id} priceLabel="₪900" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" />
            {label}
          </CardTitle>
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3" />
            נרכש
          </Badge>
        </div>
        <CardDescription>לימוד התיאוריה המלאה מתבצע באתר academy.rrtd.org</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href={RRTD_ACADEMY_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            מעבר לקורס
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * "מטיס מסחרי" — the two real CAAI commercial license tiers, each a separate purchasable course
 * (₪900) that unlocks the shared external course at academy.rrtd.org. Unlike the hobby track,
 * there's no in-app quiz here — the theory and exam prep both live on that external platform.
 */
export function CommercialTrack() {
  const { data: role } = useMyGlobalRole();
  const isHobby = role === "pilot_hobby";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">{isHobby ? "רוצה גם רישיון מסחרי?" : "מסלולי רישוי מסחרי"}</h3>
        <p className="text-sm text-muted-foreground">
          {isHobby
            ? "זו הרחבה נפרדת ובתשלום מעבר למסלול הפנאי החינמי שלכם — נדרשת רק אם אתם מתכננים לעבוד בתשלום עם כטב״ם."
            : "שני מסלולי רישוי נפרדים לפי משקל הכטב״ם, כל אחד נרכש בנפרד."}
        </p>
      </div>
      {COMMERCIAL_COURSES.map((course) => (
        <CommercialCourseCard key={course.id} id={course.id} label={course.label} />
      ))}
    </div>
  );
}
