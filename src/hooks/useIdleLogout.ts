"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signOut } from "@/actions/auth";

export const IDLE_LOGOUT_MS = 30 * 60 * 1000;

/** Real user activity only — a redraw, a poll, or a background tab timer firing shouldn't count as "the pilot is here". */
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

/**
 * Supabase's own session (refresh token) stays valid far longer than this —
 * this is a separate, deliberately shorter UX/security idle timer for a
 * shared or unattended device: sign out after 30 minutes with no real
 * interaction, everywhere under (app)/ (mounted once in AppShell). Same
 * queryClient.clear() + signOut() pattern as the manual logout button in
 * SettingsMenu.tsx, for the same reason — signOut() is a Server Action, so
 * it never fires the client SDK's onAuthStateChange, and the next person to
 * sign in on this tab would otherwise see this session's cached data.
 */
export function useIdleLogout() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleIdle() {
      queryClient.clear();
      toast.info("נותקת אוטומטית עקב חוסר פעילות של 30 דקות");
      signOut();
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleIdle, IDLE_LOGOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [queryClient]);
}
