"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export const MIN_RADIUS_M = 10;
export const MAX_RADIUS_M = 5000;

/**
 * A whole-number field that never pushes an out-of-range value into state.
 * The radius field used to write every keystroke straight through as
 * Number(value) — clearing it (the only way to type a different number)
 * made that 0, and a 0 radius threw out of the airspace check's render and
 * took the whole app down. What's being typed stays a local draft; only a
 * number that's actually in range is committed, an empty or half-typed value
 * just waits, and leaving the field snaps it back to a valid number.
 * `value` null means "not filled in yet" (a required field with no default).
 */
export function BoundedNumberInput({
  id,
  value,
  onChange,
  min,
  max,
  errorText,
  placeholder,
}: {
  id: string;
  value: number | null;
  onChange: (n: number) => void;
  min: number;
  max: number;
  errorText: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  // An external write (the map's drag-to-size gesture, a reset) must overwrite what's typed.
  useEffect(() => {
    if (value !== null && Number(draft) !== value) setDraft(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only an *external* change to value should overwrite the draft
  }, [value]);

  function handleChange(raw: string) {
    setDraft(raw);
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) {
      onChange(Math.round(n));
    }
  }

  function handleBlur() {
    if (draft.trim() === "") {
      if (value !== null) setDraft(String(value));
      return;
    }
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  const invalid = draft.trim() !== "" && !(Number(draft) >= min && Number(draft) <= max);

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        dir="ltr"
        aria-invalid={invalid}
      />
      {invalid && <p className="text-xs text-destructive">{errorText}</p>}
    </div>
  );
}
