import { test, expect } from "@playwright/test";
import { readCredentials, login } from "./helpers";

test("pilot can log in and lands on the map", async ({ page }) => {
  const creds = readCredentials("E2E_HOBBY");
  test.skip(!creds, "Set E2E_HOBBY_EMAIL / E2E_HOBBY_PASSWORD to run this spec");
  if (!creds) return;

  await login(page, creds);
  await expect(page.getByRole("button", { name: "תפריט MetisOps" })).toBeVisible();
});
