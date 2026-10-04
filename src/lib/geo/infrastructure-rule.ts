/**
 * תקנות הטיס (הפעלת טיסן), תשפ"ד 2024 — "אין להטיס במרחק הקטן מ-150 מטר מתשתית אלא אם כן התשתית היא בבעלותו או
 * בחזקתו של מי שמפעיל את הטיסן או שהבעלים או המחזיק של התשתית הסכים לכך", ובנוסף: "ניתן להטיס מעל אדם או תשתית עם
 * טיסן זעיר" (עד 250 גרם) בתנאים — אין חלקים נעים גלויים, ואינו שוהה מעל אדם או מעל כלי רכב בתנועה.
 *
 * So for a sport/leisure pilot a building within 150 m is not a wall: it is a declaration. A heavier drone needs the
 * owner's consent and goes to a dispatcher; a micro drone with the conditions declared may be approved at once.
 * (The commercial regulation is different — special authorization, תקנה 32 — and is untouched here.)
 */
export const MICRO_DRONE_MAX_GRAMS = 250;

export type InfrastructureDeclaration = "owner_consent" | "micro_drone_conditions";

export const INFRASTRUCTURE_DECLARATION_LABELS: Record<InfrastructureDeclaration, string> = {
  owner_consent: "בעל המבנה הסכים לטיסה (או שהמבנה בבעלותי)",
  micro_drone_conditions: "הטיסן שלי עד 250 גרם, ללא חלקים נעים גלויים, ולא אשהה מעל אדם או רכב בתנועה",
};

export function isMicroDrone(mtowGrams: number | null | undefined): boolean {
  return typeof mtowGrams === "number" && mtowGrams > 0 && mtowGrams <= MICRO_DRONE_MAX_GRAMS;
}

export type InfrastructureOutcome =
  /** Nothing within the legal distance. */
  | { outcome: "not_applicable" }
  /** A commercial pilot: the special-authorization path, as before. */
  | { outcome: "special_authorization" }
  /** A micro drone with its conditions declared — no further approval needed for the infrastructure. May be approved at once. */
  | { outcome: "exempt_micro" }
  /** The owner's consent was declared — a dispatcher reviews; never approved automatically. */
  | { outcome: "owner_consent" }
  /** A hobby pilot must declare one of `options` before the request can be submitted. */
  | { outcome: "declaration_required"; options: InfrastructureDeclaration[] };

export function resolveInfrastructureRule(input: {
  isHobby: boolean;
  /** There is infrastructure within the legal distance of the point. */
  infrastructureNearby: boolean;
  mtowGrams: number | null | undefined;
  declaration: InfrastructureDeclaration | null | undefined;
}): InfrastructureOutcome {
  if (!input.infrastructureNearby) return { outcome: "not_applicable" };
  if (!input.isHobby) return { outcome: "special_authorization" };

  const micro = isMicroDrone(input.mtowGrams);
  if (input.declaration === "micro_drone_conditions" && micro) return { outcome: "exempt_micro" };
  if (input.declaration === "owner_consent") return { outcome: "owner_consent" };
  return {
    outcome: "declaration_required",
    options: micro ? ["micro_drone_conditions", "owner_consent"] : ["owner_consent"],
  };
}
