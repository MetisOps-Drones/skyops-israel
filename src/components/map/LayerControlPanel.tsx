"use client";

import { Layers3, Sun, ExternalLink, Palette, FileText, Satellite, Radar } from "lucide-react";
import { useMyGlobalRole } from "@/hooks/useOrgContext";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TermTooltip } from "@/components/map/TermTooltip";
import { DemoModeNotice } from "@/components/shared/DemoModeNotice";
import { AIRSPACE_ZONE_COLORS, AIRSPACE_ZONE_LABELS } from "@/lib/constants/airspace-zones";
import type { AviationGlossaryTerm } from "@/lib/constants/aviation-glossary";
import { cn } from "@/lib/utils";
import type { MapBaseStyle, MapLayerVisibility } from "@/lib/types/map-ui";

const ZONE_TYPE_GLOSSARY_TERM: Record<keyof typeof AIRSPACE_ZONE_LABELS, AviationGlossaryTerm> = {
  CTR: "CTR",
  FIRING_ZONE: "שטח אש",
  RESTRICTED_AREA: "שטח מוגבל",
  NATURE_RESERVE: "שמורת טבע",
};

const BASE_STYLE_OPTIONS: { value: MapBaseStyle; label: string; icon: typeof Palette }[] = [
  { value: "colorful", label: "צבעונית", icon: Palette },
  { value: "light", label: "לבנה", icon: FileText },
  { value: "satellite", label: "תצ\"א", icon: Satellite },
];

export function LayerControlPanel({
  visibility,
  onVisibilityChange,
  baseStyle,
  onBaseStyleChange,
  highContrast,
  onHighContrastChange,
}: {
  visibility: MapLayerVisibility;
  onVisibilityChange: (next: MapLayerVisibility) => void;
  baseStyle: MapBaseStyle;
  onBaseStyleChange: (next: MapBaseStyle) => void;
  highContrast: boolean;
  onHighContrastChange: (next: boolean) => void;
}) {
  const { data: role } = useMyGlobalRole();
  const isAdmin = role === "dispatcher_admin";

  function toggle(key: keyof MapLayerVisibility) {
    onVisibilityChange({ ...visibility, [key]: !visibility[key] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="שכבות ומקרא מפה"
          title="שכבות ומקרא מפה"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-md transition-colors hover:bg-accent",
            highContrast ? "border-2 border-foreground" : "border border-input"
          )}
        >
          <Layers3 className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-3">
        <DropdownMenuLabel className="px-1 py-0 text-xs text-muted-foreground">בסיס מפה</DropdownMenuLabel>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {BASE_STYLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = baseStyle === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onBaseStyleChange(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[11px]",
                  active ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="px-1 py-0 text-xs text-muted-foreground">שכבות מפה</DropdownMenuLabel>
        <DemoModeNotice compact className="mt-1.5 px-1">
          אזורים אסורים / שמורות טבע / תשתיות (CTR) למטה: 4 אזורי הדגמה בלבד לצורך בדיקת האישור האוטומטי — לא כל
          המרחב האווירי בישראל. שכבת מרחב האווירי המלאה למטה מבוססת על נתונים רשמיים.
        </DemoModeNotice>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          <DropdownMenuCheckboxItem
            checked={visibility.nfz}
            onCheckedChange={() => toggle("nfz")}
            className="py-1.5 text-xs"
          >
            <TermTooltip term="NFZ">אזורים אסורים (הדגמה)</TermTooltip>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibility.natureReserves}
            onCheckedChange={() => toggle("natureReserves")}
            className="py-1.5 text-xs"
          >
            <TermTooltip term="שמורת טבע">שמורות טבע (הדגמה)</TermTooltip>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibility.infrastructure}
            onCheckedChange={() => toggle("infrastructure")}
            className="py-1.5 text-xs"
          >
            <TermTooltip term="CTR">תשתיות/CTR (הדגמה)</TermTooltip>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibility.windHazard}
            onCheckedChange={() => toggle("windHazard")}
            className="py-1.5 text-xs"
          >
            מזג אוויר ורוח
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibility.aipReference}
            onCheckedChange={() => toggle("aipReference")}
            className="col-span-2 py-1.5 text-xs"
          >
            <TermTooltip term="AIP">שכבת מרחב אווירי (ייעוץ, ללא NOTAM בזמן אמת)</TermTooltip>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibility.myHistory}
            onCheckedChange={() => toggle("myHistory")}
            className="col-span-2 py-1.5 text-xs"
          >
            היסטוריית תיאומים שלי
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibility.buildings}
            onCheckedChange={() => toggle("buildings")}
            className="col-span-2 py-1.5 text-xs"
          >
            מבנים וישובים (נראה מרמת התקרבות גבוהה)
          </DropdownMenuCheckboxItem>
          {isAdmin && (
            <DropdownMenuCheckboxItem
              checked={visibility.allCoordinations}
              onCheckedChange={() => toggle("allCoordinations")}
              className="col-span-2 py-1.5 text-xs font-medium text-primary"
            >
              <span className="flex items-center gap-1.5">
                <Radar className="h-3.5 w-3.5" />
                כל התיאומים הפעילים בפלטפורמה (אדמין)
              </span>
            </DropdownMenuCheckboxItem>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="px-1 py-0 text-xs text-muted-foreground">מקרא צבעים</DropdownMenuLabel>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 px-1 text-xs">
          {Object.entries(AIRSPACE_ZONE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: AIRSPACE_ZONE_COLORS[type as keyof typeof AIRSPACE_ZONE_COLORS] }}
              />
              <TermTooltip term={ZONE_TYPE_GLOSSARY_TERM[type as keyof typeof AIRSPACE_ZONE_LABELS]}>
                {label}
              </TermTooltip>
            </div>
          ))}
        </div>
        <a
          href="https://www.gov.il/he/pages/drone-app"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 px-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          אימות נוסף באפליקציית DronesIL הרשמית
        </a>

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={highContrast}
          onCheckedChange={() => onHighContrastChange(!highContrast)}
          className="py-1.5 text-xs"
        >
          <span className="flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" />
            מצב ניגודיות גבוהה (לשימוש בשמש)
          </span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
