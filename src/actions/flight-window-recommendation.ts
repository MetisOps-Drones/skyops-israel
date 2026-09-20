"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchForecast, findBestWindow } from "@/lib/weather/forecast";

interface Candidate {
  label: string;
  point: [number, number]; // [lng, lat]
  key: string; // stable dedup key, independent of the label
}

async function reverseGeocodeLabel(point: [number, number]): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${point[0]}&latitude=${point[1]}&types=place&language=he&access_token=${token}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.features?.[0]?.properties?.name ?? null;
  } catch {
    return null;
  }
}

/** ~1.1km grid — close enough that two requests in "the same area" collapse to one candidate instead of one notification per slightly-different pin. */
function roundKey(point: [number, number]): string {
  return `${point[1].toFixed(2)},${point[0].toFixed(2)}`;
}

function distanceRoughlyEqual(a: [number, number], b: [number, number]): boolean {
  return roundKey(a) === roundKey(b);
}

/**
 * Recommended-flight-window notifications (idea #1 from the product audit):
 * checks the pilot's current live location (passed in from the browser —
 * the server has no other way to know it) plus their own most-visited past
 * coordination areas, and if a genuinely safe wind/precipitation window
 * shows up in the next 24h forecast for any of them, creates a notification
 * pointing at it. Silently a no-op wherever OPENWEATHERMAP_API_KEY isn't
 * configured (fetchForecast returns null) or no safe window exists — this
 * never invents a recommendation it can't back with a real forecast.
 */
export async function checkRecommendedFlightWindows(
  currentLocation: [number, number] | null
): Promise<{ created: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { created: 0 };

  const candidates: Candidate[] = [];

  if (currentLocation) {
    candidates.push({ label: "המיקום הנוכחי שלך", point: currentLocation, key: roundKey(currentLocation) });
  }

  // Areas of interest: the pilot's own most-recent distinct coordination
  // locations — a simple recency-based proxy for "where they usually fly"
  // rather than a full frequency model, which isn't worth the complexity
  // for a couple of forecast checks.
  const { data: pastRequests } = await supabase
    .from("flight_requests")
    .select("center_point_geojson")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const seenAreaKeys = new Set(candidates.map((c) => c.key));
  for (const row of pastRequests ?? []) {
    const geom = row.center_point_geojson as unknown as GeoJSON.Point | null;
    if (geom?.type !== "Point") continue;
    const point = geom.coordinates as [number, number];
    const key = roundKey(point);
    if (seenAreaKeys.has(key)) continue;
    seenAreaKeys.add(key);
    candidates.push({ label: "אזור שבו תיאמת טיסות בעבר", point, key });
    if (candidates.length >= 3) break; // current location + up to 2 areas of interest
  }

  let created = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const candidate of candidates) {
    // One recommendation per area per day — re-running this check (e.g. on
    // every map load) shouldn't spam the same "good window today" notice.
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "recommended_flight_window")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .contains("metadata", { area_key: candidate.key });
    if (existing && existing.length > 0) continue;

    const forecast = await fetchForecast(candidate.point[1], candidate.point[0]);
    if (!forecast) continue;

    const window = findBestWindow(forecast);
    if (!window) continue;

    const label = candidate.label === "המיקום הנוכחי שלך" || !distanceRoughlyEqual(candidate.point, currentLocation ?? [0, 0])
      ? ((await reverseGeocodeLabel(candidate.point)) ?? candidate.label)
      : candidate.label;

    const timeLabel = window.start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
    const windKmh = window.windSpeedMs !== null ? Math.round(window.windSpeedMs * 3.6) : null;

    await supabase.from("notifications").insert({
      user_id: user.id,
      kind: "recommended_flight_window",
      title: `חלון טיסה מומלץ ב${label}`,
      body: `תנאים טובים לטיסה סביב השעה ${timeLabel} היום${windKmh !== null ? ` (רוח כ-${windKmh} קמ"ש)` : ""} — לפי תחזית מזג אוויר, לא תחליף לבדיקה לפני המראה.`,
      metadata: { area_key: candidate.key, lat: candidate.point[1], lon: candidate.point[0] },
    });
    created += 1;
  }

  return { created };
}
