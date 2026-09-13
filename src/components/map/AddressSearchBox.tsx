"use client";

import { useRef, useState } from "react";
import { Loader2, MapPinned, Search, X } from "lucide-react";
import { useAddressSearch, type AddressSuggestion } from "@/hooks/useAddressSearch";
import { cn } from "@/lib/utils";

/**
 * Address/place search for the map — the only way to reach a location today
 * is "my current position" or scrolling/zooming by hand. This also gives
 * keyboard-only and screen-reader users a way to inspect a location: the
 * map's click-to-inspect flow itself has no keyboard equivalent.
 */
export function AddressSearchBox({
  onSelect,
  highContrast = false,
}: {
  onSelect: (point: [number, number], placeName: string) => void;
  highContrast?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: suggestions = [], isFetching } = useAddressSearch(query);

  function handleSelect(s: AddressSuggestion) {
    onSelect(s.point, s.placeName);
    setQuery(s.placeName);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative min-w-0 w-64 shrink sm:w-80">
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-sm shadow-md",
          highContrast ? "border-2 border-foreground" : "border border-input"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a suggestion below registers before the list unmounts.
            blurTimeout.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder="חיפוש כתובת או מקום"
          aria-label="חיפוש כתובת או מקום על המפה"
          className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {isFetching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        {query && !isFetching && (
          <button
            type="button"
            aria-label="ניקוי חיפוש"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 3 && (
        <div className="absolute inset-x-0 top-12 z-10 overflow-hidden rounded-xl border bg-card shadow-lg">
          {suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {isFetching ? "מחפש..." : "לא נמצאו תוצאות"}
            </p>
          ) : (
            <ul>
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-4 py-2.5 text-start text-sm hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(s)}
                  >
                    <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{s.placeName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
