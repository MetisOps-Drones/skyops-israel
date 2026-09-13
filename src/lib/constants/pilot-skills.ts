/**
 * Curated suggestion lists for the marketplace pilot-profile tag pickers.
 * Grounded against real industry sources rather than invented: flight-mode
 * naming from ArduPilot's flight-modes reference and DJI's own mode docs
 * (GPS/ATTI/Sport/PosHold/Acro terminology varies by platform — both
 * families are represented); software/drone-model lists from current
 * (2026) drone-mapping-software and enterprise-drone comparison roundups;
 * specializations from drone-industry job-title/careers guides (BVLOS,
 * dock operations, integration). Not exhaustive on purpose — every picker
 * also accepts a free-text custom entry, so this is a starting menu, not a
 * closed enum.
 */

export const UAV_CATEGORIES = [
  "מולטירוטור",
  "כנף קבועה",
  "VTOL (המראה אנכית)",
  "הרמה כבדה",
  "FPV / מירוץ",
  "תחנת עגינה אוטונומית (Dock)",
  "ריסוס חקלאי",
  "משלוחים",
] as const;

export const FLIGHT_MODES = [
  "GPS / P-Mode",
  "ATTI (Attitude)",
  "Stabilize",
  "Sport / S-Mode",
  "Position Hold",
  "Angle",
  "Horizon",
  "Acro / Manual",
  "Loiter",
  "RTL",
] as const;

export const PILOT_SKILLS = [
  "צילום וידאו אווירי",
  "מיפוי ופוטוגרמטריה",
  "הדמיה תרמית",
  "סריקת LiDAR",
  "טיסת לילה",
  "BVLOS (מעבר לטווח ראייה)",
  "ריסוס וחקלאות מדייקת",
  "בדק תשתיות (קווי חשמל, אנטנות, גשרים)",
  "בדק פאנלים סולאריים",
  "FPV חופשי / אקרובטי",
  "חיפוש והצלה",
  "ליווי אירועים והפקות",
  "הטסת מטען",
] as const;

export const PILOT_SOFTWARE = [
  "DJI Pilot 2",
  "DJI Terra",
  "Pix4Dmapper",
  "Pix4Dcloud",
  "DroneDeploy",
  "Agisoft Metashape",
  "WebODM",
  "Mission Planner (ArduPilot)",
  "QGroundControl",
  "Litchi",
  "ArcGIS Drone2Map",
  "DatuMate",
] as const;

export const PILOT_SPECIALIZATIONS = [
  "מטיס ניסוי",
  "אינטגרטור מערכות (UAS Integrator)",
  "מפעיל תחנת עגינה אוטונומית",
  "מטיס BVLOS",
  "מטיס ראשי / מנהל תפעול טיסות",
  "טכנאי תחזוקה ותיקונים",
  "מדריך הטסה",
  "מהנדס פיתוח / אינטגרציית מטען",
  "מומחה מיפוי וסקר",
  "מטיס קולנוע וצילום",
] as const;

/** Coarse service-area tags — enough for a business to filter "someone near me" without needing precise geocoding. */
export const SERVICE_AREAS = [
  "כל הארץ",
  "צפון וגליל",
  "חיפה והקריות",
  "השרון",
  "גוש דן",
  "ירושלים והסביבה",
  "השפלה",
  "דרום ונגב",
  "אילת וערבה",
] as const;

export const DRONE_MODELS = [
  "DJI Mavic 3 Enterprise",
  "DJI Matrice 30T",
  "DJI Matrice 300 RTK",
  "DJI Matrice 350 RTK",
  "DJI Matrice 4T",
  "DJI Phantom 4 RTK",
  "DJI Inspire 2/3",
  "DJI Agras (ריסוס)",
  "DJI Mini (סדרה)",
  "Autel EVO Max 4T",
  "Autel EVO II Enterprise",
  "Skydio X10",
  "Wingtra WingtraOne",
  "senseFly eBee X",
  "Freefly Alta X",
  "Parrot ANAFI USA",
  "מבנה FPV מותאם אישית",
] as const;
