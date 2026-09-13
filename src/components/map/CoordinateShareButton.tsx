"use client";

import { Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toDMS } from "@/lib/geo/spatial";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} הועתק`);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
}

/** One-click copy of the current GPS position in the formats pilots actually paste into — a coordination request, a group chat, or a navigation app. */
export function CoordinateShareButton({ coords }: { coords: [number, number] | null }) {
  const disabled = !coords;

  function formats(): { label: string; value: string }[] {
    if (!coords) return [];
    const [lng, lat] = coords;
    return [
      { label: "מעלות עשרוניות (DD)", value: `${lat.toFixed(6)}, ${lng.toFixed(6)}` },
      { label: "מעלות/דקות/שניות (DMS)", value: `${toDMS(lat, "lat")} ${toDMS(lng, "lng")}` },
      { label: "קישור Waze", value: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
      { label: "קישור Google Maps", value: `https://www.google.com/maps?q=${lat},${lng}` },
    ];
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="שיתוף מיקום נוכחי"
          title="שיתוף מיקום נוכחי"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>העתקת המיקום שלי</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats().map((format) => (
          <DropdownMenuItem
            key={format.label}
            className="flex items-center justify-between gap-2 py-3 text-sm"
            onSelect={() => copy(format.value, format.label)}
          >
            {format.label}
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
