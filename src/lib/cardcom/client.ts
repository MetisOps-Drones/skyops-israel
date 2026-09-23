/**
 * Cardcom API v11 client — LowProfile hosted checkout + token-based
 * recurring charges. Server-only (uses CARDCOM_API_PASSWORD).
 *
 * IMPORTANT: this sandbox couldn't reach secure.cardcom.solutions or
 * Cardcom's docs (network egress blocked), so the request/response field
 * names below are best-effort — pieced together from public search results
 * and community SDKs, NOT copied from the official spec. Before relying on
 * this in production:
 *   1. Set CARDCOM_TERMINAL_NUMBER/CARDCOM_API_NAME/CARDCOM_API_PASSWORD to
 *      your SANDBOX terminal's values in a preview deploy.
 *   2. Try a checkout end to end. Cardcom's v11 API returns a descriptive
 *      `Description` string on any field/validation error (confirmed) —
 *      paste that error back and the exact field name gets corrected here,
 *      in this one file, without touching any other code.
 * The actual security property of the integration (see the webhook route)
 * does NOT depend on getting every field name right — it never trusts the
 * webhook payload, only uses it as a trigger to re-fetch the authoritative
 * status from Cardcom using our own credentials. A wrong field name here
 * fails safe (checkout errors out / stays unpaid), it can't cause a false
 * "paid" activation.
 */

const CARDCOM_BASE_URL = "https://secure.cardcom.solutions/api/v11";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export interface CardcomDocumentInput {
  /** Buyer name as it should appear on the tax invoice. */
  name: string;
  email?: string;
  /** Israeli ח.פ / ת.ז, if known — not required to issue a receipt. */
  taxId?: string;
  productDescription: string;
}

export interface CreateLowProfileInput {
  /** Amount to actually charge right now — 0 for a trial signup (see tokenOnly). */
  amountIls: number;
  productName: string;
  /** Our billing_checkouts.id — round-tripped by Cardcom so the webhook can match the callback to a row without trusting anything else in the payload. */
  returnValue: string;
  successRedirectUrl: string;
  failedRedirectUrl: string;
  webhookUrl: string;
  /** Also save a reusable card token for recurring monthly billing. */
  createToken: boolean;
  /** Free-trial signups: save the card via Cardcom's token-only operation without charging anything now — the recurring cron makes the real first charge when the trial ends. */
  tokenOnly?: boolean;
  /** Omitted for a tokenOnly checkout — nothing was actually paid yet, so there's nothing to invoice. */
  document?: CardcomDocumentInput;
}

export interface CreateLowProfileResult {
  ok: boolean;
  description: string;
  lowProfileId?: string;
  redirectUrl?: string;
}

/** Step 1: ask Cardcom for a hosted checkout page URL. */
export async function createLowProfile(input: CreateLowProfileInput): Promise<CreateLowProfileResult> {
  const terminalNumber = Number(requiredEnv("CARDCOM_TERMINAL_NUMBER"));
  const apiName = requiredEnv("CARDCOM_API_NAME");

  const res = await fetch(`${CARDCOM_BASE_URL}/LowProfile/Create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      TerminalNumber: terminalNumber,
      ApiName: apiName,
      Operation: input.tokenOnly ? "CreateTokenOnly" : input.createToken ? "ChargeAndCreateToken" : "ChargeOnly",
      Amount: input.amountIls,
      ProductName: input.productName,
      ReturnValue: input.returnValue,
      SuccessRedirectUrl: input.successRedirectUrl,
      FailedRedirectUrl: input.failedRedirectUrl,
      WebHookUrl: input.webhookUrl,
      ...(input.document
        ? {
            Document: {
              DocumentTypeToCreate: "TaxInvoiceAndReceipt",
              Name: input.document.name,
              Email: input.document.email,
              TaxId: input.document.taxId,
              IsSendByEmail: Boolean(input.document.email),
              Products: [
                {
                  Description: input.document.productDescription,
                  UnitCost: input.amountIls,
                  Quantity: 1,
                },
              ],
            },
          }
        : {}),
    }),
  });

  const body = (await res.json()) as {
    ResponseCode: number;
    Description: string;
    LowProfileId?: string;
    Url?: string;
  };

  return {
    ok: body.ResponseCode === 0,
    description: body.Description,
    lowProfileId: body.LowProfileId,
    redirectUrl: body.Url,
  };
}

export interface LowProfileResult {
  ok: boolean;
  description: string;
  /** True only when Cardcom's own record of this LowProfileId shows a completed, successful charge. */
  paid: boolean;
  returnValue?: string;
  amountIls?: number;
  transactionId?: string;
  token?: string;
  tokenExpiry?: string;
  documentNumber?: string;
  documentUrl?: string;
}

/**
 * Step 2 (the security-critical call): look up a LowProfileId's real,
 * server-confirmed status directly from Cardcom using OUR OWN credentials —
 * never trust the webhook POST body itself for the payment decision, only
 * use it to learn which LowProfileId to look up.
 */
export async function getLowProfileResult(lowProfileId: string): Promise<LowProfileResult> {
  const terminalNumber = Number(requiredEnv("CARDCOM_TERMINAL_NUMBER"));
  const apiName = requiredEnv("CARDCOM_API_NAME");

  const res = await fetch(`${CARDCOM_BASE_URL}/LowProfile/GetLpResult`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      TerminalNumber: terminalNumber,
      ApiName: apiName,
      LowProfileId: lowProfileId,
    }),
  });

  const body = (await res.json()) as {
    ResponseCode: number;
    Description: string;
    ReturnValue?: string;
    DealResponse?: number;
    Amount?: number;
    TranzactionId?: string;
    TokenInfo?: { Token?: string; CardMonth?: number; CardYear?: number };
    DocumentInfo?: { DocumentNumber?: string; DocumentUrl?: string };
  };

  return {
    ok: body.ResponseCode === 0,
    description: body.Description,
    paid: body.ResponseCode === 0 && body.DealResponse === 0,
    returnValue: body.ReturnValue,
    amountIls: body.Amount,
    transactionId: body.TranzactionId,
    token: body.TokenInfo?.Token,
    tokenExpiry:
      body.TokenInfo?.CardMonth && body.TokenInfo?.CardYear
        ? `${String(body.TokenInfo.CardMonth).padStart(2, "0")}/${body.TokenInfo.CardYear}`
        : undefined,
    documentNumber: body.DocumentInfo?.DocumentNumber,
    documentUrl: body.DocumentInfo?.DocumentUrl,
  };
}

export interface ChargeTokenInput {
  token: string;
  amountIls: number;
  productName: string;
  document: CardcomDocumentInput;
}

export interface ChargeTokenResult {
  ok: boolean;
  description: string;
  transactionId?: string;
  documentNumber?: string;
  documentUrl?: string;
}

/** Recurring monthly charge against a previously saved token (src/app/api/cron/charge-recurring-subscriptions). */
export async function chargeToken(input: ChargeTokenInput): Promise<ChargeTokenResult> {
  const terminalNumber = Number(requiredEnv("CARDCOM_TERMINAL_NUMBER"));
  const apiName = requiredEnv("CARDCOM_API_NAME");
  const apiPassword = requiredEnv("CARDCOM_API_PASSWORD");

  const res = await fetch(`${CARDCOM_BASE_URL}/Transactions/Transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      TerminalNumber: terminalNumber,
      ApiName: apiName,
      ApiPassword: apiPassword,
      TokenToCharge: { Token: input.token },
      Amount: input.amountIls,
      ProductName: input.productName,
      Document: {
        DocumentTypeToCreate: "TaxInvoiceAndReceipt",
        Name: input.document.name,
        Email: input.document.email,
        TaxId: input.document.taxId,
        IsSendByEmail: Boolean(input.document.email),
        Products: [
          {
            Description: input.document.productDescription,
            UnitCost: input.amountIls,
            Quantity: 1,
          },
        ],
      },
    }),
  });

  const body = (await res.json()) as {
    ResponseCode: number;
    Description: string;
    TranzactionId?: string;
    DocumentInfo?: { DocumentNumber?: string; DocumentUrl?: string };
  };

  return {
    ok: body.ResponseCode === 0,
    description: body.Description,
    transactionId: body.TranzactionId,
    documentNumber: body.DocumentInfo?.DocumentNumber,
    documentUrl: body.DocumentInfo?.DocumentUrl,
  };
}
