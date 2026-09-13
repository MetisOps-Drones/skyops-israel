import Papa from "papaparse";

/**
 * Parses DJI flight-log CSV/TXT exports (the format produced by DJI CsvView /
 * Airdata-style exports). Column names vary slightly across DJI firmware and
 * export tools, so headers are matched case-insensitively against a list of
 * known aliases rather than a single fixed schema.
 */

export interface TelemetrySample {
  timeMs: number;
  latitude: number | null;
  longitude: number | null;
  altitudeM: number | null;
  distanceM: number | null;
  batteryPercent: number | null;
  speedMs: number | null;
}

export interface ParsedTelemetry {
  samples: TelemetrySample[];
  startTime: Date | null;
  endTime: Date | null;
  durationMinutes: number;
  maxAltitudeM: number;
  maxDistanceM: number;
  minBatteryPercent: number | null;
  sampleCount: number;
}

const COLUMN_ALIASES = {
  timeMs: ["time(millisecond)", "time(ms)", "offsettime(ms)", "time"],
  datetime: ["datetime(utc)", "datetime", "custom.date [local]", "gps:datetime"],
  latitude: ["gps(latitude)", "latitude", "gps:lat", "osd.latitude"],
  longitude: ["gps(longitude)", "longitude", "gps:long", "osd.longitude"],
  altitudeFeet: ["height_above_takeoff(feet)", "altitude(feet)", "osd.altitude [ft]"],
  altitudeMeters: ["height_above_takeoff(meters)", "altitude(meters)", "osd.altitude [m]", "gps(heightmsl)"],
  distanceFeet: ["distance(feet)", "osd.distance [ft]"],
  distanceMeters: ["distance(meters)", "osd.distance [m]"],
  battery: ["battery_percent", "battery_percentage", "osd.battery percent", "capacity_percent"],
  speedMph: ["speed(mph)", "osd.gpslevel", "xspeed(mph)"],
  speedMs: ["speed(m/s)", "osd.speed [m/s]"],
} as const;

function findColumn(headers: string[], aliases: readonly string[]): string | null {
  const lowered = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lowered.indexOf(alias.toLowerCase());
    if (idx !== -1) return headers[idx] ?? null;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

const FEET_TO_METERS = 0.3048;
const MPH_TO_MS = 0.44704;

export function parseDjiTelemetryCsv(csvText: string): ParsedTelemetry {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`Failed to parse telemetry file: ${result.errors[0]?.message ?? "unknown error"}`);
  }

  const headers = result.meta.fields ?? [];
  const cols = {
    timeMs: findColumn(headers, COLUMN_ALIASES.timeMs),
    datetime: findColumn(headers, COLUMN_ALIASES.datetime),
    latitude: findColumn(headers, COLUMN_ALIASES.latitude),
    longitude: findColumn(headers, COLUMN_ALIASES.longitude),
    altitudeFeet: findColumn(headers, COLUMN_ALIASES.altitudeFeet),
    altitudeMeters: findColumn(headers, COLUMN_ALIASES.altitudeMeters),
    distanceFeet: findColumn(headers, COLUMN_ALIASES.distanceFeet),
    distanceMeters: findColumn(headers, COLUMN_ALIASES.distanceMeters),
    battery: findColumn(headers, COLUMN_ALIASES.battery),
    speedMph: findColumn(headers, COLUMN_ALIASES.speedMph),
    speedMs: findColumn(headers, COLUMN_ALIASES.speedMs),
  };

  if (!cols.timeMs && !cols.datetime) {
    throw new Error(
      "Unrecognized telemetry format: no time column found. Expected a DJI CsvView/Airdata-style export."
    );
  }

  let firstDatetime: Date | null = null;
  let lastDatetime: Date | null = null;

  const samples: TelemetrySample[] = result.data.map((row, index) => {
    const rawAltitudeFeet = cols.altitudeFeet ? toNumber(row[cols.altitudeFeet]) : null;
    const rawAltitudeMeters = cols.altitudeMeters ? toNumber(row[cols.altitudeMeters]) : null;
    const altitudeM =
      rawAltitudeMeters ?? (rawAltitudeFeet !== null ? rawAltitudeFeet * FEET_TO_METERS : null);

    const rawDistanceFeet = cols.distanceFeet ? toNumber(row[cols.distanceFeet]) : null;
    const rawDistanceMeters = cols.distanceMeters ? toNumber(row[cols.distanceMeters]) : null;
    const distanceM =
      rawDistanceMeters ?? (rawDistanceFeet !== null ? rawDistanceFeet * FEET_TO_METERS : null);

    const rawSpeedMph = cols.speedMph ? toNumber(row[cols.speedMph]) : null;
    const rawSpeedMs = cols.speedMs ? toNumber(row[cols.speedMs]) : null;
    const speedMs = rawSpeedMs ?? (rawSpeedMph !== null ? rawSpeedMph * MPH_TO_MS : null);

    const timeMs = cols.timeMs ? (toNumber(row[cols.timeMs]) ?? index * 1000) : index * 1000;

    if (cols.datetime) {
      const parsed = new Date(row[cols.datetime] ?? "");
      if (!Number.isNaN(parsed.getTime())) {
        if (!firstDatetime) firstDatetime = parsed;
        lastDatetime = parsed;
      }
    }

    return {
      timeMs,
      latitude: cols.latitude ? toNumber(row[cols.latitude]) : null,
      longitude: cols.longitude ? toNumber(row[cols.longitude]) : null,
      altitudeM,
      distanceM,
      batteryPercent: cols.battery ? toNumber(row[cols.battery]) : null,
      speedMs,
    };
  });

  const altitudes = samples.map((s) => s.altitudeM).filter((v): v is number => v !== null);
  const distances = samples.map((s) => s.distanceM).filter((v): v is number => v !== null);
  const batteries = samples.map((s) => s.batteryPercent).filter((v): v is number => v !== null);

  const durationMinutes =
    firstDatetime && lastDatetime
      ? Math.max(0, Math.round(((lastDatetime as Date).getTime() - (firstDatetime as Date).getTime()) / 60000))
      : samples.length > 0
        ? Math.max(0, Math.round(((samples[samples.length - 1]?.timeMs ?? 0) - (samples[0]?.timeMs ?? 0)) / 60000))
        : 0;

  return {
    samples,
    startTime: firstDatetime,
    endTime: lastDatetime,
    durationMinutes,
    maxAltitudeM: altitudes.length > 0 ? Math.max(...altitudes) : 0,
    maxDistanceM: distances.length > 0 ? Math.max(...distances) : 0,
    minBatteryPercent: batteries.length > 0 ? Math.min(...batteries) : null,
    sampleCount: samples.length,
  };
}

/** Downsamples a parsed telemetry series before persisting to the JSONB `telemetry_data` column. */
export function summarizeTelemetryForStorage(parsed: ParsedTelemetry, maxPoints = 200) {
  const step = Math.max(1, Math.floor(parsed.samples.length / maxPoints));
  const track = parsed.samples
    .filter((_, i) => i % step === 0)
    .map((s) => ({
      t: s.timeMs,
      lat: s.latitude,
      lng: s.longitude,
      alt: s.altitudeM !== null ? Math.round(s.altitudeM * 10) / 10 : null,
      dist: s.distanceM !== null ? Math.round(s.distanceM * 10) / 10 : null,
      batt: s.batteryPercent,
    }));

  return {
    source: "dji_csv" as const,
    sampleCount: parsed.sampleCount,
    maxAltitudeM: parsed.maxAltitudeM,
    maxDistanceM: parsed.maxDistanceM,
    minBatteryPercent: parsed.minBatteryPercent,
    track,
  };
}
