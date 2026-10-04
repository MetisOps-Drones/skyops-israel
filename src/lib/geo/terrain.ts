const SHARED_USER_AGENT = "Metisim-DroneApp/1.0 (+https://metis-ops.com)";

/**
 * Ground elevation (meters AMSL) at a point — Open Topo Data (SRTM 30m, global). Public instance caps
 * at 1 req/sec and 1000 req/day: fine for this app's volume, but if usage grows this should move to a
 * self-hosted instance. Returns null on any failure — callers must treat "unknown" conservatively,
 * never as zero.
 */
export async function fetchTerrainElevationM(lat: number, lon: number, timeoutMs = 10_000): Promise<number | null> {
  try {
    const res = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lon}`, {
      headers: { "User-Agent": SHARED_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const elevation = data?.results?.[0]?.elevation;
    return typeof elevation === "number" ? elevation : null;
  } catch {
    return null;
  }
}
