import type { Tables } from "@/lib/types/database.types";

/**
 * Client-side mirror of the server trigger validate_flight_request_requirements
 * (0021_request_validation_and_business.sql) — same license-type/weight-class/
 * request-type matching, same non-expired requirement. This is advisory only:
 * the trigger is what actually enforces it, and stays the sole source of
 * truth. The point here is purely UX — surfacing a clear "you need a license
 * on file for this drone" message before the pilot fills out the whole form,
 * instead of only after submit via a raw Postgres error from the trigger.
 */
export interface LicenseRequirementCheck {
  ok: boolean;
  matchingLicenseType: Tables<"pilot_licenses">["license_type"] | null;
  /** Non-hobby matches also require a currently-valid insurance_certificate document — see the same trigger. */
  needsInsurance: boolean;
}

const LICENSE_RANK: Record<Tables<"pilot_licenses">["license_type"], number> = {
  heavy_2000kg: 3,
  commercial_25kg: 2,
  hobby: 1,
};

export function resolveLicenseRequirement(
  licenses: Tables<"pilot_licenses">[],
  droneMtowGrams: number,
  requestType: "basic_auto_100m" | "manual_notam_bubble"
): LicenseRequirementCheck {
  const now = new Date();
  const candidates = licenses.filter((l) => {
    if (l.status === "expired" || new Date(l.expires_at) < now) return false;
    if (requestType === "manual_notam_bubble" && l.license_type === "hobby") return false;
    if (l.license_type === "hobby") return droneMtowGrams <= 5000;
    if (l.license_type === "commercial_25kg") return droneMtowGrams <= 25000;
    if (l.license_type === "heavy_2000kg") return droneMtowGrams <= 2000000;
    return false;
  });
  candidates.sort((a, b) => LICENSE_RANK[b.license_type] - LICENSE_RANK[a.license_type]);
  const matchingLicenseType = candidates[0]?.license_type ?? null;
  return {
    ok: matchingLicenseType !== null,
    matchingLicenseType,
    needsInsurance: matchingLicenseType !== null && matchingLicenseType !== "hobby",
  };
}
