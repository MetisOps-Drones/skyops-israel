"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AVIATION_GLOSSARY } from "@/lib/constants/aviation-glossary";
import { cn } from "@/lib/utils";

/** Wraps a short aviation term with a plain-Hebrew explanation on hover/tap. */
export function TermTooltip({
  term,
  children,
  className,
}: {
  term: keyof typeof AVIATION_GLOSSARY;
  children: ReactNode;
  className?: string;
}) {
  const explanation = AVIATION_GLOSSARY[term];
  if (!explanation) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-help border-b border-dotted border-current/50 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{explanation}</TooltipContent>
    </Tooltip>
  );
}
