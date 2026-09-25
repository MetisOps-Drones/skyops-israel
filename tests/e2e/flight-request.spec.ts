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
