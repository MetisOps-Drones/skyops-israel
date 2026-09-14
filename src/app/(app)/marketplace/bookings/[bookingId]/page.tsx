import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingChatPageClient } from "./BookingChatPageClient";

export default async function BookingChatPage({ params }: { params: { bookingId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BookingChatPageClient bookingId={params.bookingId} />
    </div>
  );
}
