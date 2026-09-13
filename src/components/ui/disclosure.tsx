"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A plain expand/collapse section — no Radix primitive installed for this (Collapsible/Accordion
 * aren't in package.json) and a controlled useState is simpler than adding a dependency for one
 * toggle. Used to push secondary detail (the "why", not the "what") behind a tap instead of
 * always rendering it expanded.
 */
export function Disclosure({
  label,
  defaultOpen = false,
  children,
}: {
  label: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex flex-1 items-center min-w-0 text-start">{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  );
}
