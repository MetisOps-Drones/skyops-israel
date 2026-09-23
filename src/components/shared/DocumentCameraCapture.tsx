"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Live camera capture with an alignment guide overlay, used for both the
 * license scan (card-shaped guide, auto-crops to it on capture) and the
 * live selfie for face-match (circular guide, captures the full frame —
 * cropping to the guide isn't needed for face detection and risks cutting
 * the face off if alignment is imperfect). Always offers a file-picker
 * fallback alongside the camera — permission can be denied, or the device
 * simply has no camera (desktop testing).
 */
export function DocumentCameraCapture({
  facingMode,
  guideShape,
  label,
  onCapture,
}: {
  facingMode: "environment" | "user";
  guideShape: "card" | "circle";
  label: string;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError("אין גישה למצלמה — ניתן להעלות תמונה מהמכשיר במקום");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    let sx = 0;
    let sy = 0;
    let sw = video.videoWidth;
    let sh = video.videoHeight;

    if (guideShape === "card") {
      // Auto-crop to the card-shaped guide rectangle (see the matching
      // inset percentages on the overlay below) — no manual dragging, the
      // capture button crops for you.
      const insetX = 0.08;
      const insetY = 0.28;
      sx = video.videoWidth * insetX;
      sy = video.videoHeight * insetY;
      sw = video.videoWidth * (1 - 2 * insetX);
      sh = video.videoHeight * (1 - 2 * insetY);
    }
    // "circle" (selfie) captures the full frame — see doc comment above.

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreview(URL.createObjectURL(blob));
        stopCamera();
        onCapture(file);
      },
      "image/jpeg",
      0.9
    );
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onCapture(file);
  }

  function retake() {
    setPreview(null);
    startCamera();
  }

  if (preview) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element -- a transient local object URL, not worth Next/Image's remote-optimization pipeline */}
          <img src={preview} alt={label} className="w-full object-cover" />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={retake}>
          <RotateCcw className="h-3.5 w-3.5" />
          צילום מחדש
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {cameraActive ? (
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} muted playsInline className="w-full" />
          <div
            className={cn(
              "pointer-events-none absolute border-2 border-dashed border-primary",
              guideShape === "card" ? "inset-x-[8%] inset-y-[28%] rounded-lg" : "inset-x-[20%] inset-y-[10%] rounded-full"
            )}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute end-2 top-2 h-7 w-7 bg-background/80"
            onClick={stopCamera}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" onClick={capture} className="absolute bottom-3 start-1/2 -translate-x-1/2">
            <Camera className="h-4 w-4" />
            צילום
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-center">
          <Camera className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
          {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={startCamera}>
              <Camera className="h-3.5 w-3.5" />
              פתיחת מצלמה
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <label>
                <Upload className="h-3.5 w-3.5" />
                העלאת תמונה
                <input type="file" accept="image/*" className="hidden" onChange={handleFilePicked} />
              </label>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
