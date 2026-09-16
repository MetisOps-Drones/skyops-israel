"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useMapDrawStore } from "@/stores/useMapDrawStore";
import { useAirspaceCheck } from "@/hooks/useAirspaceCheck";
import { useAirspaceZones } from "@/hooks/useAirspaceZones";
import { useAipReferenceZones } from "@/hooks/useAipReferenceZones";
import { useMyFlightRequests, useAllFlightRequestsForAdmin, type AdminFlightRequest } from "@/hooks/useFlightRequests";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import { useMyGlobalRole } from "@/hooks/useOrgContext";
import {
  AIRSPACE_ZONE_COLORS,
  ISRAEL_MAP_CENTER,
  ISRAEL_MAP_DEFAULT_ZOOM,
} from "@/lib/constants/airspace-zones";
import { AIP_ZONE_KIND_COLORS } from "@/lib/constants/aip-reference-zones";
import { FLIGHT_REQUEST_STATUS_COLORS, FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";
import {
  DEFAULT_MAP_BASE_STYLE,
  DEFAULT_MAP_LAYER_VISIBILITY,
  zoneCategoryOf,
  type MapBaseStyle,
  type MapLayerVisibility,
} from "@/lib/types/map-ui";
import { MapPin, Radar } from "lucide-react";

const MAPBOX_STYLE_URLS: Record<MapBaseStyle, string> = {
  colorful: "mapbox://styles/mapbox/outdoors-v12",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export function BubbleMap({
  flyToTarget,
  layerVisibility = DEFAULT_MAP_LAYER_VISIBILITY,
  baseStyle = DEFAULT_MAP_BASE_STYLE,
  highContrast = false,
  onInspectPoint,
}: {
  flyToTarget?: [number, number] | null;
  layerVisibility?: MapLayerVisibility;
  baseStyle?: MapBaseStyle;
  /** Accessibility override for sunlight readability — always wins over `baseStyle` when on. */
  highContrast?: boolean;
  /** Called for a plain map click while not actively placing a coordination pin — drives LocationInfoCard. */
  onInspectPoint?: (point: [number, number]) => void;
} = {}) {
  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isSizingRadius, setIsSizingRadius] = useState(false);

  const {
    drawMode,
    shapeType,
    center,
    radiusMeters,
    polygon,
    setDrawMode,
    setCenter,
    setRadiusMeters,
    setPolygon,
  } = useMapDrawStore();

  const spatialCheck = useAirspaceCheck();
  const { data: airspaceZones = [] } = useAirspaceZones();
  const { data: aipZones = [] } = useAipReferenceZones();
  const { data: myFlightRequests = [] } = useMyFlightRequests();
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const { data: role } = useMyGlobalRole();
  const isAdmin = role === "dispatcher_admin";
  const { data: allCoordinations = [] } = useAllFlightRequestsForAdmin(isAdmin && layerVisibility.allCoordinations);
  const [selectedCoordinationId, setSelectedCoordinationId] = useState<string | null>(null);

  const airspaceZonesGeojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: airspaceZones
        .filter((zone) => zone.geom_geojson && typeof zone.geom_geojson === "object")
        .filter((zone) => layerVisibility[zoneCategoryOf(zone.type)])
        .map((zone) => ({
          type: "Feature",
          geometry: zone.geom_geojson as unknown as GeoJSON.Geometry,
          properties: { id: zone.id, name: zone.name, type: zone.type, color: AIRSPACE_ZONE_COLORS[zone.type] },
        })),
    }),
    [airspaceZones, layerVisibility]
  );

  /** Only the pilot's own past requests that resolve to a single point — a drawn polygon's shape isn't worth rendering here, this layer is deliberately just "where was I". */
  const historyPoints = useMemo(() => {
    if (!layerVisibility.myHistory) return [];
    return myFlightRequests
      .map((r) => {
        const geom = r.center_point_geojson as unknown as GeoJSON.Point | null;
        if (!geom || geom.type !== "Point") return null;
        return {
          id: r.id,
          point: geom.coordinates as [number, number],
          status: r.status,
          startTime: r.start_time,
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null);
  }, [myFlightRequests, layerVisibility.myHistory]);

  const selectedHistory = historyPoints.find((h) => h.id === selectedHistoryId) ?? null;
  const selectedHistoryCity = useReverseGeocode(selectedHistory?.point ?? null);

  /** Admin-only "control tower" layer: every active/pending request's actual footprint (buffered circle or drawn polygon), colored by status — not just a dot like the personal history layer. */
  const allCoordinationsGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!layerVisibility.allCoordinations) return { type: "FeatureCollection", features: [] };
    return {
      type: "FeatureCollection",
      features: allCoordinations
        .map((r) => {
          const polygonGeom = r.polygon_geojson as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
          const centerGeom = r.center_point_geojson as unknown as GeoJSON.Point | null;
          let geometry: GeoJSON.Geometry | null = null;
          if (polygonGeom) {
            geometry = polygonGeom;
          } else if (centerGeom?.type === "Point") {
            geometry = turf.circle(
              centerGeom.coordinates as [number, number],
              Math.max(r.radius_meters ?? 100, 10) / 1000,
              { units: "kilometers" }
            ).geometry;
          }
          if (!geometry) return null;
          return {
            type: "Feature" as const,
            geometry,
            properties: {
              id: r.id,
              color: FLIGHT_REQUEST_STATUS_COLORS[r.status],
            },
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null),
    };
  }, [allCoordinations, layerVisibility.allCoordinations]);

  const selectedCoordination = allCoordinations.find((r) => r.id === selectedCoordinationId) ?? null;
  const selectedCoordinationCenter = selectedCoordination
    ? ((selectedCoordination.center_point_geojson as unknown as GeoJSON.Point | null)?.coordinates as
        | [number, number]
        | undefined)
    : undefined;

  /** One clickable marker per coordination, at its centroid — the shape itself (rendered via allCoordinationsGeojson) is visual-only, hit-testing a fill layer isn't worth the complexity when a small marker does the same job. */
  const coordinationMarkers = useMemo(() => {
    if (!layerVisibility.allCoordinations) return [];
    return allCoordinations
      .map((r) => {
        const centerGeom = r.center_point_geojson as unknown as GeoJSON.Point | null;
        const polygonGeom = r.polygon_geojson as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
        const point =
          centerGeom?.type === "Point"
            ? (centerGeom.coordinates as [number, number])
            : polygonGeom
              ? (turf.centroid(polygonGeom).geometry.coordinates as [number, number])
              : null;
        if (!point) return null;
        return { id: r.id, point, status: r.status };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [allCoordinations, layerVisibility.allCoordinations]);

  const aipZonesGeojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: aipZones
        .filter((zone) => zone.geom_geojson && typeof zone.geom_geojson === "object")
        .map((zone) => ({
          type: "Feature",
          geometry: zone.geom_geojson as unknown as GeoJSON.Geometry,
          properties: { id: zone.id, name: zone.name, color: AIP_ZONE_KIND_COLORS[zone.kind] },
        })),
    }),
    [aipZones]
  );

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];

      // Plain browsing (not actively placing a coordination pin): every
      // click — on an AIP zone or open ground — inspects that point instead
      // of starting a request, so exploring the map never accidentally
      // starts a draft.
      if (shapeType === "circle" && drawMode === "idle") {
        onInspectPoint?.(point);
        return;
      }

      if (shapeType !== "circle") return;
      if (drawMode === "placing_pin") {
        setCenter(point);
        setDrawMode("sizing_radius");
      }
    },
    [shapeType, drawMode, setCenter, setDrawMode, onInspectPoint]
  );

  const handleMouseDown = useCallback(() => {
    if (shapeType === "circle" && drawMode === "sizing_radius") {
      setIsSizingRadius(true);
    }
  }, [shapeType, drawMode]);

  const handleMouseMove = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!isSizingRadius || !center) return;
      const distanceKm = turf.distance(center, [event.lngLat.lng, event.lngLat.lat], { units: "kilometers" });
      setRadiusMeters(Math.max(10, Math.round(distanceKm * 1000)));
    },
    [isSizingRadius, center, setRadiusMeters]
  );

  const handleMouseUp = useCallback(() => {
    if (isSizingRadius) {
      setIsSizingRadius(false);
      setDrawMode("done");
    }
  }, [isSizingRadius, setDrawMode]);

  // Wire up Mapbox GL Draw for polygon mode (Module A: "or draws a bounding polygon").
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (shapeType !== "polygon") {
      if (drawRef.current) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
      return;
    }

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "draw_polygon",
    });
    drawRef.current = draw;
    map.addControl(draw);

    const updatePolygon = () => {
      const data = draw.getAll();
      const feature = data.features[0];
      if (feature && feature.geometry.type === "Polygon") {
        setPolygon(feature.geometry as GeoJSON.Polygon);
        setDrawMode("done");
      }
    };
    const clearPolygon = () => setPolygon(null);

    // mapbox-gl-draw fires its own custom event names ("draw.create" etc.)
    // that aren't part of mapbox-gl's own MapEventType — cast to a minimal
    // string-keyed interface rather than fighting the upstream types.
    const drawEvents = map as unknown as {
      on: (type: string, listener: () => void) => void;
      off: (type: string, listener: () => void) => void;
    };

    drawEvents.on("draw.create", updatePolygon);
    drawEvents.on("draw.update", updatePolygon);
    drawEvents.on("draw.delete", clearPolygon);

    return () => {
      drawEvents.off("draw.create", updatePolygon);
      drawEvents.off("draw.update", updatePolygon);
      drawEvents.off("draw.delete", clearPolygon);
      if (drawRef.current) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [shapeType, setPolygon, setDrawMode]);

  // Recenters the view when `center` is set programmatically (e.g. when a
  // pin is placed via the "pin airspace for coordination" button) rather
  // than by clicking the map, where the view is already roughly there.
  useEffect(() => {
    if (!center) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 13) });
  }, [center]);

  // Plain "reset map to my current location" — recenters the view only,
  // independent of the flight-request draw state (no pin/marker is placed).
  useEffect(() => {
    if (!flyToTarget) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({ center: flyToTarget, zoom: Math.max(map.getZoom(), 13) });
  }, [flyToTarget]);

  const circleFeature = useMemo(() => {
    if (shapeType !== "circle" || !center) return null;
    return turf.circle(center, Math.max(radiusMeters, 10) / 1000, { units: "kilometers" });
  }, [shapeType, center, radiusMeters]);

  const clearanceColor = spatialCheck?.clear ? "#16a34a" : "#dc2626";

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: ISRAEL_MAP_CENTER[0],
          latitude: ISRAEL_MAP_CENTER[1],
          zoom: ISRAEL_MAP_DEFAULT_ZOOM,
        }}
        mapStyle={highContrast ? MAPBOX_STYLE_URLS.colorful : MAPBOX_STYLE_URLS[baseStyle]}
        onClick={handleMapClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        cursor={shapeType === "circle" && drawMode !== "done" ? "crosshair" : "default"}
      >
        <NavigationControl position="top-left" />

        <Source id="airspace-zones" type="geojson" data={airspaceZonesGeojson}>
          <Layer
            id="airspace-zones-fill"
            type="fill"
            paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.18 }}
          />
          <Layer
            id="airspace-zones-line"
            type="line"
            paint={{ "line-color": ["get", "color"], "line-width": 1 }}
          />
        </Source>

        {layerVisibility.aipReference && (
          <Source id="aip-reference-zones" type="geojson" data={aipZonesGeojson}>
            <Layer
              id="aip-reference-zones-fill"
              type="fill"
              paint={{
                "fill-color": ["get", "color"],
                "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.12, 10, 0.2, 14, 0.3],
              }}
            />
            <Layer
              id="aip-reference-zones-line"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 10, 1.75, 14, 2.5],
                "line-dasharray": [3, 2],
              }}
            />
            <Layer
              id="aip-reference-zones-label"
              type="symbol"
              minzoom={9}
              layout={{
                "text-field": ["get", "name"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 14, 13],
                "text-allow-overlap": false,
                "symbol-placement": "point",
              }}
              paint={{
                "text-color": ["get", "color"],
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.4,
              }}
            />
          </Source>
        )}

        {layerVisibility.buildings && process.env.NEXT_PUBLIC_R2_PUBLIC_URL && (
          <Source
            id="buildings"
            type="vector"
            tiles={[`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/buildings/{z}/{x}/{y}.pbf`]}
            minzoom={14}
            maxzoom={15}
          >
            <Layer
              id="buildings-fill"
              type="fill"
              source-layer="buildings"
              minzoom={14}
              paint={{ "fill-color": "#8b8478", "fill-opacity": 0.5 }}
            />
            <Layer
              id="buildings-line"
              type="line"
              source-layer="buildings"
              minzoom={14}
              paint={{ "line-color": "#6b645a", "line-width": 0.75 }}
            />
          </Source>
        )}

        {layerVisibility.allCoordinations && (
          <Source id="all-coordinations" type="geojson" data={allCoordinationsGeojson}>
            <Layer
              id="all-coordinations-fill"
              type="fill"
              paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.15 }}
            />
            <Layer
              id="all-coordinations-line"
              type="line"
              paint={{ "line-color": ["get", "color"], "line-width": 1.5, "line-dasharray": [2, 1.5] }}
            />
          </Source>
        )}

        {coordinationMarkers.map((m) => (
          <Marker
            key={m.id}
            longitude={m.point[0]}
            latitude={m.point[1]}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedCoordinationId(m.id);
            }}
          >
            <button
              type="button"
              aria-label={FLIGHT_REQUEST_STATUS_LABELS[m.status]}
              className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow"
              style={{ backgroundColor: FLIGHT_REQUEST_STATUS_COLORS[m.status] }}
            >
              <Radar className="h-3 w-3 text-white" />
            </button>
          </Marker>
        ))}

        {selectedCoordination && selectedCoordinationCenter && (
          <Popup
            longitude={selectedCoordinationCenter[0]}
            latitude={selectedCoordinationCenter[1]}
            anchor="bottom"
            offset={12}
            closeButton
            onClose={() => setSelectedCoordinationId(null)}
          >
            <div className="flex flex-col gap-0.5 text-xs">
              <p className="font-semibold">{selectedCoordination.profiles?.full_name ?? "—"}</p>
              {selectedCoordination.profiles?.organizations?.name && (
                <p className="text-muted-foreground">{selectedCoordination.profiles.organizations.name}</p>
              )}
              <p>{FLIGHT_REQUEST_STATUS_LABELS[selectedCoordination.status]}</p>
              <p className="whitespace-nowrap" dir="ltr">
                {new Date(selectedCoordination.start_time).toLocaleString("he-IL")} –{" "}
                {new Date(selectedCoordination.end_time).toLocaleString("he-IL")}
              </p>
            </div>
          </Popup>
        )}

        {circleFeature && (
          <Source id="flight-bubble" type="geojson" data={circleFeature}>
            <Layer
              id="flight-bubble-fill"
              type="fill"
              paint={{ "fill-color": clearanceColor, "fill-opacity": 0.25 }}
            />
            <Layer
              id="flight-bubble-line"
              type="line"
              paint={{ "line-color": clearanceColor, "line-width": 2 }}
            />
          </Source>
        )}

        {shapeType === "polygon" && polygon && (
          <Source id="flight-polygon-preview" type="geojson" data={turf.feature(polygon)}>
            <Layer
              id="flight-polygon-fill"
              type="fill"
              paint={{ "fill-color": clearanceColor, "fill-opacity": 0.25 }}
            />
          </Source>
        )}

        {center && shapeType === "circle" && (
          <Marker longitude={center[0]} latitude={center[1]} anchor="bottom">
            <MapPin className="h-7 w-7 text-primary drop-shadow" fill="currentColor" />
          </Marker>
        )}

        {historyPoints.map((h) => (
          <Marker
            key={h.id}
            longitude={h.point[0]}
            latitude={h.point[1]}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedHistoryId(h.id);
            }}
          >
            <button
              type="button"
              aria-label={FLIGHT_REQUEST_STATUS_LABELS[h.status]}
              className="h-3.5 w-3.5 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: FLIGHT_REQUEST_STATUS_COLORS[h.status] }}
            />
          </Marker>
        ))}

        {selectedHistory && (
          <Popup
            longitude={selectedHistory.point[0]}
            latitude={selectedHistory.point[1]}
            anchor="bottom"
            offset={12}
            closeButton
            onClose={() => setSelectedHistoryId(null)}
          >
            <p className="whitespace-nowrap text-xs font-medium">
              {FLIGHT_REQUEST_STATUS_LABELS[selectedHistory.status]}
              {selectedHistoryCity.data ? ` · ${selectedHistoryCity.data}` : ""}
              {" · "}
              {new Date(selectedHistory.startTime).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
            </p>
          </Popup>
        )}
      </Map>

      {shapeType === "circle" && drawMode === "idle" && (
        <div className="pointer-events-none absolute inset-x-0 top-28 mx-auto w-fit rounded-full bg-card/95 px-4 py-2 text-sm font-medium shadow">
          לחצו על המפה למידע על האזור
        </div>
      )}
      {shapeType === "circle" && drawMode === "placing_pin" && (
        <div className="pointer-events-none absolute inset-x-0 top-28 mx-auto w-fit rounded-full bg-card/95 px-4 py-2 text-sm font-medium shadow">
          לחץ על המפה כדי להציב סיכת מיקום
        </div>
      )}
      {shapeType === "circle" && drawMode === "sizing_radius" && (
        <div className="pointer-events-none absolute inset-x-0 top-28 mx-auto w-fit rounded-full bg-card/95 px-4 py-2 text-sm font-medium shadow">
          גרור על המפה כדי להגדיר רדיוס — {radiusMeters} מ׳
        </div>
      )}
    </div>
  );
}
