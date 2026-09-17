import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, LayoutGrid, KeyRound, BadgeCheck, MessagesSquare, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const ADMIN_SECTIONS = [
  { href: "/ops", label: "מוקד תיאום", description: "תור בקשות טיסה ממתינות ופרסום NOTAM", icon: ShieldCheck },
  { href: "/admin/platform", label: "ניהול פלטפורמה", description: "הגדרות כלליות, אזורי מרחב אווירי ותשתית", icon: LayoutGrid },
  { href: "/admin/api", label: "API לשותפים", description: "מפתחות API ומקורות נתונים חלופיים לכל שכבה", icon: KeyRound },
  { href: "/admin/pilots", label: "אימות מטיסים", description: "בדיקת רישיונות ורישום כלי טיס", icon: BadgeCheck },
  { href: "/admin/marketplace", label: "ניטור מרקטפלייס", description: "מעקב אחר הזמנות עבודה ותקשורת בין מטיסים לארגונים", icon: MessagesSquare },
];

/** The admin bubble's landing screen — a small hub of the 5 admin-only sections, mirroring the top-level bubble pattern one level deeper. */
export default async function AdminHubPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "dispatcher_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">ניהול אדמין</h1>
        <p className="text-sm text-muted-foreground">בחרו תחום ניהול</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ADMIN_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <section.icon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium">{section.label}</p>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
