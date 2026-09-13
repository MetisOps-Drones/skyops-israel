import type { LucideIcon } from "lucide-react";
import { MapPinned, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

function HeroStat({
  icon: Icon,
  value,
  label,
  attention,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  attention?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          attention ? "bg-warning text-warning-foreground" : "bg-brand-gold text-brand-gold-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-brand-navy-foreground/75">{label}</p>
      </div>
    </div>
  );
}

export function GreetingHero({
  greeting,
  firstName,
  formattedDate,
  todayCoordinationsCount,
  daysUntilLicenseRenewal,
}: {
  greeting: string;
  firstName: string;
  formattedDate: string;
  todayCoordinationsCount: number;
  daysUntilLicenseRenewal: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-brand-navy p-6 text-brand-navy-foreground">
      <p className="text-sm text-brand-navy-foreground/75">{formattedDate}</p>
      <h1 className="mt-1 text-2xl font-bold">
        {greeting}, {firstName}
      </h1>
      <p className="mt-1 text-sm text-brand-navy-foreground/75">הנה מה שקורה היום ב-MetisOps שלך</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <HeroStat icon={MapPinned} value={todayCoordinationsCount} label="תיאומי שטח היום" />
        {daysUntilLicenseRenewal !== null ? (
          <HeroStat
            icon={CalendarClock}
            value={daysUntilLicenseRenewal}
            label="ימים לחידוש הרישיון"
            attention={daysUntilLicenseRenewal <= 30}
          />
        ) : (
          <HeroStat icon={CalendarClock} value="—" label="אין רישיון פעיל רשום" attention />
        )}
      </div>
    </div>
  );
}
