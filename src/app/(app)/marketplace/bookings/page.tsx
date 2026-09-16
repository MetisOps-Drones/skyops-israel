import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingsPageClient } from "./BookingsPageClient";

export default async function BookingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">הזמנות עבודה</h1>
        <p className="text-sm text-muted-foreground">הזמנות שנשלחו לכם או שלחתם, ומצב התיאום מול כל צד</p>
      </div>
      <BookingsPageClient />
    </div>
  );
}
