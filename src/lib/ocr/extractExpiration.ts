/**
 * Document OCR pipeline (Module D). Extracts an expiration date from an
 * uploaded license/registration document.
 *
 * Two modes:
 *  - Real OCR: if `OCR_API_KEY` + `OCR_API_ENDPOINT` are configured, the raw
 *    file bytes are sent to that endpoint (any provider that accepts a
 *    multipart file and returns plain text — Google Cloud Vision's
 *    `DOCUMENT_TEXT_DETECTION`, AWS Textract's `DetectDocumentText`, or Azure
 *    Document Intelligence all fit behind this same call shape). The
 *    returned text is then scanned for a date.
 *  - Simulated OCR: when no OCR provider is configured (e.g. local dev), the
 *    original filename is scanned for a date instead, and if none is found
 *    a plausible expiration date is synthesized. The result is flagged
 *    `method: "simulated"` so callers can surface that clearly to the pilot
 *    rather than silently trusting a guessed date.
 */

export interface OcrExtractionResult {
  expiresAt: Date | null;
  confidence: number;
  rawText: string;
  method: "ocr" | "simulated";
}

const DATE_PATTERNS: { regex: RegExp; parse: (m: RegExpMatchArray) => Date | null }[] = [
  {
    // DD/MM/YYYY or DD-MM-YYYY
    regex: /\b(\d{2})[/-](\d{2})[/-](\d{4})\b/,
    parse: (m) => {
      const [, dd, mm, yyyy] = m;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      return Number.isNaN(date.getTime()) ? null : date;
    },
  },
  {
    // YYYY-MM-DD
    regex: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    parse: (m) => {
      const [, yyyy, mm, dd] = m;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      return Number.isNaN(date.getTime()) ? null : date;
    },
  },
];

function extractDateFromText(text: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const parsed = pattern.parse(match);
      if (parsed) return parsed;
    }
  }
  return null;
}

async function runProviderOcr(file: Blob, endpoint: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`OCR provider responded ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as { text?: string };
  return payload.text ?? "";
}

/** Synthesizes a plausible expiration date (12–24 months out) for local/dev use. */
function synthesizeExpiration(seedText: string): Date {
  const seed = Array.from(seedText).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const monthsOut = 12 + (seed % 13); // 12..24 months
  const date = new Date();
  date.setMonth(date.getMonth() + monthsOut);
  return date;
}

export async function extractExpirationDate(
  file: Blob,
  fileName: string
): Promise<OcrExtractionResult> {
  const ocrApiKey = process.env.OCR_API_KEY;
  const ocrEndpoint = process.env.OCR_API_ENDPOINT;

  if (ocrApiKey && ocrEndpoint) {
    const rawText = await runProviderOcr(file, ocrEndpoint, ocrApiKey);
    const expiresAt = extractDateFromText(rawText);
    return {
      expiresAt,
      confidence: expiresAt ? 0.92 : 0.2,
      rawText,
      method: "ocr",
    };
  }

  const fromFilename = extractDateFromText(fileName);
  if (fromFilename) {
    return {
      expiresAt: fromFilename,
      confidence: 0.5,
      rawText: fileName,
      method: "simulated",
    };
  }

  return {
    expiresAt: synthesizeExpiration(fileName),
    confidence: 0.1,
    rawText: fileName,
    method: "simulated",
  };
}

export interface IdentityFieldsResult {
  /** Printed full name, as best extracted — null when OCR couldn't find one (never guessed). */
  name: string | null;
  /** 9-digit Israeli ת"ז / printed license ID number. */
  idNumber: string | null;
  rawText: string;
  method: "ocr" | "simulated";
}

/** Israeli ת"ז is 9 digits; license documents print the same number as the holder's ID. */
const ID_NUMBER_PATTERN = /\b(\d{9})\b/;

function extractIdNumberFromText(text: string): string | null {
  const match = text.match(ID_NUMBER_PATTERN);
  return match?.[1] ?? null;
}

/**
 * Best-effort label-based name extraction from plain OCR text — not a real
 * document-layout parser (see the module doc comment on extractIdentityFields
 * for why), but Israeli ID cards and the CAAI pilot license both print the
 * name behind a recognizable Hebrew/English label, so a handful of regexes
 * covers the common cases without guessing: an unmatched document returns
 * null exactly like extractIdNumberFromText does, rather than a wrong name.
 */
function extractNameFromText(text: string): string | null {
  const normalized = text.replace(/\r/g, "");

  // Israeli ID card prints שם פרטי (given) and שם משפחה (family) as separate
  // labeled fields, in either order — either half alone is still useful
  // downstream since namesRoughlyMatch does a substring comparison.
  const givenMatch = normalized.match(/שם\s*פרטי[:\s]+([^\n]{2,40})/);
  const familyMatch = normalized.match(/שם\s*משפחה[:\s]+([^\n]{2,40})/);
  if (givenMatch || familyMatch) {
    return [givenMatch?.[1], familyMatch?.[1]]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.trim())
      .join(" ");
  }

  // A single combined שם/שם מלא label (how the CAAI license itself prints
  // it) — checked after the split-field patterns above so "שם משפחה:" never
  // matches here as a bare "שם:" label.
  const combinedMatch = normalized.match(/שם\s*(?:מלא)?\s*[:.]\s*([^\n]{2,60})/);
  if (combinedMatch?.[1]) return combinedMatch[1].trim();

  // English fallback, for a bilingual document or a provider that only
  // transcribes the Latin-alphabet side.
  const englishMatch = normalized.match(/(?:full\s*)?name\s*[:.]\s*([^\n]{2,60})/i);
  if (englishMatch?.[1]) return englishMatch[1].trim();

  return null;
}

/** Deterministic per-file placeholder for local/dev use — never a real extraction, so a mismatched pair of uploads correctly shows as "no match" while an identical pair shows as "match", exercising both demo paths honestly. */
function synthesizeIdentityFields(seedText: string): { name: string; idNumber: string } {
  const cleaned = seedText.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z֐-׿]+/g, " ").trim();
  const seed = Array.from(seedText).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const idNumber = String(100000000 + (seed % 900000000));
  return { name: cleaned || "לא זוהה שם", idNumber };
}

/**
 * Extracts the printed name + ID number from a license or ID-card document,
 * for the license-vs-ID cross-check in identity-verification.ts. Same
 * real/simulated split as extractExpirationDate — see that function's doc
 * comment for the provider contract.
 */
export async function extractIdentityFields(file: Blob, fileName: string): Promise<IdentityFieldsResult> {
  const ocrApiKey = process.env.OCR_API_KEY;
  const ocrEndpoint = process.env.OCR_API_ENDPOINT;

  if (ocrApiKey && ocrEndpoint) {
    const rawText = await runProviderOcr(file, ocrEndpoint, ocrApiKey);
    return {
      name: extractNameFromText(rawText),
      idNumber: extractIdNumberFromText(rawText),
      rawText,
      method: "ocr",
    };
  }

  const { name, idNumber } = synthesizeIdentityFields(fileName);
  return { name, idNumber, rawText: fileName, method: "simulated" };
}
