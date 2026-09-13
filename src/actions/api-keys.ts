"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-keys";
import type { ApiLayer } from "@/lib/types/database.types";

/**
 * All of these run on the regular (cookie-bound) server client, not the
 * service-role one — RLS's `is_dispatcher_admin()` check on api_keys /
 * layer_source_overrides is the actual enforcement, this isn't just a UI
 * gate. See supabase/migrations/0034_partner_api_layers.sql.
 */

export async function createApiKeyAction(
  layer: ApiLayer,
  label: string
): Promise<{ success: true; rawKey: string } | { success: false; error: string }> {
  if (!label.trim()) return { success: false, error: "יש לתת שם למפתח" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "יש להתחבר מחדש" };

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  const { error } = await supabase.from("api_keys").insert({
    label: label.trim(),
    layer,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    created_by: user.id,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/api");
  return { success: true, rawKey };
}

export async function revokeApiKeyAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/api");
  return { success: !error, error: error?.message };
}

export async function setLayerOverrideAction(
  layer: ApiLayer,
  overrideUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("layer_source_overrides").upsert({
    layer,
    override_url: overrideUrl,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  });

  revalidatePath("/admin/api");
  return { success: !error, error: error?.message };
}
