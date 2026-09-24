"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, Marker, type MapRef } from "react-map-gl";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePendingCoordinationRequests, type FlightRequestWithRelations } from "@/hooks/useFlightRequests";
import { urgencyHours, urgencyTier, URGENCY_COLOR, URGENCY_LABEL } from "@/lib/coordination/urgency";
import { ISRAEL_MAP_CENTER, ISRAEL_MAP_DEFAULT_ZOOM } from "@/lib/constants/airspace-zones";
import { cn } from "@/lib/utils";

function requestGeometry(request: FlightRequestWithRelations): GeoJSON.Geometry | null {
  const polygonGeojson = request.polygon_geojson as unknown as GeoJSON.MultiPolygon | null;
  if (request.request_type === "manual_notam_bubble" && polygonGeojson) {
    return polygonGeojson;
  }
  const point = request.center_point_geojson as unknown as GeoJSON.Point | null;
  if (!point || point.type !== "Point") return null;
  return turf.circle(point.coordinates as [number, number], Math.max(request.radius_meters ?? 100, 10) / 1000, {
    units: "kilometers",
  }).geometry;
}

function requestCentroid(request: FlightRequestWithRelations): [number, number] | null {
  const point = request.center_point_geojson as unknown as GeoJSON.Point | null;
  if (point?.type === "Point") return point.coordinates as [number, number];
  const geometry = requestGeometry(request);
  return geometry ? (turf.centroid(geometry).geometry.coordinates as [number, number]) : null;
}

/**
 * "Where is everything, at a glance" for the pending queue — the one thing
 * the flat table (PendingRequestsTable) can never give a dispatcher without
 * opening each request one at a time. Deliberately its own small read-only
 * map rather than reusing the full BubbleMap: that component carries a
 * whole draw/base-style/buildings toolkit built for the pilot-facing
 * request flow, none of which belongs here. Shapes are colored by urgency
 * (not status — everything in this queue is pending by definition, so
 * urgency is the signal that actually matters), using the exact same
 * cutoffs and colors as the table's own urgency badge (src/lib/coordination
 * /urgency.ts) so the two never disagree.
 */
export function OpsQueueMap({
  selectedId,
  onSelect,
}: {
  selectedId?: string | null;
  onSelect: (request: FlightRequestWithRelations) => void;
}) {
  const { data: requests = [] } = usePendingCoordinationRequests();
  const mapRef = useRef<MapRef | null>(null);

  const featureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: requests
        .map((r) => {
          const geometry = requestGeometry(r);
          if (!geometry) return null;
          const tier = urgencyTier(urgencyHours(r));
          return {
            type: "Feature" as const,
            geometry,
            properties: { id: r.id, color: URGENCY_COLOR[tier], selected: r.id === selectedId },
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null),
    };
  }, [requests, selectedId]);

  const markers = useMemo(
    () =>
      requests
        .map((r) => {
          const point = requestCentroid(r);
          if (!point) return null;
          const tier = urgencyTier(urgencyHours(r));
          return { id: r.id, point, tier, request: r };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null),
    [requests]
  );

  // Frames the whole queue whenever the set of pending requests changes, so
  // opening /ops always shows every one of them at once without manual
  // panning — deliberately keyed off `markers` (not `selectedId`), so
  // clicking a marker to open its drawer never yanks the view around.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || markers.length === 0) return;
    const [first] = markers;
    if (markers.length === 1 && first) {
      map.flyTo({ center: first.point, zoom: 11, duration: 500 });
      return;
    }
    const bbox = turf.bbox({ type: "FeatureCollection", features: markers.map((m) => turf.point(m.point)) });
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 48, maxZoom: 12, duration: 500 }
    );
  }, [markers]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-lg border sm:h-80">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: ISRAEL_MAP_CENTER[0],
          latitude: ISRAEL_MAP_CENTER[1],
          zoom: ISRAEL_MAP_DEFAULT_ZOOM,
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        cursor="pointer"
      >
        <Source id="ops-queue" type="geojson" data={featureCollection}>
          <Layer id="ops-queue-fill" type="fill" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.2 }} />
          <Layer
            id="ops-queue-line"
            type="line"
            paint={{
              "line-color": ["get", "color"],
              "line-width": ["case", ["get", "selected"], 3, 1.5],
            }}
          />
        </Source>

        {markers.map((m) => (
          <Marker key={m.id} longitude={m.point[0]} latitude={m.point[1]} anchor="center">
            <button
              type="button"
              aria-label={`${URGENCY_LABEL[m.tier]} — ${m.request.profiles?.full_name ?? "בקשת תיאום"}`}
              title={m.request.profiles?.full_name ?? undefined}
              onClick={() => onSelect(m.request)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow transition-transform hover:scale-125",
                m.id === selectedId && "ring-2 ring-foreground ring-offset-1"
              )}
              style={{ backgroundColor: URGENCY_COLOR[m.tier] }}
            />
          </Marker>
        ))}
      </Map>

      {requests.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-card/80 text-sm text-muted-foreground">
          אין בקשות ממתינות להצגה על המפה
        </div>
      )}
    </div>
  );
}
