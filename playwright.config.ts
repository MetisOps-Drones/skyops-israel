import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Next.js loads .env.local itself for the dev server process, but this config
// runs as a plain Node script, so it needs to load the same file explicitly
// to see E2E_* test-account credentials (see tests/e2e/README.md).
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

/**
 * These run against a real dev server hitting the real (production) Supabase
 * project -- there's no local/staging DB to point at yet -- so every test
 * needs dedicated test accounts (never real pilot/org data) via the env vars
 * documented in tests/e2e/README.md. A test whose required env vars are
 * missing skips itself rather than failing, so `npx playwright test` stays
 * safe to run without every credential configured.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
