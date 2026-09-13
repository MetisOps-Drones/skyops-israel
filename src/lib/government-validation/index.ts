/**
 * Provider-agnostic hook for validating user-submitted regulatory data
 * (drone registration numbers, pilot license numbers, special-authorization
 * references) against a government registry — same shape as
 * src/lib/notifications/sms.ts: gated by env vars, logs instead of calling
 * out when unconfigured, so every call site behaves the same whether or not
 * a real integration exists yet.
 *
 * No such endpoint exists publicly from CAAI/the Ministry of Transport as
 * of writing, so `GOV_VALIDATION_API_ENDPOINT`/`GOV_VALIDATION_API_KEY` are
 * unset everywhere — every request below resolves to `not_configured`,
 * never a fabricated pass.
 */
import type { GovernmentValidationEntity, GovernmentValidationStatus } from "@/lib/types/database.types";

export interface GovernmentValidationInput {
  entityType: GovernmentValidationEntity;
  entityId: string;
  submittedValue: string;
}

export interface GovernmentValidationResult {
  status: GovernmentValidationStatus;
  provider: string | null;
  response: unknown | null;
}

export async function validateAgainstGovernmentRegistry(
  input: GovernmentValidationInput
): Promise<GovernmentValidationResult> {
  const endpoint = process.env.GOV_VALIDATION_API_ENDPOINT;
  const apiKey = process.env.GOV_VALIDATION_API_KEY;

  if (!endpoint || !apiKey) {
    console.info(
      `[gov-validation:not-configured] entity=${input.entityType} id=${input.entityId} value="${input.submittedValue}"`
    );
    return { status: "not_configured", provider: null, response: null };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ entity_type: input.entityType, value: input.submittedValue }),
    });

    if (!response.ok) {
      return { status: "error", provider: endpoint, response: await response.text() };
    }

    const data = await response.json();
    return { status: data.verified ? "verified" : "rejected", provider: endpoint, response: data };
  } catch (err) {
    return { status: "error", provider: endpoint, response: err instanceof Error ? err.message : String(err) };
  }
}
