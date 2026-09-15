import { gunzipSync } from "zlib";

/**
 * Local authoritative "is this point near a building" check, replacing the
 * OSM/Overpass-based residential-area lookup for the legal
 * distance-from-infrastructure rule (see flight-rules.ts). Backed by a
 * pre-computed 20m-resolution bitmap of the whole VIDA/Overture buildings
 * dataset (see scratchpad tooling — not checked in, ~3.5M buildings,
 * buffered by the exact altitude bands the app offers) hosted as a static
 * file on R2, one grid per altitude band so this stays a flat O(1) bit
 * lookup with no per-request geometry work.
 */

// Matches supabase/migrations tooling output — grid covers Israel + West
// Bank at 20m cells, one bit per cell, gzip-compressed on the wire.
const COLS = 8306;
const ROWS = 22264;
const GRID_M = 20;
const LON_MIN = 34.2;
const LAT_MIN = 29.4;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 94915.90309589755;

const SUPPORTED_BUFFERS_M = [50, 100, 150] as const;
export type ProximityBufferM = (typeof SUPPORTED_BUFFERS_M)[number];

const gridCache = new Map<ProximityBufferM, Buffer>();

async function loadGrid(bufferM: ProximityBufferM): Promise<Buffer> {
  const cached = gridCache.get(bufferM);
  if (cached) return cached;

  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL not configured");
  const res = await fetch(`${base}/proximity-grid/${bufferM}m.bin`);
  if (!res.ok) throw new Error(`proximity grid fetch failed: ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const packed = gunzipSync(gz);
  gridCache.set(bufferM, packed);
  return packed;
}

/** Nearest-supported buffer distance at or above `meters` — the grids are pre-computed only for the app's fixed altitude bands (50/100/150m). */
export function nearestSupportedBufferM(meters: number): ProximityBufferM {
  for (const b of SUPPORTED_BUFFERS_M) {
    if (meters <= b) return b;
  }
  return 150;
}

/**
 * true = a building's centroid is within `bufferM` of (lon, lat), i.e. this
 * point is inside the "near infrastructure" zone at that distance. Points
 * outside the grid's coverage (should not happen for a request already
 * inside Israel's operating envelope) are treated as clear.
 */
export async function isNearBuilding(lon: number, lat: number, bufferM: ProximityBufferM): Promise<boolean> {
  const grid = await loadGrid(bufferM);
  const col = Math.round(((lon - LON_MIN) * M_PER_DEG_LON) / GRID_M);
  const row = Math.round(((lat - LAT_MIN) * M_PER_DEG_LAT) / GRID_M);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  const idx = row * COLS + col;
  const byte = grid[idx >> 3] ?? 0;
  return (byte & (1 << (idx & 7))) !== 0;
}
