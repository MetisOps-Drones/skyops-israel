import { expect, type Page } from "@playwright/test";

export interface TestCredentials {
  email: string;
  password: string;
}

/** Reads one account's env vars, or returns null if either is missing -- callers use this to test.skip() instead of failing on a missing credential. */
export function readCredentials(prefix: "E2E_HOBBY" | "E2E_DISPATCHER"): TestCredentials | null {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

/** Logs in via the real form (login runs as a Server Action, so there's no API shortcut) and waits for the post-login redirect. */
export async function login(page: Page, creds: TestCredentials) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole("button", { name: "התחבר" }).click();
  await expect(page).toHaveURL(/\/map/, { timeout: 15_000 });
}
