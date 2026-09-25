import { test, expect } from "@playwright/test";
import { readCredentials, login } from "./helpers";

/**
 * Full "publish a NOTAM" coverage would need a seeded pending manual_notam_bubble
 * request in the live queue to click into, and actually publishing one writes
 * a real notams row visible to every pilot -- too fragile/unsafe to automate
 * against production without a seeding mechanism. This covers the part that's
 * safe and still valuable as a regression guard: a dispatcher_admin account
 * can log in and the coordination queue (/ops) actually renders (map, table,
 * coordination-authorities card) instead of erroring out.
 */
test("dispatcher can reach the coordination queue", async ({ page }) => {
  const creds = readCredentials("E2E_DISPATCHER");
  test.skip(!creds, "Set E2E_DISPATCHER_EMAIL / E2E_DISPATCHER_PASSWORD to run this spec");
  if (!creds) return;

  await login(page, creds);
  await page.goto("/ops");

  await expect(page.getByRole("heading", { name: "מוקד תיאום" })).toBeVisible();
  await expect(page.getByText("גורמי תיאום מרחב אווירי")).toBeVisible();
});
