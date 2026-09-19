/**
 * Client-side, best-effort face comparison — face-api.js running entirely in
 * the browser (models served from /public/models, ~7MB, fetched once and
 * cached). No API key, no per-check cost, no server round-trip for the
 * biometric data itself.
 *
 * This is NOT identity-grade verification: there is no liveness/anti-spoof
 * check, so a printed photo or a photo of a screen can fool it, and the
 * 128-d descriptor comparison is a similarity heuristic, not a calibrated
 * probability. Every caller must surface it as a consistency hint for a
 * human reviewer, never as proof of identity. A dedicated IDV provider
 * (Onfido/Sumsub/Jumio-class — see migration 0078's comment) is the upgrade
 * path if stronger assurance is ever needed.
 */
import * as faceapi from "face-api.js";

const MODEL_URL = "/models";

let loadingPromise: Promise<void> | null = null;

export async function loadFaceMatchModels(): Promise<void> {
  if (!loadingPromise) {
    loadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => undefined);
  }
  return loadingPromise;
}

export interface FaceDescriptorResult {
  descriptor: Float32Array | null;
}

export async function computeFaceDescriptor(
  image: HTMLImageElement | HTMLCanvasElement
): Promise<FaceDescriptorResult> {
  await loadFaceMatchModels();
  const detection = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return { descriptor: detection?.descriptor ?? null };
}

export type FaceMatchResult = "match" | "no_match" | "inconclusive";

/** face-api.js's own documented rule of thumb for its 128-d descriptors: euclidean distance below ~0.6 usually indicates the same person. Anything from 0.6 to 0.8 is treated as inconclusive rather than forced into a binary call. */
const MATCH_DISTANCE = 0.6;
const NO_MATCH_DISTANCE = 0.8;

export function compareFaceDescriptors(
  a: Float32Array,
  b: Float32Array
): { distance: number; similarity: number; result: FaceMatchResult } {
  const distance = faceapi.euclideanDistance(a, b);
  const similarity = Math.max(0, Math.min(1, 1 - distance));
  const result: FaceMatchResult = distance < MATCH_DISTANCE ? "match" : distance < NO_MATCH_DISTANCE ? "inconclusive" : "no_match";
  return { distance, similarity, result };
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
  });
  return img;
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
    });
    return img;
  } finally {
    // The image has decoded its pixel data into a bitmap by the time onload
    // fires, so the object URL itself is no longer needed — revoking it here
    // (rather than leaving it for GC) avoids leaking one blob URL per check.
    URL.revokeObjectURL(url);
  }
}
