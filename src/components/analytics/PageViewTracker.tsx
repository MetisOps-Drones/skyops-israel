"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics/track";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("page_view", { path: pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
