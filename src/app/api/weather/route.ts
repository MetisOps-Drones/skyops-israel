import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy to OpenWeatherMap: keeps the API key off the client and
 * lets us return only the fields flight planning actually needs (D-03, A-04).
 * Ground elevation (MSL) comes from Open-Meteo's free, keyless elevation
 * endpoint (SRTM-based) — OpenWeatherMap's /weather response doesn't include it.
 */
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat/lon נדרשים" }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מזג אוויר לא מוגדר" }, { status: 500 });
  }

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=he&appid=${apiKey}`;
  const elevationUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;

  const [weatherRes, elevationRes] = await Promise.all([
    fetch(weatherUrl, { next: { revalidate: 600 } }),
    fetch(elevationUrl, { next: { revalidate: 86400 } }).catch(() => null),
  ]);

  if (!weatherRes.ok) {
    return NextResponse.json({ error: "שליפת מזג האוויר נכשלה" }, { status: 502 });
  }

  const data = await weatherRes.json();
  const elevationData = elevationRes?.ok ? await elevationRes.json().catch(() => null) : null;
  const elevationM = typeof elevationData?.elevation?.[0] === "number" ? elevationData.elevation[0] : null;

  return NextResponse.json({
    temp_c: data.main?.temp ?? null,
    wind_speed_ms: data.wind?.speed ?? null,
    wind_gust_ms: data.wind?.gust ?? null,
    wind_deg: data.wind?.deg ?? null,
    visibility_m: data.visibility ?? null,
    precipitation: Boolean(data.rain || data.snow),
    description: data.weather?.[0]?.description ?? null,
    icon: data.weather?.[0]?.icon ?? null,
    elevation_m: elevationM,
  });
}
