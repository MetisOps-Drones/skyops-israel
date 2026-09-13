import { randomBytes, createHash } from "crypto";

const RAW_KEY_PREFIX = "mo_";
const DISPLAY_PREFIX_LENGTH = 10;

/** Generates a new raw API key plus what actually gets stored (a hash — the raw key is only ever shown once, at creation). */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `${RAW_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { rawKey, keyHash: hashApiKey(rawKey), keyPrefix: rawKey.slice(0, DISPLAY_PREFIX_LENGTH) };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
