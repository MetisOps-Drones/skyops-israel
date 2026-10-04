import { test, expect } from "@playwright/test";
import { readCredentials, login } from "./helpers";

/**
 * Covers the platform's single most critical path: a pilot dropping a pin
 * and reaching the flight-request form. Doesn't submit (submitting creates
 * a real flight_requests row against production) -- just proves the
 * map-click -> pin -> drawer sequence still opens the form, which is exactly
 * the sequence a cross-user cache bug or a broken empty-state silently
 * breaks (see the auth-cache-leak fix from this same audit round).
 */
test("pilot can open the flight-request drawer from the map", async ({ page }) => {
  const creds = readCredentials("E2E_HOBBY");
  test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
  if (!creds) return;

  await login(page, creds);

  await page.getByRole("button", { name: "דקירת מרחב אווירי לתיאום" }).click();

  const map = page.getByRole("region", { name: "Map" });
  await map.click({ position: { x: 400, y: 350 } });
  // First click drops a draggable pin; clicking it again opens the drawer.
  await map.click({ position: { x: 400, y: 350 } });

  await expect(page.getByRole("dialog").getByText("פרטי בקשת טיסה")).toBeVisible({ timeout: 10_000 });
  // Either the drone picker or the inline "no drone yet" register/empty
  // state must render -- never a blank/broken form.
  await expect(
    page.getByText("כדי לתאם טיסה יש לרשום רחפן").or(page.getByLabel("כלי טיס"))
  ).toBeVisible();
});

/**
 * Regression: clearing the radius field (the only way to type a different
 * number) used to push 0 into state, which threw out of the airspace check's
 * render and crashed the whole app. The field must survive being emptied,
 * half-typed and out of range.
 */
test("emptying the radius field does not crash the request form", async ({ page }) => {
  const creds = readCredentials("E2E_HOBBY");
  test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
  if (!creds) return;

  await login(page, creds);
  await page.getByRole("button", { name: "דקירת מרחב אווירי לתיאום" }).click();
  const map = page.getByRole("region", { name: "Map" });
  await map.click({ position: { x: 400, y: 350 } });
  await map.click({ position: { x: 400, y: 350 } });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("פרטי בקשת טיסה")).toBeVisible({ timeout: 10_000 });

  const radius = dialog.locator("#radius");
  await radius.fill("");
  await expect(dialog.getByText("פרטי בקשת טיסה")).toBeVisible();
  await radius.fill("3");
  await expect(dialog.getByText("הרדיוס חייב להיות בין")).toBeVisible();
  await radius.fill("250");
  await expect(dialog.getByText("הרדיוס חייב להיות בין")).toBeHidden();
  await expect(dialog.getByText("פרטי בקשת טיסה")).toBeVisible();
});
