/**
 * Subscription-plan catalog. Pricing here is a first proposed benchmark (grounded loosely
 * against comparable drone-ops/B2B SaaS pricing — DroneDeploy's per-seat $329-599/yr, and
 * Israeli SMB SaaS running roughly ₪79-999/mo for narrower tools), not validated against real
 * customer willingness-to-pay. There is no billing processor wired in — selecting a plan is the
 * same demo-checkout convention already used by PaywallScreen and the org-upgrade flow (writes the
 * selection, shows a "מצב הדגמה" toast). Feature lists are grounded in what the platform
 * actually has today; "אנליטיקת AI" on the business/פרו plan is aspirational — the current
 * /analytics page is plain event-count dashboards, not AI-driven — kept because it was
 * explicitly requested, but flagged so it isn't oversold before it's built.
 *
 * Each tier (beyond the base one) lists only its OWN additions in `features` — `inheritsFrom`
 * points at the plan it builds on, and the comparison UI renders "הכל מ-{that plan}, ועוד:"
 * above the list, matching a standard tiered-pricing layout (e.g. Monday.com's plan comparison).
 */

export type PlanCategory = "private" | "business" | "org";

export interface CoordinationLimit {
  /** Total flight requests allowed per period, both types combined. */
  count: number;
  period: "week" | "month";
  /** How many of `count` may be a manual NOTAM/polygon request ("בועת NOTAM") — 0 means none allowed. */
  complexAllowed: number;
}

export interface Plan {
  code: string;
  category: PlanCategory;
  name: string;
  /** null = custom/sales-led pricing ("צור קשר לתמחור") */
  priceIls: number | null;
  billingPeriod: "חודש" | null;
  /** This tier's own additions on top of `inheritsFrom` — or the full list, for a base tier. */
  features: string[];
  /** Code of the plan this tier builds on, within the same category. */
  inheritsFrom?: string;
  overageNote?: string;
  highlight?: string;
  /** Eligible to join the freelancer marketplace (business category, standard tier and up). */
  marketplaceEligible?: boolean;
  /** The exact numbers behind each plan's "עד X תיאומים" feature text — null = unlimited (org tier only; see resolveCoordinationLimit in coordination-quota.ts for why it never actually looks this up per org). Enforced server-side in actions/flight-requests.ts and shown client-side via useCoordinationQuota. */
  coordinationLimit: CoordinationLimit | null;
}

export const PRIVATE_PLANS: Plan[] = [
  {
    code: "private_free",
    category: "private",
    name: "חינמי",
    priceIls: 0,
    billingPeriod: null,
    features: ["עד תיאום אחד בשבוע (ללא NOTAM)", "גישה למערכת הלימוד לרישיון מטיסן"],
    overageNote: "כל תיאום נוסף: ₪19",
    coordinationLimit: { count: 1, period: "week", complexAllowed: 0 },
  },
  {
    code: "private_standard",
    category: "private",
    name: "סטנדרטי",
    priceIls: 39,
    billingPeriod: "חודש",
    inheritsFrom: "private_free",
    features: ["עד 3 תיאומים בשבוע (במקום 1)", "יומן טיסות"],
    coordinationLimit: { count: 3, period: "week", complexAllowed: 0 },
  },
];

export const BUSINESS_PLANS: Plan[] = [
  {
    code: "business_free",
    category: "business",
    name: "חינמי",
    priceIls: 0,
    billingPeriod: null,
    features: [
      "עד תיאום אחד בשבוע (ללא NOTAM)",
      "גישה למערכת הלימוד לרישיון מטיסן",
      "רישום רחפן אחד ליומן טיסות",
    ],
    overageNote: "כל תיאום נוסף: ₪29",
    coordinationLimit: { count: 1, period: "week", complexAllowed: 0 },
  },
  {
    code: "business_standard",
    category: "business",
    name: "סטנדרטי",
    priceIls: 129,
    billingPeriod: "חודש",
    inheritsFrom: "business_free",
    features: [
      "עד 7 תיאומים בחודש (ללא תיאומים מורכבים / NOTAM)",
      "יומן טיסות עד 3 כלים (במקום רחפן אחד)",
      "זכאות להצטרף למרקטפלייס המטיסים",
    ],
    marketplaceEligible: true,
    coordinationLimit: { count: 7, period: "month", complexAllowed: 0 },
  },
  {
    code: "business_pro",
    category: "business",
    name: "פרו",
    priceIls: 299,
    billingPeriod: "חודש",
    inheritsFrom: "business_standard",
    features: ["עד 12 תיאומים בחודש (כולל עד תיאום מורכב אחד)", "אנליטיקת AI (בקרוב)"],
    highlight: "מומלץ",
    marketplaceEligible: true,
    coordinationLimit: { count: 12, period: "month", complexAllowed: 1 },
  },
];

// coordinationLimit is null on every org tier — matches ORG_COMMON_FEATURES'
// "תיאומים ללא הגבלה, כולל NOTAM" below, true for all org sizes alike.
export const ORG_PLANS: Plan[] = [
  {
    code: "org_micro",
    category: "org",
    name: "עסק זעיר",
    priceIls: 449,
    billingPeriod: "חודש",
    features: ["1-3 עובדים", "עד 3 רחפנים בצי", "גישה למרקטפלייס המטיסים"],
    coordinationLimit: null,
  },
  {
    code: "org_small",
    category: "org",
    name: "עסק קטן",
    priceIls: 899,
    billingPeriod: "חודש",
    features: ["3-10 עובדים", "עד 5 רחפנים בצי"],
    coordinationLimit: null,
  },
  {
    code: "org_medium",
    category: "org",
    name: "עסק בינוני",
    priceIls: 1590,
    billingPeriod: "חודש",
    features: ["10-20 עובדים", "עד 7 רחפנים בצי"],
    highlight: "מומלץ",
    coordinationLimit: null,
  },
  {
    code: "org_unlimited",
    category: "org",
    name: "ללא הגבלה",
    priceIls: null,
    billingPeriod: null,
    features: ["מעל 20 עובדים", "צי רחפנים ללא הגבלה"],
    coordinationLimit: null,
  },
];

/** Shared across every org tier — not repeated per-card. */
export const ORG_COMMON_FEATURES = [
  "תיאומים ללא הגבלה, כולל NOTAM",
  "יומן טיסות מלא + ניהול צי משותף",
  "הזמנת מטיסים עצמאיים לארגון",
  "לוח אנליטיקה ברמת הארגון",
];

export const ALL_PLANS = [...PRIVATE_PLANS, ...BUSINESS_PLANS, ...ORG_PLANS];

export function findPlan(code: string | null | undefined): Plan | undefined {
  return ALL_PLANS.find((p) => p.code === code);
}

/** Recommends an org plan from the signup wizard's employee-count/drone-count answers — picks
 * whichever tier is large enough to cover BOTH numbers (same bands as ORG_PLANS' own features). */
export function recommendOrgPlan(employeeCount: number, droneCount: number): Plan {
  const bandFor = (employees: number, drones: number) => {
    if (employees <= 3 && drones <= 3) return 0;
    if (employees <= 10 && drones <= 5) return 1;
    if (employees <= 20 && drones <= 7) return 2;
    return 3;
  };
  return ORG_PLANS[bandFor(employeeCount, droneCount)]!;
}
