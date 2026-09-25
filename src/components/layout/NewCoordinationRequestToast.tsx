"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";

const STORAGE_KEY = "metisops:toastedCoordinationRequestIds";
/** Trimmed to the most recent N — this is just "don't re-toast", not a real read-tracking store (notifications.read_at already covers that), so it doesn't need to grow forever. */
const MAX_STORED = 200;

function loadSeenIds(): Set<string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-MAX_STORED)));
  } catch {
    // Private window / blocked storage — worst case a notification toasts
    // again next reload, same as before this fix existed.
  }
}

/**
 * A more prominent nudge than the passively-updating bell badge (which
 * already existed — see 0073_notify_dispatchers_new_request.sql — and only
 * changes a small number a dispatcher has to notice on their own). Admin-only,
 * mounted once in AppShell. Deliberately visual only, no sound — this is a
 * shared work computer for some dispatchers, and an unexpected sound is a
 * worse interruption than a toast that's easy to glance at or ignore.
 *
 * "Already toasted" used to live only in a useRef, which resets on every
 * full page reload (not just client-side navigation) — a dispatcher who
 * refreshes their browser got the same still-unread notification re-toasted
 * every time. Persisted to localStorage instead, so it survives a reload;
 * the very first run in a given browser still just captures a baseline
 * without toasting (same as the original in-memory logic), so restoring a
 * whole backlog of pre-existing unread notifications on a brand-new device
 * doesn't fire a wall of toasts.
 */
export function NewCoordinationRequestToast() {
  const { data: notifications = [] } = useNotifications();
  const router = useRouter();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seenIds.current === null) {
      const stored = loadSeenIds();
      if (stored === null) {
        // First run ever in this browser — baseline the existing pile
        // without toasting for any of it, then stop; next effect run (new
        // data) compares against this real baseline.
        const baseline = new Set(notifications.map((n) => n.id));
        seenIds.current = baseline;
        saveSeenIds(baseline);
        return;
      }
      seenIds.current = stored;
    }

    for (const n of notifications) {
      if (n.kind !== "coordination_requested") continue;
      if (seenIds.current.has(n.id)) continue;
      seenIds.current.add(n.id);
      toast.info(n.title, {
        description: n.body,
        action: { label: "פתיחת מוקד תיאום", onClick: () => router.push("/ops") },
      });
    }

    saveSeenIds(seenIds.current);
  }, [notifications, router]);

  return null;
}
