import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database.types";

/**
 * The signed-in user + their full profile row, resolved once per request.
 *
 * (app)/layout.tsx already runs this exact lookup (auth.getUser(), then a
 * profiles select) before any page renders — every page.tsx under it was
 * independently repeating the same two round trips just to re-derive a
 * narrower slice of data the layout already had, turning each navigation
 * into a 4-hop waterfall (layout auth -> layout profile -> page auth ->
 * page profile) before the page's own data even starts loading. That's the
 * gap between "map panning feels instant" (pure client-side, already-loaded
 * data) and "opening a menu item is slow" (a fresh server round trip, paid
 * twice over). React's cache() memoizes a no-arg async function per request,
 * so the layout's call and every page's call collapse into ONE real fetch
 * each; every caller just gets the already-resolved promise back.
 */
export const getCurrentUserProfile = cache(
  async (): Promise<{ user: User; profile: Tables<"profiles"> } | null> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!profile) return null;

    return { user, profile };
  }
);
