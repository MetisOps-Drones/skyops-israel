import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/current-user";
import { BookingChatPageClient } from "./BookingChatPageClient";

export default async function BookingChatPage({ params }: { params: { bookingId: string } }) {
  const current = await getCurrentUserProfile();
  if (!current) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BookingChatPageClient bookingId={params.bookingId} />
    </div>
  );
}
