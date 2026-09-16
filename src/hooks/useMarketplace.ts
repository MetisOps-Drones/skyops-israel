"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { ALL_PLANS } from "@/lib/constants/plans";
import type { Tables, Enums } from "@/lib/types/database.types";

const MARKETPLACE_ELIGIBLE_PLAN_CODES = ALL_PLANS.filter((p) => p.marketplaceEligible).map((p) => p.code);

export type ContactRequestStatus = Enums<"contact_request_status">;

export interface MarketplaceFreelancer {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  business_hours: unknown;
  professional_category: string | null;
  is_verified_pilot: boolean;
  avg_rating: number | null;
  review_count: number;
  my_contact_request_status: ContactRequestStatus | null;
  headline: string | null;
  years_experience: number | null;
  specializations: string[];
  skills: string[];
  service_areas: string[];
}

export interface MarketplacePilotProfile extends MarketplaceFreelancer {
  drone_models: string[];
  uav_categories: string[];
  flight_modes: string[];
  software: string[];
}

/** The full "profile page" view of one pilot — for the marketplace's click-through detail page. */
export function useMarketplacePilotProfile(pilotId: string | null) {
  return useQuery({
    queryKey: ["marketplace_pilot_profile", pilotId],
    queryFn: async (): Promise<MarketplacePilotProfile | null> => {
      if (!pilotId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("get_marketplace_pilot_profile", { target_pilot_id: pilotId })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(pilotId),
  });
}

/**
 * Freelancers who opted in via "פרטי עסק" — visible only to org accounts.
 * Goes through a security-definer function (see 0049_marketplace_engagement.sql)
 * that never selects `phone` at all — the raw table is no longer readable by
 * other orgs for this purpose (see get_pilot_contact_phone for how a phone
 * number is actually obtained, once a contact request is accepted).
 */
export function useMarketplaceFreelancers() {
  return useQuery({
    queryKey: ["marketplace_freelancers"],
    queryFn: async (): Promise<MarketplaceFreelancer[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("marketplace_freelancers", {
        eligible_plan_codes: MARKETPLACE_ELIGIBLE_PLAN_CODES,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useRequestContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { org_id: string; pilot_id: string; message?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase.from("contact_requests").insert({
        org_id: input.org_id,
        pilot_id: input.pilot_id,
        requested_by: user.id,
        message: input.message ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_freelancers"] });
    },
  });
}

/** Only succeeds once the pilot has accepted a contact request from the caller's org. */
export function usePilotContactPhone(pilotId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["pilot_contact_phone", pilotId],
    queryFn: async (): Promise<string | null> => {
      if (!pilotId) return null;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_pilot_contact_phone", { target_pilot_id: pilotId });
      if (error) throw error;
      return data;
    },
    enabled: enabled && Boolean(pilotId),
  });
}

/** Incoming contact requests for the logged-in pilot, to accept/decline. */
export type ContactRequestWithOrg = Tables<"contact_requests"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name"> | null;
};

export function useMyIncomingContactRequests() {
  return useQuery({
    queryKey: ["contact_requests", "incoming"],
    queryFn: async (): Promise<ContactRequestWithOrg[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_requests")
        .select("*, organizations ( id, name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ContactRequestWithOrg[];
    },
  });
}

export function useDecideContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; accept: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("contact_requests")
        .update({ status: input.accept ? "accepted" : "declined", decided_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_requests"] });
    },
  });
}

export type PilotReview = Tables<"pilot_reviews"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name"> | null;
};

export function usePilotReviews(pilotId: string | null) {
  return useQuery({
    queryKey: ["pilot_reviews", pilotId],
    queryFn: async (): Promise<PilotReview[]> => {
      if (!pilotId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pilot_reviews")
        .select("*, organizations ( id, name )")
        .eq("pilot_id", pilotId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PilotReview[];
    },
    enabled: Boolean(pilotId),
  });
}

export interface AcceptedEngagement {
  id: string;
  pilot_id: string;
  pilot_full_name: string;
  pilot_avatar_url: string | null;
  decided_at: string | null;
}

/**
 * Freelancers the calling org has actually worked with (an accepted contact
 * request) — lets a review be left as soon as a job wraps up, without going
 * back to that pilot's specific marketplace profile page to find the button.
 * Goes through a security-definer RPC rather than a client-side embedded
 * join: a raw `profiles!contact_requests_pilot_id_fkey(...)` embed hits RLS
 * on `profiles` (0049 dropped the broad org-read policy there), so it
 * silently fails for anyone but the row owner.
 */
export function useMyAcceptedEngagements() {
  return useQuery({
    queryKey: ["contact_requests", "accepted_engagements"],
    queryFn: async (): Promise<AcceptedEngagement[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("my_accepted_engagements");
      if (error) throw error;
      return data;
    },
  });
}

export type BookingStatus = Enums<"booking_status">;

export interface MarketplaceBooking {
  id: string;
  org_id: string;
  org_name: string;
  pilot_id: string;
  pilot_full_name: string;
  pilot_avatar_url: string | null;
  created_by: string;
  title: string;
  description: string;
  location: string | null;
  budget_ils: number | null;
  operation_type: string | null;
  drone_type: string | null;
  purpose: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  association_code: string | null;
  association_expires_at: string | null;
  created_at: string;
}

/** Every booking the caller is a participant in — sent invitations (org side) or received ones (pilot side). Goes through an RPC for the same reason my_accepted_engagements does (0054): embedding profiles/organizations client-side would hit RLS. */
export function useMyMarketplaceBookings() {
  return useQuery({
    queryKey: ["marketplace_bookings", "mine"],
    queryFn: async (): Promise<MarketplaceBooking[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("my_marketplace_bookings");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

/** One booking by id — used by the chat screen, which a dispatcher_admin can also open for oversight even though they're not a participant (get_marketplace_booking allows that; my_marketplace_bookings above does not). */
export function useMarketplaceBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ["marketplace_booking", bookingId],
    queryFn: async (): Promise<MarketplaceBooking | null> => {
      if (!bookingId) return null;
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_marketplace_booking", { target_booking_id: bookingId }).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(bookingId),
    refetchInterval: 15_000,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      org_id: string;
      pilot_id: string;
      title: string;
      description: string;
      location: string | null;
      budget_ils: number | null;
      operation_type: string | null;
      drone_type: string | null;
      purpose: string | null;
      start_time: string;
      end_time: string;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase.from("marketplace_bookings").insert({ ...input, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_bookings"] });
    },
  });
}

/** Pilot accepts/declines an invitation. Accepting can fail with a Postgres exclusion-constraint error (23P01) if the proposed hours overlap a booking the pilot already has pending/confirmed — surfaced as a friendly message. */
export function useRespondToBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; accept: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("marketplace_bookings")
        .update({ status: input.accept ? "pending" : "declined" })
        .eq("id", input.id);
      if (error) {
        if (error.code === "23P01") {
          throw new Error("השעות המבוקשות כבר תפוסות אצלך בעבודה אחרת");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_bookings"] });
    },
  });
}

/** The final "deal confirmed" action — only the pilot may call this (enforced in enforce_booking_status_transition, 0060). Locks the slot for good and generates the org<->pilot association code. */
export function useConfirmBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("marketplace_bookings").update({ status: "confirmed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_bookings"] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("marketplace_bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_bookings"] });
    },
  });
}

export function useSubmitPilotReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { org_id: string; pilot_id: string; rating: number; comment?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר מחדש");
      const { error } = await supabase
        .from("pilot_reviews")
        .upsert(
          {
            org_id: input.org_id,
            pilot_id: input.pilot_id,
            reviewer_id: user.id,
            rating: input.rating,
            comment: input.comment ?? null,
          },
          { onConflict: "org_id,pilot_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pilot_reviews", variables.pilot_id] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_freelancers"] });
    },
  });
}
