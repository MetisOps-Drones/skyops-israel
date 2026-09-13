import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";

/** Server Component / Server Action client — reads the caller's session from cookies and enforces RLS. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render; a middleware refresh
            // will persist the session instead. Safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for trusted server-only paths (cron jobs, NOTAM
 * publish notifications, OCR ingestion). Bypasses RLS — never expose this
 * client or its key to the browser.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Service-role client is not tied to a user session.
        },
      },
    }
  );
}
