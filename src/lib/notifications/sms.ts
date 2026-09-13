/**
 * Thin wrapper around whatever SMS gateway is configured via
 * `SMS_PROVIDER_API_KEY`. Kept provider-agnostic (plain REST POST) so
 * swapping to a specific vendor (e.g. an Israeli SMS gateway like
 * inforU/019sms) only means changing this file, not every call site.
 *
 * When no API key is configured (local/dev), the message is logged instead
 * of sent — callers don't need to branch on environment.
 */
export interface SendSmsInput {
  toPhone: string;
  message: string;
}

export async function sendSms({ toPhone, message }: SendSmsInput): Promise<{ sent: boolean }> {
  const apiKey = process.env.SMS_PROVIDER_API_KEY;
  const senderId = process.env.SMS_PROVIDER_SENDER_ID ?? "MetisOps";
  const endpoint = process.env.SMS_PROVIDER_ENDPOINT;

  if (!apiKey || !endpoint) {
    console.info(`[sms:dev-mode] to=${toPhone} sender=${senderId} message="${message}"`);
    return { sent: false };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ to: toPhone, from: senderId, text: message }),
  });

  if (!response.ok) {
    throw new Error(`SMS provider responded ${response.status}: ${await response.text()}`);
  }

  return { sent: true };
}
