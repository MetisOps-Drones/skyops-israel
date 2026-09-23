import { windSafety } from "./windSafety";

export interface ForecastSample {
  time: Date;
  windSpeedMs: number | null;
  precipitation: boolean;
}

/**
 * OpenWeatherMap's free 5-day/3-hour forecast — same API key as
 * src/app/api/weather/route.ts's current-conditions proxy, called directly
 * here (server-side only, inside a Server Action, not a client fetch) since
 * nothing browser-side needs this data shape.
 */
export async function fetchForecast(lat: number, lon: number): Promise<ForecastSample[] | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 3600 } });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const data = await response.json();
  const list: Array<{
    dt: number;
    wind?: { speed?: number };
    rain?: unknown;
    snow?: unknown;
    pop?: number;
  }> = data.list ?? [];

  return list.map((sample) => ({
    time: new Date(sample.dt * 1000),
    windSpeedMs: typeof sample.wind?.speed === "number" ? sample.wind.speed : null,
    // pop (probability of precipitation) >= 0.4 treated the same as
    // observed rain/snow — the forecast endpoint often omits rain/snow
    // objects even when real precipitation risk is flagged via pop.
    precipitation: Boolean(sample.rain || sample.snow || (sample.pop ?? 0) >= 0.4),
  }));
}

export interface RecommendedWindow {
  start: Date;
  end: Date;
  windSpeedMs: number | null;
}

/**
 * Earliest "safe" (per the same windSafety thresholds the map itself uses)
 * 3-hour forecast slot within the next `hoursAhead` hours — not the calmest
 * one, since a pilot planning today's flight cares more about "when can I
 * go" than squeezing out the single best number somewhere at 4am.
 */
export function findBestWindow(
  samples: ForecastSample[],
  now: Date = new Date(),
  hoursAhead = 24
): RecommendedWindow | null {
  const horizon = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const upcoming = samples
    .filter((s) => s.time >= now && s.time <= horizon)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const best = upcoming.find((s) => windSafety(s.windSpeedMs, s.precipitation) === "safe");
  if (!best) return null;

  return {
    start: best.time,
    end: new Date(best.time.getTime() + 3 * 60 * 60 * 1000),
    windSpeedMs: best.windSpeedMs,
  };
}
