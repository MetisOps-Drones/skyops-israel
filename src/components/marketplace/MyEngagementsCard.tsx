"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { useMyAcceptedEngagements, usePilotReviews } from "@/hooks/useMarketplace";
import { ReviewButton } from "@/components/marketplace/ReviewButton";
import { StarRow } from "@/components/marketplace/StarRow";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function EngagementRow({ pilotId, orgId, name, avatarUrl }: { pilotId: string; orgId: string; name: string; avatarUrl: string | null }) {
  const { data: reviews = [] } = usePilotReviews(pilotId);
  const myReview = reviews.find((r) => r.org_id === orgId);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <Link href={`/marketplace/${pilotId}`} className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium hover:underline">{name}</p>
          {myReview ? (
            <div className="flex items-center gap-1.5">
              <StarRow rating={myReview.rating} size="h-3 w-3" />
              <span className="text-xs text-muted-foreground">ההמלצה שלכם</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">עדיין לא הושארה המלצה</span>
          )}
        </div>
      </Link>
      <ReviewButton pilotId={pilotId} orgId={orgId} name={name} variant={myReview ? "outline" : "default"} />
    </div>
  );
}

/**
 * Every freelancer this org has actually worked with, with a review action
 * right there — the org shouldn't have to remember to go back to a pilot's
 * profile page after a job wraps up just to leave a recommendation.
 */
export function MyEngagementsCard() {
  const { data: ctx } = useMyOrgContext();
  const { data: engagements = [], isLoading } = useMyAcceptedEngagements();

  if (!ctx?.orgId) return null;
  if (!isLoading && engagements.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </span>
          מטיסים עצמאים שעבדתם איתם
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          לאחר שסיימתם עבודה מול מטיס/ה, אפשר להשאיר המלצה ישירות מכאן — היא תוצג לארגונים אחרים במרקטפלייס.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {engagements.map((e) => (
          <EngagementRow key={e.id} pilotId={e.pilot_id} orgId={ctx.orgId!} name={e.pilot_full_name} avatarUrl={e.pilot_avatar_url} />
        ))}
      </CardContent>
    </Card>
  );
}
