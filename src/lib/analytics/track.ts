import { createClient } from "@/lib/supabase/client";

/**
 * Fire-and-forget product-analytics event. Never throws and never blocks
 * the UI — a failed insert (offline, RLS edge case) should not break the
 * feature the user is actually using. Business-state events (a flight
 * request changing status, a membership being approved, etc.) are already
 * captured server-side by DB triggers — this is for everything else:
 * page views, and UI actions that don't correspond to a single row write.
 */
export function trackEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  const supabase = createClient();
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    supabase
      .from("app_events")
      .insert({ actor_id: user.id, event_name: eventName, metadata: metadata as never })
      .then(({ error }) => {
        if (error) console.warn("trackEvent failed:", eventName, error.message);
      });
  });
}
