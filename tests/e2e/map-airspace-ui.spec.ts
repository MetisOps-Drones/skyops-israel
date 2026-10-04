import { test, expect, type Page } from "@playwright/test";
import { readCredentials, login } from "./helpers";

/**
 * What a hobby pilot actually SEES when inspecting a point on the map — the
 * verdict banner, and that the request button appears only where a
 * coordination request is allowed. Mapbox geocoding is stubbed so each test
 * can jump the map to an exact coordinate (the same flow as picking a search
 * result), without clicking pixels on a canvas.
 */
async function inspectPoint(page: Page, lng: number, lat: number) {
  await page.route("https://api.mapbox.com/geocoding/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ features: [{ id: "stub.1", place_name: "נקודת בדיקה", center: [lng, lat] }] }),
    })
  );
  const search = page.getByPlaceholder("חיפוש כתובת, רחפן או בקשת טיסה");
  await search.fill("נקודת בדיקה");
  await page.getByRole("button", { name: /נקודת בדיקה/ }).click();
  return page.getByRole("dialog").filter({ hasText: "פרטי מיקום" });
}

test.describe("point inspector verdicts", () => {
  test.beforeEach(async ({ page }) => {
    const creds = readCredentials("E2E_HOBBY");
    test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
    await login(page, creds!);
  });

  test("on the Hatzor runway: forbidden, immediately, with no request button", async ({ page }) => {
    const card = await inspectPoint(page, 34.72732, 31.76168);
    await expect(card.getByText("אסור להטיס באזור זה")).toBeVisible({ timeout: 15_000 });
    await expect(card.getByRole("button", { name: "בקשת תיאום לנקודה זו" })).toHaveCount(0);
  });

  test("a prohibited area (Jerusalem, LLP13): forbidden", async ({ page }) => {
    const card = await inspectPoint(page, 35.2137, 31.7683);
    await expect(card.getByText("אסור להטיס באזור זה")).toBeVisible({ timeout: 15_000 });
  });

  test("Shapir — inside the Hatzor CTR, 3 km from the runway: coordination with the tower, not forbidden", async ({ page }) => {
    const card = await inspectPoint(page, 34.7272, 31.6983);
    await expect(card.getByText(/בתוך מרחב מבוקר \(CTR\/ATZ\)/)).toBeVisible({ timeout: 45_000 });
    await expect(card.getByText("אסור להטיס באזור זה")).toHaveCount(0);
  });

  test("the verdict banner is one line — the legal explanation lives under the 'why' disclosure", async ({ page }) => {
    const card = await inspectPoint(page, 34.72732, 31.76168);
    await expect(card.getByText("אסור להטיס באזור זה")).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/לפי הפמ"ת והתקנות/)).toBeHidden();
    await card.getByText("למה? — פירוט מלא").click();
    await expect(card.getByText(/לפי הפמ"ת והתקנות/)).toBeVisible();
  });
});
