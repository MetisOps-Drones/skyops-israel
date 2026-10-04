import { test, expect } from "@playwright/test";
import { locationStatusFor } from "../../src/lib/geo/location-status";
import { zoneVerdictFor, type ZoneBlockLevel } from "../../src/lib/geo/flight-rules";

/**
 * The map's top-bar pill must say what the location card says. It used to show a red "forbidden"
 * for anything that wasn't "none" — including a control zone that only needs the tower's coordination.
 */
const base = { hasOrg: false, blockedFromGround: false, legacyBlocked: false, notamInside: false };

test.describe("top-bar location status", () => {
  test("a clear point is clear", () => {
    expect(locationStatusFor({ ...base, blockLevel: "none" })).toEqual({ tone: "clear", label: "מותר לטיסה במיקומך" });
  });

  test("a control zone (CTR/ATZ) is coordination, NOT forbidden", () => {
    const s = locationStatusFor({ ...base, blockLevel: "controlled_airspace" });
    expect(s.tone).toBe("caution");
    expect(s.label).toBe(zoneVerdictFor("controlled_airspace", false).shortLabel);
    expect(s.label).not.toContain("אסור");
  });

  test("a restricted area is coordination", () => {
    expect(locationStatusFor({ ...base, blockLevel: "coordination_ok" }).tone).toBe("caution");
  });

  test("forbidden (prohibited area / runway distance) and a ground-blocked point are forbidden", () => {
    expect(locationStatusFor({ ...base, blockLevel: "forbidden" })).toEqual({ tone: "forbidden", label: "אסור לטיסה במיקומך" });
    expect(locationStatusFor({ ...base, blockLevel: "none", blockedFromGround: true }).tone).toBe("forbidden");
    expect(locationStatusFor({ ...base, blockLevel: "none", legacyBlocked: true }).tone).toBe("forbidden");
  });

  test("a dangerous area: forbidden for a solo account, an approval path for an organization", () => {
    expect(locationStatusFor({ ...base, blockLevel: "director_approval_only" }).tone).toBe("forbidden");
    expect(locationStatusFor({ ...base, hasOrg: true, blockLevel: "director_approval_only" }).tone).toBe("caution");
  });

  test("an active NOTAM on an otherwise clear point asks for coordination", () => {
    const s = locationStatusFor({ ...base, blockLevel: "none", notamInside: true });
    expect(s.tone).toBe("caution");
    expect(s.label).toContain("נוטאם");
  });

  test("the zone verdict outranks a NOTAM; every non-none level has a short label that agrees with its headline's severity", () => {
    expect(locationStatusFor({ ...base, blockLevel: "forbidden", notamInside: true }).tone).toBe("forbidden");
    for (const level of ["coordination_ok", "controlled_airspace", "director_approval_only", "forbidden"] as ZoneBlockLevel[]) {
      for (const hasOrg of [false, true]) {
        const v = zoneVerdictFor(level, hasOrg);
        expect(v.shortLabel, `${level}/${hasOrg}`).not.toBe("");
        expect(locationStatusFor({ ...base, hasOrg, blockLevel: level }).tone === "forbidden", `${level}/${hasOrg}`).toBe(!v.canSubmit);
      }
    }
  });
});
