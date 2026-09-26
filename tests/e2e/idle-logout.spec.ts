import { test, expect } from "@playwright/test";
import { readCredentials, login } from "./helpers";

// Must match IDLE_LOGOUT_MS in src/hooks/useIdleLogout.ts -- not imported
// directly since that file is a "use client" React hook module, not meant
// to be evaluated outside a Next.js/browser build.
const IDLE_LOGOUT_MS = 30 * 60 * 1000;

/**
 * The clock has to be installed BEFORE the idle timer's setTimeout is ever
 * registered (i.e. before navigating in at all) -- Playwright's page.clock
 * only virtualizes timers created after install(), so installing it after
 * login would leave the real 30-minute setTimeout untouched and this test
 * would need to actually wait 30 minutes. Fast-forwarding only fakes
 * browser timers, not Node-side Playwright assertion polling or real
 * network calls (login's server action, then the idle timeout's own
 * signOut() call), so both still resolve in real time as expected.
 */
test("pilot is signed out after 30 minutes of no activity", async ({ page }) => {
  const creds = readCredentials("E2E_HOBBY");
  test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
  if (!creds) return;

  await page.clock.install();
  await login(page, creds);

  await page.clock.fastForward(IDLE_LOGOUT_MS + 5_000);

  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
  await expect(page.getByText("נותקת אוטומטית עקב חוסר פעילות")).toBeVisible();
});

test("real activity resets the idle timer", async ({ page }) => {
  const creds = readCredentials("E2E_HOBBY");
  test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
  if (!creds) return;

  await page.clock.install();
  await login(page, creds);

  // Just under the timeout, then a real interaction, then past the ORIGINAL
  // deadline -- staying logged in here is what proves activity actually
  // resets the timer instead of the timeout simply being wrong.
  await page.clock.fastForward(IDLE_LOGOUT_MS - 5_000);
  await page.mouse.move(100, 100);
  await page.clock.fastForward(10_000);

  await expect(page).toHaveURL(/\/map/);
});
