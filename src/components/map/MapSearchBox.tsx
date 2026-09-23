"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinned, Plane, History, Search, X } from "lucide-react";
import { useMapSearch, type DroneSearchResult, type FlightRequestSearchResult } from "@/hooks/useMapSearch";
import type { AddressSuggestion } from "@/hooks/useAddressSearch";
import { cn } from "@/lib/utils";

/**
 * Map search — places (existing geocoding), the pilot's own drones, and
 * their own flight requests, grouped under one input. Kept as the same
 * always-visible pill it always was (not a modal command palette) so the
 * map page's overall structure doesn't shift; Ctrl+K just focuses it.
 */
export function MapSearchBox({
  onSelectPlace,
  onSelectDrone,
  onSelectFlightRequest,
  highContrast = false,
}: {
  onSelectPlace: (point: [number, number], placeName: string) => void;
  onSelectDrone: (droneId: string, label: string) => void;
  onSelectFlightRequest: (result: FlightRequestSearchResult) => void;
  highContrast?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { places, placesLoading, drones, flightRequests } = useMapSearch(query);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSelectPlace(s: AddressSuggestion) {
    onSelectPlace(s.point, s.placeName);
    setQuery(s.placeName);
    setOpen(false);
  }

  function handleSelectDrone(d: DroneSearchResult) {
    onSelectDrone(d.id, d.label);
    setQuery("");
    setOpen(false);
  }

  function handleSelectFlightRequest(r: FlightRequestSearchResult) {
    onSelectFlightRequest(r);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
  }

  const hasQuery = query.trim().length >= 2;
  const hasResults = places.length > 0 || drones.length > 0 || flightRequests.length > 0;

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
          ref={inputRef}
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
          placeholder="חיפוש כתובת, רחפן או בקשת טיסה"
          aria-label="חיפוש כתובת, רחפן או בקשת טיסה"
          className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {placesLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        {query && !placesLoading && (
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

      {open && hasQuery && (
        <div className="absolute inset-x-0 top-12 z-10 max-h-80 overflow-y-auto rounded-xl border bg-card shadow-lg">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{placesLoading ? "מחפש..." : "לא נמצאו תוצאות"}</p>
          ) : (
            <>
              {places.length > 0 && (
                <ul>
                  {places.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-4 py-2.5 text-start text-sm hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectPlace(s)}
                      >
                        <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{s.placeName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {drones.length > 0 && (
                <ul className="border-t">
                  <li className="px-4 pt-2 text-xs font-medium text-muted-foreground">הרחפנים שלי</li>
                  {drones.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-4 py-2.5 text-start text-sm hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectDrone(d)}
                      >
                        <Plane className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {d.label}
                          {d.sublabel && <span className="text-muted-foreground"> · {d.sublabel}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {flightRequests.length > 0 && (
                <ul className="border-t">
                  <li className="px-4 pt-2 text-xs font-medium text-muted-foreground">בקשות הטיסה שלי</li>
                  {flightRequests.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-4 py-2.5 text-start text-sm hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectFlightRequest(r)}
                      >
                        <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {r.label}
                          <span className="text-muted-foreground"> · {r.sublabel}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
