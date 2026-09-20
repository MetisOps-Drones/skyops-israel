"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * A more prominent nudge than the passively-updating bell badge (which
 * already existed — see 0073_notify_dispatchers_new_request.sql — and only
 * changes a small number a dispatcher has to notice on their own). Admin-only,
 * mounted once in AppShell. Deliberately visual only, no sound — this is a
 * shared work computer for some dispatchers, and an unexpected sound is a
 * worse interruption than a toast that's easy to glance at or ignore.
 */
export function NewCoordinationRequestToast() {
  const { data: notifications = [] } = useNotifications();
  const router = useRouter();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));

    if (seenIds.current === null) {
      // First load — nothing is "new" yet, just the existing unread pile.
      // Toasting for all of those on every page load would be its own kind
      // of noise.
      seenIds.current = currentIds;
      return;
    }

    for (const n of notifications) {
      if (n.kind !== "coordination_requested") continue;
      if (seenIds.current.has(n.id)) continue;
      toast.info(n.title, {
        description: n.body,
        action: { label: "פתיחת מוקד תיאום", onClick: () => router.push("/ops") },
      });
    }

    seenIds.current = currentIds;
  }, [notifications, router]);

  return null;
}
