import { createServiceRoleClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-keys";
import type { ApiLayer } from "@/lib/types/database.types";

export type ApiKeyVerification = { ok: true } | { ok: false; status: number; error: string };

/**
 * Validates the API key against one of the scoped layer(s) it's supposed to
 * unlock. Accepts either a single layer or a list — an embed page's own key
 * (e.g. `map_embed`) legitimately unlocks more than one underlying data
 * endpoint at once, so its internal calls need to accept that layer
 * alongside the endpoint's own "native" layer rather than only the exact
 * match. Reads the key from `Authorization: Bearer <key>` when present,
 * falling back to a `key` query param — the latter exists because an
 * embedded page loaded directly in an <iframe src> has no way to set
 * request headers.
 */
export async function verifyApiKey(
  request: Request,
  layer: ApiLayer | ApiLayer[]
): Promise<ApiKeyVerification> {
  const acceptable = Array.isArray(layer) ? layer : [layer];
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const rawKey = bearerMatch?.[1] ?? new URL(request.url).searchParams.get("key");
  if (!rawKey) {
    return { ok: false, status: 401, error: "נדרש מפתח API — בכותרת Authorization: Bearer <key> או בפרמטר key=" };
  }

  const keyHash = hashApiKey(rawKey);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, layer, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 401, error: "מפתח API לא תקין" };
  if (data.revoked_at) return { ok: false, status: 401, error: "מפתח API בוטל" };
  if (!acceptable.includes(data.layer)) {
    return {
      ok: false,
      status: 403,
      error: `מפתח זה מוגדר לשכבת "${data.layer}", לא "${acceptable.join(" / ")}"`,
    };
  }

  // Fire-and-forget usage tracking — never block the actual response on it.
  void supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return { ok: true };
}
