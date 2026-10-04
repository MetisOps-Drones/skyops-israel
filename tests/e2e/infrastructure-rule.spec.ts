import { test, expect } from "@playwright/test";
import { isMicroDrone, resolveInfrastructureRule, MICRO_DRONE_MAX_GRAMS } from "../../src/lib/geo/infrastructure-rule";
import { readCredentials, login } from "./helpers";

/**
 * תקנות הטיס (הפעלת טיסן): within 150 m of infrastructure a sport/leisure pilot needs the owner's consent,
 * or flies a micro drone (≤250 g) under the regulation's conditions. Immediate approval only for the micro drone.
 */
const base = { isHobby: true, infrastructureNearby: true };

test.describe("infrastructure rule for a sport/leisure pilot", () => {
  test("250 g is a micro drone, 251 g is not; unknown weight is not", () => {
    expect(MICRO_DRONE_MAX_GRAMS).toBe(250);
    expect(isMicroDrone(250)).toBe(true);
    expect(isMicroDrone(249)).toBe(true);
    expect(isMicroDrone(251)).toBe(false);
    expect(isMicroDrone(null)).toBe(false);
    expect(isMicroDrone(0)).toBe(false);
  });

  test("nothing nearby: not applicable, whatever the drone", () => {
    expect(resolveInfrastructureRule({ ...base, infrastructureNearby: false, mtowGrams: 900, declaration: null })).toEqual({ outcome: "not_applicable" });
  });

  test("a micro drone with its conditions declared is exempt — the only path to an immediate approval", () => {
    expect(resolveInfrastructureRule({ ...base, mtowGrams: 249, declaration: "micro_drone_conditions" })).toEqual({ outcome: "exempt_micro" });
  });

  test("a heavier drone cannot use the micro-drone declaration", () => {
    const r = resolveInfrastructureRule({ ...base, mtowGrams: 900, declaration: "micro_drone_conditions" });
    expect(r).toEqual({ outcome: "declaration_required", options: ["owner_consent"] });
  });

  test("the owner's consent goes to a dispatcher — for a micro drone too, never automatic", () => {
    expect(resolveInfrastructureRule({ ...base, mtowGrams: 900, declaration: "owner_consent" })).toEqual({ outcome: "owner_consent" });
    expect(resolveInfrastructureRule({ ...base, mtowGrams: 200, declaration: "owner_consent" })).toEqual({ outcome: "owner_consent" });
  });

  test("no declaration: it is requested, and the options depend on the drone", () => {
    expect(resolveInfrastructureRule({ ...base, mtowGrams: 200, declaration: null })).toEqual({
      outcome: "declaration_required",
      options: ["micro_drone_conditions", "owner_consent"],
    });
    expect(resolveInfrastructureRule({ ...base, mtowGrams: 1500, declaration: null })).toEqual({ outcome: "declaration_required", options: ["owner_consent"] });
    expect(resolveInfrastructureRule({ ...base, mtowGrams: null, declaration: null })).toEqual({ outcome: "declaration_required", options: ["owner_consent"] });
  });

  test("a commercial pilot is unchanged: special authorization", () => {
    expect(resolveInfrastructureRule({ isHobby: false, infrastructureNearby: true, mtowGrams: 900, declaration: "owner_consent" })).toEqual({ outcome: "special_authorization" });
  });
});

test("a sport/leisure pilot next to buildings is not told 'a private account can't coordinate' — and is asked for a declaration", async ({ page }) => {
  test.setTimeout(120_000);
  const creds = readCredentials("E2E_HOBBY");
  test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
  await login(page, creds!);
  await page.route("https://api.mapbox.com/geocoding/**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ features: [{ id: "s", place_name: "נקבשבע", center: [34.79, 31.252] }] }) })
  ); // central Beer Sheva: buildings within 150 m
  await page.getByPlaceholder("חיפוש כתובת, רחפן או בקשת טיסה").fill("נקבשבע");
  await page.getByRole("button", { name: /נקבשבע/ }).first().click();
  const card = page.getByRole("dialog").filter({ hasText: "פרטי מיקום" });
  await expect(card.getByText(/מותר בהסכמת בעל התשתית, או בטיסן זעיר/)).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText(/מחשבון פרטי/)).toHaveCount(0);

  await card.getByRole("button", { name: "בקשת תיאום לנקודה זו" }).click();
  const form = page.getByRole("dialog").filter({ hasText: "פרטי בקשת טיסה" });
  await expect(form.getByText(/הצהרה נדרשת — תשתית בטווח/)).toBeVisible({ timeout: 60_000 });
  await expect(form.getByText("בעל המבנה הסכים לטיסה (או שהמבנה בבעלותי)")).toBeVisible();
  await expect(form.getByRole("button", { name: "שליחת בקשה" })).toBeDisabled();
});
