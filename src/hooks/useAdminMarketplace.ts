"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/types/database.types";

export interface BookingStatusCount {
  status: Enums<"booking_status">;
  booking_count: number;
}

export function useAdminBookingsOverview() {
  return useQuery({
    queryKey: ["admin_marketplace_bookings_overview"],
    queryFn: async (): Promise<BookingStatusCount[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_marketplace_bookings_overview");
      if (error) throw error;
      return data;
    },
  });
}

export interface RecurringChatPhrase {
  phrase: string;
  phrase_length: number;
  occurrence_count: number;
  conversation_count: number;
  last_seen_at: string;
}

export function useAdminRecurringChatPhrases(minConversations = 3) {
  return useQuery({
    queryKey: ["admin_recurring_chat_phrases", minConversations],
    queryFn: async (): Promise<RecurringChatPhrase[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_recurring_chat_phrases", {
        min_conversations: minConversations,
      });
      if (error) throw error;
      return data;
    },
  });
}

export interface AdminBookingRow {
  id: string;
  title: string;
  status: Enums<"booking_status">;
  start_time: string;
  end_time: string;
  created_at: string;
  org_name: string | null;
  pilot_full_name: string | null;
}

/** Every booking on the platform, for the admin monitoring screen — RLS already grants dispatcher_admin unrestricted read on marketplace_bookings/organizations/profiles, so this is a plain query (same reasoning as useAllFlightRequestsForAdmin). */
export function useAdminAllBookings() {
  return useQuery({
    queryKey: ["admin_marketplace_bookings", "all"],
    queryFn: async (): Promise<AdminBookingRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("marketplace_bookings")
        .select("id, title, status, start_time, end_time, created_at, organizations ( name ), profiles!marketplace_bookings_pilot_id_fkey ( full_name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        start_time: b.start_time,
        end_time: b.end_time,
        created_at: b.created_at,
        org_name: (b.organizations as unknown as { name: string } | null)?.name ?? null,
        pilot_full_name: (b.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
      }));
    },
  });
}
