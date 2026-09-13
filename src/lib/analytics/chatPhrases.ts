// Recurring-phrase mining for booking chats (see 0063_chat_phrase_analytics.sql).
// Deliberately simple word/sequence counting, not an LLM call: normalize,
// drop stopwords, and count 3-5 word n-grams shared across many distinct
// conversations. "זה יקר לי מדי" showing up in 40 different chats is the
// kind of thing this is meant to catch.

const HEBREW_STOPWORDS = new Set([
  "את", "של", "עם", "על", "אני", "אתה", "אתם", "הוא", "היא", "אנחנו", "זה", "זאת",
  "אז", "גם", "רק", "כן", "לא", "מה", "אם", "כי", "אבל", "יש", "אין", "היה", "היו",
  "לי", "לך", "לו", "לה", "לנו", "לכם", "להם", "אותי", "אותך", "אותו", "אותה",
  "כל", "כמה", "יותר", "פחות", "עוד", "כבר", "רוצה", "רוצים", "היי", "שלום", "תודה",
]);

const ENGLISH_STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "to", "of", "and", "or", "in", "on",
  "for", "with", "this", "that", "it", "i", "you", "we", "they",
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'()\[\]{}\-–—/\\]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isStopword(token: string): boolean {
  return HEBREW_STOPWORDS.has(token) || ENGLISH_STOPWORDS.has(token) || token.length < 2;
}

/** Distinct 3-5 word n-grams found in one message, deduped within the message (a repeated phrase inside one long message only counts once towards conversation spread). */
export function extractPhrases(body: string): { phrase: string; length: number }[] {
  const tokens = normalize(body);
  const seen = new Set<string>();
  const phrases: { phrase: string; length: number }[] = [];

  for (const length of [3, 4, 5]) {
    for (let i = 0; i + length <= tokens.length; i++) {
      const slice = tokens.slice(i, i + length);
      if (slice.every(isStopword)) continue;
      const phrase = slice.join(" ");
      const key = `${length}:${phrase}`;
      if (seen.has(key)) continue;
      seen.add(key);
      phrases.push({ phrase, length });
    }
  }

  return phrases;
}
