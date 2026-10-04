import { test, expect, type Page } from "@playwright/test";
import * as turf from "@turf/turf";
import { readCredentials, login } from "./helpers";
import { hasServiceKey, loadAipZones } from "./data";

/**
 * The location card tells the pilot what is limited *at the time asked about*: a helicopter area's
 * 60 m cap holds on weekdays (for hobby and commercial alike), and checking a Saturday shows the cap
 * is not in force then but starts on Sunday.
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

test("a helicopter area: 'you may fly, but only up to 60 m' on a weekday; on a Saturday it is coming, not in force", async ({ page }) => {
  const creds = readCredentials("E2E_HOBBY");
  test.setTimeout(120_000); // the card waits on terrain, building and proximity lookups
  test.skip(!creds || !hasServiceKey, "Set E2E_HOBBY_* and SUPABASE_SERVICE_ROLE_KEY to run this spec");
  const heli = (await loadAipZones()).find((z) => z.weekdays_only && z.code?.startsWith("CAAI-HELI") && z.name.includes("חרמון"));
  test.skip(!heli, "Migration 0093 has not been run yet");
  const [lng, lat] = turf.pointOnFeature(turf.polygon((heli!.geom_geojson as unknown as GeoJSON.Polygon).coordinates)).geometry.coordinates;

  await page.clock.setFixedTime(new Date("2026-10-06T09:00:00Z")); // a Tuesday
  await login(page, creds!);
  const card = await inspectPoint(page, lng!, lat!, "נקחרמון");

  await expect(card.getByText("מותר להטיס במיקומך, אך יש לשים לב:")).toBeVisible({ timeout: 45_000 });
  await expect(card.getByText(/מותר להטיס עד 60 מ' מעל הקרקע בלבד/)).toBeVisible();
  await expect(card.getByText(/תקרת טיסה: עד 50 מ'/)).toBeVisible(); // hobby: the general 50 m is already under the 60 m cap

  // The same point on Saturday noon (Israel): no cap in force, a warning that it starts Sunday.
  await card.getByLabel("בדיקה למועד אחר").fill("2026-10-10T12:00");
  await expect(card.getByText(/בקרוב:.*ייכנס לתוקף/)).toBeVisible();
  await expect(card.getByText(/מותר להטיס עד 60 מ' מעל הקרקע בלבד/)).toHaveCount(0);

  await card.getByRole("button", { name: "חזרה לעכשיו" }).click();
  await expect(card.getByText(/מותר להטיס עד 60 מ' מעל הקרקע בלבד/)).toBeVisible();
});
