import Link from "next/link";
import { signOut } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsMenu } from "./NotificationsMenu";
import { LogOut, User, CreditCard, LifeBuoy, Store, ShieldCheck } from "lucide-react";
import type { Tables } from "@/lib/types/database.types";

const TIER_LABELS: Record<string, string> = {
  pilot_hobby: "לקוח פרטי",
  pilot_pro: "לקוח פרטי עסקי",
  fleet_manager: "ארגון",
  dispatcher_admin: "מוקדן תיאום",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopNav({ profile, email }: { profile: Tables<"profiles">; email: string | null }) {
  const canSeeMarketplace = Boolean(profile.org_id);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2 md:hidden">
        <span className="font-bold">MetisOps</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        <NotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
              <Avatar className="h-8 w-8 ring-1 ring-border">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
                <AvatarFallback className="text-xs">{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-start sm:block">
                <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{TIER_LABELS[profile.role]}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium">{profile.full_name}</span>
              {email && <span className="text-xs font-normal text-muted-foreground" dir="ltr">{email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User />
                הפרופיל שלי
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile?open=subscription">
                <CreditCard />
                מנוי ושדרוג חשבון
              </Link>
            </DropdownMenuItem>
            {canSeeMarketplace && (
              <DropdownMenuItem asChild>
                <Link href="/marketplace">
                  <Store />
                  מרקטפלייס מטיסים
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <a href="mailto:support@metis-ops.com">
                <LifeBuoy />
                עזרה ותמיכה
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="https://www.gov.il/he/departments/civil_aviation_authority" target="_blank" rel="noreferrer">
                <ShieldCheck />
                אתר רשות התעופה האזרחית
              </a>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  התנתק
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
