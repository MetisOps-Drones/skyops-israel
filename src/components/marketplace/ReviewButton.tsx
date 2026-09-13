"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePilotReviews, useSubmitPilotReview } from "@/hooks/useMarketplace";

/**
 * Leaves/edits a review for one pilot — shared between the pilot's own
 * profile page and the org's "engagements" list, so a review can be left
 * right after a job wraps up without navigating back to the pilot's page.
 */
export function ReviewButton({
  pilotId,
  orgId,
  name,
  variant = "outline",
}: {
  pilotId: string;
  orgId: string;
  name: string;
  variant?: "outline" | "default" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  // Keyed on the real pilotId regardless of `open` — keying it off `open`
  // meant the query flipped to a different (never-fetched) cache entry the
  // moment the dialog closed, so a second edit always silently reset to a
  // blank 5-star form instead of prefilling the existing review.
  const { data: reviews = [] } = usePilotReviews(pilotId);
  const submitReview = useSubmitPilotReview();
  const myReview = reviews.find((r) => r.org_id === orgId);

  function openDialog() {
    setRating(myReview?.rating ?? 5);
    setComment(myReview?.comment ?? "");
    setOpen(true);
  }

  async function handleSubmit() {
    try {
      await submitReview.mutateAsync({ org_id: orgId, pilot_id: pilotId, rating, comment: comment.trim() || undefined });
      toast.success("הדירוג נשמר");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת הדירוג נכשלה");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant={variant} onClick={openDialog}>
        <Star className="h-4 w-4" />
        {myReview ? "עריכת ההמלצה שלכם" : "השארת המלצה"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>המלצה על {name}</DialogTitle>
          <DialogDescription>ההמלצה תוצג לארגונים אחרים במרקטפלייס.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} כוכבים`}>
              <Star className={cn("h-7 w-7", n <= rating ? "fill-warning text-warning" : "text-muted-foreground/30")} />
            </button>
          ))}
        </div>
        <Textarea placeholder="חוות דעת (אופציונלי)" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={submitReview.isPending}>
            {submitReview.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
