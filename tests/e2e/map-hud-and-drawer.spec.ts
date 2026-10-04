import { test, expect, type Page } from "@playwright/test";
import { readCredentials, login } from "./helpers";

/**
 * UI audit follow-ups: the top bar must agree with the location card, must not sit on the zoom
 * buttons, and the request form must lead with the verdict on the point (no contradictory legacy
 * "demo" status block).
 */
async function inspectPoint(page: Page, lng: number, lat: number, label: string) {
  await page.route("https://api.mapbox.com/geocoding/**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ features: [{ id: "stub.1", place_name: label, center: [lng, lat] }] }) })
  );
  await page.getByPlaceholder("חיפוש כתובת, רחפן או בקשת טיסה").fill(label);
  await page.getByRole("button", { name: new RegExp(label) }).first().click();
  const card = page.getByRole("dialog").filter({ hasText: "פרטי מיקום" });
  await card.waitFor({ timeout: 20_000 });
  return card;
}

test.describe("map top bar", () => {
  test.use({ geolocation: { latitude: 32.0853, longitude: 34.7818 }, permissions: ["geolocation"] });

  test("inside the Ben Gurion control zone the bar says coordination — not forbidden — and leaves the zoom buttons free", async ({ page }) => {
    const creds = readCredentials("E2E_HOBBY");
    test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
    await login(page, creds!);
    await expect(page.getByText("מרחב מבוקר — נדרש תיאום")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("אסור לטיסה במיקומך")).toHaveCount(0);
    await expect(page.getByText(/עד 0 מ'/)).toHaveCount(0);

    // The "+" zoom button is the element under its own centre, i.e. nothing is drawn over it.
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const box = (await zoomIn.boundingBox())!;
    const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest("button")?.getAttribute("aria-label"), [box.x + box.width / 2, box.y + box.height / 2]);
    expect(onTop).toBe("Zoom in");
  });
});

test.describe("request form", () => {
  test("opens with the verdict on the point above the fields, and without the legacy 'demo' status", async ({ page }) => {
    const creds = readCredentials("E2E_HOBBY");
    test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
    await login(page, creds!);
    // A firing-range (weekday-only restricted) point in the Negev: coordination is allowed for a hobby account.
    const card = await inspectPoint(page, 34.8186, 30.4344, "נקרנג");
    await card.getByRole("button", { name: "בקשת תיאום לנקודה זו" }).click();
    const form = page.getByRole("dialog").filter({ hasText: "פרטי בקשת טיסה" });
    const verdict = form.getByText(/אזור מוגבל — טיסה רק לפי תנאי האזור/);
    await expect(verdict).toBeVisible({ timeout: 30_000 });
    const verdictY = (await verdict.boundingBox())!.y;
    const radiusY = (await form.getByText("רדיוס (מטרים)").boundingBox())!.y;
    expect(verdictY, "verdict sits above the radius field").toBeLessThan(radiusY);
    await expect(form.getByText("סטטוס בדיקת מרחב אווירי")).toHaveCount(0);
    await expect(form.getByText("(הדגמה)")).toHaveCount(0);
  });
});
