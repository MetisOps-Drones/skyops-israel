"use client";

import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIRM_THRESHOLD = 0.85;

/**
 * The final "deal confirmed" gesture in the booking chat — a deliberate,
 * hard-to-trigger-by-accident action since it locks the pilot's slot for
 * real. Self-contained LTR drag math regardless of the app's RTL shell (same
 * trick numeric/date inputs already use — see FlightParamsDrawer).
 */
export function SwipeToConfirm({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const confirmedRef = useRef(false);

  function clampAndSet(clientX: number) {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const thumbSize = 44;
    const maxX = rect.width - thumbSize;
    const x = Math.min(Math.max(clientX - rect.left - thumbSize / 2, 0), maxX);
    setDragX(x);
    return maxX > 0 ? x / maxX : 0;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (pending) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    confirmedRef.current = false;
    setDragging(true);
    clampAndSet(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || confirmedRef.current) return;
    const progress = clampAndSet(e.clientX);
    if (progress >= CONFIRM_THRESHOLD) {
      confirmedRef.current = true;
      setDragging(false);
      onConfirm();
    }
  }

  function handlePointerUp() {
    setDragging(false);
    if (!confirmedRef.current) setDragX(0);
  }

  return (
    <div dir="ltr" className="flex flex-col gap-1.5">
      <div
        ref={trackRef}
        className="relative h-12 w-full select-none overflow-hidden rounded-full bg-success/15"
      >
        <div
          className="pointer-events-none absolute inset-y-0 start-0 rounded-full bg-success/25"
          style={{ width: `calc(${dragX}px + 44px)` }}
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-success">
          {pending ? "מאשר..." : "החליקו לאישור סופי של העסקה"}
        </p>
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "absolute top-1 flex h-10 w-10 cursor-grab items-center justify-center rounded-full bg-success text-success-foreground shadow active:cursor-grabbing",
            pending && "cursor-not-allowed opacity-70"
          )}
          style={{ transform: `translateX(${dragX}px)`, left: "4px" }}
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">הפעולה תנעל את הסלוט בלוח הזמנים שלכם</p>
    </div>
  );
}
