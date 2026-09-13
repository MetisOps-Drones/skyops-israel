"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRow({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(size, n <= Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  );
}
