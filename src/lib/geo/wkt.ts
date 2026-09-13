/**
 * Minimal GeoJSON -> WKT converter for the handful of geometry types this
 * app writes to Postgres via PostgREST (`flight_requests.center_point` /
 * `.polygon`).
 *
 * PostgREST has no cast from a JSON object to PostGIS's `geometry` column
 * type, but PostGIS *does* register an implicit cast from `text` in WKT
 * format — so geometry values are sent as WKT strings on insert/update
 * rather than as raw GeoJSON objects. (Reads go the other way: PostgREST
 * returns geometry columns as GeoJSON automatically when queried with
 * `st_asgeojson`, or as WKB hex by default — this app selects `*` and
 * relies on Postgres/PostGIS's default GeoJSON-compatible representation
 * configured via the column's `geometry` type combined with PostgREST's
 * automatic detection of PostGIS columns.)
 */
export function pointToWKT([lng, lat]: [number, number]): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

function ringToWKT(ring: number[][]): string {
  return `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`;
}

export function polygonToWKT(coordinates: number[][][]): string {
  return `SRID=4326;POLYGON(${coordinates.map(ringToWKT).join(", ")})`;
}

export function multiPolygonToWKT(coordinates: number[][][][]): string {
  return `SRID=4326;MULTIPOLYGON(${coordinates.map((poly) => `(${poly.map(ringToWKT).join(", ")})`).join(", ")})`;
}
