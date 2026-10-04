import * as turf from "@turf/turf";
import type { ControlTowerFlightRequest } from "@/hooks/useFlightRequests";
import type { CoordinationAuthority } from "@/hooks/useCoordinationAuthorities";

function footprintOf(
  request: Pick<ControlTowerFlightRequest, "request_type" | "polygon_geojson" | "center_point_geojson" | "radius_meters">
): GeoJSON.Feature | null {
  const polygonGeojson = request.polygon_geojson as unknown as GeoJSON.MultiPolygon | null;
  if (request.request_type === "manual_notam_bubble" && polygonGeojson) {
    return turf.multiPolygon(polygonGeojson.coordinates);
  }
  const point = request.center_point_geojson as unknown as GeoJSON.Point | null;
  if (!point || point.type !== "Point") return null;
  return turf.circle(point.coordinates as [number, number], Math.max(request.radius_meters ?? 100, 10) / 1000, {
    units: "kilometers",
  });
}

/**
 * Client-side mirror of the overlapping_flight_requests() RPC (0055) — same
 * status set (pending_dispatcher/submitted_to_iaf/notam_published/
 * auto_cleared), same time-window + spatial-intersection rule — computed
 * once over the whole active/pending set instead of one RPC round trip per
 * row. useControlTowerFlightRequests already fetches exactly this status
 * set elsewhere (the map's own control-tower layer), so this reuses that
 * data rather than adding a new query; PendingRequestsTable used to run
 * this as N separate per-row queries.
 */
export function computeOverlapCounts(allActive: ControlTowerFlightRequest[]): Map<string, number> {
  const withFootprint = allActive
    .map((r) => ({ r, footprint: footprintOf(r) }))
    .filter((x): x is { r: ControlTowerFlightRequest; footprint: GeoJSON.Feature } => x.footprint !== null);

  const counts = new Map<string, number>();
  for (const a of withFootprint) {
    let count = 0;
    const aStart = new Date(a.r.start_time).getTime();
    const aEnd = new Date(a.r.end_time).getTime();
    for (const b of withFootprint) {
      if (a.r.id === b.r.id || a.r.user_id === b.r.user_id) continue;
      const bStart = new Date(b.r.start_time).getTime();
      const bEnd = new Date(b.r.end_time).getTime();
      if (!(bStart < aEnd && bEnd > aStart)) continue;
      if (!turf.booleanIntersects(a.footprint, b.footprint)) continue;
      count++;
    }
    counts.set(a.r.id, count);
  }
  return counts;
}

/**
 * Client-side mirror of find_coordination_authority()'s st_dwithin radius
 * check — a plain "is this point within any authority's radius" is all a
 * badge/filter needs (not the full ranked list CoordinationPanel computes
 * server-side), so distance-within-radius against the already-fetched
 * authorities list (useCoordinationAuthorities, one query for the whole
 * table) replaces what used to be one RPC call per row.
 */
export function authoritiesNear(lng: number, lat: number, authorities: CoordinationAuthority[]): CoordinationAuthority[] {
  return authorities.filter((a) => turf.distance([lng, lat], [a.center_lng, a.center_lat], { units: "kilometers" }) * 1000 <= a.radius_m);
}
