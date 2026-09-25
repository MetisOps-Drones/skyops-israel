function extractNameFromText(text) {
  const normalized = text.replace(/\r/g, "");

  const givenMatch = normalized.match(/שם\s*פרטי[:\s]+([^\n]{2,40})/);
  const familyMatch = normalized.match(/שם\s*משפחה[:\s]+([^\n]{2,40})/);
  if (givenMatch || familyMatch) {
    return [givenMatch?.[1], familyMatch?.[1]]
      .filter((s) => Boolean(s))
      .map((s) => s.trim())
      .join(" ");
  }

  const combinedMatch = normalized.match(/שם\s*(?:מלא)?\s*[:.]\s*([^\n]{2,60})/);
  if (combinedMatch?.[1]) return combinedMatch[1].trim();

  const englishMatch = normalized.match(/(?:full\s*)?name\s*[:.]\s*([^\n]{2,60})/i);
  if (englishMatch?.[1]) return englishMatch[1].trim();

  return null;
}

const cases = [
  ["ID card, split fields", "מדינת ישראל\nתעודת זהות\nשם משפחה: כהן\nשם פרטי: ישראל\nמספר זהות 123456789"],
  ["ID card, given only (partial OCR)", "שם פרטי: דנה\nמספר זהות 987654321"],
  ["CAAI license, combined label", "רשות התעופה האזרחית\nרישיון מטיס\nשם: ישראל כהן\nמספר רישיון PIL-1234"],
  ["English document", "Republic Aviation Authority\nPilot License\nName: Israel Cohen\nLicense No: PIL-1234"],
  ["No name field at all", "מספר זהות 123456789\nתאריך תפוגה 31/12/2030"],
];

for (const [label, text] of cases) {
  console.log(`${label}: ${JSON.stringify(extractNameFromText(text))}`);
}
