import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One consistent way to flag "this isn't wired to a real integration yet"
 * across the app — payments, government validation, OCR, SMS, NOTAM filing —
 * instead of each area inventing its own wording/prominence. Always amber,
 * always the same shape, so a reviewer scanning the app can tell at a glance
 * which parts are demo-mode vs. live.
 */
export function DemoModeNotice({
  children,
  className,
  compact = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Inline single-line form for tight spaces (e.g. next to a status badge) instead of the full boxed notice. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-warning", className)}>
        <FlaskConical className="h-3 w-3 shrink-0" />
        {children}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning",
        className
      )}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">מצב הדגמה</p>
        <p className="text-xs leading-relaxed text-warning/90">{children}</p>
      </div>
    </div>
  );
}
