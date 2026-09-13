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
