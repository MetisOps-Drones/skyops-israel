"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const CHECKLIST_ITEMS = [
  "בדיקת מזג אוויר ותנאי רוח מתאימים לטיסה",
  "בדיקת רמת סוללה מלאה בכלי הטיס ובשלט",
  "בדיקת קושחה (Firmware) עדכנית",
  "כיול מצפן ו-IMU בוצע בסביבה החדשה",
  "כרטיס זיכרון פנוי מותקן במצלמה",
  "אישור הרשמה בתוקף של כלי הטיס (CAAI)",
  "בדיקת שטח פתיחה/סגירה של הלהבים",
  "וידוא שאין אנשים או רכוש בטווח הנפילה הפוטנציאלי",
];

export function PreFlightChecklist() {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const completedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">רשימת בדיקה טרום טיסה</p>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{CHECKLIST_ITEMS.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {CHECKLIST_ITEMS.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Checkbox
              id={`checklist-${index}`}
              checked={Boolean(checked[index])}
              onCheckedChange={(value) => setChecked((prev) => ({ ...prev, [index]: value === true }))}
            />
            <Label htmlFor={`checklist-${index}`} className="cursor-pointer text-sm font-normal">
              {item}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
