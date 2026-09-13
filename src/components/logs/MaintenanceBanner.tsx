"use client";

import { Wrench } from "lucide-react";
import { useDrones } from "@/hooks/useDrones";

export function MaintenanceBanner() {
  const { data: drones = [] } = useDrones();
  const flagged = drones.filter((d) => d.status === "maintenance_required");

  if (flagged.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div>
        <p className="text-sm font-semibold">נדרש טיפול תקופתי (מעל 50 שעות טיסה)</p>
        <p className="text-sm text-muted-foreground">
          {flagged.map((d) => d.nickname).join(", ")} — יש להעביר בדיקה תקופתית לפני המשך שימוש.
        </p>
      </div>
    </div>
  );
}
