import type { AipZoneKind } from "@/lib/types/database.types";

/**
 * Plain-language names, not ICAO/AIP jargon — a hobby pilot with a מטיסן
 * license, not an air-traffic controller, is the reader. Each one still
 * keeps the official code in parentheses for anyone who wants to look it
 * up, but the words themselves should make sense on a first read.
 */
export const AIP_ZONE_KIND_LABELS: Record<AipZoneKind, string> = {
  CTR: "מרחב פיקוח שדה תעופה (CTR)",
  ATZ: "מרחב תעבורה של שדה תעופה קטן (ATZ)",
  TMA: "מרחב פיקוח גבוה ליד שדה תעופה (TMA)",
  CTA: "מרחב טיסה מבוקר למטוסים (CTA)",
  RESTRICTED: "אזור עם הגבלות טיסה (LLR)",
  DANGER: "אזור מסוכן לטיסה (LLD)",
  PROHIBITED: "אזור אסור לטיסה לגמרי (LLP)",
};

/** Amber/purple family — distinct from AIRSPACE_ZONE_COLORS so the two layers never look interchangeable. */
export const AIP_ZONE_KIND_COLORS: Record<AipZoneKind, string> = {
  CTR: "#7c3aed",
  ATZ: "#c026d3",
  TMA: "#0891b2",
  CTA: "#0e7490",
  RESTRICTED: "#b45309",
  DANGER: "#b91c1c",
  PROHIBITED: "#78350f",
};

/** Bright, distinct from both zone color families above — a live NOTAM is time-sensitive and current, not a standing classification. */
export const LIVE_NOTAM_COLOR = "#ea580c";

/**
 * Dispatcher-facing (not pilot-facing) legal requirement per zone kind —
 * what the *dispatcher* must verify/obtain before approving a request that
 * overlaps this kind of zone, not just "why it's flagged". Sourced from the
 * same regulatory basis as flight-rules.ts's blockLevelForKind, made
 * concrete: CTR is Class C controlled airspace around an active airport —
 * no drone entry without the tower's own explicit clearance, obtained by
 * the dispatcher coordinating directly with ATC and (for LLBG specifically)
 * security control, not just a standing in-app approval. RESTRICTED/DANGER/
 * PROHIBITED text mirrors the identical regulation clause both CAAI laws
 * use for those categories.
 */
export const AIP_ZONE_KIND_DISPATCHER_REQUIREMENT: Record<AipZoneKind, string> = {
  CTR: 'מרחב פיקוח בדרגה C סביב שדה תעופה פעיל — אסור להטיס בו ("לא ניתן להטיס באזור פיקוח"), וגם במרחק קטן מ-2 ק"מ מגבולו. המערכת חוסמת הגשת בקשה לנקודה כזו בכל סוג חשבון; אם בקשה כזו הגיעה בכל זאת, אין לאשר אותה ללא היתר מפורש ומוקדם ממגדל הפיקוח של השדה (ובנתב"ג — גם מול גורמי הביטחון).',
  ATZ: 'מרחב תעבורה של שדה קטן — אסור להטיס בו ("לא ניתן להטיס באזור פיקוח שדה") וגם במרחק קטן מ-2 ק"מ מגבולו. המערכת חוסמת הגשת בקשה בכל סוג חשבון; אישור אפשרי רק עם היתר מפורש ומוקדם ממפעיל השדה/המגדל.',
  TMA: "מרחב פיקוח גבוה ליד שדה תעופה — ודא שגובה הטיסה המבוקש אינו חוצה את רצפת המרחב המבוקר בנקודה זו; אם כן, נדרש תיאום נוסף מול הגורם השולט.",
  CTA: "מרחב טיסה מבוקר למטוסים — כנ\"ל: ודא שגובה הטיסה המבוקש אינו חוצה את רצפת המרחב בנקודה זו לפני אישור.",
  RESTRICTED: "אזור מוגבל (LLR) — טיסה מותרת רק לפי התנאים שנקבעו לאזור זה או באישור הגורם השולט בו. יש לבדוק את התנאים הספציפיים לפני אישור, לא רק את החפיפה הגאומטרית.",
  DANGER: 'אזור מסוכן לטיסה (LLD) — אסורה טיסה ללא אישור פרטני של מנהל רת"א (לא תיאום עצמאי דרך המערכת). זמין רק לחשבון ארגון, ורק לאחר קבלת האישור הפרטני בפועל מחוץ למערכת.',
  PROHIBITED: 'אזור אסור לטיסה (LLP, כולל אזורי הגבלת בסיסי חיל האוויר של רת"א) — אסור להטיס בו. המערכת חוסמת הגשת בקשה בכל סוג חשבון; אם בקשה כזו הגיעה בכל זאת, אין לאשר אותה ללא אישור פרטני של מנהל רת"א שהתקבל בפועל מחוץ למערכת.',
};
