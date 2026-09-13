"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A tag picker: selected values as removable badges, curated suggestion
 * chips for the rest, plus a free-text field so the list is never a closed
 * enum. No combobox primitive exists in this project (see ClientPicker) —
 * this is the multi-value sibling of that same "suggest, but always allow
 * custom" pattern.
 */
export function TagMultiSelect({
  label,
  value,
  onChange,
  suggestions,
  placeholder = "הוספה ידנית",
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: readonly string[];
  placeholder?: string;
}) {
  const [customInput, setCustomInput] = useState("");
  const available = suggestions.filter((s) => !value.includes(s));

  function add(tag: string) {
    const t = tag.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setCustomInput("");
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 py-1 pe-1.5">
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`הסרת ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors",
                "hover:border-primary hover:bg-accent hover:text-foreground"
              )}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(customInput);
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => add(customInput)} disabled={!customInput.trim()}>
          הוספה
        </Button>
      </div>
    </div>
  );
}
