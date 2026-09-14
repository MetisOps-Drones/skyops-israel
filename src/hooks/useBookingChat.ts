"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database.types";

export type BookingMessage = Tables<"booking_messages">;

/**
 * No realtime infrastructure exists anywhere else in this app (notifications
 * poll too) — matching that convention rather than introducing Supabase
 * Realtime for just this one screen. 5s feels chat-like without being a new
 * category of infra.
 */
export function useBookingMessages(bookingId: string | null) {
  return useQuery({
    queryKey: ["booking_messages", bookingId],
    queryFn: async (): Promise<BookingMessage[]> => {
      if (!bookingId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("booking_messages")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(bookingId),
    refetchInterval: 5_000,
  });
}

export function useSendBookingMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookingId: string; body: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase
        .from("booking_messages")
        .insert({ booking_id: input.bookingId, sender_id: user.id, body: input.body });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["booking_messages", variables.bookingId] });
    },
  });
}
