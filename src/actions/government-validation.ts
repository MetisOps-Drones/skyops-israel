"use server";

import { createClient } from "@/lib/supabase/server";
import { validateAgainstGovernmentRegistry } from "@/lib/government-validation";
import type { GovernmentValidationEntity } from "@/lib/types/database.types";

/**
 * Records (and, once a real provider is configured, actually runs) a
 * government-registry check for a piece of regulatory data the user
 * submitted — a drone registration number, a license number, a special
 * authorization. Called right after the entity is created so every such
 * record has a validation trail from day one, even while every result is
 * `not_configured`.
 */
export async function requestGovernmentValidation(input: {
  entityType: GovernmentValidationEntity;
  entityId: string;
  submittedValue: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "יש להתחבר מחדש" };
  }

  const result = await validateAgainstGovernmentRegistry(input);

  const { error } = await supabase.from("government_validation_requests").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    submitted_value: input.submittedValue,
    status: result.status,
    provider: result.provider,
    response: result.response as never,
    requested_by: user.id,
    checked_at: result.status !== "not_configured" ? new Date().toISOString() : null,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
