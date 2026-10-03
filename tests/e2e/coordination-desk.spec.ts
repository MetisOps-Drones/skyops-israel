import { test, expect } from "@playwright/test";
import * as turf from "@turf/turf";
import { AERODROME_RUNWAYS } from "../../src/lib/geo/aerodrome-runways";
import { altitudeAmslFt, mToFt } from "../../src/lib/geo/aip";
import { authorityContacts, isMobileNumber } from "../../src/lib/coordination/authority-contacts";
import {
  buildCoordinationMessage,
  describeFlightAltitude,
  formatLocalPhone,
  normalizePhoneForWhatsApp,
  whatsAppChatLink,
  whatsAppLink,
} from "../../src/lib/coordination/message";
import { findAuthorities, hasServiceKey, loadAipZones, loadAuthorities } from "./data";

/**
 * The coordination desk: who gets suggested for a point, how their numbers
 * are presented, and what the forwarded message says. The data-backed tests
 * read production (service key, SELECT / read-only RPC only) and skip when
 * the key isn't set; the formatting tests are pure.
 */
test.describe("contact numbers and links (pure)", () => {
  test("WhatsApp links normalise Israeli numbers to 972 and never keep the leading 0", () => {
    expect(normalizePhoneForWhatsApp("0586726900")).toBe("972586726900");
    expect(normalizePhoneForWhatsApp("058-672-6900")).toBe("972586726900");
    expect(normalizePhoneForWhatsApp("+972 58 672 6900")).toBe("972586726900");
    expect(whatsAppChatLink("058-672-6900")).toBe("https://wa.me/972586726900");
    expect(whatsAppLink("0586726900", "שלום\nבדיקה")).toBe(`https://wa.me/972586726900?text=${encodeURIComponent("שלום\nבדיקה")}`);
  });

  test("mobile numbers get WhatsApp, landlines get a call button", () => {
    expect(isMobileNumber("058-672-6900")).toBe(true);
    expect(isMobileNumber("0586726900")).toBe(true);
    expect(isMobileNumber("073-3485024")).toBe(false);
    expect(isMobileNumber("03-9711000")).toBe(false);
    expect(formatLocalPhone("0586726900")).toBe("058-672-6900");
  });

  test("labeled contacts are read from the list, and legacy columns are the fallback", () => {
    const base = { phone: "073-3485024", backup_phone: null, whatsapp_phone: "0586726900" };
    const labeled = authorityContacts({ ...base, contacts: [{ label: "מגדל פיקוח", phone: "073-3485024" }, { label: "תיאום טיסות", phone: "058-672-6900" }] });
    expect(labeled.map((c) => c.label)).toEqual(["מגדל פיקוח", "תיאום טיסות"]);
    const legacy = authorityContacts({ ...base, contacts: [] });
    expect(legacy.map((c) => c.phone)).toEqual(["073-3485024", "0586726900"]);
    // junk in the jsonb never crashes the desk
    expect(authorityContacts({ ...base, contacts: [null, 5, { label: "x" }, { phone: "  " }] as never }).length).toBe(2);
  });
});

test.describe("altitude shown to the coordinator", () => {
  test("meters → feet, and AMSL adds the ground elevation (never guessed)", () => {
    expect(mToFt(50)).toBe(164);
    expect(mToFt(100)).toBe(328);
    expect(altitudeAmslFt(50, 56)).toBe(mToFt(106));
    expect(altitudeAmslFt(50, null)).toBeNull();
    expect(describeFlightAltitude(50, null)).toBe("50 מ' מעל הקרקע (164 רגל)");
    expect(describeFlightAltitude(50, 348)).toContain("רגל מעפ\"י");
  });

  test("the forwarded message carries camera, takedown time and the feet/AMSL altitude", () => {
    const request = {
      profiles: { full_name: "טייס בדיקה", phone: "050-0000000" },
      drones: { nickname: "מאביק", model: "Mavic 3", registration_number: "4X-TEST" },
      start_time: "2026-10-05T05:00:00Z",
      end_time: "2026-10-05T09:00:00Z",
      max_altitude_meters: 80,
      flight_purpose: "photography",
      camera_type: "vertical",
      takedown_response_seconds: 150,
      emergency_contact_phone: "050-1234567",
    } as never;
    const msg = buildCoordinationMessage(request, "31°41'54\"N 34°43'38\"E", { altitudeAmslFt: 1250 });
    expect(msg).toContain("80 מ' מעל הקרקע (262 רגל)");
    expect(msg).toContain("1,250 רגל מעפ\"י");
    expect(msg).toContain("מצלמה: אנכית");
    expect(msg).toContain("זמן הורדה מרגע בקשה: 2 דק' 30 שנ'");
  });
});

test.describe("authority suggestions against the AIP layer (production data)", () => {
  test.skip(!hasServiceKey, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local");

  test("Hatzor tower has both labeled numbers, the second one reachable on WhatsApp", async () => {
    const hatzor = (await loadAuthorities()).find((a) => a.name === "מגדל פיקוח בסיס חצור")!;
    const contacts = authorityContacts(hatzor as never);
    expect(contacts.map((c) => c.label)).toEqual(["מגדל פיקוח", "תיאום טיסות"]);
    expect(contacts.map((c) => c.phone)).toEqual(["073-3485024", "058-672-6900"]);
    expect(isMobileNumber(contacts[0]!.phone)).toBe(false);
    expect(isMobileNumber(contacts[1]!.phone)).toBe(true);
  });

  test("the first suggestion at every military runway is that base's own tower (needs migration 0092)", async () => {
    const wrong: string[] = [];
    for (const r of AERODROME_RUNWAYS.filter((x) => x.military)) {
      const mid = r.line[Math.floor(r.line.length / 2)] as [number, number];
      const first = (await findAuthorities(mid[0], mid[1]))[0];
      if (!first || !/בסיס/.test(first.name)) wrong.push(`${r.name}: ${first?.name ?? "NONE"}`);
    }
    expect(wrong).toEqual([]);
  });

  test("every CTR/ATZ zone has at least one coordination authority (known gap: the closed old Eilat airport)", async () => {
    const zones = await loadAipZones();
    const missing: string[] = [];
    for (const z of zones.filter((x) => x.kind === "CTR" || x.kind === "ATZ")) {
      const pt = turf.pointOnFeature(turf.polygon((z.geom_geojson as unknown as GeoJSON.Polygon).coordinates)).geometry.coordinates;
      if ((await findAuthorities(pt[0]!, pt[1]!)).length === 0) missing.push(`${z.code} ${z.name}`);
    }
    expect(missing).toEqual(["LLET אילת (שדה התעופה הישן)"]);
  });

  test("every authority row is well-formed (radius, centre inside Israel, a number)", async () => {
    const bad = (await loadAuthorities())
      .filter((a) => !(a.radius_m > 0) || a.center_lat < 29 || a.center_lat > 33.7 || a.center_lng < 34 || a.center_lng > 36.2 || authorityContacts(a as never).length === 0)
      .map((a) => a.name);
    expect(bad).toEqual([]);
  });
});
