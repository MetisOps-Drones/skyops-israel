"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { createClient } from "@/lib/supabase/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  // Every user-scoped query key (useMyLicenses, etc.) omits the user id, so
  // TanStack Query has no way to tell "the signed-in user changed" on its
  // own — a long-lived tab keeps serving one account's cached data after a
  // sign-out/sign-in or an account switch. This app's own login/logout
  // (src/actions/auth.ts) run entirely as Server Actions against the
  // server-side Supabase client, so they never actually fire this
  // listener — the real clear() calls live at those call sites (LoginForm,
  // SettingsMenu's logout button). This listener stays as a safety net for
  // any auth change that DOES go through the client SDK directly (e.g. an
  // OAuth callback). undefined = "haven't seen the first auth event yet";
  // only a real id change (including to/from null) clears the cache, so a
  // same-user TOKEN_REFRESHED doesn't wipe it for no reason.
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (lastUserId.current === undefined) {
        lastUserId.current = userId;
        return;
      }
      if (userId !== lastUserId.current) {
        lastUserId.current = userId;
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <PageViewTracker />
        {children}
        <Toaster />
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
